import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is disabled in production.' },
    { status: 403 },
  );
}
