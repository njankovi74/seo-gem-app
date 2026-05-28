import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
    version: '2.0',
  });
}
