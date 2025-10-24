import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'openai' | 'gemini';

async function run(provider: Provider, model?: string) {
  const prov = (provider || process.env.SEO_LLM_PROVIDER || '') as Provider;
  const mdl = model || (prov === 'openai' ? process.env.OPENAI_MODEL : process.env.GEMINI_MODEL) || undefined;

  try {
    if (prov === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY missing');
      // Use a literal dynamic import so Vercel's dependency tracer includes the package
      const mod: any = await import('openai');
      const client = new mod.default({ apiKey });
      const res = await client.responses.create({
        model: mdl || 'gpt-4o-mini',
        input: [{ role: 'user', content: 'Vrati samo JSON: {"status":"ok"}' }],
        max_output_tokens: 64,
        temperature: 0.2,
      } as any);
      const output = (res as any).output_text || (res as any).choices?.[0]?.message?.content || '';
      return NextResponse.json({ ok: true, provider: prov, model: mdl, output });
    }

    if (prov === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY missing');
      // Use a literal dynamic import so Vercel's dependency tracer includes the package
      const mod: any = await import('@google/generative-ai');
      const client = new mod.GoogleGenerativeAI(apiKey);
      const m = client.getGenerativeModel({ model: mdl || 'gemini-1.5-flash', generationConfig: { temperature: 0.2, maxOutputTokens: 64 } });
      const result = await m.generateContent('Vrati samo JSON: {"status":"ok"}');
      const text = (result as any)?.response?.text?.() || (result as any)?.response?.text || '';
      return NextResponse.json({ ok: true, provider: prov, model: mdl, output: text });
    }

    return NextResponse.json({ ok: false, error: 'Unknown provider', provider: prov, model: mdl }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error', provider: prov, model: mdl }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const provider = (body.provider || process.env.SEO_LLM_PROVIDER || '').toLowerCase() as Provider;
  const model = body.model as string | undefined;
  return run(provider, model);
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const provider = (search.get('provider') || process.env.SEO_LLM_PROVIDER || '').toLowerCase() as Provider;
  const model = search.get('model') || undefined;
  return run(provider, model);
}
