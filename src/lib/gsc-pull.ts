/**
 * GSC Data Pull Service
 * 
 * Fetches Search Console data for all configured portals
 * and stores it in Supabase `article_gsc_metrics` table.
 */

import { refreshAccessToken, getPortalTokens } from './google-oauth';
import { createClient } from '@supabase/supabase-js';

const GSC_API = 'https://www.googleapis.com/webmasters/v3';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Fetch GSC data for a single portal for a given date range.
 * Returns per-page metrics with top queries.
 */
export async function fetchGSCData(portalId: string, startDate: string, endDate: string): Promise<{
  pages: Array<{
    url: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avg_position: number;
    search_type: string;
    top_queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  }>;
  error?: string;
}> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.gsc_refresh_token || !tokens?.gsc_property) {
    return { pages: [], error: `GSC not configured for portal: ${portalId}` };
  }

  const { access_token } = await refreshAccessToken(tokens.gsc_refresh_token);

  // Step 1: Get per-page metrics
  const pageResponse = await fetch(
    `${GSC_API}/sites/${encodeURIComponent(tokens.gsc_property)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500,
        type: 'web',
      }),
    }
  );

  if (!pageResponse.ok) {
    const err = await pageResponse.text();
    return { pages: [], error: `GSC API error: ${err}` };
  }

  const pageData = await pageResponse.json();
  const pageRows: GSCRow[] = pageData.rows || [];

  // Step 2: Get per-page + query breakdown (top queries per page)
  const queryResponse = await fetch(
    `${GSC_API}/sites/${encodeURIComponent(tokens.gsc_property)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page', 'query'],
        rowLimit: 5000,
        type: 'web',
      }),
    }
  );

  // Build query map: page → queries[]
  const queryMap: Map<string, Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>> = new Map();

  if (queryResponse.ok) {
    const queryData = await queryResponse.json();
    const queryRows: GSCRow[] = queryData.rows || [];

    for (const row of queryRows) {
      const [page, query] = row.keys;
      if (!queryMap.has(page)) queryMap.set(page, []);
      queryMap.get(page)!.push({
        query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 1000) / 1000,
        position: Math.round(row.position * 10) / 10,
      });
    }

    // Sort queries by impressions desc, keep top 10 per page
    for (const [page, queries] of queryMap) {
      queries.sort((a, b) => b.impressions - a.impressions);
      queryMap.set(page, queries.slice(0, 10));
    }
  }

  // Combine
  const pages = pageRows.map(row => ({
    url: row.keys[0],
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: Math.round(row.ctr * 1000) / 1000,
    avg_position: Math.round(row.position * 10) / 10,
    search_type: 'web',
    top_queries: queryMap.get(row.keys[0]) || [],
  }));

  return { pages };
}

/**
 * Also fetch Discover data (separate search type).
 */
export async function fetchGSCDiscoverData(portalId: string, startDate: string, endDate: string): Promise<{
  pages: Array<{
    url: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
}> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.gsc_refresh_token || !tokens?.gsc_property) {
    return { pages: [] };
  }

  const { access_token } = await refreshAccessToken(tokens.gsc_refresh_token);

  const response = await fetch(
    `${GSC_API}/sites/${encodeURIComponent(tokens.gsc_property)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500,
        type: 'discover',
      }),
    }
  );

  if (!response.ok) return { pages: [] };

  const data = await response.json();
  return {
    pages: (data.rows || []).map((row: GSCRow) => ({
      url: row.keys[0],
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round(row.ctr * 1000) / 1000,
    })),
  };
}

/**
 * Pull GSC data and save to Supabase for a single portal.
 */
export async function syncGSCForPortal(portalId: string, date: string): Promise<{
  success: boolean;
  pagesProcessed: number;
  error?: string;
}> {
  const sb = getSupabase();

  try {
    // Fetch web search data
    const webData = await fetchGSCData(portalId, date, date);
    if (webData.error) {
      return { success: false, pagesProcessed: 0, error: webData.error };
    }

    // Fetch Discover data
    const discoverData = await fetchGSCDiscoverData(portalId, date, date);

    // Upsert web search metrics
    const webRows = webData.pages.map(page => ({
      portal_id: portalId,
      article_url: page.url,
      date,
      impressions: page.impressions,
      clicks: page.clicks,
      ctr: page.ctr,
      avg_position: page.avg_position,
      search_type: 'web',
      top_queries: page.top_queries,
    }));

    // Upsert Discover metrics
    const discoverRows = discoverData.pages.map(page => ({
      portal_id: portalId,
      article_url: page.url,
      date,
      impressions: page.impressions,
      clicks: page.clicks,
      ctr: page.ctr,
      avg_position: 0,
      search_type: 'discover',
      top_queries: [],
    }));

    const allRows = [...webRows, ...discoverRows];

    if (allRows.length > 0) {
      // Batch upsert in chunks of 100
      for (let i = 0; i < allRows.length; i += 100) {
        const chunk = allRows.slice(i, i + 100);
        const { error } = await sb
          .from('article_gsc_metrics')
          .upsert(chunk, { onConflict: 'portal_id,article_url,date,search_type' });

        if (error) {
          console.error(`❌ [GSC] Upsert error for ${portalId}:`, error.message);
        }
      }
    }

    // Update last sync timestamp
    await sb
      .from('portal_analytics_config')
      .update({ last_gsc_sync_at: new Date().toISOString() })
      .eq('portal_id', portalId);

    console.log(`✅ [GSC] ${portalId}: ${allRows.length} pages synced for ${date}`);
    return { success: true, pagesProcessed: allRows.length };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [GSC] ${portalId} sync error:`, msg);
    return { success: false, pagesProcessed: 0, error: msg };
  }
}
