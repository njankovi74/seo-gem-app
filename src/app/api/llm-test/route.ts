import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'openai' | 'gemini';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const provider = (body.provider || process.env.SEO_LLM_PROVIDER || '').toLowerCase() as Provider;
  const model = body.model || (provider === 'openai' ? process.env.OPENAI_MODEL : process.env.GEMINI_MODEL);

  try {
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY missing');
      const dynImport: any = new Function('m', 'return import(m)');
      const mod: any = await dynImport('openai');
      const client = new mod.default({ apiKey });
      const res = await client.responses.create({
        model: model || 'gpt-4o-mini',
        input: [{ role: 'user', content: 'Vrati samo JSON: {"status":"ok"}' }],
        max_output_tokens: 64,
        temperature: 0.2,
      } as any);
      const output = (res as any).output_text || (res as any).choices?.[0]?.message?.content || '';
      return NextResponse.json({ ok: true, provider, model, output });
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY missing');
      const dynImport: any = new Function('m', 'return import(m)');
      const mod: any = await dynImport('@google/generative-ai');
      const client = new mod.GoogleGenerativeAI(apiKey);
      const m = client.getGenerativeModel({ model: model || 'gemini-1.5-flash', generationConfig: { temperature: 0.2, maxOutputTokens: 64 } });
      const result = await m.generateContent('Vrati samo JSON: {"status":"ok"}');
      const text = (result as any)?.response?.text?.() || (result as any)?.response?.text || '';
      return NextResponse.json({ ok: true, provider, model, output: text });
    }

    return NextResponse.json({ ok: false, error: 'Unknown provider', provider, model }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error', provider, model }, { status: 500 });
  }
}
