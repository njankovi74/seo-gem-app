import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateCmsRequest, corsHeaders, cmsErrorResponse } from '@/lib/cms-auth';
import { getSimilarTitleExamples, analyzePattern, type TitleOption } from '@/lib/title-history';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { prioritizeKeywords } from '@/lib/keyword-prioritizer';
import { type SupportedLanguage, isValidLanguage } from '@/lib/i18n';
import { getTitlesPrompt } from '@/lib/prompts/titles-prompt';

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
    const language: SupportedLanguage = (reqLang && isValidLanguage(reqLang)) ? reqLang : 'sr';

    if (!articleBody || articleBody.trim().length < 100) {
      return cmsErrorResponse('Tekst članka mora imati najmanje 100 karaktera.', 400, origin);
    }

    const text = (lead ? lead + '\n\n' : '') + articleBody;
    const effectiveTitle = title || '';
    const fullText = effectiveTitle ? `${effectiveTitle}. ${text}` : text;

    console.log(`🏢 [CMS/titles] Portal: ${auth.portalId}, lang: ${language}, title: "${effectiveTitle.substring(0, 50)}...", text: ${text.length} chars`);

    // Run analysis + RAG fetch IN PARALLEL for latency optimization
    const tfidfAnalyzer = new TFIDFAnalyzer(language);
    const lsaAnalyzer = new LSAAnalyzer(language);

    // CPU-bound analysis (sync) + DB query (async) run concurrently
    const ragPromise = getSimilarTitleExamples(text, 5, auth.portalId);

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

    // Await RAG results (likely already resolved during CPU analysis)
    const similarExamples = await ragPromise;
    const preferredPattern = analyzePattern(similarExamples, language);

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

    console.log(`✅ [CMS/titles] Generated ${titles.length} titles for ${auth.portalId}`);

    return NextResponse.json({
      success: true,
      titles,
      usedRAG: similarExamples.length > 0,
    }, { headers });

  } catch (error) {
    console.error('❌ [CMS/titles] Error:', error);
    return cmsErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500, origin
    );
  }
}
