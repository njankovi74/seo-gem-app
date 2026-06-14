/**
 * POST /api/admin/oauth/start
 * 
 * Starts the Google OAuth flow for connecting GSC/GA4 to a portal.
 * Body: { portal_id: "newsmax" }
 * Returns: { authUrl: "https://accounts.google.com/..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse } from '@/lib/admin-auth';
import { getAuthorizationUrl } from '@/lib/google-oauth';

export async function POST(request: NextRequest) {
  // Verify admin
  const auth = authenticateAdmin(request);
  if (!auth.valid) {
    return adminErrorResponse(auth.error || 'Unauthorized', 401);
  }

  try {
    const { portal_id } = await request.json();

    if (!portal_id) {
      return adminErrorResponse('portal_id is required', 400);
    }

    const validPortals = ['newsmax', 'newsmax_al', 'newsmax_pl', 'insajder'];
    if (!validPortals.includes(portal_id)) {
      return adminErrorResponse(`Invalid portal_id. Valid: ${validPortals.join(', ')}`, 400);
    }

    const authUrl = getAuthorizationUrl(portal_id);

    console.log(`🔐 [Admin/OAuth] Starting OAuth flow for portal: ${portal_id}`);

    return NextResponse.json({
      success: true,
      authUrl,
      portal_id,
      instructions: 'Open this URL in the browser with the Google account that has GSC/GA4 access.',
    });

  } catch (error) {
    console.error('❌ [Admin/OAuth] Error:', error);
    return adminErrorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    );
  }
}
