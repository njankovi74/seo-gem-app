import { NextRequest, NextResponse } from 'next/server';

/**
 * CMS API Key Authentication Middleware
 * 
 * Each portal gets a unique API key stored in env vars:
 *   CMS_API_KEY_NEWSMAX=sk_cms_newsmax_xxxxx
 *   CMS_API_KEY_PORTAL2=sk_cms_portal2_xxxxx
 * 
 * The key maps to a portal_id for multi-tenant RAG isolation.
 */

interface AuthResult {
  valid: boolean;
  portalId?: string;
  error?: string;
}

// Build a map of API keys → portal IDs from environment variables
function getApiKeyMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('CMS_API_KEY_') && value) {
      // CMS_API_KEY_NEWSMAX → portalId = "newsmax"
      const portalId = key.replace('CMS_API_KEY_', '').toLowerCase();
      map.set(value, portalId);
    }
  }
  return map;
}

export function authenticateCmsRequest(request: NextRequest): AuthResult {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header. Use: Bearer <API_KEY>' };
  }

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    return { valid: false, error: 'Empty API key' };
  }

  const keyMap = getApiKeyMap();
  const portalId = keyMap.get(apiKey);

  if (!portalId) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true, portalId };
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  // Allowed CMS domains
  const allowed = [
    // Serbian (newsmaxbalkans.com)
    'https://backoffice.newsmaxbalkans.com',
    'http://backoffice.newsmaxbalkans.com',
    'https://backoffice-newsmax.cubesdev.rs',
    'http://backoffice-newsmax.cubesdev.rs',
    // Albanian (newsmaxbalkans.al) — confirm exact URLs with Cubes
    'https://backoffice.newsmaxbalkans.al',
    'http://backoffice.newsmaxbalkans.al',
    'https://backoffice-newsmaxal.cubesdev.rs',
    'http://backoffice-newsmaxal.cubesdev.rs',
    // Polish (newsmaxpolska.pl) — confirm exact URLs with Cubes
    'https://backoffice.newsmaxpolska.pl',
    'http://backoffice.newsmaxpolska.pl',
    'https://backoffice-newsmaxpl.cubesdev.rs',
    'http://backoffice-newsmaxpl.cubesdev.rs',
    // Add more portals here as they onboard
  ];

  // Also allow localhost for development
  if (process.env.NODE_ENV === 'development') {
    allowed.push('http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000');
  }

  const effectiveOrigin = origin && allowed.includes(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Standard error response for CMS API endpoints
 */
export function cmsErrorResponse(message: string, status: number, origin?: string | null): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: corsHeaders(origin) }
  );
}
