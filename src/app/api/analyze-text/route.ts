import { NextRequest, NextResponse } from 'next/server';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { buildDeterministicSEO, buildSEOWithLLM } from '@/lib/seo-output';
import { computeAuthorMetrics } from '@/lib/author-metrics';
import { buildAuthorRecommendations } from '@/lib/author-recommendations';
import { prioritizeKeywords, prioritizedAsCSV, prioritizedAsCommaList } from '@/lib/keyword-prioritizer';

interface AnalysisRequest {
  text: string;
  title?: string;
  provider?: 'openai' | 'gemini';
  model?: string;
  strictModel?: boolean;
}

interface AnalysisResponse {
  success: boolean;
  data?: {
    tfidfAnalysis: any;
    lsaAnalysis: any;
    searchIntent: any;
    summary: {
      mainTopics: string[];
      keyTerms: string[];
      readabilityScore: number;
      conceptStrength: number;
      recommendedFocus: string;
    };
    seoOutputs?: {
      title: string;
      metaDescription: string;
      keywordsLine: string;
      markdown: string;
    }
    authorMetrics?: import('@/lib/author-metrics').AuthorMetrics;
    authorRecommendations?: import('@/lib/author-recommendations').AuthorRecommendations;
    prioritizedKeywords?: {
      items: Array<{ term: string; score: number; category: string; reasons: string[] }>
      csv: string;
      commaList: string;
    }
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  try {
  const { text, title, provider, model, strictModel }: AnalysisRequest = await request.json();

    if (!text || text.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Tekst mora imati najmanje 50 karaktera za analizu'
      }, { status: 400 });
    }

    // Initialize analyzers
    const tfidfAnalyzer = new TFIDFAnalyzer();
    const lsaAnalyzer = new LSAAnalyzer();

    // Combine title and text for analysis if title is provided
    const fullText = title ? `${title}. ${text}` : text;

    // Perform TF-IDF analysis
    const tfidfAnalysis = tfidfAnalyzer.analyze(fullText);

    // Perform LSA analysis
    const lsaAnalysis = lsaAnalyzer.analyzeSemantics(fullText);

    // Classify search intent
    const searchIntent = lsaAnalyzer.classifySearchIntent(fullText, tfidfAnalysis.semanticCore);

    // Generate summary and recommendations
    const mainTopics = lsaAnalysis.topicClusters.map(cluster => cluster.name);
    const keyTerms = tfidfAnalysis.semanticCore.slice(0, 10).map(term => term.word);
    
    // Determine recommended focus based on analysis
    let recommendedFocus = 'informativni sadržaj';
    if (searchIntent.type === 'commercial') {
      recommendedFocus = 'komercijalna istraga';
    } else if (searchIntent.type === 'transactional') {
      recommendedFocus = 'transakcijski sadržaj';
    } else if (lsaAnalysis.topicClusters.length > 0) {
      recommendedFocus = `${lsaAnalysis.topicClusters[0].name.toLowerCase()} fokus`;
    }

    const summary = {
      mainTopics,
      keyTerms,
      readabilityScore: tfidfAnalysis.readabilityScore,
      conceptStrength: lsaAnalysis.conceptStrength,
      recommendedFocus
    };

    // Prioritize keywords (2.3)
    const prioritized = prioritizeKeywords(text, tfidfAnalysis, lsaAnalysis, searchIntent);

    // Generate SEO outputs (use prioritized keywords for inputs)
    const deterministicSEO = buildDeterministicSEO({
      title,
      keyTerms: prioritized.map(p => p.term),
      mainTopics,
      searchIntentType: searchIntent.type
    }, text);

    // LLM enhancement (provider-configurable). If LLM hard-fails, gracefully fall back
    // to deterministic output but include diagnostics so UI can inform the user.
    const noBase = (process.env.SEO_NO_BASE_SEO || '').toLowerCase() === 'true';
    let seoOutputs: ReturnType<typeof buildDeterministicSEO> | undefined;
    let llmError: string | undefined;
    
    console.log('🚀 [analyze-text] Calling buildSEOWithLLM:', { provider, model, strictModel, hasText: !!text });
    
    try {
      seoOutputs = await buildSEOWithLLM(
        deterministicSEO,
        {
          documentTitle: title,
          keyTerms: prioritized.map(p => p.term),
          mainTopics,
          searchIntentType: searchIntent.type,
          textSample: text.slice(0, 1000)
        },
        { provider, model, strictModel }
      );
      
      console.log('✅ [analyze-text] buildSEOWithLLM success:', {
        hasOutputs: !!seoOutputs,
        titleMatch: seoOutputs?.title === deterministicSEO.title,
        title: seoOutputs?.title
      });
      
    } catch (e: any) {
      // Preserve a user-friendly flow: keep deterministic SEO and expose reason in diagnostics
      llmError = e?.message || 'LLM failure';
      console.error('❌ [analyze-text] buildSEOWithLLM error:', llmError);
      if (!noBase) {
        seoOutputs = deterministicSEO;
      }
    }

    // LLM diagnostics: was LLM actually used or did we fall back?
    const configuredProvider = (provider || process.env.SEO_LLM_PROVIDER || '').toLowerCase();
    const configuredModel =
      configuredProvider === 'openai'
        ? (model || process.env.OPENAI_MODEL || '')
        : configuredProvider === 'gemini'
          ? (model || process.env.GEMINI_MODEL || '')
          : '';
    const usedLLM = !!seoOutputs && (
      seoOutputs.title !== deterministicSEO.title ||
      seoOutputs.metaDescription !== deterministicSEO.metaDescription ||
      seoOutputs.keywordsLine !== deterministicSEO.keywordsLine
    );

    // Author-focused metrics and recommendations
    const prioritizedTerms = prioritized.map(p => p.term);
    const authorMetrics = computeAuthorMetrics({
      text,
      topics: mainTopics,
      prioritizedKeywords: prioritizedTerms
    });

    const authorRecommendations = buildAuthorRecommendations({
      metrics: authorMetrics,
      mainTopics,
      prioritizedKeywords: prioritizedTerms,
      seoTitle: seoOutputs?.title,
      seoMeta: seoOutputs?.metaDescription
    });

    return NextResponse.json({
      success: true,
      data: {
        tfidfAnalysis,
        lsaAnalysis,
        searchIntent,
        summary,
  ...(seoOutputs ? { seoOutputs } : {}),
        authorMetrics,
        authorRecommendations,
        prioritizedKeywords: {
          items: prioritized,
          csv: prioritizedAsCSV(prioritized),
          commaList: prioritizedAsCommaList(prioritized)
        },
        // Non-breaking diagnostics for UI/logging
        llm: {
          configuredProvider,
          configuredModel,
          strictModel: !!(strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true')),
          used: usedLLM,
          hasKeys: {
            openai: !!process.env.OPENAI_API_KEY,
            gemini: !!process.env.GEMINI_API_KEY,
          },
          error: llmError
        }
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    const isDev = process.env.NODE_ENV !== 'production';
    const debug = (process.env.SEO_DEBUG || '').toLowerCase() === 'true';
    const message = (isDev || debug) && error instanceof Error ? `${error.message}` : 'Greška pri analizi teksta. Molimo pokušajte ponovo.';
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}

// Ensure Node.js runtime (uses Node libs and external SDKs) and prevent static optimization
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Allow': 'POST, OPTIONS' },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  // Lightweight browser-friendly probe: /api/analyze-text?text=...&provider=gemini&model=gemini-2.5-pro
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || '';
    const title = searchParams.get('title') || undefined;
    const providerParam = (searchParams.get('provider') || undefined) as 'openai' | 'gemini' | undefined;
    const model = searchParams.get('model') || undefined;
    const strictModel = (searchParams.get('strict') || '').toLowerCase() === 'true' || undefined;

    if (!text || text.trim().length < 20) {
      return NextResponse.json({
        success: false,
        error: 'Dodaj ?text= sa najmanje 20 karaktera'
      }, { status: 400 });
    }

    // Same pipeline as POST (TF-IDF, LSA, intent)
    const tfidfAnalyzer = new TFIDFAnalyzer();
    const lsaAnalyzer = new LSAAnalyzer();
    const fullText = title ? `${title}. ${text}` : text;
    const tfidfAnalysis = tfidfAnalyzer.analyze(fullText);
    const lsaAnalysis = lsaAnalyzer.analyzeSemantics(fullText);
    const searchIntent = lsaAnalyzer.classifySearchIntent(fullText, tfidfAnalysis.semanticCore);

    const mainTopics = lsaAnalysis.topicClusters.map(cluster => cluster.name);
    const prioritized = prioritizeKeywords(text, tfidfAnalysis, lsaAnalysis, searchIntent);

    const deterministicSEO = buildDeterministicSEO({
      title,
      keyTerms: prioritized.map(p => p.term),
      mainTopics,
      searchIntentType: searchIntent.type
    }, text);

    const noBase = (process.env.SEO_NO_BASE_SEO || '').toLowerCase() === 'true';
    let seoOutputs: ReturnType<typeof buildDeterministicSEO> | undefined;
    let llmError: string | undefined;
    try {
      seoOutputs = await buildSEOWithLLM(
        deterministicSEO,
        {
          documentTitle: title,
          keyTerms: prioritized.map(p => p.term),
          mainTopics,
          searchIntentType: searchIntent.type,
          textSample: text.slice(0, 1000)
        },
        { provider: providerParam, model, strictModel }
      );
    } catch (e: any) {
      llmError = e?.message || 'LLM failure';
      if (!noBase) {
        seoOutputs = deterministicSEO;
      }
    }

    const configuredProvider = (providerParam || process.env.SEO_LLM_PROVIDER || '').toLowerCase();
    const configuredModel =
      configuredProvider === 'openai'
        ? (model || process.env.OPENAI_MODEL || '')
        : configuredProvider === 'gemini'
          ? (model || process.env.GEMINI_MODEL || '')
          : '';
    const usedLLM = !!seoOutputs && (
      seoOutputs.title !== deterministicSEO.title ||
      seoOutputs.metaDescription !== deterministicSEO.metaDescription ||
      seoOutputs.keywordsLine !== deterministicSEO.keywordsLine
    );

    return NextResponse.json({
      success: true,
      data: {
        tfidfAnalysis,
        lsaAnalysis,
        searchIntent,
        summary: {
          mainTopics,
          keyTerms: tfidfAnalysis.semanticCore.slice(0, 10).map(t => t.word),
          readabilityScore: tfidfAnalysis.readabilityScore,
          conceptStrength: lsaAnalysis.conceptStrength,
          recommendedFocus: searchIntent.type
        },
        ...(seoOutputs ? { seoOutputs } : {}),
        prioritizedKeywords: {
          items: prioritized,
          csv: prioritizedAsCSV(prioritized),
          commaList: prioritizedAsCommaList(prioritized)
        },
        llm: {
          configuredProvider,
          configuredModel,
          strictModel: !!(strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true')),
          used: usedLLM,
          hasKeys: {
            openai: !!process.env.OPENAI_API_KEY,
            gemini: !!process.env.GEMINI_API_KEY,
          },
          error: llmError
        }
      }
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV !== 'production';
    const debug = (process.env.SEO_DEBUG || '').toLowerCase() === 'true';
    const message = (isDev || debug) && error instanceof Error ? `${error.message}` : 'Greška pri GET analizi.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}