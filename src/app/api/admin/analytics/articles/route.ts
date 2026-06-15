/**
 * GET /api/admin/analytics/articles
 * 
 * Returns ONLY SEO GEM articles with their GSC + GA4 metrics.
 * Data source: title_history (primary) → matched with analytics by article ID.
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
    // 1. PRIMARY: Get ALL title_history entries for this portal (paginated)
    const titleData = await fetchAll(sb, 'title_history',
      'id, article_url, selected_title, selection_type, offered_titles, created_at',
      { portal_id: portal });

    // Build title map keyed by article ID
    const titleMap = new Map<string, {
      id: number;
      article_url: string;
      selected_title: string;
      selection_type: string;
      style: string;
      created_at: string;
    }>();

    for (const t of titleData) {
      const artId = extractArticleId(t.article_url);
      if (!artId || titleMap.has(artId)) continue; // Keep most recent (already sorted desc)

      let style = 'custom';
      if (t.offered_titles && Array.isArray(t.offered_titles)) {
        const match = t.offered_titles.find(
          (o: { text: string; style: string }) => o.text === t.selected_title
        );
        if (match) style = match.style;
      }

      titleMap.set(artId, {
        id: t.id,
        article_url: t.article_url,
        selected_title: t.selected_title,
        selection_type: t.selection_type,
        style,
        created_at: t.created_at,
      });
    }

    // 2. Get GSC data (paginated)
    const gscData = await fetchAll(sb, 'article_gsc_metrics',
      'article_url, impressions, clicks, avg_position, search_type, top_queries',
      { portal_id: portal },
      { start: startDate, end: endDate });

    // Aggregate GSC per article ID
    const gscMap = new Map<string, {
      impressions: number; clicks: number; avg_position: number; positionCount: number;
      web_impressions: number; discover_impressions: number;
      top_queries: Array<{ query: string; clicks: number; impressions: number }>;
    }>();

    for (const row of gscData) {
      const artId = extractArticleId(row.article_url);
      if (!artId) continue;

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

    // 3. Get GA4 data (paginated)
    const ga4Data = await fetchAll(sb, 'article_ga4_metrics',
      'article_url, pageviews, sessions, avg_engagement_seconds, pages_per_session, organic_pct, direct_pct, social_pct',
      { portal_id: portal },
      { start: startDate, end: endDate });

    // Aggregate GA4 per article ID
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

    // 4. Build articles list — ONLY from title_history (SEO GEM articles)
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

      // Status
      let status: 'early' | 'ok' | 'warning' | 'top' = 'ok';
      if (ageDays < 7) status = 'early';
      else if (impressions > 500 && ctr > 0.06) status = 'top';
      else if (impressions > 200 && ctr < 0.02) status = 'warning';

      const topQueries = (gsc?.top_queries || [])
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);

      articles.push({
        article_id: artId,
        url: title.article_url,
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

    // Sort by pageviews desc (most viewed SEO GEM articles first)
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
