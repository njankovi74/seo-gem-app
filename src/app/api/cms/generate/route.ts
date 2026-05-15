import { NextRequest, NextResponse } from 'next/server';
import { authenticateCmsRequest, corsHeaders, cmsErrorResponse } from '@/lib/cms-auth';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { buildDeterministicSEO, buildSEOWithLLM } from '@/lib/seo-output';
import { prioritizeKeywords } from '@/lib/keyword-prioritizer';
import { saveTitleChoice } from '@/lib/title-history';
import { type SupportedLanguage, isValidLanguage } from '@/lib/i18n';

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
    const { title, selectedTitle, body: articleBody, lead, articleUrl, offeredTitles, language: reqLang } = body;
    const language: SupportedLanguage = (reqLang && isValidLanguage(reqLang)) ? reqLang : 'sr';

    if (!selectedTitle || !selectedTitle.trim()) {
      return cmsErrorResponse('selectedTitle je obavezan.', 400, origin);
    }

    if (!articleBody || articleBody.trim().length < 100) {
      return cmsErrorResponse('Tekst članka mora imati najmanje 100 karaktera.', 400, origin);
    }

    const text = (lead ? lead + '\n\n' : '') + articleBody;
    const effectiveTitle = title || selectedTitle;
    const fullText = `${effectiveTitle}. ${text}`;

    console.log(`🏢 [CMS/generate] Portal: ${auth.portalId}, lang: ${language}, selectedTitle: "${selectedTitle.substring(0, 50)}..."`);

    // TF-IDF + LSA for keyword extraction with language config
    const tfidfAnalyzer = new TFIDFAnalyzer(language);
    const lsaAnalyzer = new LSAAnalyzer(language);

    const tfidfAnalysis = tfidfAnalyzer.analyze(fullText);
    const lsaAnalysis = lsaAnalyzer.analyzeSemantics(fullText);
    const searchIntent = lsaAnalyzer.classifySearchIntent(fullText, tfidfAnalysis.semanticCore);

    let mainTopics = lsaAnalysis.topicClusters.map((c: any) => c.name);
    if (mainTopics.length === 0 && tfidfAnalysis.semanticCore.length > 0) {
      mainTopics = tfidfAnalysis.semanticCore.slice(0, 5).map((t: any) => t.word).filter((w: string) => w.length > 3);
    }

    const prioritized = prioritizeKeywords(text, tfidfAnalysis, lsaAnalysis, searchIntent, language);

    // Build deterministic SEO as fallback
    const deterministicSEO = buildDeterministicSEO({
      title: selectedTitle,
      keyTerms: prioritized.map(p => p.term),
      mainTopics,
      searchIntentType: searchIntent.type,
    }, text);

    deterministicSEO.title = selectedTitle;

    // LLM generation (meta desc + keywords + schema)
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const strictModel = (process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true';

    let seoOutputs: typeof deterministicSEO | null = null;
    let llmFailed = false;
    try {
      const llmResult = await buildSEOWithLLM(
        deterministicSEO,
        {
          documentTitle: selectedTitle,
          keyTerms: prioritized.map(p => p.term),
          mainTopics,
          searchIntentType: searchIntent.type,
          textSample: text,
          articleUrl: articleUrl || '',
          articleMetadata: {},
        },
        { model, strictModel, skipTitleGeneration: true },
        language
      );

      // Check if LLM actually generated content or just returned the deterministic fallback
      if (llmResult && llmResult.metaDescription && llmResult.metaDescription !== deterministicSEO.metaDescription) {
        llmResult.title = selectedTitle; // Preserve selected title
        seoOutputs = llmResult;
      } else {
        // LLM returned but output is the same as fallback template — treat as failure
        console.warn('⚠️ [CMS/generate] LLM returned deterministic fallback content, treating as failure');
        llmFailed = true;
      }
    } catch (llmError: any) {
      console.error('⚠️ [CMS/generate] LLM failed:', llmError?.message);
      llmFailed = true;
    }

    // Only save to Supabase when LLM succeeded (don't pollute DB with empty/bad data)
    if (seoOutputs && !llmFailed) {
      try {
        await saveTitleChoice({
          articleUrl: articleUrl || '',
          articleText: text.substring(0, 5000),
          offeredTitles: offeredTitles || [],
          selectedTitle,
          selectionType: 'custom',
          metaDescription: seoOutputs.metaDescription,
          keywords: seoOutputs.keywordsLine,
          portalId: auth.portalId,
        });
        console.log(`✅ [CMS/generate] Saved to Supabase for portal: ${auth.portalId}`);
      } catch (saveError) {
        console.error('⚠️ [CMS/generate] Supabase save failed (non-blocking):', saveError);
      }
    }

    if (llmFailed) {
      console.warn(`⚠️ [CMS/generate] LLM failed for ${auth.portalId}, returning empty fields`);
    } else {
      console.log(`✅ [CMS/generate] Done for ${auth.portalId}`);
    }

    return NextResponse.json({
      success: true,
      llmFailed,
      seoTitle: selectedTitle,
      metaDescription: llmFailed ? '' : (seoOutputs?.metaDescription || ''),
      keywords: llmFailed ? '' : (seoOutputs?.keywordsLine || ''),
      schemaMarkup: llmFailed ? '' : (seoOutputs?.schemaMarkup || ''),
    }, { headers });

  } catch (error) {
    console.error('❌ [CMS/generate] Error:', error);
    return cmsErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500, origin
    );
  }
}
