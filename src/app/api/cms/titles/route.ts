import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateCmsRequest, corsHeaders, cmsErrorResponse } from '@/lib/cms-auth';
import { getSimilarTitleExamples, analyzePattern, analyzeStylePatterns, type TitleOption } from '@/lib/title-history';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { prioritizeKeywords } from '@/lib/keyword-prioritizer';
import { type SupportedLanguage, isValidLanguage } from '@/lib/i18n';
import { getTitlesPrompt } from '@/lib/prompts/titles-prompt';
import { getGoogleSuggestions } from '@/lib/google-suggest';
import { getRelevantSuggestions } from '@/lib/suggest-queries';
import { factCheckTitles } from '@/lib/title-factcheck';
import { validateTitleLanguage } from '@/lib/language-validator';
import { logGeneration, startTimer } from '@/lib/generation-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // generation + fact check + guard rewrite

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // Start latency timer
  const timer = startTimer();

  // Authenticate
  const auth = authenticateCmsRequest(request);
  if (!auth.valid) {
    await logGeneration({ portal_id: 'unknown', endpoint: 'titles', status: 'error', latency_ms: timer(), error_message: auth.error || 'Unauthorized', error_type: 'auth_error' });
    return cmsErrorResponse(auth.error || 'Unauthorized', 401, origin);
  }

  try {
    const body = await request.json();
    const { title, body: articleBody, lead, language: reqLang } = body;

    // Language resolution: request param > portal-based fallback > 'sr'
    const portalLangMap: Record<string, SupportedLanguage> = {
      newsmax_al: 'sq',
      newsmax_pl: 'pl',
      newsmax_en: 'en',
      newsmax: 'sr',
    };
    const portalLang = auth.portalId ? portalLangMap[auth.portalId] : undefined;
    const language: SupportedLanguage = (reqLang && isValidLanguage(reqLang))
      ? reqLang
      : portalLang || 'sr';

    if (!articleBody || articleBody.trim().length < 100) {
      return cmsErrorResponse('Tekst članka mora imati najmanje 100 karaktera.', 400, origin);
    }

    // NFC: some CMS texts contain decomposed letters (c + ́), which break tokenization and matching
    const text = ((lead ? lead + '\n\n' : '') + articleBody).normalize('NFC');
    const effectiveTitle = (title || '').normalize('NFC');
    const fullText = effectiveTitle ? `${effectiveTitle}. ${text}` : text;

    console.log(`🏢 [CMS/titles] Portal: ${auth.portalId}, lang: ${language}, title: "${effectiveTitle.substring(0, 50)}...", text: ${text.length} chars`);

    // Run analysis + RAG + Google Suggest + Style Analysis IN PARALLEL
    const tfidfAnalyzer = new TFIDFAnalyzer(language);
    const lsaAnalyzer = new LSAAnalyzer(language);

    // Launch ALL async operations concurrently
    const ragPromise = getSimilarTitleExamples(text, 5, auth.portalId);
    const stylePromise = analyzeStylePatterns(auth.portalId!, language);

    const tfidfAnalysis = tfidfAnalyzer.analyze(fullText);
    const lsaAnalysis = lsaAnalyzer.analyzeSemantics(fullText);
    const searchIntent = lsaAnalyzer.classifySearchIntent(fullText, tfidfAnalysis.semanticCore);

    let mainTopics = lsaAnalysis.topicClusters.map((c: any) => c.name);
    if (mainTopics.length === 0 && tfidfAnalysis.semanticCore.length > 0) {
      mainTopics = tfidfAnalysis.semanticCore.slice(0, 5).map((t: any) => t.word).filter((w: string) => w.length > 3);
    }

    // Prioritize keywords
    const prioritized = prioritizeKeywords(text, tfidfAnalysis, lsaAnalysis, searchIntent, language);
    const primaryKW = prioritized[0]?.term || '';
    const secondaryKWs = prioritized.slice(1, 6).map(p => p.term);

    // Await all async results (likely already resolved during CPU analysis)
    const [similarExamples, styleAnalysis] = await Promise.all([ragPromise, stylePromise]);
    const preferredPattern = analyzePattern(similarExamples, language);

    // Google Suggest:
    // - sr: smart pipeline — 2–4 word queries from the article + relevance filter (no single-word noise)
    // - other languages: legacy single primary keyword (to be adapted later)
    const googleSuggestions = language === 'sr'
      ? (await getRelevantSuggestions(fullText, effectiveTitle, language)).suggestions
      : await getGoogleSuggestions(primaryKW, language);

    // Build few-shot examples with language-aware labels
    const ragLabels: Record<string, { header: string; example: string; textLabel: string; offered: string; selected: string }> = {
      sr: { header: 'PRETHODNI IZBORI NOVINARA (slični članci)', example: 'PRIMER', textLabel: 'Tekst', offered: 'Ponuđeni', selected: 'ODABRAN' },
      en: { header: 'PREVIOUS EDITOR CHOICES (similar articles)', example: 'EXAMPLE', textLabel: 'Text', offered: 'Offered', selected: 'SELECTED' },
      pl: { header: 'POPRZEDNIE WYBORY REDAKTORA (podobne artykuły)', example: 'PRZYKŁAD', textLabel: 'Tekst', offered: 'Zaproponowane', selected: 'WYBRANY' },
      sq: { header: 'ZGJEDHJET E MËPARSHME TË REDAKTORIT (artikuj të ngjashëm)', example: 'SHEMBULL', textLabel: 'Teksti', offered: 'Të ofruara', selected: 'I ZGJEDHUR' },
    };
    const labels = ragLabels[language] || ragLabels.sr;

    const fewShotExamples = similarExamples.length > 0
      ? `\n\n**${labels.header}:**\n\n${similarExamples
          .map(
            (ex, i) => `${labels.example} ${i + 1}:
${labels.textLabel}: "${ex.article_text.substring(0, 150)}..."
${labels.offered}:
${ex.offered_titles.map((t: any, j: number) => `  ${j + 1}. ${t?.text || 'N/A'}`).join('\n')}
✅ ${labels.selected}: "${ex.selected_title}"
`
          )
          .join('\n')}\n`
      : '';

    // Generate title prompt using i18n-aware prompt builder
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const prompt = getTitlesPrompt(language, {
      primaryKW,
      secondaryKWs,
      mainTopics,
      searchIntentType: searchIntent.type,
      text,
      fewShotExamples: fewShotExamples || undefined,
      preferredPattern: preferredPattern || undefined,
      googleSuggestions: googleSuggestions.length > 0 ? googleSuggestions : undefined,
      styleAnalysis: styleAnalysis || undefined,
    });

    // Serbian titles use the model chosen after the Oct 2026 comparison (3.8 Flash);
    // other languages stay on GEMINI_MODEL until they are tested and adapted.
    const modelName = (language === 'sr' ? (process.env.TITLES_MODEL_SR || 'gemini-3.8-flash') : '')
      || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const isThinkingModel = modelName.includes('2.5') || modelName.startsWith('gemini-3');
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.6,
        responseMimeType: 'application/json',
        // Limit thinking budget to reduce latency while preserving output quality
        ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 4096 } } : {}),
      } as any,
    });

    // Retry up to 2 times on JSON parse failure
    let titles: TitleOption[] | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        console.log(`📈 [Usage/titles] model=${modelName}`, JSON.stringify(result.response.usageMetadata || {}));
        const responseText = result.response.text();

        // Parse JSON — strip markdown fences if present
        const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Try to extract JSON object if there's extra text before/after
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText);
        titles = parsed.titles;

        if (!Array.isArray(titles) || titles.length < 3) {
          throw new Error(`Expected 6 titles, got ${titles?.length || 0}`);
        }
        break; // success
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(`⚠️ [CMS/titles] Attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < 2) {
          console.log('🔄 [CMS/titles] Retrying...');
        }
      }
    }

    if (!titles) {
      throw lastError || new Error('Failed to generate titles');
    }

    // Fix lengths
    titles.forEach(t => { t.length = t.text.length; });

    // === FACT CHECK (sr): verify each title against the article; replace only factually wrong ones ===
    if (language === 'sr' && process.env.FACTCHECK_DISABLED !== 'true') {
      const fc = await factCheckTitles(genAI, titles, text);
      console.log(`📈 [Usage/titles-factcheck] model=${fc.model}`, JSON.stringify(fc.usage || {}));
      const bad = fc.results.filter((r) => r.ok === false);
      console.log(`🔎 [FactCheck] checked=${fc.checked} flagged=${bad.map((r) => `#${r.i}: ${r.problem}`).join(' | ') || 'none'} replaced=${fc.replaced.join(',') || 'none'}`);
    }

    // === TITLE GUARD (sr): colon allowed only in option 6, max 70 chars — rewrite offenders ===
    // LLMs do not count characters reliably, so length and colon rules are enforced in code.
    if (language === 'sr') {
      // Deterministic punctuation fixes: no trailing period; question words end with "?"
      const QUESTION_START = /^(zašto|kako|šta|ko|koji|koja|koje|kada|gde|da li|koliko|čime|čemu|može li|hoće li|ima li)\b/i;
      titles.forEach((t) => {
        let txt = t.text.trim();
        if (/[^.]\.$/.test(txt)) txt = txt.slice(0, -1).trim();
        if (QUESTION_START.test(txt) && !/[?!]$/.test(txt)) txt = txt + '?';
        if (txt !== t.text) { t.text = txt; t.length = txt.length; }
      });

      const MAX_LEN = 70;
      const offending = titles
        .map((t, i) => ({ t, i, colon: i < 5 && t.text.includes(':'), long: t.text.length > MAX_LEN, question: i < 2 && /\?$/.test(t.text) }))
        .filter((o) => o.colon || o.long || o.question);
      if (offending.length > 0) {
        console.warn(`⚠️ [CMS/titles] Guard: ${offending.map(o => `#${o.i + 1}${o.colon ? ' dvotačka' : ''}${o.long ? ` ${o.t.text.length} znakova` : ''}${o.question ? ' pitanje u informativnom' : ''}`).join(', ')} — rewriting`);
        try {
          const fixModel = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
              ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 512 } } : {}),
            } as any,
          });
          const fixPrompt = `Prepravi sledeće novinarske naslove prema napomeni u zagradi. Zadrži iste činjenice i isti smisao i ne dodaj ništa čega nema u originalu.
- [BEZ DVOTAČKE]: fluidna rečenica (ili pitanje, ako je original pitanje), bez dvotačke (:).
- [IZJAVNA REČENICA]: preformuliši u izjavnu rečenicu (NE pitanje) sa istom činjenicom.
- [SKRATI]: najviše ${MAX_LEN} karaktera. Skraćuj inteligentno: izbaci suvišne reči, koristi ustaljene skraćenice stranaka i institucija (npr. NDSS, SNS, RIK, MUP), ne seci rečenicu i ne gubi ključnu činjenicu.
Bez tačke na kraju, pravilan srpski jezik (latinica).
Vrati isključivo JSON: {"titles": ["...", "..."]} istim redom.

${offending.map((o, k) => `${k + 1}. [${[o.colon ? 'BEZ DVOTAČKE' : '', o.question ? 'IZJAVNA REČENICA' : '', o.long ? 'SKRATI' : ''].filter(Boolean).join(', ')}] ${o.t.text}`).join('\n')}`;
          const fixResult = await fixModel.generateContent(fixPrompt);
          console.log(`📈 [Usage/titles-guard] model=${modelName}`, JSON.stringify(fixResult.response.usageMetadata || {}));
          const fixText = fixResult.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const fixMatch = fixText.match(/\{[\s\S]*\}/);
          const fixed: string[] = JSON.parse(fixMatch ? fixMatch[0] : fixText).titles || [];
          offending.forEach((o, k) => {
            const f = (fixed[k] || '').trim().replace(/\.$/, '');
            const colonOk = !o.colon || !f.includes(':');
            const statementOk = !o.question || !f.endsWith('?');
            if (f && colonOk && statementOk && f.length <= MAX_LEN) {
              titles![o.i].text = f;
              titles![o.i].length = f.length;
            } else {
              console.warn(`⚠️ [CMS/titles] Guard rewrite rejected for #${o.i + 1}: "${f}" (${f.length})`);
            }
          });
        } catch (fixError) {
          console.error('⚠️ [CMS/titles] Guard rewrite failed (keeping originals):', fixError);
        }
      }
    }

    // === LANGUAGE VALIDATION ===
    const langCheck = await validateTitleLanguage(
      titles.map(t => t.text),
      language
    );

    if (!langCheck.isMatch && langCheck.confidence !== 'undetermined') {
      console.warn(`⚠️ [CMS/titles] Language mismatch! Expected: ${language}, Got: ${langCheck.detected}. Retrying with enforcement...`);

      // Language enforcement labels
      const langEnforce: Record<string, string> = {
        sr: '\n\n⚠️ KRITIČNO: Svi naslovi MORAJU biti na SRPSKOM jeziku. Piši ISKLJUČIVO na srpskom.',
        pl: '\n\n⚠️ KRYTYCZNE: Wszystkie tytuły MUSZĄ być w języku POLSKIM. Pisz WYŁĄCZNIE po polsku.',
        sq: '\n\n⚠️ KRITIKE: Të gjithë titujt DUHET të jenë në gjuhën SHQIPE. Shkruani VETËM në shqip.',
        en: '\n\n⚠️ CRITICAL: All titles MUST be in ENGLISH. Write EXCLUSIVELY in English.',
      };

      const enforcedPrompt = prompt + (langEnforce[language] || langEnforce.sr);

      // Retry with enforced language
      try {
        const retryResult = await model.generateContent(enforcedPrompt);
        const retryText = retryResult.response.text();
        const retryCleaned = retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const retryJsonMatch = retryCleaned.match(/\{[\s\S]*\}/);
        const retryParsed = JSON.parse(retryJsonMatch ? retryJsonMatch[0] : retryCleaned);
        const retryTitles = retryParsed.titles as TitleOption[];

        if (Array.isArray(retryTitles) && retryTitles.length >= 3) {
          retryTitles.forEach(t => { t.length = t.text.length; });

          // Validate retry result
          const retryCheck = await validateTitleLanguage(
            retryTitles.map(t => t.text),
            language
          );

          if (retryCheck.isMatch || retryCheck.confidence === 'undetermined') {
            console.log(`✅ [CMS/titles] Retry succeeded — language now correct`);
            titles = retryTitles;
          } else {
            // Both attempts failed — return error
            console.error(`❌ [CMS/titles] Retry also produced wrong language (${retryCheck.detected}). Blocking response.`);
            return cmsErrorResponse(
              `Language generation error: expected ${language}, got ${retryCheck.detected}. Please try again.`,
              422, origin
            );
          }
        }
      } catch (retryError) {
        console.error('❌ [CMS/titles] Language retry failed:', retryError);
        return cmsErrorResponse(
          `Language validation failed. Please try again.`,
          422, origin
        );
      }
    }

    console.log(`✅ [CMS/titles] Generated ${titles.length} titles for ${auth.portalId} (lang: ${language}, validated: ${langCheck.isMatch ? 'pass' : 'retry-pass'})`);

    // Log successful generation (fire-and-forget)
    const styleBreakdown: Record<string, number> = {};
    titles.forEach(t => { styleBreakdown[t.style] = (styleBreakdown[t.style] || 0) + 1; });
    await logGeneration({
      portal_id: auth.portalId!,
      endpoint: 'titles',
      status: 'success',
      article_url: body.articleUrl || body.url || undefined,
      titles_count: titles.length,
      style_breakdown: styleBreakdown,
      model_used: modelName,
      latency_ms: timer(),
      language,
      rag_used: similarExamples.length > 0,
      rag_examples_count: similarExamples.length,
      google_suggestions_count: googleSuggestions.length,
      primary_keyword: primaryKW || undefined,
    });

    return NextResponse.json({
      success: true,
      titles,
      usedRAG: similarExamples.length > 0,
      languageValidation: {
        expected: langCheck.expected,
        detected: langCheck.detected,
        validated: true,
      },
    }, { headers });

  } catch (error) {
    console.error('❌ [CMS/titles] Error:', error);
    await logGeneration({
      portal_id: auth.portalId || 'unknown',
      endpoint: 'titles',
      status: 'error',
      latency_ms: timer(),
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error && error.message.includes('timeout') ? 'llm_timeout' : 'server_error',
    });
    return cmsErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500, origin
    );
  }
}
