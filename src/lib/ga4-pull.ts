/**
 * GA4 Data Pull Service
 * 
 * Fetches Google Analytics 4 data for all configured portals
 * and stores it in Supabase `article_ga4_metrics` table.
 * 
 * Uses the GA4 Data API (v1beta).
 */

import { refreshAccessToken, getPortalTokens } from './google-oauth';
import { createClient } from '@supabase/supabase-js';

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

/**
 * Fetch GA4 page-level metrics for a portal and date range.
 */
export async function fetchGA4Data(portalId: string, startDate: string, endDate: string): Promise<{
  pages: Array<{
    url: string;
    pageviews: number;
    sessions: number;
    avg_engagement_seconds: number;
    bounce_rate: number;
    pages_per_session: number;
  }>;
  error?: string;
}> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.ga4_refresh_token || !tokens?.ga4_property_id) {
    return { pages: [], error: `GA4 not configured for portal: ${portalId}` };
  }

  const { access_token } = await refreshAccessToken(tokens.ga4_refresh_token);

  const response = await fetch(
    `${GA4_API}/properties/${tokens.ga4_property_id}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViewsPerSession' },
        ],
        limit: 10000,
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return { pages: [], error: `GA4 API error: ${err}` };
  }

  const data = await response.json();
  const rows = data.rows || [];

  const pages = rows.map((row: { dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }) => ({
    url: row.dimensionValues[0].value,
    pageviews: parseInt(row.metricValues[0].value) || 0,
    sessions: parseInt(row.metricValues[1].value) || 0,
    avg_engagement_seconds: parseFloat(row.metricValues[2].value) || 0,
    bounce_rate: parseFloat(row.metricValues[3].value) || 0,
    pages_per_session: parseFloat(row.metricValues[4].value) || 0,
  }));

  return { pages };
}

/**
 * Fetch traffic source breakdown per page.
 */
export async function fetchGA4TrafficSources(portalId: string, startDate: string, endDate: string): Promise<{
  sources: Map<string, { organic: number; discover: number; direct: number; social: number; total: number }>;
}> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.ga4_refresh_token || !tokens?.ga4_property_id) {
    return { sources: new Map() };
  }

  const { access_token } = await refreshAccessToken(tokens.ga4_refresh_token);

  const response = await fetch(
    `${GA4_API}/properties/${tokens.ga4_property_id}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'sessionDefaultChannelGroup' },
        ],
        metrics: [{ name: 'sessions' }],
        limit: 10000,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
    }
  );

  const sources = new Map<string, { organic: number; discover: number; direct: number; social: number; total: number }>();

  if (!response.ok) return { sources };

  const data = await response.json();
  const rows = data.rows || [];

  for (const row of rows) {
    const pagePath = row.dimensionValues[0].value;
    const channel = (row.dimensionValues[1].value || '').toLowerCase();
    const sessions = parseInt(row.metricValues[0].value) || 0;

    if (!sources.has(pagePath)) {
      sources.set(pagePath, { organic: 0, discover: 0, direct: 0, social: 0, total: 0 });
    }

    const s = sources.get(pagePath)!;
    s.total += sessions;

    if (channel.includes('organic')) {
      s.organic += sessions;
    } else if (channel.includes('direct')) {
      s.direct += sessions;
    } else if (channel.includes('social') || channel.includes('referral')) {
      s.social += sessions;
    }
    // Note: Discover traffic typically shows as "Organic Search" in GA4
  }

  return { sources };
}

/**
 * Fetch country breakdown for the portal.
 */
export async function fetchGA4Countries(portalId: string, startDate: string, endDate: string): Promise<{
  countries: Record<string, number>;
}> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.ga4_refresh_token || !tokens?.ga4_property_id) {
    return { countries: {} };
  }

  const { access_token } = await refreshAccessToken(tokens.ga4_refresh_token);

  const response = await fetch(
    `${GA4_API}/properties/${tokens.ga4_property_id}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }],
        limit: 20,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
    }
  );

  if (!response.ok) return { countries: {} };

  const data = await response.json();
  const rows = data.rows || [];
  const countries: Record<string, number> = {};

  for (const row of rows) {
    countries[row.dimensionValues[0].value] = parseInt(row.metricValues[0].value) || 0;
  }

  return { countries };
}

/**
 * Pull GA4 data and save to Supabase for a single portal.
 */
export async function syncGA4ForPortal(portalId: string, date: string): Promise<{
  success: boolean;
  pagesProcessed: number;
  error?: string;
}> {
  const sb = getSupabase();

  try {
    // Fetch page metrics
    const pageData = await fetchGA4Data(portalId, date, date);
    if (pageData.error) {
      return { success: false, pagesProcessed: 0, error: pageData.error };
    }

    // Fetch traffic source breakdown
    const sourceData = await fetchGA4TrafficSources(portalId, date, date);

    // Fetch country breakdown (portal-level, stored on each page for simplicity)
    const countryData = await fetchGA4Countries(portalId, date, date);

    // Combine into upsert rows
    const rows = pageData.pages.map(page => {
      const src = sourceData.sources.get(page.url);
      const total = src?.total || 1;

      return {
        portal_id: portalId,
        article_url: page.url,
        date,
        pageviews: page.pageviews,
        sessions: page.sessions,
        avg_engagement_seconds: Math.round(page.avg_engagement_seconds * 10) / 10,
        bounce_rate: Math.round(page.bounce_rate * 1000) / 1000,
        pages_per_session: Math.round(page.pages_per_session * 10) / 10,
        organic_pct: src ? Math.round((src.organic / total) * 100) : 0,
        discover_pct: src ? Math.round((src.discover / total) * 100) : 0,
        direct_pct: src ? Math.round((src.direct / total) * 100) : 0,
        social_pct: src ? Math.round((src.social / total) * 100) : 0,
        country_breakdown: countryData.countries,
      };
    });

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await sb
          .from('article_ga4_metrics')
          .upsert(chunk, { onConflict: 'portal_id,article_url,date' });

        if (error) {
          console.error(`❌ [GA4] Upsert error for ${portalId}:`, error.message);
        }
      }
    }

    // Update last sync timestamp
    await sb
      .from('portal_analytics_config')
      .update({ last_ga4_sync_at: new Date().toISOString() })
      .eq('portal_id', portalId);

    console.log(`✅ [GA4] ${portalId}: ${rows.length} pages synced for ${date}`);
    return { success: true, pagesProcessed: rows.length };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [GA4] ${portalId} sync error:`, msg);
    return { success: false, pagesProcessed: 0, error: msg };
  }
}
