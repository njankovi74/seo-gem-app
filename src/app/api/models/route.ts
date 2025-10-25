import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qpProvider = (searchParams.get('provider') || '').toLowerCase();
    const provider = (qpProvider || process.env.SEO_LLM_PROVIDER || 'openai').toLowerCase();

    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ success: false, error: 'OPENAI_API_KEY nije podešen' }, { status: 400 });
      }

      const baseURL = process.env.OPENAI_BASE_URL;
      const dynImport: any = new Function('m', 'return import(m)');
      const mod: any = await dynImport('openai').catch(() => null);
      if (!mod || !mod.default) {
        return NextResponse.json({ success: false, error: 'OpenAI SDK nije instaliran' }, { status: 500 });
      }

      const client = new mod.default({ apiKey, baseURL });

      // Pokušaj listanja modela (SDK v4)
      const modelsResp = await client.models.list();
      const ids: string[] = Array.isArray(modelsResp?.data) ? modelsResp.data.map((m: any) => m.id) : [];

      const wanted = ['gpt-5', 'gpt-4o', 'gpt-4o-mini'];
      const projectModel = process.env.OPENAI_MODEL || null;

      const has: Record<string, boolean> = {};
      for (const w of wanted) has[w] = ids.includes(w);
      if (projectModel) {
        has[projectModel] = ids.includes(projectModel);
      }

      return NextResponse.json({
        success: true,
        provider: 'openai',
        projectModel,
        has,
        total: ids.length,
        models: ids.slice(0, 100)
      });
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ success: false, error: 'GEMINI_API_KEY nije podešen' }, { status: 400 });
      }
      // Listanje modela preko REST endpointa (SDK ne izlaže list uvek)
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const t = await resp.text();
        return NextResponse.json({ success: false, error: `Gemini models error: ${resp.status} ${t}` }, { status: 500 });
      }
      const json = await resp.json();
      const models: string[] = Array.isArray(json?.models) ? json.models.map((m: any) => m.name || m?.id || '').filter(Boolean) : [];
      const projectModel = process.env.GEMINI_MODEL || null;
      const wanted = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b'];
      const has: Record<string, boolean> = {};
      for (const w of wanted) {
        has[w] = models.some(id => id.includes(w));
      }
      if (projectModel) {
        has[projectModel] = models.some(id => id.includes(projectModel as string));
      }

      return NextResponse.json({
        success: true,
        provider: 'gemini',
        projectModel,
        has,
        total: models.length,
        models: models.slice(0, 100)
      });
    }

    return NextResponse.json({ success: false, error: `Nepoznat provider: ${provider}` }, { status: 400 });
  } catch (e: any) {
    const msg = e?.error?.message || e?.message || 'Nepoznata greška';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
