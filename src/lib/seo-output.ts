export interface SEOOutputs {
  title: string;
  metaDescription: string;
  keywordsLine: string;
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
  options?: { model?: string; strictModel?: boolean; skipTitleGeneration?: boolean }
): Promise<SEOOutputs> {
  // Allow per-request override; fallback to env
  const requireLLM = (process.env.SEO_LLM_REQUIRED || '').toLowerCase() === 'true';
  const strictModel = options?.strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true');
  const skipTitleGeneration = options?.skipTitleGeneration ?? false;

  // Guardrails za kvalitet i usklađenost sa smernicama (sažeto iz dokumenta):
  const bannedTokens = [
    'kliknite ovde','odmah','besplatno','najbolje ikad','šokantno','neverovatno','viralno','ekskluzivno','!!!'
  ];

  const primaryKW = context.keyTerms?.[0] || context.mainTopics?.[0] || (context.documentTitle || '').split(' ').slice(0,3).join(' ');
  const secondaryKWs = context.keyTerms?.slice(1, 6) || [];

  const jsonSchema = skipTitleGeneration 
    ? `{
  "meta": string,           // 150–160 karaktera, informativan sažetak vrednosti teksta (bez CTA), uključi primarnu i 1 sekundarnu ključnu reč, bez navodnika/emodžija
  "keywords": string[],     // 10–14 komada, 70–90% long‑tail (2–4 reči), mala slova, bez duplikata/stop reči/ličnih imena/brenda, relevantne i precizne
  "slug": string            // kratko, kebab-case, 4–8 reči, samo [a-z0-9-]
}`
    : `{
  "title": string,          // ≤ 75 karaktera, uključi primarnu ključnu reč, bez clickbaita, pravilna kapitalizacija, bez navodnika i brenda sajta
  "meta": string,           // 150–160 karaktera, informativan sažetak vrednosti teksta (bez CTA), uključi primarnu i 1 sekundarnu ključnu reč, bez navodnika/emodžija
  "keywords": string[],     // 10–14 komada, 70–90% long‑tail (2–4 reči), mala slova, bez duplikata/stop reči/ličnih imena/brenda, relevantne i precizne
  "slug": string            // kratko, kebab-case, 4–8 reči, samo [a-z0-9-]
}`;

  const titleInstructions = skipTitleGeneration
    ? `**NASLOV JE VEĆ ODREĐEN:** ${context.documentTitle}
**TVOJ ZADATAK:** Generiši samo Meta opis, Keywords i Slug na osnovu ovog naslova.`
    : `Pravila za SEO naslov (USER-CENTRIC):
- **JEZIK I TRANSKRPCIJA:**
  * **OBAVEZNO koristi SRPSKU TRANSKRIPCIJU imena** kako je napisano u tekstu!
  * ❌ "Mathias Lessort" → ✅ "Matijas Lesor" (ako je u tekstu srpski)
  * ❌ "LeBron James" → ✅ "Lebron Džejms" (ako je u tekstu srpski)
  * **NE "ispravljaj" imena u originalni engleski** - zadrži kako je u tekstu!

- **PRIRODAN JEZIK - IZBEGAVAJ AI SMELL:**
  * ❌ "vraća se na teren Panatinaikosa" (dečije, neprirodno)
  * ✅ "centar Panatinaikosa vraća se na teren" (profesionalno)
  * ✅ "košarkaš Panatinaikosa spreman za povratak" (prirodno)
  * **Uključi POZICIJU/FUNKCIJU** kada je relevantno (centar, trener, premijer...)
  * **Izbegavaj formulacije koje odmah otkrivaju da je AI pisao!**

- **OBAVEZNO UKLJUČI:**
  * Ako tekst pominje **IME OSOBE** → IME mora biti u naslovu (user traži tu osobu!)
  * Ako tekst pominje **LOKACIJU** (grad, mesto) → LOKACIJA mora biti u naslovu
  * Ako tekst opisuje **DOGAĐAJ/AKCIJU** → GLAGOL mora biti u naslovu (šta se desilo?)
  * Ako tekst pominje **GODINE/STAROST** → DODAJ u naslov (relevantno za user)

- **FORMAT: KO + ŠTA + GDE (ako postoje u tekstu)**
  * Primer: "Dušan Knežević (18), paraatletičar iz Vršca osvaja medalje"
           ↑ KO (ime+god) ↑ ŠTA (pozicija)  ↑ GDE    ↑ AKCIJA
  * Primer: "Aleksandar Luković podneo ostavku u Radničkom"
           ↑ KO           ↑ ŠTA (akcija)     ↑ GDE (klub)

- **ZABRANJENO:**
  * ❌ Generičke fraze: "Upornost i uspeh", "Priča o", "Inspirativna vest"
  * ❌ Subjektivne ocene: "neverovatno", "senzacionalno", "dirljivo"  
  * ❌ Transformacija u drugi žanr: News vest → NE smeš pretvoriti u feature story
  * ❌ Presecanje naslova: Mora stati u 75 chars bez prekida rečenice

- **ZADRŽI ORIGINALNU FORMU:**
  * Pitanje → Pitanje sa "?" ("Kako X?" → "Kako X: detalji?")
  * Glagol/akcija → Isti glagol ("podneo" → "podneo", NE "odlučio", NE "kraj ere")
  * Ton → Isti žanr (vest → vest, vodič → vodič)

- **PROVERA PRE SLANJA:**
  1. Da li user koji traži ključne reči ODMAH vidi odgovor u naslovu?
  2. Da li naslov ima IME/LOKACIJU/AKCIJU iz teksta?
  3. Da li je naslov < 75 chars i ne prekida se na pola?
  4. Da li je to news format, NE feature story?`;

  const prompt = `Ti si SEO asistent za srpski jezik (latinica). Na osnovu ulaza generiši striktno JSON sa sledećim poljima:
${jsonSchema}

MAIN PRINCIP: **User First - Search Intent Matching**
→ Naslov mora biti DIREKTAN ODGOVOR na pitanje koje user ima kada traži ključne reči
→ User pretraga → Vidi naslov → Prepoznaje odgovor → Klikne

${titleInstructions}

Meta opis: 
- Sažmi KO + ŠTA + GDE + KADA/ZAŠTO - **KONKRETNO iz teksta**
- **🚨 KRITIČNO - ZAVRŠENA REČENICA:**
  * Meta opis MORA biti 150-160 karaktera
  * Meta opis MORA biti završena rečenica sa tačkom na kraju!
  * ❌ NEDOZVOLJENO: "...ukoliko se obaveze ne" (presečeno!)
  * ✅ DOZVOLJENO: "...ukoliko se obaveze ne ispune." (završeno!)
  * **Pre slanja proveri: Da li poslednja reč ima tačku i da li ima smisla?**
- **🚨 NAJVAŽNIJE PRAVILO - NE SMEŠ PREKRŠITI:**
  * **UVEK koristi PUNO IME I PREZIME osobe na PRVOM pomenu!**
  * ❌ POGREŠNO: "Košarkaš Lesor..." → MORA: "Košarkaš Vasa Micić..."
  * ❌ POGREŠNO: "Lesor, ključni igrač..." → MORA: "Vasa Micić, ključni igrač..."
  * ❌ POGREŠNO: "Trener Ataman najavio..." → MORA: "Trener Ergin Ataman najavio..."
  * **Samo prezime = NEPROFESIONALNO i NEDOVOLJNO PISMENO!**
  * **Ovo je novinarsjki standard - bez izuzetaka!**
- ❌ Bez CTA: "Saznajte", "Otkrijte", "Pročitajte"
- ✅ Direktan info: "Košarkaš Vasa Micić vraća se...", "Trener Ergin Ataman podnosi...", "Procedura uključuje..."

Ključne reči:
- **KRITIČNO: Keywords MORAJU sadržati IME/NAZIV iz teksta u VEĆINI fraza!**
  * ✅ "lesor povratak", "lesor panatinаikos", "lesor povreda" (ime u svakoj!)
  * ❌ "oporavak nakon povrede", "trenerska procena" (generičko, neupotrebljivo!)
- **User search intent:** Šta user KUCAu Google? "ime + akcija", "ime + lokacija", "ime + događaj"
- Long-tail (2-4 reči), varijante sa lokacijom/kontekstom, bez generika/datuma

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
    
    // Remove trailing period from title and meta description (SEO best practice)
    title = title.trim().replace(/\.$/, '');
    meta = meta.trim().replace(/\.$/, '');
    
    const markdown = ['1. SEO Naslov (Title Tag)','', '```', title, '```', '', '2. Meta Opis (Meta Description)', '', '```', meta, '```', '', '3. Formatirana Lista Ključnih Reči', '', '```', kwLine, '```'].join('\n');
    return { title, metaDescription: meta, keywordsLine: kwLine, markdown };
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
            { role: 'system', content: 'Ti si SEO asistent za srpski jezik.' },
            { role: 'user', content: prompt }
          ],
          ...(isGPT5 ? {} : { temperature: 0.4 }),
          max_completion_tokens: isGPT5 ? 8000 : 2000
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
