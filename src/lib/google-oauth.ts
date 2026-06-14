/**
 * Google OAuth 2.0 helper for Search Console and GA4 API access.
 * Handles token generation, refresh, and storage in Supabase.
 */

import { createClient } from '@supabase/supabase-js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Scopes needed for GSC + GA4 read-only access
const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',        // GSC
  'https://www.googleapis.com/auth/analytics.readonly',          // GA4
].join(' ');

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET env vars');
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://seo-gem-app.vercel.app';

  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/admin/oauth/callback`,
  };
}

/**
 * Generate the Google OAuth authorization URL.
 * The `state` parameter carries the portal_id so we know which portal to link.
 */
export function getAuthorizationUrl(portalId: string): string {
  const config = getOAuthConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',        // Get refresh_token
    prompt: 'consent',             // Force consent to ensure refresh_token
    state: portalId,               // Carry portal_id through OAuth flow
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens (access_token + refresh_token).
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const config = getOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const config = getOAuthConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}

// ── Supabase helpers for token storage ──

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

/**
 * Save OAuth tokens for a portal.
 */
export async function savePortalTokens(portalId: string, tokens: {
  gsc_refresh_token?: string;
  ga4_refresh_token?: string;
  gsc_property?: string;
  ga4_property_id?: string;
}): Promise<void> {
  const sb = getSupabase();

  const { error } = await sb
    .from('portal_analytics_config')
    .upsert({
      portal_id: portalId,
      portal_name: portalId,  // Will be updated later
      ...tokens,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'portal_id' });

  if (error) throw new Error(`Failed to save tokens: ${error.message}`);
}

/**
 * Get stored tokens for a portal.
 */
export async function getPortalTokens(portalId: string): Promise<{
  gsc_refresh_token: string | null;
  ga4_refresh_token: string | null;
  gsc_property: string | null;
  ga4_property_id: string | null;
} | null> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from('portal_analytics_config')
    .select('gsc_refresh_token, ga4_refresh_token, gsc_property, ga4_property_id')
    .eq('portal_id', portalId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get a fresh access token for a portal's GSC access.
 * Automatically refreshes using stored refresh_token.
 */
export async function getGSCAccessToken(portalId: string): Promise<string> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.gsc_refresh_token) {
    throw new Error(`No GSC token stored for portal: ${portalId}`);
  }

  const { access_token } = await refreshAccessToken(tokens.gsc_refresh_token);
  return access_token;
}

/**
 * Get a fresh access token for a portal's GA4 access.
 */
export async function getGA4AccessToken(portalId: string): Promise<string> {
  const tokens = await getPortalTokens(portalId);
  if (!tokens?.ga4_refresh_token) {
    throw new Error(`No GA4 token stored for portal: ${portalId}`);
  }

  const { access_token } = await refreshAccessToken(tokens.ga4_refresh_token);
  return access_token;
}

/**
 * List all configured portals with their analytics status.
 */
export async function listPortalConfigs(): Promise<Array<{
  portal_id: string;
  portal_name: string;
  gsc_connected: boolean;
  ga4_connected: boolean;
  last_gsc_sync_at: string | null;
  last_ga4_sync_at: string | null;
}>> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from('portal_analytics_config')
    .select('*')
    .order('portal_id');

  if (error) throw new Error(`Failed to list configs: ${error.message}`);

  return (data || []).map(row => ({
    portal_id: row.portal_id,
    portal_name: row.portal_name,
    gsc_connected: !!row.gsc_refresh_token,
    ga4_connected: !!row.ga4_refresh_token,
    last_gsc_sync_at: row.last_gsc_sync_at,
    last_ga4_sync_at: row.last_ga4_sync_at,
  }));
}
