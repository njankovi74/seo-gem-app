/**
 * Admin authentication middleware.
 * Protects admin routes with a simple password check.
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

/**
 * Verify admin access. Checks for password in:
 * 1. Authorization header: "Admin <password>"
 * 2. Query param: ?admin_key=<password>
 * 3. Cookie: admin_token=<password>
 */
export function authenticateAdmin(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  if (!ADMIN_PASSWORD) {
    return { valid: false, error: 'ADMIN_PASSWORD not configured on server' };
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme === 'Admin' && token === ADMIN_PASSWORD) {
      return { valid: true };
    }
  }

  // Check query param
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('admin_key');
  if (adminKey === ADMIN_PASSWORD) {
    return { valid: true };
  }

  // Check cookie
  const cookie = request.cookies.get('admin_token');
  if (cookie?.value === ADMIN_PASSWORD) {
    return { valid: true };
  }

  return { valid: false, error: 'Unauthorized — invalid admin credentials' };
}

/**
 * Helper to return admin error response.
 */
export function adminErrorResponse(message: string, status: number = 401): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}
