/**
 * GSC Data Pull Service
 * 
 * Fetches Search Console data for all configured portals
 * and stores it in Supabase `article_gsc_metrics` and `site_gsc_daily` tables.
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

export interface GSCSiteTotal {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

/**
 * Fetch GSC data for a single portal for a given date range.
 * Returns per-page metrics with top queries.
 * Paginates per-page web metrics in batches of 5,000 up to 25,000 rows.
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
  const endpoint = `${GSC_API}/sites/${encodeURIComponent(tokens.gsc_property)}/searchAnalytics/query`;

  // Step 1: Get per-page metrics (rowLimit 5000, paginated with startRow up to 25000)
  const PAGE_ROW_LIMIT = 5000;
  const MAX_TOTAL_ROWS = 25000;
  const pageRows: GSCRow[] = [];

  for (let startRow = 0; startRow < MAX_TOTAL_ROWS; startRow += PAGE_ROW_LIMIT) {
    const pageResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: PAGE_ROW_LIMIT,
        startRow,
        type: 'web',
      }),
    });

    if (!pageResponse.ok) {
      const err = await pageResponse.text();
      return { pages: [], error: `GSC API error: ${err}` };
    }

    const pageData = await pageResponse.json();
    const batchRows: GSCRow[] = pageData.rows || [];
    pageRows.push(...batchRows);

    if (batchRows.length < PAGE_ROW_LIMIT) {
      break;
    }
  }

  // Step 2: Get per-page + query breakdown (top queries per page — kept at rowLimit 5000)
  const queryResponse = await fetch(endpoint, {
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
  });

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
 * Uses rowLimit 2000 with startRow pagination up to 25,000.
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
  const endpoint = `${GSC_API}/sites/${encodeURIComponent(tokens.gsc_property)}/searchAnalytics/query`;

  const DISCOVER_ROW_LIMIT = 2000;
  const MAX_TOTAL_ROWS = 25000;
  const discoverRows: GSCRow[] = [];

  for (let startRow = 0; startRow < MAX_TOTAL_ROWS; startRow += DISCOVER_ROW_LIMIT) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: DISCOVER_ROW_LIMIT,
        startRow,
        type: 'discover',
      }),
    });

    if (!response.ok) break;

    const data = await response.json();
    const batchRows: GSCRow[] = data.rows || [];
    discoverRows.push(...batchRows);

    if (batchRows.length < DISCOVER_ROW_LIMIT) {
      break;
    }
  }

  return {
    pages: discoverRows.map((row: GSCRow) => ({
      url: row.keys[0],
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: Math.round(row.ctr * 1000) / 1000,
    })),
  };
}

/**
 * Fetch site-wide daily totals from GSC without 'page' dimension
 * for both 'web' and 'discover' search types.
 */
export async function fetchGSCSiteTotals(portalId: string, date: string): Promise<{
  web: GSCSiteTotal;
  discover: GSCSiteTotal;
  error?: string;
}> {
  const emptyTotal: GSCSiteTotal = { impressions: 0, clicks: 0, ctr: 0, position: 0 };
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.gsc_refresh_token || !tokens?.gsc_property) {
    return {
      web: { ...emptyTotal },
      discover: { ...emptyTotal },
      error: `GSC not configured for portal: ${portalId}`,
    };
  }

  const { access_token } = await refreshAccessToken(tokens.gsc_refresh_token);
  const endpoint = `${GSC_API}/sites/${encodeURIComponent(tokens.gsc_property)}/searchAnalytics/query`;

  const fetchType = async (searchType: 'web' | 'discover'): Promise<GSCSiteTotal> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: date,
        endDate: date,
        type: searchType,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (searchType === 'discover') {
        console.warn(`⚠️ [GSC] Discover site totals non-OK for ${portalId} (${date}): ${err}`);
        return { ...emptyTotal };
      }
      throw new Error(`GSC site totals (${searchType}) API error: ${err}`);
    }

    const data = await response.json();
    const row = data.rows?.[0];
    if (!row) {
      return { ...emptyTotal };
    }

    return {
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 10000,
      position: row.position ? Math.round(row.position * 10) / 10 : 0,
    };
  };

  try {
    const [web, discover] = await Promise.all([
      fetchType('web'),
      fetchType('discover'),
    ]);
    return { web, discover };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      web: { ...emptyTotal },
      discover: { ...emptyTotal },
      error: msg,
    };
  }
}

/**
 * Upsert site-wide daily GSC totals into `site_gsc_daily`.
 */
export async function upsertGSCSiteTotals(
  portalId: string,
  date: string,
  siteTotals: { web: GSCSiteTotal; discover: GSCSiteTotal },
  pagesPulled?: { web: number; discover: number }
): Promise<{ error?: string }> {
  const sb = getSupabase();
  const nowIso = new Date().toISOString();

  const dailyRows = [
    {
      portal_id: portalId,
      date,
      search_type: 'web',
      impressions: siteTotals.web.impressions,
      clicks: siteTotals.web.clicks,
      ctr: siteTotals.web.ctr,
      avg_position: siteTotals.web.position,
      ...(pagesPulled !== undefined ? { pages_pulled: pagesPulled.web } : {}),
      updated_at: nowIso,
    },
    {
      portal_id: portalId,
      date,
      search_type: 'discover',
      impressions: siteTotals.discover.impressions,
      clicks: siteTotals.discover.clicks,
      ctr: siteTotals.discover.ctr,
      avg_position: siteTotals.discover.position,
      ...(pagesPulled !== undefined ? { pages_pulled: pagesPulled.discover } : {}),
      updated_at: nowIso,
    },
  ];

  const { error } = await sb
    .from('site_gsc_daily')
    .upsert(dailyRows, { onConflict: 'portal_id,date,search_type' });

  if (error) {
    console.error(`❌ [GSC] site_gsc_daily upsert error for ${portalId} (${date}):`, error.message);
    return { error: error.message };
  }

  return {};
}

/**
 * Pull GSC data and save to Supabase for a single portal.
 */
export async function syncGSCForPortal(portalId: string, date: string): Promise<{
  success: boolean;
  pagesProcessed: number;
  sitePages?: { web: number; discover: number };
  siteTotals?: { web: GSCSiteTotal; discover: GSCSiteTotal };
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
      // Batch upsert in chunks of 500
      for (let i = 0; i < allRows.length; i += 500) {
        const chunk = allRows.slice(i, i + 500);
        const { error } = await sb
          .from('article_gsc_metrics')
          .upsert(chunk, { onConflict: 'portal_id,article_url,date,search_type' });

        if (error) {
          console.error(`❌ [GSC] Upsert error for ${portalId}:`, error.message);
        }
      }
    }

    // Fetch and upsert site-wide daily totals (web + discover)
    const sitePages = {
      web: webRows.length,
      discover: discoverRows.length,
    };
    const siteTotals = await fetchGSCSiteTotals(portalId, date);
    if (!siteTotals.error) {
      await upsertGSCSiteTotals(portalId, date, siteTotals, sitePages);
    } else {
      console.error(`❌ [GSC] Site totals error for ${portalId} (${date}):`, siteTotals.error);
    }

    // Update last sync timestamp
    await sb
      .from('portal_analytics_config')
      .update({ last_gsc_sync_at: new Date().toISOString() })
      .eq('portal_id', portalId);

    console.log(`✅ [GSC] ${portalId}: ${allRows.length} pages synced for ${date} (web: ${sitePages.web}, discover: ${sitePages.discover})`);
    return {
      success: true,
      pagesProcessed: allRows.length,
      sitePages,
      siteTotals: {
        web: siteTotals.web,
        discover: siteTotals.discover,
      },
      ...(siteTotals.error ? { error: siteTotals.error } : {}),
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [GSC] ${portalId} sync error:`, msg);
    return { success: false, pagesProcessed: 0, error: msg };
  }
}
