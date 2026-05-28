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
export const maxDuration = 55; // Allow up to 55s for LLM generation (Vercel Pro limit: 60s)

// ── Per-portal publisher info (known constants) ──
const PUBLISHER_INFO: Record<string, { name: string; logoUrl: string; domain: string }> = {
  newsmax: {
    name: 'Newsmax Balkans',
    logoUrl: 'https://newsmaxbalkans.com/files/img/logo.png',
    domain: 'newsmaxbalkans.com',
  },
  newsmax_en: {
    name: 'Newsmax Balkans',
    logoUrl: 'https://newsmaxbalkans.com/files/img/logo.png',
    domain: 'newsmaxbalkans.com',
  },
  newsmax_al: {
    name: 'Newsmax Balkans',
    logoUrl: 'https://newsmaxbalkans.al/files/img/logo.png',
    domain: 'newsmaxbalkans.al',
  },
  newsmax_pl: {
    name: 'Newsmax Polska',
    logoUrl: 'https://newsmaxpolska.com/files/img/logo.png',
    domain: 'newsmaxpolska.com',
  },
};

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ── Fetch metadata from published article page (non-blocking) ──
interface ScrapedMeta {
  publishedTime?: string;
  modifiedTime?: string;
  imageUrl?: string;
  canonicalUrl?: string;
  articleSection?: string;
  authorName?: string;
}

async function fetchArticleMetadata(articleUrl?: string): Promise<ScrapedMeta> {
  if (!articleUrl || !articleUrl.startsWith('http')) return {};
  // Skip non-article URLs
  if (articleUrl.includes('localhost') || articleUrl.includes('127.0.0.1')) return {};
  if (articleUrl.includes('backoffice')) {
    console.log(`📋 [CMS/generate] Skipping backoffice URL for metadata scrape: ${articleUrl.substring(0, 60)}...`);
    return {};
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
    const res = await fetch(articleUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SEO-GEM-Bot/1.0 (metadata-scraper)' },
    });
    clearTimeout(timeout);

    if (!res.ok) return {};
    const html = await res.text();

    // ── 1. Try to extract from existing JSON-LD script block (primary source) ──
    let jsonLd: any = null;
    const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch?.[1]) {
      try { jsonLd = JSON.parse(jsonLdMatch[1].trim()); } catch { /* invalid JSON-LD */ }
    }

    // ── 2. Extract meta tags as fallback ──
    const getMeta = (property: string): string => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return m[1].trim();
      }
      return '';
    };

    const canonical = (() => {
      const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
      return m?.[1]?.trim() || '';
    })();

    // ── 3. Merge: JSON-LD takes priority, then meta tags ──
    const result: ScrapedMeta = {
      publishedTime:
        jsonLd?.datePublished ||
        getMeta('article:published_time') || getMeta('datePublished') || '',
      modifiedTime:
        jsonLd?.dateModified ||
        getMeta('article:modified_time') || getMeta('dateModified') || '',
      imageUrl:
        (typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url) ||
        getMeta('og:image') || '',
      canonicalUrl:
        jsonLd?.mainEntityOfPage?.['@id'] ||
        canonical || getMeta('og:url') || '',
      articleSection:
        jsonLd?.articleSection ||
        getMeta('article:section') || '',
      authorName:
        jsonLd?.creator ||
        (typeof jsonLd?.author === 'string' ? jsonLd.author : jsonLd?.author?.name) ||
        getMeta('article:author') || getMeta('author') || '',
    };

    // Clean ?preview=true and other query params from canonical URL
    if (result.canonicalUrl) {
      try { result.canonicalUrl = result.canonicalUrl.split('?')[0]; } catch { /* */ }
    }

    const found = Object.values(result).filter(Boolean).length;
    if (found > 0) {
      console.log(`📋 [CMS/generate] Scraped ${found} metadata fields from ${articleUrl}:`,
        JSON.stringify(result, null, 0).substring(0, 200));
    }
    return result;
  } catch (e: any) {
    // Timeout or fetch error — article may not be published yet
    console.log(`📋 [CMS/generate] Could not fetch article metadata (${e.message?.substring(0, 50)})`);
    return {};
  }
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
    const {
      title, selectedTitle, body: articleBody, lead, articleUrl,
      offeredTitles, language: reqLang,
      // New metadata fields from CMS embed
      authorName, articleSection,
    } = body;
    const language: SupportedLanguage = (reqLang && isValidLanguage(reqLang)) ? reqLang : 'sr';

    const errorMsgs: Record<string, { titleRequired: string; textTooShort: string }> = {
      sr: { titleRequired: 'selectedTitle je obavezan.', textTooShort: 'Tekst članka mora imati najmanje 100 karaktera.' },
      en: { titleRequired: 'selectedTitle is required.', textTooShort: 'Article text must have at least 100 characters.' },
      pl: { titleRequired: 'selectedTitle jest wymagany.', textTooShort: 'Tekst artykułu musi mieć co najmniej 100 znaków.' },
      sq: { titleRequired: 'selectedTitle është i detyrueshëm.', textTooShort: 'Teksti i artikullit duhet të ketë të paktën 100 karaktere.' },
    };
    const msgs = errorMsgs[language] || errorMsgs.sr;

    if (!selectedTitle || !selectedTitle.trim()) {
      return cmsErrorResponse(msgs.titleRequired, 400, origin);
    }

    if (!articleBody || articleBody.trim().length < 100) {
      return cmsErrorResponse(msgs.textTooShort, 400, origin);
    }

    const text = (lead ? lead + '\n\n' : '') + articleBody;
    const effectiveTitle = title || selectedTitle;
    const fullText = `${effectiveTitle}. ${text}`;

    console.log(`🏢 [CMS/generate] Portal: ${auth.portalId}, lang: ${language}, selectedTitle: "${selectedTitle.substring(0, 50)}..."`);

    // ── PARALLEL: Run metadata scrape AND TF-IDF/LSA analysis concurrently ──
    const metadataPromise = fetchArticleMetadata(articleUrl);

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
    }, text, language);

    deterministicSEO.title = selectedTitle;

    // LLM generation (meta desc + keywords + schema)
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const strictModel = (process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true';

    // Resolve publisher info from portal ID
    const publisherInfo = PUBLISHER_INFO[auth.portalId || ''] || PUBLISHER_INFO.newsmax;
    const now = new Date().toISOString();

    // Await metadata (already running in parallel, should be done by now)
    const scraped = await metadataPromise;

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
          articleUrl: scraped.canonicalUrl || articleUrl || '',
          articleMetadata: {
            publisherName: publisherInfo.name,
            publisherLogoUrl: publisherInfo.logoUrl,
            authorName: authorName || scraped.authorName || publisherInfo.name,
            publishedTime: scraped.publishedTime || now,
            dateModified: scraped.modifiedTime || now,
            imageUrl: scraped.imageUrl || '',
            articleSection: articleSection || scraped.articleSection || '',
          },
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
