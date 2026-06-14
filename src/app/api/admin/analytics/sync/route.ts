/**
 * GET /api/admin/analytics/sync
 * 
 * Cron endpoint that pulls GSC + GA4 data for all connected portals.
 * 
 * Designed to run daily via Vercel Cron at ~03:00 UTC.
 * Can also be triggered manually with admin auth.
 * 
 * Query params:
 *   - date: specific date to sync (YYYY-MM-DD), defaults to 3 days ago for GSC
 *   - days: number of days to sync (1-30), defaults to 1
 *   - portal: specific portal_id to sync, defaults to all
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse } from '@/lib/admin-auth';
import { syncGSCForPortal } from '@/lib/gsc-pull';
import { syncGA4ForPortal } from '@/lib/ga4-pull';
import { createClient } from '@supabase/supabase-js';

// Vercel cron auth
const CRON_SECRET = process.env.CRON_SECRET;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

export async function GET(request: NextRequest) {
  // Allow Vercel Cron or admin auth
  const cronAuth = request.headers.get('authorization');
  const isCron = CRON_SECRET && cronAuth === `Bearer ${CRON_SECRET}`;

  if (!isCron) {
    const auth = authenticateAdmin(request);
    if (!auth.valid) {
      return adminErrorResponse(auth.error || 'Unauthorized', 401);
    }
  }

  const url = new URL(request.url);
  const specificPortal = url.searchParams.get('portal');
  const days = Math.min(parseInt(url.searchParams.get('days') || '1'), 30);

  try {
    const sb = getSupabase();

    // Get all connected portals
    const { data: portals } = await sb
      .from('portal_analytics_config')
      .select('portal_id, portal_name, gsc_refresh_token, ga4_refresh_token, gsc_property, ga4_property_id')
      .order('portal_id');

    if (!portals || portals.length === 0) {
      return NextResponse.json({ success: true, message: 'No portals configured' });
    }

    const targetPortals = specificPortal
      ? portals.filter(p => p.portal_id === specificPortal)
      : portals;

    const results: Array<{
      portal_id: string;
      portal_name: string;
      gsc: { date: string; pages: number; error?: string }[];
      ga4: { date: string; pages: number; error?: string }[];
    }> = [];

    for (const portal of targetPortals) {
      const portalResult: {
        portal_id: string;
        portal_name: string;
        gsc: { date: string; pages: number; error?: string }[];
        ga4: { date: string; pages: number; error?: string }[];
      } = {
        portal_id: portal.portal_id,
        portal_name: portal.portal_name,
        gsc: [],
        ga4: [],
      };

      for (let d = 0; d < days; d++) {
        // GSC: data has 2-3 day delay, so offset by 3 + d days
        const gscDate = getDaysAgo(3 + d);
        // GA4: near real-time, offset by 1 + d days (yesterday + back)
        const ga4Date = getDaysAgo(1 + d);

        // Pull GSC
        if (portal.gsc_refresh_token && portal.gsc_property) {
          console.log(`📊 [Sync] GSC ${portal.portal_id} for ${gscDate}...`);
          const gscResult = await syncGSCForPortal(portal.portal_id, gscDate);
          portalResult.gsc.push({
            date: gscDate,
            pages: gscResult.pagesProcessed,
            ...(gscResult.error ? { error: gscResult.error } : {}),
          });
        }

        // Pull GA4
        if (portal.ga4_refresh_token && portal.ga4_property_id) {
          console.log(`📊 [Sync] GA4 ${portal.portal_id} for ${ga4Date}...`);
          const ga4Result = await syncGA4ForPortal(portal.portal_id, ga4Date);
          portalResult.ga4.push({
            date: ga4Date,
            pages: ga4Result.pagesProcessed,
            ...(ga4Result.error ? { error: ga4Result.error } : {}),
          });
        }
      }

      results.push(portalResult);
    }

    // Summary
    const totalGSCPages = results.reduce((sum, r) => sum + r.gsc.reduce((s, g) => s + g.pages, 0), 0);
    const totalGA4Pages = results.reduce((sum, r) => sum + r.ga4.reduce((s, g) => s + g.pages, 0), 0);

    console.log(`✅ [Sync] Complete: ${totalGSCPages} GSC pages, ${totalGA4Pages} GA4 pages across ${results.length} portals`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        portals_synced: results.length,
        total_gsc_pages: totalGSCPages,
        total_ga4_pages: totalGA4Pages,
        days_synced: days,
      },
      results,
    });

  } catch (error) {
    console.error('❌ [Sync] Error:', error);
    return adminErrorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    );
  }
}
