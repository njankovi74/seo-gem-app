/**
 * GET /api/admin/analytics/overview
 * 
 * Returns portal-level aggregate metrics for the admin dashboard.
 * 
 * Query params:
 *   - start: start date YYYY-MM-DD (default: 7 days ago)
 *   - end: end date YYYY-MM-DD (default: today)
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

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (!auth.valid) {
    return adminErrorResponse(auth.error || 'Unauthorized', 401);
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('start') || getDaysAgo(7);
  const endDate = url.searchParams.get('end') || getDaysAgo(0);

  const sb = getSupabase();

  try {
    // Get all portal configs
    const { data: portals } = await sb
      .from('portal_analytics_config')
      .select('portal_id, portal_name, last_gsc_sync_at, last_ga4_sync_at')
      .order('portal_id');

    const overview = [];

    for (const portal of (portals || [])) {
      // GSC aggregates
      const { data: gscWeb } = await sb
        .from('article_gsc_metrics')
        .select('impressions, clicks')
        .eq('portal_id', portal.portal_id)
        .eq('search_type', 'web')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: gscDiscover } = await sb
        .from('article_gsc_metrics')
        .select('impressions, clicks')
        .eq('portal_id', portal.portal_id)
        .eq('search_type', 'discover')
        .gte('date', startDate)
        .lte('date', endDate);

      // GA4 aggregates — paginated to get ALL data
      const ga4 = await fetchAll(sb, 'article_ga4_metrics',
        'article_url, pageviews, sessions, avg_engagement_seconds, pages_per_session, country_breakdown, organic_pct, direct_pct',
        { portal_id: portal.portal_id },
        startDate, endDate
      );

      // Get ALL SEO GEM article URLs for this portal
      const seoGemArticles = await fetchAllSimple(sb, 'title_history', 'article_url',
        { portal_id: portal.portal_id });

      // Count SEO GEM articles created in this period
      const { count: seoGemCount } = await sb
        .from('title_history')
        .select('id', { count: 'exact', head: true })
        .eq('portal_id', portal.portal_id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      // Total SEO GEM articles ever
      const { count: seoGemTotal } = await sb
        .from('title_history')
        .select('id', { count: 'exact', head: true })
        .eq('portal_id', portal.portal_id);

      // Build set of SEO GEM article IDs for matching
      // Extract the numeric article ID from URLs like /category/vesti/12345/slug/vest
      const seoGemIds = new Set<string>();
      for (const art of seoGemArticles) {
        if (!art.article_url) continue;
        // Match numeric ID that's at least 4 digits (to exclude small author IDs etc)
        const match = art.article_url.match(/\/(\d{4,})\//);
        if (match) seoGemIds.add(match[1]);
      }

      // Calculate totals
      const webImpressions = (gscWeb || []).reduce((s, r) => s + r.impressions, 0);
      const webClicks = (gscWeb || []).reduce((s, r) => s + r.clicks, 0);
      const discoverImpressions = (gscDiscover || []).reduce((s, r) => s + r.impressions, 0);
      const discoverClicks = (gscDiscover || []).reduce((s, r) => s + r.clicks, 0);
      const totalImpressions = webImpressions + discoverImpressions;
      const totalClicks = webClicks + discoverClicks;

      // GA4 totals + SEO GEM filtered
      let totalPageviews = 0, totalSessions = 0, totalEngagement = 0, totalPPS = 0;
      let gemPageviews = 0, gemSessions = 0, gemEngagement = 0, gemPPS = 0, gemCount = 0;
      let gemOrganicDirectViews = 0;
      const countryTotals: Record<string, number> = {};

      for (const row of (ga4 || [])) {
        totalPageviews += row.pageviews;
        totalSessions += row.sessions;
        totalEngagement += row.avg_engagement_seconds;
        totalPPS += row.pages_per_session;

        // Check if this URL contains a SEO GEM article ID
        const idMatch = row.article_url.match(/\/(\d{4,})\//);
        if (idMatch && seoGemIds.has(idMatch[1])) {
          gemPageviews += row.pageviews;
          gemSessions += row.sessions;
          gemEngagement += row.avg_engagement_seconds;
          gemPPS += row.pages_per_session;
          gemCount += 1;
          // Calculate Organic + Direct portion of pageviews
          const orgDirectPct = ((row.organic_pct || 0) + (row.direct_pct || 0)) / 100;
          gemOrganicDirectViews += Math.round(row.pageviews * orgDirectPct);
        }

        // Country aggregation
        if (row.country_breakdown) {
          for (const [country, count] of Object.entries(row.country_breakdown)) {
            countryTotals[country] = (countryTotals[country] || 0) + (count as number);
          }
        }
      }

      const ga4Count = (ga4 || []).length;
      const avgEngagement = ga4Count > 0 ? totalEngagement / ga4Count : 0;
      const avgPPS = ga4Count > 0 ? totalPPS / ga4Count : 0;
      const gemAvgEngagement = gemCount > 0 ? gemEngagement / gemCount : 0;
      const gemAvgPPS = gemCount > 0 ? gemPPS / gemCount : 0;

      // Top 5 countries
      const topCountries = Object.entries(countryTotals)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([country, sessions]) => ({ country, sessions }));

      overview.push({
        portal_id: portal.portal_id,
        portal_name: portal.portal_name,
        last_sync: {
          gsc: portal.last_gsc_sync_at,
          ga4: portal.last_ga4_sync_at,
        },
        seo_gem_articles_period: seoGemCount || 0,
        seo_gem_articles_total: seoGemTotal || 0,
        gsc: {
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0,
          web_impressions: webImpressions,
          web_clicks: webClicks,
          discover_impressions: discoverImpressions,
          discover_clicks: discoverClicks,
        },
        ga4: {
          pageviews: totalPageviews,
          sessions: totalSessions,
          avg_engagement_sec: Math.round(avgEngagement),
          pages_per_session: Math.round(avgPPS * 10) / 10,
          top_countries: topCountries,
          // SEO GEM specific GA4 data
          gem_pageviews: gemPageviews,
          gem_sessions: gemSessions,
          gem_avg_engagement_sec: Math.round(gemAvgEngagement),
          gem_pages_per_session: Math.round(gemAvgPPS * 10) / 10,
          gem_pageviews_pct: totalPageviews > 0 ? Math.round((gemPageviews / totalPageviews) * 1000) / 10 : 0,
          gem_sessions_pct: totalSessions > 0 ? Math.round((gemSessions / totalSessions) * 1000) / 10 : 0,
          // Organic + Direct only (SEO GEM attributable traffic)
          gem_organic_direct_views: gemOrganicDirectViews,
          gem_organic_direct_pct: gemPageviews > 0 ? Math.round((gemOrganicDirectViews / gemPageviews) * 1000) / 10 : 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      period: { start: startDate, end: endDate },
      portals: overview,
    });

  } catch (error) {
    console.error('❌ [Overview] Error:', error);
    return adminErrorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    );
  }
}

/** Paginated fetch for analytics tables (overcomes Supabase 1000-row default) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(
  sb: any,
  table: string,
  select: string,
  filters: Record<string, string>,
  startDate: string,
  endDate: string,
  pageSize = 1000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    q = q.gte('date', startDate).lte('date', endDate);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Paginated fetch for simple queries without date range */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllSimple(
  sb: any,
  table: string,
  select: string,
  filters: Record<string, string>,
  pageSize = 1000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + pageSize - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

