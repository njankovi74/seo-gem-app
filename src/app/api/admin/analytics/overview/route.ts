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

      // GA4 aggregates
      const { data: ga4 } = await sb
        .from('article_ga4_metrics')
        .select('pageviews, sessions, avg_engagement_seconds, pages_per_session, country_breakdown')
        .eq('portal_id', portal.portal_id)
        .gte('date', startDate)
        .lte('date', endDate);

      // Count SEO GEM articles
      const { count: seoGemCount } = await sb
        .from('title_history')
        .select('id', { count: 'exact', head: true })
        .eq('portal_id', portal.portal_id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      // Calculate totals
      const webImpressions = (gscWeb || []).reduce((s, r) => s + r.impressions, 0);
      const webClicks = (gscWeb || []).reduce((s, r) => s + r.clicks, 0);
      const discoverImpressions = (gscDiscover || []).reduce((s, r) => s + r.impressions, 0);
      const discoverClicks = (gscDiscover || []).reduce((s, r) => s + r.clicks, 0);
      const totalImpressions = webImpressions + discoverImpressions;
      const totalClicks = webClicks + discoverClicks;

      const totalPageviews = (ga4 || []).reduce((s, r) => s + r.pageviews, 0);
      const totalSessions = (ga4 || []).reduce((s, r) => s + r.sessions, 0);
      const avgEngagement = (ga4 || []).length > 0
        ? (ga4 || []).reduce((s, r) => s + r.avg_engagement_seconds, 0) / (ga4 || []).length
        : 0;
      const avgPPS = (ga4 || []).length > 0
        ? (ga4 || []).reduce((s, r) => s + r.pages_per_session, 0) / (ga4 || []).length
        : 0;

      // Aggregate country data from last GA4 entry
      const countryTotals: Record<string, number> = {};
      for (const row of (ga4 || [])) {
        if (row.country_breakdown) {
          for (const [country, count] of Object.entries(row.country_breakdown)) {
            countryTotals[country] = (countryTotals[country] || 0) + (count as number);
          }
        }
      }
      // Top 5 countries
      const topCountries = Object.entries(countryTotals)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([country, sessions]) => ({ country, sessions }));

      // Unique URLs count
      const uniqueWebUrls = new Set((gscWeb || []).map(r => JSON.stringify(r))).size; // approximate

      overview.push({
        portal_id: portal.portal_id,
        portal_name: portal.portal_name,
        last_sync: {
          gsc: portal.last_gsc_sync_at,
          ga4: portal.last_ga4_sync_at,
        },
        seo_gem_articles: seoGemCount || 0,
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
