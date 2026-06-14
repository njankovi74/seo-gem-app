/**
 * GET /api/admin/analytics/status
 * 
 * Returns the current analytics connection status for all portals.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse } from '@/lib/admin-auth';
import { listPortalConfigs } from '@/lib/google-oauth';

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (!auth.valid) {
    return adminErrorResponse(auth.error || 'Unauthorized', 401);
  }

  try {
    const configs = await listPortalConfigs();

    return NextResponse.json({
      success: true,
      portals: configs,
      summary: {
        total: configs.length,
        gsc_connected: configs.filter(c => c.gsc_connected).length,
        ga4_connected: configs.filter(c => c.ga4_connected).length,
      },
    });

  } catch (error) {
    console.error('❌ [Admin/Status] Error:', error);
    return adminErrorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    );
  }
}
