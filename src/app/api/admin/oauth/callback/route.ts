/**
 * GET /api/admin/oauth/callback
 * 
 * Google OAuth callback — receives the authorization code,
 * exchanges it for tokens, and saves to Supabase.
 * 
 * Google redirects here with: ?code=xxx&state=portal_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, savePortalTokens } from '@/lib/google-oauth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');  // portal_id
  const error = url.searchParams.get('error');

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    console.error(`❌ [Admin/OAuth] OAuth error: ${error}`);
    return new NextResponse(
      renderHTML('OAuth Error', `Google returned an error: ${error}`, false),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code || !state) {
    return new NextResponse(
      renderHTML('Missing Parameters', 'Missing code or state parameter.', false),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    console.log(`🔐 [Admin/OAuth] Exchanging code for tokens, portal: ${state}`);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      console.warn('⚠️ [Admin/OAuth] No refresh_token received — user may have already authorized');
    }

    // Save both GSC and GA4 tokens (same OAuth gives access to both)
    await savePortalTokens(state, {
      gsc_refresh_token: tokens.refresh_token,
      ga4_refresh_token: tokens.refresh_token,  // Same token works for both
    });

    console.log(`✅ [Admin/OAuth] Tokens saved for portal: ${state}`);

    return new NextResponse(
      renderHTML(
        'Connected!',
        `Successfully connected Google Search Console and GA4 for portal: <strong>${state}</strong>.<br><br>
        You can close this window. The system will start pulling data automatically.`,
        true
      ),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (err) {
    console.error('❌ [Admin/OAuth] Token exchange failed:', err);
    return new NextResponse(
      renderHTML('Error', `Token exchange failed: ${err instanceof Error ? err.message : 'Unknown error'}`, false),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/** Render a simple HTML page for the OAuth callback result */
function renderHTML(title: string, message: string, success: boolean): string {
  const color = success ? '#10b981' : '#ef4444';
  const icon = success ? '✅' : '❌';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SEO GEM Admin — ${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; margin: 0;
      background: #0f172a; color: #e2e8f0;
    }
    .card {
      background: #1e293b; border-radius: 16px; padding: 48px;
      max-width: 500px; text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 1px solid ${color}33;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${color}; margin: 0 0 16px 0; font-size: 24px; }
    p { color: #94a3b8; line-height: 1.6; }
    strong { color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
