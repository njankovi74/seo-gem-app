import { NextRequest, NextResponse } from 'next/server';
import { authenticateCmsRequest, corsHeaders, cmsErrorResponse } from '@/lib/cms-auth';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { buildDeterministicSEO, buildSEOWithLLM } from '@/lib/seo-output';
import { prioritizeKeywords } from '@/lib/keyword-prioritizer';
import { saveTitleChoice } from '@/lib/title-history';

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
    const { title, selectedTitle, body: articleBody, lead, articleUrl, offeredTitles } = body;

    if (!selectedTitle || !selectedTitle.trim()) {
      return cmsErrorResponse('selectedTitle je obavezan.', 400, origin);
    }

    if (!articleBody || articleBody.trim().length < 100) {
      return cmsErrorResponse('Tekst članka mora imati najmanje 100 karaktera.', 400, origin);
    }

    const text = (lead ? lead + '\n\n' : '') + articleBody;
    const effectiveTitle = title || selectedTitle;
    const fullText = `${effectiveTitle}. ${text}`;

    console.log(`🏢 [CMS/generate] Portal: ${auth.portalId}, selectedTitle: "${selectedTitle.substring(0, 50)}..."`);

    // TF-IDF + LSA for keyword extraction (same API as analyze-text route)
    const tfidfAnalyzer = new TFIDFAnalyzer();
    const lsaAnalyzer = new LSAAnalyzer();

    const tfidfAnalysis = tfidfAnalyzer.analyze(fullText);
    const lsaAnalysis = lsaAnalyzer.analyzeSemantics(fullText);
    const searchIntent = lsaAnalyzer.classifySearchIntent(fullText, tfidfAnalysis.semanticCore);

    let mainTopics = lsaAnalysis.topicClusters.map((c: any) => c.name);
    if (mainTopics.length === 0 && tfidfAnalysis.semanticCore.length > 0) {
      mainTopics = tfidfAnalysis.semanticCore.slice(0, 5).map((t: any) => t.word).filter((w: string) => w.length > 3);
    }

    const prioritized = prioritizeKeywords(text, tfidfAnalysis, lsaAnalysis, searchIntent);

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

    let seoOutputs = deterministicSEO;
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
        { model, strictModel, skipTitleGeneration: true }
      );

      if (llmResult) {
        llmResult.title = selectedTitle; // Preserve selected title
        seoOutputs = llmResult;
      }
    } catch (llmError: any) {
      console.error('⚠️ [CMS/generate] LLM failed, using deterministic:', llmError?.message);
    }

    // Save to Supabase for RAG (non-blocking)
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

    console.log(`✅ [CMS/generate] Done for ${auth.portalId}`);

    return NextResponse.json({
      success: true,
      seoTitle: seoOutputs.title,
      metaDescription: seoOutputs.metaDescription,
      keywords: seoOutputs.keywordsLine,
      schemaMarkup: seoOutputs.schemaMarkup || '',
    }, { headers });

  } catch (error) {
    console.error('❌ [CMS/generate] Error:', error);
    return cmsErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500, origin
    );
  }
}
