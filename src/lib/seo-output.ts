export interface SEOOutputs {
  title: string;
  metaDescription: string;
  keywordsLine: string;
  markdown: string;
}

function truncate(str: string, limit: number): string {
  if (!str) return '';
  const s = str.trim();
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function capitalize(s: string): string {
  if (!s) return s as any;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Join keywords with commas ensuring total length (including separators) <= limit.
function joinWithCharLimit(items: string[], limit: number, sep = ', '): string {
  const out: string[] = [];
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const piece = (i === 0 ? '' : sep) + (items[i] || '');
    if (total + piece.length > limit) break;
    out.push(items[i]);
    total += piece.length;
  }
  return out.join(sep);
}

export function buildDeterministicSEO(
  params: { title?: string; keyTerms: string[]; mainTopics: string[]; searchIntentType: string },
  _sourceText?: string
): SEOOutputs {
  const primary = params.keyTerms[0] || params.mainTopics[0] || (params.title || '').split(' ').slice(0, 3).join(' ');
  const secondary = params.keyTerms[1] || params.mainTopics[1] || '';
  let rawTitle = `${capitalize(primary)}: Sve što treba da znate`;
  rawTitle = truncate(rawTitle, 60);
  let baseMeta = `${capitalize(primary)} utiče na vašu publiku i rezultate. Saznajte kako se odnosi na ${secondary || 'ključne pojmove'} i zašto je važno za SEO. Pročitajte kompletnu analizu.`;
  baseMeta = truncate(baseMeta, 160);
  const uniq = Array.from(new Set(params.keyTerms.filter(k => k && k.length > 2)));
  const keywordsLine = joinWithCharLimit(uniq.slice(0, 14), 300, ', ');
  const markdown = [
    '1. SEO Naslov (Title Tag)',
    '',
    '```',
    rawTitle,
    '```',
    '',
    '2. Meta Opis (Meta Description)',
    '',
    '```',
    baseMeta,
    '```',
    '',
    '3. Formatirana Lista Ključnih Reči',
    '',
    '```',
    keywordsLine,
    '```'
  ].join('\n');
  return { title: rawTitle, metaDescription: baseMeta, keywordsLine, markdown };
}

export async function buildSEOWithLLM(
  fallback: SEOOutputs,
  context: {
    documentTitle?: string;
    keyTerms: string[];
    mainTopics: string[];
    searchIntentType: string;
    textSample?: string;
  },
  options?: { provider?: 'openai' | 'gemini'; model?: string; strictModel?: boolean }
): Promise<SEOOutputs> {
  // Allow per-request override; fallback to env
  const provider = (options?.provider || process.env.SEO_LLM_PROVIDER || '').toLowerCase();
  const requireLLM = (process.env.SEO_LLM_REQUIRED || '').toLowerCase() === 'true';
  const strictModel = options?.strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true');

  // Guardrails za kvalitet i usklađenost sa smernicama (sažeto iz dokumenta):
  const bannedTokens = [
    'kliknite ovde','odmah','besplatno','najbolje ikad','šokantno','neverovatno','viralno','ekskluzivno','!!!'
  ];

  const primaryKW = context.keyTerms?.[0] || context.mainTopics?.[0] || (context.documentTitle || '').split(' ').slice(0,3).join(' ');
  const secondaryKWs = context.keyTerms?.slice(1, 6) || [];

  const prompt = `Ti si SEO asistent za srpski jezik (latinica). Na osnovu ulaza generiši striktno JSON sa sledećim poljima:
{
  "title": string,          // ≤ 60 karaktera, uključi primarnu ključnu reč, bez clickbaita, pravilna kapitalizacija, bez navodnika i brenda sajta
  "meta": string,           // 150–160 karaktera, informativan sažetak vrednosti teksta (bez CTA), uključi primarnu i 1 sekundarnu ključnu reč, bez navodnika/emodžija
  "keywords": string[],     // 10–14 komada, 70–90% long‑tail (2–4 reči), mala slova, bez duplikata/stop reči/ličnih imena/brenda, relevantne i precizne
  "slug": string            // kratko, kebab-case, 4–8 reči, samo [a-z0-9-]
}

Pravila za SEO naslov i opis:
- Jezik: srpski (latinica). Ton: stručan i koristan, bez senzacionalizma.
- **KLJUČNO: ZADRŽI ORIGINALNU FORMU I AKCIJU iz naslova dokumenta!**
  * **Pitanja:** Ako naslov počinje sa "Kako", "Šta", "Ko", "Zašto", "Kada", "Gde", "Da li" → **ZADRŽI pitanje u SEO naslovu i završi sa znakom pitanja "?"!** (Ne pretvaraj "Kako X?" u "Vodič za X" ili "X: objašnjenje")
  * **Glagoli/akcije:** Ako naslov sadrži glagol (preminuo, uhapšen, najavio, otvorio, zatražio, podneo, pobedio, potpisao...) → **OBAVEZNO zadrži taj glagol ili direktan sinonim!**
  * **Cilj:** Korisnik koji čita originalni naslov i SEO naslov mora prepoznati **ISTU SUŠTINSKU PORUKU** (samo SEO-optimizovanu, ne transformisanu u drugi žanr/ton)
  * **Zabranjene transformacije:**
    - "Kako X?" → ❌ "Vodič za X", ❌ "X: uputstvo", ❌ "Sve o X"  →  ✅ "Kako X: [detalj]"
    - "Preminuo Y" → ❌ "Biografija Y", ❌ "Život Y"  →  ✅ "Preminuo Y, [kontekst]"
    - "Najavio Z" → ❌ "Planovi Z", ❌ "Budućnost Z"  →  ✅ "Najavio Z: [detalj]"
- **Meta opis:** Ako je vest/događaj, sažmi suštinu (ko, šta, gde, kada, zašto/kako) - bez izmišljanja detalja, striktno na osnovu teksta
  * **ZABRANJEN CTA ton:** NE koristi imperativ/poziv na akciju → ❌ "Saznajte", ❌ "Otkrijte", ❌ "Pogledajte", ❌ "Pročitajte"
  * **Koristi informativan teaser stil:** Direktno naveđi suštinu sadržaja → ✅ "U skladu sa Zakonom...", ✅ "Nekadašnji predsednik...", ✅ "Procedura uključuje..."
- Zabranjene fraze: ${bannedTokens.join(', ')}.
- Ključne reči: prednost long‑tail frazama (2–4 reči); uključi varijante primarne fraze sa modifikatorima (lokacija, problem/rešenje, namera), izbegni generike ("autor", "društvo"), bez datuma/vremena.
- Ukupna dužina finalnog stringa sa ključnim rečima (spojenih zarezima i razmacima: ", ") treba biti ≤ 300 karaktera; skrati listu po potrebi.
- Poštuj ograničenja dužine. Ako mora skraćivanje, zadrži smisao i ključne reči.

Ulaz (sažetak):
- Primarna ključna reč: ${primaryKW}
- Sekundarne: ${secondaryKWs.join(', ')}
- Glavne teme: ${context.mainTopics.join(', ')}
- Intent: ${context.searchIntentType}
- Naslov dokumenta: ${context.documentTitle || '(nema)'}
- Uzorak teksta: ${(context.textSample || '').slice(0, 800)}

Vrati SAMO JSON, bez objašnjenja i bez code fences.`;

  // Normalize any unknown SDK result/value into a plain string for safe parsing
  function ensureText(val: any): string {
    try {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      
      // PRIORITY 1: Gemini SDK result shape - result.response.text() is a METHOD
      // This is the primary way Gemini SDK returns content in current versions
      if (val.response && typeof val.response.text === 'function') {
        try {
          const t = val.response.text();
          if (t && typeof t === 'string') return t;
        } catch (e) {
          // If text() throws, continue to fallbacks
        }
      }
      
      // PRIORITY 2: Direct text method or property on the value itself
      if (typeof val.text === 'function') {
        const t = val.text();
        return typeof t === 'string' ? t : String(t ?? '');
      }
      if (typeof val.text === 'string') return val.text;
      
      // PRIORITY 3: response.text as a string property (older or alternative SDK shapes)
      if (val.response) {
        const r = val.response;
        if (typeof r?.text === 'string' && r.text) return r.text;
        // Decode JSON returned as inlineData when responseMimeType is application/json
        const parts = r?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          const out: string[] = [];
          for (const p of parts) {
            if (typeof p?.text === 'string' && p.text) out.push(p.text);
            const b64 = p?.inlineData?.data;
            const mt = p?.inlineData?.mimeType || p?.mimeType;
            if (b64 && typeof b64 === 'string') {
              try {
                const decoded = Buffer.from(b64, 'base64').toString('utf8');
                // If it's JSON and mime indicates JSON, prefer it
                if ((mt || '').includes('json')) return decoded;
                out.push(decoded);
              } catch { /* ignore */ }
            }
          }
          if (out.length) return out.join('\n');
        }
      }
      // Gemini candidates content parts
      const parts2 = val?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts2)) {
        const maybe: string[] = [];
        for (const p of parts2) {
          if (typeof p?.text === 'string') maybe.push(p.text);
          const b64 = p?.inlineData?.data;
          const mt = p?.inlineData?.mimeType || p?.mimeType;
          if (b64 && typeof b64 === 'string') {
            try {
              const decoded = Buffer.from(b64, 'base64').toString('utf8');
              if ((mt || '').includes('json')) return decoded;
              maybe.push(decoded);
            } catch { /* ignore */ }
          }
        }
        if (maybe.length) return maybe.join('\n');
      }
      // Last resort: stringify objects, or coerce primitives/functions
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    } catch {
      return '';
    }
  }

  function sanitizeKeywords(arr: string[], primary: string, secondaries: string[]): string[] {
    const stop = new Set(['je','za','u','na','i','od','do','se','da','koji','kako','što','sto','ili','ali','pa','su','sa','o','autor','društvo','hronika','video','foto','komentar','najnovije']);
    const out: string[] = [];
    for (const k of arr || []) {
      const t = (k || '').toString().trim().toLowerCase();
      if (!t) continue;
      if (t.length < 3) continue;
      if (/[0-9]:[0-9]/.test(t)) continue; // vreme
      if (/\d{1,2}\.\d{1,2}\./.test(t)) continue; // datum
      if (stop.has(t)) continue;
      if (bannedTokens.some(b => t.includes(b))) continue;
      if (!out.includes(t)) out.push(t);
    }
    // Obavezni udeo long‑tail fraza (≥ 70%) i maksimalno 12–14 ukupno
    function isLong(s: string) { return s.trim().split(/\s+/).length >= 2 && s.trim().split(/\s+/).length <= 4; }
    const targetTotal = Math.max(10, Math.min(14, out.length));
    const targetLong = Math.ceil(targetTotal * 0.7);

    // ako nema dovoljno long‑tail, sintetizuj na osnovu primarne + sekundarnih
    const primaryBase = (primary || '').toLowerCase().trim();
    const sec = (secondaries || []).map(s => (s || '').toLowerCase().trim()).filter(Boolean).slice(0,6);
    for (const s of sec) {
      if (out.length >= 14) break;
      const combo1 = `${primaryBase} ${s}`.trim();
      const combo2 = `${s} ${primaryBase}`.trim();
      for (const c of [combo1, combo2]) {
        if (!c || out.includes(c)) continue;
        if (!isLong(c)) continue;
        if (c.length < 8 || c.length > 40) continue;
        out.push(c);
      }
    }

    // osiguraj udeo long‑tail
    const longs = out.filter(isLong);
    if (longs.length < targetLong) {
      // pokušaj da proširiš single‑tail dodavanjem konteksta primarne reči
      const singles = out.filter(k => !isLong(k));
      for (const s of singles) {
        if (longs.length >= targetLong) break;
        const c = `${s} ${primaryBase}`.trim();
        if (!out.includes(c) && isLong(c)) { out.push(c); longs.push(c); }
      }
    }

    // krajnji rez
    return out.slice(0, 14);
  }

  function parseOutput(outRaw: any): SEOOutputs {
    const out = ensureText(outRaw);
    let title = fallback.title;
    let meta = fallback.metaDescription;
    let kwLine = fallback.keywordsLine;
    try {
      // Pokušaj da parsiraš kao JSON direktno
      const firstBrace = out.indexOf('{');
      const lastBrace = out.lastIndexOf('}');
      const jsonStr = firstBrace >= 0 && lastBrace > firstBrace ? out.slice(firstBrace, lastBrace + 1) : out;
      const obj = JSON.parse(jsonStr);
      if (obj?.title) title = obj.title.toString();
      if (obj?.meta) meta = obj.meta.toString();
      if (Array.isArray(obj?.keywords)) {
        const cleaned = sanitizeKeywords(
          obj.keywords.map((x: any) => x?.toString?.() || ''),
          primaryKW,
          secondaryKWs
        );
  kwLine = joinWithCharLimit(cleaned, 300, ', ');
      }
      // slug trenutno ne prikazujemo u UI, ali ga možemo kasnije dodati
    } catch {
      // Fallback: heuristike iz prethodne verzije (ako model nije poslao JSON)
      const text = ensureText(out);
      const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      const idx1 = lines.findIndex((l: string) => l.toLowerCase().includes('1. seo naslov') || /^1\./.test(l));
      const idx2 = lines.findIndex((l: string) => l.toLowerCase().includes('2. meta opis') || /^2\./.test(l));
      const idx3 = lines.findIndex((l: string) => l.toLowerCase().includes('3. formatirana') || /^3\./.test(l));
      if (idx1 >= 0 && idx2 > idx1) title = lines[idx1 + 1] || title;
      if (idx2 >= 0 && ((idx3 > idx2) || idx3 === -1)) meta = lines[idx2 + 1] || meta;
      if (idx3 >= 0) kwLine = lines[idx3 + 1] || kwLine;
    }
    title = truncate(title, 60);
    meta = truncate(meta, 160);
    kwLine = kwLine ? kwLine.slice(0, 300) : '';
    const markdown = ['1. SEO Naslov (Title Tag)','', '```', title, '```', '', '2. Meta Opis (Meta Description)', '', '```', meta, '```', '', '3. Formatirana Lista Ključnih Reči', '', '```', kwLine, '```'].join('\n');
    return { title, metaDescription: meta, keywordsLine: kwLine, markdown };
  }

  try {
    // OpenAI
    if (provider === 'openai' || (!provider && process.env.OPENAI_API_KEY)) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  // Literal dynamic import so serverless bundlers can trace the dependency
  const mod: any = await import('openai').catch(() => null);
      if (!mod || !mod.default) throw new Error('openai sdk not installed');
      const baseURL = process.env.OPENAI_BASE_URL;
      const client = new mod.default({ apiKey, baseURL });
      const primaryModel = options?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const fallbackModels = strictModel ? [] : [
        'gpt-4o',
        'gpt-4o-mini'
      ].filter(m => m !== primaryModel);

      async function tryModel(modelName: string): Promise<string | null> {
        try {
          // Prefer the Responses API for widest model compatibility
          // Note: Some models reject 'max_tokens' on chat.completions – Responses API uses 'max_output_tokens'.
          const res = await client.responses.create({
            model: modelName,
            input: [
              { role: 'system', content: 'Ti si SEO asistent za srpski jezik.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_output_tokens: 350
          } as any);

          // Extract text from Responses API
          // SDK returns: res.output_text or res.choices?.[0]?.message?.content depending on version
          const outputText = (res as any).output_text
            || (res as any).content?.[0]?.text
            || (res as any).choices?.[0]?.message?.content
            || '';
          return outputText || '';
        } catch (e: any) {
          const msg = e?.error?.message || e?.message || '';
          const code = e?.status || e?.code || '';
          const isModelAccess = /model/i.test(msg) || code === 404 || code === 403;
          if (isModelAccess) return null; // pokušaj sledeći model
          // If Responses API not supported on SDK, fallback to chat.completions without max_tokens
          try {
            const res2 = await client.chat.completions.create({
              model: modelName,
              messages: [
                { role: 'system', content: 'Ti si SEO asistent za srpski jezik.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.4
            });
            return res2.choices?.[0]?.message?.content || '';
          } catch (e2: any) {
            throw e2;
          }
        }
      }

      let content = await tryModel(primaryModel);
      if (!strictModel) {
        for (const m of fallbackModels) {
          if (content) break;
          content = await tryModel(m);
        }
      }

      if (!content) {
        if (requireLLM) throw new Error(`LLM unavailable for models: ${[primaryModel, ...fallbackModels].join(', ')}`);
        return fallback;
      }
      return parseOutput(content);
    }

    // Gemini
    if (provider === 'gemini' || (!provider && process.env.GEMINI_API_KEY)) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  // Literal dynamic import so serverless bundlers can trace the dependency
  const mod: any = await import('@google/generative-ai').catch(() => null);
      if (!mod || !mod.GoogleGenerativeAI) throw new Error('gemini sdk not installed');
  // COST OPTIMIZATION: Use Flash-Lite (smallest & cheapest - perfect for SEO!)
  // gemini-2.5-pro: $10.00/M output tokens
  // gemini-2.5-flash: $2.50/M output tokens  
  // gemini-2.5-flash-lite: $0.40/M output tokens (6x cheaper than Flash, 25x cheaper than Pro!)
  const primaryModel = options?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const client = new mod.GoogleGenerativeAI(apiKey);
  // Force JSON output to reduce parsing ambiguity on Gemini 2.x
  // Increased maxOutputTokens to 4000 - Serbian Cyrillic/Latin + complex keyword arrays need more tokens
  const genConfig = { temperature: 0.4, maxOutputTokens: 4000, responseMimeType: 'application/json' } as any;

      let lastErrMsg: string | undefined;
      async function tryGemini(modelName: string): Promise<string | null> {
        try {
          console.log(`🔵 [Gemini] Trying model: ${modelName}`);
          const model = client.getGenerativeModel({ model: modelName, generationConfig: genConfig });
          // Prefer JSON response; pass plain text prompt
          const result = await model.generateContent(prompt as any);
          const out = ensureText(result);
          
          console.log(`✅ [Gemini] Response:`, {
            model: modelName,
            textLength: out?.length || 0,
            finishReason: result?.response?.candidates?.[0]?.finishReason,
            sample: out?.substring(0, 80)
          });
          
          return out || '';
        } catch (e: any) {
          const msg = e?.message || '';
          lastErrMsg = msg || lastErrMsg;
          const status = e?.status || e?.code || '';
          
          console.error(`❌ [Gemini] Error:`, { model: modelName, msg, status });
          
          const isAccess = /model/i.test(msg) || /not found/i.test(msg) || /permission/i.test(msg) || /unsupported/i.test(msg) || /404/.test(msg) || /403/.test(msg);
          const isQuotaOrSafety = /quota|exceeded|blocked|safety|rate/i.test(msg) || status === 429 || status === 400;
          // On any recoverable error, signal caller to try fallback models
          if (isAccess || isQuotaOrSafety) return null;
          // Non-recoverable → rethrow so caller can decide (and propagate when REQUIRED=true)
          throw e;
        }
      }

      // Fallback policy: avoid crossing major generations unless explicitly requested.
      // For 2.x primaries (e.g., 2.5-pro), don't auto-fallback to 1.5 models to prevent 404s on some projects.
      const fallbackModels = strictModel ? [] : (
        primaryModel.startsWith('gemini-2.5-') ? [] :
        primaryModel.startsWith('gemini-1.5-pro') ? ['gemini-1.5-flash'] :
        primaryModel.startsWith('gemini-1.5-flash') ? ['gemini-1.5-pro'] :
        []
      ).filter(m => m !== primaryModel);

      let out: string | null = null;
      // Be lenient: even if first call throws, keep trying fallbacks when strictModel=false
      try { out = await tryGemini(primaryModel); } catch (e) { if (strictModel) throw e; }
      if (!strictModel) {
        for (const m of fallbackModels) {
          if (out) break;
          try { out = await tryGemini(m); } catch { /* continue */ }
        }
      }
  if (!out && requireLLM) throw new Error('Empty LLM response' + (lastErrMsg ? `: ${lastErrMsg}` : ''));
      return out ? parseOutput(out) : fallback;
    }

    if (requireLLM) throw new Error('No LLM provider configured');
    return fallback;
  } catch (e) {
    if (requireLLM) throw e;
    return fallback;
  }
}
