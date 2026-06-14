/**
 * GET /api/admin/analytics/articles
 * 
 * Returns combined article data: title_history + GSC + GA4 metrics.
 * Supports filtering by portal, date range, and sorting.
 * 
 * Query params:
 *   - portal: portal_id (required)
 *   - start: start date YYYY-MM-DD (default: 7 days ago)
 *   - end: end date YYYY-MM-DD (default: today)
 *   - sort: field to sort by (default: impressions)
 *   - order: asc/desc (default: desc)
 *   - limit: max results (default: 100)
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

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (!auth.valid) {
    return adminErrorResponse(auth.error || 'Unauthorized', 401);
  }

  const url = new URL(request.url);
  const portal = url.searchParams.get('portal');
  const startDate = url.searchParams.get('start') || getDaysAgo(7);
  const endDate = url.searchParams.get('end') || getDaysAgo(0);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  if (!portal) {
    return adminErrorResponse('portal parameter is required', 400);
  }

  const sb = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Get GSC data aggregated per URL for the date range
    const { data: gscData } = await sb
      .from('article_gsc_metrics')
      .select('article_url, impressions, clicks, ctr, avg_position, search_type, top_queries, date')
      .eq('portal_id', portal)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('impressions', { ascending: false });

    // 2. Get GA4 data aggregated per URL
    const { data: ga4Data } = await sb
      .from('article_ga4_metrics')
      .select('article_url, pageviews, sessions, avg_engagement_seconds, bounce_rate, pages_per_session, organic_pct, discover_pct, direct_pct, social_pct, country_breakdown, date')
      .eq('portal_id', portal)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('pageviews', { ascending: false });

    // 3. Get title_history for matching
    const { data: titleData } = await sb
      .from('title_history')
      .select('id, article_url, selected_title, selection_type, offered_titles, meta_description, keywords, created_at')
      .eq('portal_id', portal)
      .order('created_at', { ascending: false });

    // Build title map: URL → most recent title entry
    const titleMap = new Map<string, {
      id: number;
      selected_title: string;
      selection_type: string;
      style: string;
      meta_description: string;
      keywords: string;
      created_at: string;
    }>();

    for (const t of (titleData || [])) {
      const urlPath = extractPath(t.article_url);
      if (!titleMap.has(urlPath)) {
        // Find the style of the selected title
        let style = 'custom';
        if (t.offered_titles && Array.isArray(t.offered_titles)) {
          const match = t.offered_titles.find(
            (o: { text: string; style: string }) => o.text === t.selected_title
          );
          if (match) style = match.style;
        }

        titleMap.set(urlPath, {
          id: t.id,
          selected_title: t.selected_title,
          selection_type: t.selection_type,
          style,
          meta_description: t.meta_description || '',
          keywords: t.keywords || '',
          created_at: t.created_at,
        });
      }
    }

    // Aggregate GSC per URL (sum across dates, merge queries)
    const gscMap = new Map<string, {
      impressions: number;
      clicks: number;
      avg_position: number;
      positionCount: number;
      web_impressions: number;
      discover_impressions: number;
      top_queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
    }>();

    for (const row of (gscData || [])) {
      const urlPath = extractPath(row.article_url);
      if (!gscMap.has(urlPath)) {
        gscMap.set(urlPath, {
          impressions: 0, clicks: 0, avg_position: 0, positionCount: 0,
          web_impressions: 0, discover_impressions: 0, top_queries: [],
        });
      }
      const entry = gscMap.get(urlPath)!;
      entry.impressions += row.impressions;
      entry.clicks += row.clicks;

      if (row.search_type === 'web') {
        entry.web_impressions += row.impressions;
        entry.avg_position += row.avg_position;
        entry.positionCount += 1;
      } else if (row.search_type === 'discover') {
        entry.discover_impressions += row.impressions;
      }

      // Merge queries
      if (row.top_queries && Array.isArray(row.top_queries)) {
        for (const q of row.top_queries) {
          const existing = entry.top_queries.find(eq => eq.query === q.query);
          if (existing) {
            existing.clicks += q.clicks;
            existing.impressions += q.impressions;
          } else {
            entry.top_queries.push({ ...q });
          }
        }
      }
    }

    // Aggregate GA4 per URL
    const ga4Map = new Map<string, {
      pageviews: number;
      sessions: number;
      avg_engagement_seconds: number;
      engagementCount: number;
      bounce_rate: number;
      bounceCount: number;
      pages_per_session: number;
      ppsCount: number;
      organic_pct: number;
      discover_pct: number;
      direct_pct: number;
      social_pct: number;
      srcCount: number;
    }>();

    for (const row of (ga4Data || [])) {
      const urlPath = extractPath(row.article_url);
      if (!ga4Map.has(urlPath)) {
        ga4Map.set(urlPath, {
          pageviews: 0, sessions: 0,
          avg_engagement_seconds: 0, engagementCount: 0,
          bounce_rate: 0, bounceCount: 0,
          pages_per_session: 0, ppsCount: 0,
          organic_pct: 0, discover_pct: 0, direct_pct: 0, social_pct: 0, srcCount: 0,
        });
      }
      const entry = ga4Map.get(urlPath)!;
      entry.pageviews += row.pageviews;
      entry.sessions += row.sessions;
      entry.avg_engagement_seconds += row.avg_engagement_seconds;
      entry.engagementCount += 1;
      entry.bounce_rate += row.bounce_rate;
      entry.bounceCount += 1;
      entry.pages_per_session += row.pages_per_session;
      entry.ppsCount += 1;
      entry.organic_pct += row.organic_pct;
      entry.discover_pct += row.discover_pct;
      entry.direct_pct += row.direct_pct;
      entry.social_pct += row.social_pct;
      entry.srcCount += 1;
    }

    // Combine all data sources
    const allUrls = new Set([...gscMap.keys(), ...ga4Map.keys()]);
    const articles: Array<Record<string, unknown>> = [];

    for (const urlPath of allUrls) {
      const gsc = gscMap.get(urlPath);
      const ga4 = ga4Map.get(urlPath);
      const title = titleMap.get(urlPath);

      // Calculate article age
      const publishedAt = title?.created_at || null;
      const ageDays = publishedAt ? daysBetween(publishedAt.split('T')[0], today) : null;

      // Determine status based on age-aware logic
      let status: 'early' | 'ok' | 'warning' | 'top' = 'ok';
      const impressions = gsc?.impressions || 0;
      const ctr = impressions > 0 ? (gsc?.clicks || 0) / impressions : 0;

      if (ageDays !== null && ageDays < 7) {
        status = 'early';
      } else if (impressions > 500 && ctr > 0.06) {
        status = 'top';
      } else if (impressions > 200 && ctr < 0.02 && (ageDays === null || ageDays >= 7)) {
        status = 'warning';
      }

      // Sort top queries by impressions
      const topQueries = (gsc?.top_queries || [])
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);

      articles.push({
        url: urlPath,
        // Title info
        seo_title: title?.selected_title || null,
        style: title?.style || null,
        selection_type: title?.selection_type || null,
        published_at: publishedAt,
        age_days: ageDays,
        has_seo_gem: !!title,
        // GSC
        impressions,
        clicks: gsc?.clicks || 0,
        ctr: Math.round(ctr * 1000) / 10,
        avg_position: gsc?.positionCount ? Math.round((gsc.avg_position / gsc.positionCount) * 10) / 10 : null,
        web_impressions: gsc?.web_impressions || 0,
        discover_impressions: gsc?.discover_impressions || 0,
        top_queries: topQueries,
        // GA4
        pageviews: ga4?.pageviews || 0,
        sessions: ga4?.sessions || 0,
        avg_engagement_sec: ga4?.engagementCount ? Math.round(ga4.avg_engagement_seconds / ga4.engagementCount) : 0,
        bounce_rate: ga4?.bounceCount ? Math.round((ga4.bounce_rate / ga4.bounceCount) * 10) / 10 : 0,
        pages_per_session: ga4?.ppsCount ? Math.round((ga4.pages_per_session / ga4.ppsCount) * 10) / 10 : 0,
        organic_pct: ga4?.srcCount ? Math.round(ga4.organic_pct / ga4.srcCount) : 0,
        discover_pct: ga4?.srcCount ? Math.round(ga4.discover_pct / ga4.srcCount) : 0,
        direct_pct: ga4?.srcCount ? Math.round(ga4.direct_pct / ga4.srcCount) : 0,
        social_pct: ga4?.srcCount ? Math.round(ga4.social_pct / ga4.srcCount) : 0,
        // Status
        status,
      });
    }

    // Sort by impressions desc
    articles.sort((a, b) => (b.impressions as number) - (a.impressions as number));

    return NextResponse.json({
      success: true,
      portal,
      period: { start: startDate, end: endDate },
      total: articles.length,
      seo_gem_count: articles.filter(a => a.has_seo_gem).length,
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

/** Extract URL path from full URL for matching */
function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // Already a path
    return url.startsWith('/') ? url : `/${url}`;
  }
}
