export interface SEOOutputs {
  title: string;
  metaDescription: string;
  keywordsLine: string;
  schemaMarkup: string;
  markdown: string;
}

export interface DualSEOOutputs {
  gemini: SEOOutputs | null;
  openai: SEOOutputs | null;
  geminiModel?: string;
  openaiModel?: string;
  geminiError?: string;
  openaiError?: string;
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

  // Remove trailing period from title and meta description (SEO best practice)
  rawTitle = rawTitle.trim().replace(/\.$/, '');
  baseMeta = baseMeta.trim().replace(/\.$/, '');

  const uniq = Array.from(new Set(params.keyTerms.filter(k => k && k.length > 2)));
  const keywordsLine = joinWithCharLimit(uniq.slice(0, 14), 300, ', ');
  const schemaMarkup = '';
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
  return { title: rawTitle, metaDescription: baseMeta, keywordsLine, schemaMarkup, markdown };
}

export async function buildSEOWithLLM(
  fallback: SEOOutputs,
  context: {
    documentTitle?: string;
    keyTerms: string[];
    mainTopics: string[];
    searchIntentType: string;
    textSample?: string;
    articleUrl?: string;
    articleMetadata?: {
      authorName?: string;
      publishedTime?: string;
      imageUrl?: string;
    };
  },
  options?: { model?: string; strictModel?: boolean; skipTitleGeneration?: boolean }
): Promise<SEOOutputs> {
  // Allow per-request override; fallback to env
  const requireLLM = (process.env.SEO_LLM_REQUIRED || '').toLowerCase() === 'true';
  const strictModel = options?.strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true');
  const skipTitleGeneration = options?.skipTitleGeneration ?? false;

  // Guardrails za kvalitet i usklađenost sa smernicama (sažeto iz dokumenta):
  const bannedTokens = [
    'kliknite ovde', 'odmah', 'besplatno', 'najbolje ikad', 'šokantno', 'neverovatno', 'viralno', 'ekskluzivno', '!!!'
  ];

  const primaryKW = context.keyTerms?.[0] || context.mainTopics?.[0] || (context.documentTitle || '').split(' ').slice(0, 3).join(' ');
  const secondaryKWs = context.keyTerms?.slice(1, 6) || [];

  const jsonSchema = skipTitleGeneration
    ? `{
  "meta_description": string,  // Answer Nugget, max 160 karaktera, sa CTA na kraju
  "keywords": string[],        // 8–10 fraza: long-tail (3-4), mid-tail (3-4), core entiteti (2)
  "schema_markup": string      // validan JSON-LD za NewsArticle schemu
}`
    : `{
  "title": string,             // ≤ 70 karaktera SEO naslov
  "meta_description": string,  // Answer Nugget, max 160 karaktera, sa CTA na kraju
  "keywords": string[],        // 8–10 fraza: long-tail (3-4), mid-tail (3-4), core entiteti (2)
  "schema_markup": string      // validan JSON-LD za NewsArticle schemu
}`;

  const titleInstructions = skipTitleGeneration
    ? `**NASLOV JE VEĆ ODREĐEN:** ${context.documentTitle}
**TVOJ ZADATAK:** Generiši Meta opis (Answer Nugget), Keywords (Long-Tail First hijerarhija) i Schema Markup na osnovu ovog naslova i teksta.`
    : `**Generiši SEO naslov:** ≤ 70 karaktera, uključi primarnu ključnu reč, bez clickbaita, koristi srpsku transkripciju imena kako je u tekstu.`;

  const prompt = `Ti si Senior Urednik nacionalnog informativnog portala i GEO (Generative Engine Optimization) ekspert. Na osnovu ulaza generiši striktno JSON sa sledećim poljima:
${jsonSchema}

${titleInstructions}

**1. Meta Opis (meta_description) — Answer Nugget format:**
- Formuliši kao DIREKTAN, INFORMATIVAN ODGOVOR na glavno pitanje ili temu članka.
- Aktivan ton, bez okolišanja. Kreni ODMAH sa činjenicama.
- STROGO ograničenje: maksimalno 160 karaktera.
- Na samom kraju dodaj kratak, prirodan CTA, npr. "Saznajte više." ili "Pročitajte analizu."
- ZABRANJENO: Ne započinji opis frazama poput "Ovaj članak govori o..." ili "Saznajte kako...". Kreni odmah sa činjenicama.
- UVEK koristi PUNO IME I PREZIME na prvom pomenu osobe.
- Meta opis MORA biti završena rečenica.
  * ❌ NEDOZVOLJENO: "...ukoliko se obaveze ne" (presečeno!)
  * ✅ ISPRAVNO: "Milan Janković osvojio zlato na EP u paraatletici. Saznajte više."

**2. Ključne reči / Tagovi (keywords) — Long-Tail First hijerarhija:**
Tvoj zadatak je da generišeš hijerarhijsku listu od tačno 8 do 10 ključnih reči i fraza koje korisnici ZAISTA ukucavaju u pretraživač.
Redosled i struktura niza MORAJU biti sledeći:

**Nivo 1: Long-tail fraze (Prioritet! Generiši 3 do 4 fraze):**
- Ove fraze moraju imati između 3 i 6 reči.
- Formuliši ih kao prirodna korisnička pitanja ili visoko specifične konverzacijske upite (Voice Search stil) na koje ovaj članak daje odgovor.
- Primer: "kako se bezbedno evakuisati iz inostranstva", "najbolji načini za zaštitu dece na internetu"
- Ovo je ključno za AI Overviews.

**Nivo 2: Mid-tail fraze (Generiši 3 do 4 fraze):**
- Ove fraze imaju 2 do 3 reči.
- Spajaju glavni entitet sa akcijom ili problemom.
- Primer: "evakuacija državljana Srbije", "vrbovanje maloletnika online"

**Nivo 3: Core Entiteti (Generiši 2 fraze):**
- Najviše 2 glavna entiteta (1 do 2 reči, npr. ime specifične lokacije, institucije ili osobe od javnog značaja) radi mapiranja u Knowledge Graph.

❌ STROGO ZABRANJENO (Negative Prompting):
- NE SMEŠ da generišeš besmislene SEO permutacije istih reči (npr. ako staviš "evakuacija iz Katara", ne smeš dodati "Katar evakuacija" ili "evakuacija Katar"). Svaka fraza mora biti unikatna po nameri.
- Izbegavaj generičke reči od jedne reči (vesti, srbija, novo, danas) ukoliko nisu deo šire fraze.
- Vrati strogo jedan niz (array) stringova koji prati ovu hijerarhiju. Mala slova, bez duplikata.

**C. Schema Markup (Ključ: schema_markup)**
Generiši validan JSON-LD string za NewsArticle schemu.
Sledeća polja su OBAVEZNA i ne smeju biti izostavljena:

- **@context**: "https://schema.org"
- **@type**: "NewsArticle"
- **headline**: Tvoj generisani SEO naslov.
- **description**: OBAVEZNO mora biti apsolutno identična vrednost kao u polju meta_description (Answer Nugget).
- **articleBody**: Kompresovani sažetak prepun entiteta (do 150 reči).
- **mainEntityOfPage**: Formatiraj kao {"@type": "WebPage", "@id": "[url_clanka]"}. Iskoristi prosleđeni url_clanka. Ako nije prosleđen, koristi placeholder "https://example.com/article".
- **inLanguage**: Samostalno detektuj jezik iz teksta i UVEK ga formatiraj po BCP-47 standardu (npr. "sr-RS", "hr-HR", "bs-BA", "en-US"). NIKADA nemoj ostaviti prazno.
- **image**: Iskoristi prosleđeni [image_url]. Ako nema, izostavi samo ovo polje.
- **datePublished**: Iskoristi prosleđeni [published_time]. Ako nema, izostavi.
- **dateModified**: Iskoristi istu vrednost kao za datePublished (da osiguraš prolaznost signala svežine).
- **author**: Formatiraj sa identifikatorom: {"@type": "Person", "@id": "#author", "name": "[Ime iz varijable author_name ili izvučeno iz teksta]"}. Ako ime nije dostupno, izostavi.
- **publisher**: Formatiraj sa identifikatorom: {"@type": "Organization", "@id": "#organization", "name": "Nacionalni Informativni Portal"}.
- **about** i **mentions** (Kritično za Entity Depth): Dodaj ova dva niza. U "about" stavi 1-2 glavna entiteta (koncepta) iz članka definisana kao {"@type": "Thing", "name": "..."}. U "mentions" stavi do 3 sporedna entiteta (ljudi, lokacije, organizacije), svaki kao {"@type": "Thing", "name": "..."}.

⚠️ SINTAKSNA ZAŠTITA (Syntax Firewall): Vrati isključivo čistu, neobrađenu JSON strukturu objekta. STROGO ZABRANJENO je korišćenje Markdown code blokova (nemoj stavljati \`\`\`json na početak i \`\`\` na kraj stringa). Tekst mora biti validan JSON spreman za parsiranje.

**Poznate varijable sa originalnog linka:**
- image_url: ${context.articleMetadata?.imageUrl || '(nije pronađen)'}
- published_time: ${context.articleMetadata?.publishedTime || '(nije pronađen)'}
- author_name: ${context.articleMetadata?.authorName || '(nije pronađen)'}
- url_clanka: ${context.articleUrl || '(nije pronađen)'}

Ulaz (sažetak):
- Primarna ključna reč: ${primaryKW}
- Sekundarne: ${secondaryKWs.join(', ')}
- Glavne teme: ${context.mainTopics.join(', ')}
- Intent: ${context.searchIntentType}
- Naslov dokumenta: ${context.documentTitle || '(nema)'}
- Uzorak teksta: ${(context.textSample || '').slice(0, 10000)}

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

  function sanitizeKeywords(arr: string[], _primary: string, _secondaries: string[]): string[] {
    const stop = new Set(['je', 'za', 'u', 'na', 'i', 'od', 'do', 'se', 'da', 'koji', 'kako', 'što', 'sto', 'ili', 'ali', 'pa', 'su', 'sa', 'o', 'autor', 'društvo', 'hronika', 'video', 'foto', 'komentar', 'najnovije', 'vesti', 'srbija', 'novo', 'danas']);
    const out: string[] = [];
    for (const k of arr || []) {
      const t = (k || '').toString().trim().toLowerCase();
      if (!t || t.length < 3) continue;
      if (/[0-9]:[0-9]/.test(t)) continue; // vreme
      if (/\d{1,2}\.\d{1,2}\./.test(t)) continue; // datum
      if (stop.has(t)) continue;
      if (bannedTokens.some(b => t.includes(b))) continue;
      if (!out.includes(t)) out.push(t);
    }
    // Respect LLM's hierarchical output — no synthetic permutations, cap at 10
    return out.slice(0, 10);
  }

  function parseOutput(outRaw: any): SEOOutputs {
    const out = ensureText(outRaw);
    let title = fallback.title;
    let meta = fallback.metaDescription;
    let kwLine = fallback.keywordsLine;
    let schemaMarkup = '';
    try {
      // Pokušaj da parsiraš kao JSON direktno
      const firstBrace = out.indexOf('{');
      const lastBrace = out.lastIndexOf('}');
      const jsonStr = firstBrace >= 0 && lastBrace > firstBrace ? out.slice(firstBrace, lastBrace + 1) : out;
      const obj = JSON.parse(jsonStr);
      if (obj?.title) title = obj.title.toString();
      // Support both old "meta" and new "meta_description" field names
      if (obj?.meta_description) meta = obj.meta_description.toString();
      else if (obj?.meta) meta = obj.meta.toString();
      if (Array.isArray(obj?.keywords)) {
        const cleaned = sanitizeKeywords(
          obj.keywords.map((x: any) => x?.toString?.() || ''),
          primaryKW,
          secondaryKWs
        );
        kwLine = joinWithCharLimit(cleaned, 300, ', ');
      }
      // Parse schema_markup — could be a string or an object
      if (obj?.schema_markup) {
        if (typeof obj.schema_markup === 'string') {
          schemaMarkup = obj.schema_markup;
        } else if (typeof obj.schema_markup === 'object') {
          schemaMarkup = JSON.stringify(obj.schema_markup, null, 2);
        }
      }
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
    title = truncate(title, 70);
    meta = truncate(meta, 160);
    kwLine = kwLine ? kwLine.slice(0, 300) : '';

    // Remove trailing period from title (SEO best practice), keep meta as-is (has CTA with period)
    title = title.trim().replace(/\.$/, '');

    const markdown = ['1. SEO Naslov (Title Tag)', '', '```', title, '```', '', '2. Meta Opis (Meta Description)', '', '```', meta, '```', '', '3. Ključne reči / Tagovi (Named Entities)', '', '```', kwLine, '```', '', '4. Schema Markup (JSON-LD)', '', '```json', schemaMarkup || '(nije generisan)', '```'].join('\n');
    return { title, metaDescription: meta, keywordsLine: kwLine, schemaMarkup, markdown };
  }

  try {
    // Determine which provider to use based on model name
    const requestedModel = options?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const isOpenAI = requestedModel.startsWith('gpt-') || requestedModel.startsWith('o1-') || requestedModel.startsWith('o3-');

    // OpenAI provider
    if (isOpenAI) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY missing');

      const mod: any = await import('openai').catch(() => null);
      if (!mod || !mod.default) throw new Error('openai sdk not installed');

      const client = new mod.default({ apiKey });

      console.log(`🟢 [OpenAI] Trying model: ${requestedModel}`);

      try {
        // GPT-5 models don't support custom temperature, must use default (1)
        // GPT-5 also uses reasoning tokens (chain-of-thought), needs much higher limit
        // Testing shows: 4000 works for simple texts, but 8000 needed for complex/short texts
        const isGPT5 = requestedModel.startsWith('gpt-5');

        const res = await client.chat.completions.create({
          model: requestedModel,
          messages: [
            { role: 'system', content: 'Ti si Senior Urednik nacionalnog informativnog portala i GEO (Generative Engine Optimization) ekspert.' },
            { role: 'user', content: prompt }
          ],
          ...(isGPT5 ? {} : { temperature: 0.6 }),
          max_completion_tokens: isGPT5 ? 8000 : 4000
        });

        const content = res.choices?.[0]?.message?.content || '';

        console.log(`✅ [OpenAI] Response:`, {
          model: requestedModel,
          textLength: content.length,
          finishReason: res.choices?.[0]?.finish_reason,
          sample: content.substring(0, 80)
        });

        if (!content && requireLLM) throw new Error('Empty OpenAI response');
        return content ? parseOutput(content) : fallback;
      } catch (e: any) {
        console.error(`❌ [OpenAI] Error:`, { model: requestedModel, msg: e?.message });
        if (requireLLM) throw e;
        return fallback;
      }
    }

    // Gemini provider (default)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    // Literal dynamic import so serverless bundlers can trace the dependency
    const mod: any = await import('@google/generative-ai').catch(() => null);
    if (!mod || !mod.GoogleGenerativeAI) throw new Error('gemini sdk not installed');
    // COST OPTIMIZATION: gemini-2.5-flash for A/B testing
    // gemini-2.5-pro: $10.00/M output tokens
    // gemini-2.5-flash: $2.50/M output tokens  
    const primaryModel = requestedModel;
    const client = new mod.GoogleGenerativeAI(apiKey);
    // Force JSON output to reduce parsing ambiguity on Gemini 2.x
    // Increased maxOutputTokens to 4000 - Serbian Cyrillic/Latin + complex keyword arrays need more tokens
    const genConfig = { temperature: 0.6, maxOutputTokens: 4000, responseMimeType: 'application/json' } as any;

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
  } catch (e) {
    if (requireLLM) throw e;
    return fallback;
  }
}

/**
 * DUAL LLM MODE: Calls BOTH Gemini and OpenAI in parallel for A/B testing
 * Only active when SEO_DUAL_LLM=true
 */
export async function buildSEOWithDualLLM(
  fallback: SEOOutputs,
  context: {
    documentTitle?: string;
    keyTerms: string[];
    mainTopics: string[];
    searchIntentType: string;
    textSample?: string;
    articleUrl?: string;
    articleMetadata?: {
      authorName?: string;
      publishedTime?: string;
      imageUrl?: string;
    };
  }
): Promise<DualSEOOutputs> {
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log('🔄 [DUAL MODE] Calling both Gemini and OpenAI in parallel...');

  // Call both in parallel for speed
  const [geminiResult, openaiResult] = await Promise.allSettled([
    buildSEOWithLLM(fallback, context, { model: geminiModel }).catch(e => ({ error: e.message })),
    buildSEOWithLLM(fallback, context, { model: openaiModel }).catch(e => ({ error: e.message }))
  ]);

  const gemini = geminiResult.status === 'fulfilled' && !('error' in geminiResult.value)
    ? geminiResult.value as SEOOutputs
    : null;
  const geminiError = geminiResult.status === 'rejected' || ('error' in (geminiResult as any).value)
    ? (geminiResult.status === 'rejected' ? geminiResult.reason?.message : (geminiResult as any).value.error)
    : undefined;

  const openai = openaiResult.status === 'fulfilled' && !('error' in openaiResult.value)
    ? openaiResult.value as SEOOutputs
    : null;
  const openaiError = openaiResult.status === 'rejected' || ('error' in (openaiResult as any).value)
    ? (openaiResult.status === 'rejected' ? openaiResult.reason?.message : (openaiResult as any).value.error)
    : undefined;

  console.log('✅ [DUAL MODE] Results:', {
    gemini: gemini ? 'success' : `failed: ${geminiError}`,
    openai: openai ? 'success' : `failed: ${openaiError}`
  });

  return {
    gemini,
    openai,
    geminiModel,
    openaiModel,
    geminiError,
    openaiError
  };
}
