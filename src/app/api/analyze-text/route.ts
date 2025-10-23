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

    // LLM enhancement (provider-configurable)
    const seoOutputs = await buildSEOWithLLM(
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
        seoOutputs,
        authorMetrics,
        authorRecommendations,
        prioritizedKeywords: {
          items: prioritized,
          csv: prioritizedAsCSV(prioritized),
          commaList: prioritizedAsCommaList(prioritized)
        }
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    const isDev = process.env.NODE_ENV !== 'production';
    const message = isDev && error instanceof Error ? `${error.message}` : 'Greška pri analizi teksta. Molimo pokušajte ponovo.';
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

export async function GET() {
  return NextResponse.json({ error: 'Use POST on this endpoint' }, {
    status: 405,
    headers: { 'Allow': 'POST, OPTIONS' }
  });
}