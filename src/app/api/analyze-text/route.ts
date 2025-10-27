import { NextRequest, NextResponse } from 'next/server';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { buildDeterministicSEO, buildSEOWithLLM, buildSEOWithDualLLM } from '@/lib/seo-output';
import { computeAuthorMetrics } from '@/lib/author-metrics';
import { buildAuthorRecommendations } from '@/lib/author-recommendations';
import { prioritizeKeywords, prioritizedAsCSV, prioritizedAsCommaList } from '@/lib/keyword-prioritizer';
import { saveTitleChoice } from '@/lib/title-history';

interface AnalysisRequest {
  text: string;
  title?: string;
  provider?: 'openai' | 'gemini';
  model?: string;
  strictModel?: boolean;
  // New fields for title selection workflow
  selectedTitle?: string;
  selectionType?: 'ai_option_1' | 'ai_option_2' | 'ai_option_3' | 'custom';
  offeredTitles?: Array<{ text: string; style: 'faktografski' | 'kontekstualni' | 'detaljni'; length: number; reasoning: string }>;
  articleUrl?: string;
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
  const { 
    text, 
    title, 
    provider, 
    model, 
    strictModel,
    selectedTitle,
    selectionType,
    offeredTitles,
    articleUrl
  }: AnalysisRequest = await request.json();

    if (!text || text.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Tekst mora imati najmanje 50 karaktera za analizu'
      }, { status: 400 });
    }

    // Initialize analyzers
    const tfidfAnalyzer = new TFIDFAnalyzer();
    const lsaAnalyzer = new LSAAnalyzer();

    // Use selectedTitle if provided, otherwise fall back to title
    const effectiveTitle = selectedTitle || title;

    // Combine title and text for analysis if title is provided
    const fullText = effectiveTitle ? `${effectiveTitle}. ${text}` : text;

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
      title: effectiveTitle,
      keyTerms: prioritized.map(p => p.term),
      mainTopics,
      searchIntentType: searchIntent.type
    }, text);

    // If selectedTitle is provided, use it directly and skip LLM title generation
    // Only generate Meta description and Keywords with LLM
    if (selectedTitle) {
      console.log('🎯 [analyze-text] Using selectedTitle:', selectedTitle);
      
      // Override deterministic title with selected title
      deterministicSEO.title = selectedTitle;
      
      // LLM will generate Meta + Keywords based on the selected title
      let seoOutputs: ReturnType<typeof buildDeterministicSEO> | undefined;
      try {
        seoOutputs = await buildSEOWithLLM(
          deterministicSEO,
          {
            documentTitle: selectedTitle,
            keyTerms: prioritized.map(p => p.term),
            mainTopics,
            searchIntentType: searchIntent.type,
            textSample: text
          },
          { model, strictModel, skipTitleGeneration: true }
        );
        
        // Ensure the selected title is preserved (LLM should not generate a new one)
        if (seoOutputs) {
          seoOutputs.title = selectedTitle;
        }
        
        console.log('✅ [analyze-text] Generated Meta + KW for selected title');
        
        // Save title choice to Supabase for RAG
        try {
          await saveTitleChoice({
            articleUrl: articleUrl || '',
            articleText: text.substring(0, 5000), // Save first 5000 chars
            offeredTitles: offeredTitles || [],
            selectedTitle,
            selectionType: selectionType || 'custom',
            metaDescription: seoOutputs?.metaDescription || '',
            keywords: seoOutputs?.keywordsLine || ''
          });
          console.log('✅ [analyze-text] Saved title choice to Supabase for RAG');
        } catch (saveError) {
          console.error('⚠️ [analyze-text] Failed to save to Supabase (non-blocking):', saveError);
          // Non-blocking error - continue with response
        }
        
      } catch (e: any) {
        console.error('❌ [analyze-text] LLM error for selected title:', e?.message);
        seoOutputs = deterministicSEO;
      }

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
          },
          llm: {
            dualMode: false,
            configuredProvider: process.env.SEO_LLM_PROVIDER || 'gemini',
            configuredModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            used: true,
            selectedTitleMode: true,
            savedToSupabase: true,
            hasKeys: {
              openai: !!process.env.OPENAI_API_KEY,
              gemini: !!process.env.GEMINI_API_KEY,
            }
          }
        }
      });
    }

    // LLM enhancement (provider-configurable). If LLM hard-fails, gracefully fall back
    // to deterministic output but include diagnostics so UI can inform the user.
    const noBase = (process.env.SEO_NO_BASE_SEO || '').toLowerCase() === 'true';
    let seoOutputs: ReturnType<typeof buildDeterministicSEO> | undefined;
    let seoOutputsGemini: ReturnType<typeof buildDeterministicSEO> | undefined;
    let seoOutputsOpenAI: ReturnType<typeof buildDeterministicSEO> | undefined;
    let llmError: string | undefined;
    let geminiError: string | undefined;
    let openaiError: string | undefined;
    
    console.log('🚀 [analyze-text] Text stats:', { 
      titleLength: title?.length || 0, 
      textLength: text.length, 
      textSample: text.substring(0, 200) + '...',
      wordCount: text.split(/\s+/).length 
    });

    // Check if dual LLM mode is enabled
    const dualMode = process.env.SEO_DUAL_LLM === 'true';
    console.log('🚀 [analyze-text] Dual mode:', dualMode);
    
    if (dualMode) {
      // Dual mode: Call both Gemini and OpenAI simultaneously
      console.log('🔄 [analyze-text] Calling buildSEOWithDualLLM...');
      try {
        const dualResults = await buildSEOWithDualLLM(
          deterministicSEO,
          {
            documentTitle: title,
            keyTerms: prioritized.map(p => p.term),
            mainTopics,
            searchIntentType: searchIntent.type,
            textSample: text
          }
        );
        
        seoOutputsGemini = dualResults.gemini || undefined;
        seoOutputsOpenAI = dualResults.openai || undefined;
        geminiError = dualResults.geminiError;
        openaiError = dualResults.openaiError;
        
        console.log('✅ [analyze-text] Dual LLM results:', {
          hasGemini: !!seoOutputsGemini,
          hasOpenAI: !!seoOutputsOpenAI,
          geminiError,
          openaiError
        });
        
        // For backwards compatibility, set seoOutputs to Gemini if available, else OpenAI
        seoOutputs = seoOutputsGemini || seoOutputsOpenAI;
        
      } catch (e: any) {
        llmError = e?.message || 'Dual LLM failure';
        console.error('❌ [analyze-text] buildSEOWithDualLLM error:', llmError);
        if (!noBase) {
          seoOutputs = deterministicSEO;
        }
      }
    } else {
      // Single mode: Use existing logic
      console.log('🚀 [analyze-text] Calling buildSEOWithLLM:', { model, strictModel, hasText: !!text });
      
      try {
        seoOutputs = await buildSEOWithLLM(
          deterministicSEO,
          {
            documentTitle: title,
            keyTerms: prioritized.map(p => p.term),
            mainTopics,
            searchIntentType: searchIntent.type,
            textSample: text
          },
          { model, strictModel }
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
        ...(dualMode && seoOutputsGemini ? { seoOutputsGemini } : {}),
        ...(dualMode && seoOutputsOpenAI ? { seoOutputsOpenAI } : {}),
        authorMetrics,
        authorRecommendations,
        prioritizedKeywords: {
          items: prioritized,
          csv: prioritizedAsCSV(prioritized),
          commaList: prioritizedAsCommaList(prioritized)
        },
        // Non-breaking diagnostics for UI/logging
        llm: {
          dualMode,
          ...(dualMode ? {
            geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            geminiError,
            openaiError
          } : {
            configuredProvider,
            configuredModel,
            strictModel: !!(strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true')),
            used: usedLLM,
            error: llmError
          }),
          hasKeys: {
            openai: !!process.env.OPENAI_API_KEY,
            gemini: !!process.env.GEMINI_API_KEY,
          }
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
          textSample: text
        },
        { model, strictModel }
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