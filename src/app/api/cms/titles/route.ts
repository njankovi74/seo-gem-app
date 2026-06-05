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
import { validateTitleLanguage } from '@/lib/language-validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // Authenticate
  const auth = authenticateCmsRequest(request);
  if (!auth.valid) {
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

    const text = (lead ? lead + '\n\n' : '') + articleBody;
    const effectiveTitle = title || '';
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

    // Fetch Google Suggest for primary keyword (runs after we know the keyword)
    const googleSuggestions = await getGoogleSuggestions(primaryKW, language);

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

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const isThinkingModel = modelName.includes('2.5');
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
    return cmsErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500, origin
    );
  }
}
