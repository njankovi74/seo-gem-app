/**
 * GET /api/admin/analytics/articles
 * 
 * Returns ONLY SEO GEM articles with their GSC + GA4 metrics.
 * 
 * MATCHING STRATEGY (v2 - slug-based):
 * Instead of trusting title_history.article_url (which was often wrong due to
 * a bug in cms-embed.js that grabbed random links from the CMS page), we now:
 * 1. Collect all unique article URLs from GSC/GA4 data
 * 2. For each title_history record, find the GSC URL whose slug best matches
 *    the selected_title keywords (slug-based matching)
 * 3. This gives us the CORRECT article_url and article_id for each title
 * 
 * Query params:
 *   - portal: portal_id (required)
 *   - start: start date YYYY-MM-DD (default: 7 days ago)
 *   - end: end date YYYY-MM-DD (default: today)
 *   - limit: max results (default: 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse } from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/** Extract numeric article ID (4+ digits) from URL */
function extractArticleId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(\d{4,})\//);
  return match ? match[1] : null;
}

/** Extract slug from URL: /vesti/hronika/57081/slug-text-here/vest -> slug-text-here */
function extractSlug(url: string): string {
  if (!url) return '';
  const match = url.match(/\/\d{4,}\/([^/]+)\//);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Normalize text for slug matching:
 * Remove diacritics, lowercase, split to words 4+ chars
 */
// Common Serbian/English words that appear in many slugs and cause false matches
const STOP_WORDS = new Set([
  'kako', 'kada', 'zasto', 'koji', 'koja', 'koje', 'ovaj', 'ova', 'ovo',
  'srbija', 'srbiji', 'srbije', 'srpski', 'srpska', 'srpske',
  'beograd', 'beogradu', 'beograda', 'novi', 'nova', 'novo', 'novu',
  'vesti', 'vest', 'danas', 'posle', 'tokom', 'nakon', 'pred', 'prema',
  'vise', 'manje', 'samo', 'koji', 'gde', 'sta', 'koliko',
  'imate', 'imaju', 'imamo', 'moze', 'mogu', 'mora', 'treba',
  'bilo', 'biti', 'jeste', 'nije', 'nece', 'hoce',
  'ovde', 'tamo', 'gore', 'dole', 'levo', 'desno',
  'from', 'with', 'that', 'this', 'what', 'when', 'where', 'which',
]);

function normalizeForMatch(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd').replace(/\u0110/g, 'd')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !STOP_WORDS.has(w)); // 5+ chars, no stop words
}

/**
 * Score how well a title matches a URL slug. Returns 0-1.
 */
function slugMatchScore(title: string, slug: string): number {
  if (!title || !slug) return 0;
  const titleWords = normalizeForMatch(title);
  if (titleWords.length === 0) return 0;
  
  const slugNorm = slug
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd');
  
  let matches = 0;
  for (const word of titleWords) {
    if (slugNorm.includes(word)) matches++;
  }
  // Require at least 2 word matches to avoid single-word false positives
  if (matches < 2) return 0;
  return matches / titleWords.length;
}

/** Paginated Supabase fetch (1000 rows per page) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(sb: any, table: string, select: string, filters: Record<string, string>, dateRange?: { start: string; end: string }): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + 999);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    if (dateRange) q = q.gte('date', dateRange.start).lte('date', dateRange.end);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (!auth.valid) {
    return adminErrorResponse(auth.error || 'Unauthorized', 401);
  }

  const url = new URL(request.url);
  const portal = url.searchParams.get('portal');
  const startDate = url.searchParams.get('start') || getDaysAgo(7);
  const endDate = url.searchParams.get('end') || getDaysAgo(0);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);

  if (!portal) {
    return adminErrorResponse('portal parameter is required', 400);
  }

  const sb = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Get ALL title_history entries for this portal (paginated)
    const titleData = await fetchAll(sb, 'title_history',
      'id, article_url, selected_title, selection_type, offered_titles, created_at',
      { portal_id: portal });

    // 2. Get GSC data (paginated)
    const gscData = await fetchAll(sb, 'article_gsc_metrics',
      'article_url, impressions, clicks, avg_position, search_type, top_queries',
      { portal_id: portal },
      { start: startDate, end: endDate });

    // 3. Get GA4 data (paginated)
    const ga4Data = await fetchAll(sb, 'article_ga4_metrics',
      'article_url, pageviews, sessions, avg_engagement_seconds, pages_per_session, organic_pct, direct_pct, social_pct',
      { portal_id: portal },
      { start: startDate, end: endDate });

    // == Build GSC aggregation per article ID ==
    const gscMap = new Map<string, {
      impressions: number; clicks: number; avg_position: number; positionCount: number;
      web_impressions: number; discover_impressions: number;
      top_queries: Array<{ query: string; clicks: number; impressions: number }>;
    }>();
    const gscUrlMap = new Map<string, string>();

    for (const row of gscData) {
      const artId = extractArticleId(row.article_url);
      if (!artId) continue;
      if (!gscUrlMap.has(artId) && row.article_url) gscUrlMap.set(artId, row.article_url);
      if (!gscMap.has(artId)) {
        gscMap.set(artId, {
          impressions: 0, clicks: 0, avg_position: 0, positionCount: 0,
          web_impressions: 0, discover_impressions: 0, top_queries: [],
        });
      }
      const entry = gscMap.get(artId)!;
      entry.impressions += row.impressions;
      entry.clicks += row.clicks;
      if (row.search_type === 'web') {
        entry.web_impressions += row.impressions;
        entry.avg_position += row.avg_position;
        entry.positionCount += 1;
      } else if (row.search_type === 'discover') {
        entry.discover_impressions += row.impressions;
      }
      if (row.top_queries && Array.isArray(row.top_queries)) {
        for (const q of row.top_queries) {
          const ex = entry.top_queries.find(eq => eq.query === q.query);
          if (ex) { ex.clicks += q.clicks; ex.impressions += q.impressions; }
          else entry.top_queries.push({ query: q.query, clicks: q.clicks, impressions: q.impressions });
        }
      }
    }

    // == Build GA4 aggregation per article ID ==
    const ga4Map = new Map<string, {
      pageviews: number; sessions: number;
      avg_engagement_seconds: number; engCount: number;
      pages_per_session: number; ppsCount: number;
      organic_pct: number; direct_pct: number; social_pct: number; srcCount: number;
    }>();

    for (const row of ga4Data) {
      const artId = extractArticleId(row.article_url);
      if (!artId) continue;
      if (!ga4Map.has(artId)) {
        ga4Map.set(artId, {
          pageviews: 0, sessions: 0,
          avg_engagement_seconds: 0, engCount: 0,
          pages_per_session: 0, ppsCount: 0,
          organic_pct: 0, direct_pct: 0, social_pct: 0, srcCount: 0,
        });
      }
      const entry = ga4Map.get(artId)!;
      entry.pageviews += row.pageviews;
      entry.sessions += row.sessions;
      entry.avg_engagement_seconds += row.avg_engagement_seconds;
      entry.engCount += 1;
      entry.pages_per_session += row.pages_per_session;
      entry.ppsCount += 1;
      entry.organic_pct += row.organic_pct;
      entry.direct_pct += row.direct_pct;
      entry.social_pct += row.social_pct;
      entry.srcCount += 1;
    }

    // == Build slug index from ALL known analytics URLs for smart matching ==
    const allSlugs: Array<[string, string]> = []; // [slug, artId]
    for (const [artId, gscUrl] of gscUrlMap) {
      const slug = extractSlug(gscUrl);
      if (slug) allSlugs.push([slug, artId]);
    }
    // Also index GA4 URLs (some articles may only have GA4 data)
    for (const row of ga4Data) {
      const artId = extractArticleId(row.article_url);
      const slug = extractSlug(row.article_url);
      if (artId && slug && !gscUrlMap.has(artId)) {
        gscUrlMap.set(artId, row.article_url);
        allSlugs.push([slug, artId]);
      }
    }

    // == Build inverted index: word → Set<artId> for fast slug matching ==
    // Pre-normalize all slugs into words once
    const slugWordIndex = new Map<string, Set<string>>(); // word → set of artIds
    const artIdToSlug = new Map<string, string>(); // artId → normalized slug
    
    for (const [slug, artId] of allSlugs) {
      const slugNorm = slug
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd');
      artIdToSlug.set(artId, slugNorm);
      
      // Split slug into words and index each
      const slugWords = slugNorm.split('-').filter(w => w.length > 4 && !STOP_WORDS.has(w));
      for (const w of slugWords) {
        if (!slugWordIndex.has(w)) slugWordIndex.set(w, new Set());
        slugWordIndex.get(w)!.add(artId);
      }
    }

    // == Smart title-to-article matching ==
    const titleMap = new Map<string, {
      id: number;
      article_url: string;
      selected_title: string;
      selection_type: string;
      style: string;
      created_at: string;
    }>();

    const claimedIds = new Set<string>();

    for (const t of titleData) {
      let style = 'custom';
      if (t.offered_titles && Array.isArray(t.offered_titles)) {
        const match = t.offered_titles.find(
          (o: { text: string; style: string }) => o.text === t.selected_title
        );
        if (match) style = match.style;
      }

      // Strategy 1: Validate stored article_url by checking slug match
      const directId = extractArticleId(t.article_url);
      const directSlug = extractSlug(t.article_url);
      let matchedId: string | null = null;

      if (directId && directSlug && !claimedIds.has(directId)) {
        const score = slugMatchScore(t.selected_title, directSlug);
        if (score >= 0.25) {
          matchedId = directId;
        }
      }

      // Strategy 2: Use inverted index to find candidate articles quickly
      if (!matchedId) {
        const titleWords = normalizeForMatch(t.selected_title);
        
        // Collect candidate artIds that share at least one word
        const candidateCounts = new Map<string, number>();
        for (const word of titleWords) {
          const artIds = slugWordIndex.get(word);
          if (artIds) {
            for (const aid of artIds) {
              if (!claimedIds.has(aid)) {
                candidateCounts.set(aid, (candidateCounts.get(aid) || 0) + 1);
              }
            }
          }
        }

        // Only evaluate candidates with 2+ word hits (our minimum threshold)
        let bestScore = 0;
        let bestId: string | null = null;
        for (const [artId, hitCount] of candidateCounts) {
          if (hitCount < 2) continue; // Skip single-word matches
          const slugNorm = artIdToSlug.get(artId) || '';
          // Quick score: hitCount / titleWords.length (avoids full re-normalization)
          let verifiedMatches = 0;
          for (const word of titleWords) {
            if (slugNorm.includes(word)) verifiedMatches++;
          }
          if (verifiedMatches < 2) continue;
          const score = verifiedMatches / titleWords.length;
          if (score > bestScore && score >= 0.25) {
            bestScore = score;
            bestId = artId;
          }
        }
        if (bestId) matchedId = bestId;
      }

      if (!matchedId) continue; // Cannot reliably match - skip
      if (titleMap.has(matchedId)) continue;

      claimedIds.add(matchedId);
      titleMap.set(matchedId, {
        id: t.id,
        article_url: gscUrlMap.get(matchedId) || t.article_url,
        selected_title: t.selected_title,
        selection_type: t.selection_type,
        style,
        created_at: t.created_at,
      });
    }

    // 4. Build articles list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articles: any[] = [];

    for (const [artId, title] of titleMap) {
      const gsc = gscMap.get(artId);
      const ga4 = ga4Map.get(artId);

      const publishedAt = title.created_at;
      const ageDays = daysBetween(publishedAt.split('T')[0], today);

      const impressions = gsc?.impressions || 0;
      const clicks = gsc?.clicks || 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;

      let status: 'early' | 'ok' | 'warning' | 'top' = 'ok';
      if (ageDays < 7) status = 'early';
      else if (impressions > 500 && ctr > 0.06) status = 'top';
      else if (impressions > 200 && ctr < 0.02) status = 'warning';

      const topQueries = (gsc?.top_queries || [])
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);

      articles.push({
        article_id: artId,
        url: gscUrlMap.get(artId) || title.article_url,
        seo_title: title.selected_title,
        style: title.style,
        selection_type: title.selection_type,
        published_at: publishedAt,
        age_days: ageDays,
        // GSC
        impressions,
        clicks,
        ctr: Math.round(ctr * 1000) / 10,
        avg_position: gsc?.positionCount ? Math.round((gsc.avg_position / gsc.positionCount) * 10) / 10 : null,
        discover_impressions: gsc?.discover_impressions || 0,
        top_queries: topQueries,
        has_gsc: !!gsc,
        // GA4
        pageviews: ga4?.pageviews || 0,
        sessions: ga4?.sessions || 0,
        avg_engagement_sec: ga4?.engCount ? Math.round(ga4.avg_engagement_seconds / ga4.engCount) : 0,
        pages_per_session: ga4?.ppsCount ? Math.round((ga4.pages_per_session / ga4.ppsCount) * 10) / 10 : 0,
        organic_pct: ga4?.srcCount ? Math.round(ga4.organic_pct / ga4.srcCount) : 0,
        direct_pct: ga4?.srcCount ? Math.round(ga4.direct_pct / ga4.srcCount) : 0,
        social_pct: ga4?.srcCount ? Math.round(ga4.social_pct / ga4.srcCount) : 0,
        has_ga4: !!ga4,
        // Status
        status,
      });
    }

    articles.sort((a, b) => b.pageviews - a.pageviews);
    const withData = articles.filter(a => a.has_gsc || a.has_ga4);

    return NextResponse.json({
      success: true,
      portal,
      period: { start: startDate, end: endDate },
      total_seo_gem: articles.length,
      with_analytics: withData.length,
      articles: articles.slice(0, limit),
    });

  } catch (error) {
    console.error('❌ [Articles] Error:', error);
    return adminErrorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    );
  }
}
