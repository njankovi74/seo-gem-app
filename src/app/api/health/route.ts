import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    nodeEnv: process.env.NODE_ENV,
    provider: process.env.SEO_LLM_PROVIDER,
    openaiModel: process.env.OPENAI_MODEL,
    geminiModel: process.env.GEMINI_MODEL,
    strictModel: (process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true',
    required: (process.env.SEO_LLM_REQUIRED || '').toLowerCase() === 'true',
    debug: (process.env.SEO_DEBUG || '').toLowerCase() === 'true',
    hasKeys: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
  };

  return NextResponse.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
    env,
  });
}
