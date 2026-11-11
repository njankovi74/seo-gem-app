import { getLanguageConfig, type SupportedLanguage } from './i18n';
import { getSEOPrompt } from './prompts/seo-prompt';
import {
  PORTAL_DOMAINS,
  PUBLISHER_INFO,
  NEWSROOM_AUTHOR_WORDS,
  SYSTEM_AUTHOR_MARKERS,
  LEGAL_ENTITY_SUFFIXES,
  NEWS_AGENCIES,
  buildCanonicalUrlFromPublicUrl,
  toTitleCase,
} from './portal-config';

export interface SEOOutputs {
  title: string;
  metaDescription: string;
  keywordsLine: string;
  schemaMarkup: string;
  markdown: string;
  subtopics?: string[];  // LLM-generated thematic subtopics for topic coverage
}

export interface DualSEOOutputs {
  gemini: SEOOutputs | null;
  openai: SEOOutputs | null;
  geminiModel?: string;
  openaiModel?: string;
  geminiError?: string;
  openaiError?: string;
}

export interface FinalizeSchemaInput {
  cleanedSchema?: Record<string, any> | null;
  headline: string;
  metaDescription?: string;
  keywordsLine?: string;
  language: SupportedLanguage;
  portalId?: string;
  publisherName: string;
  publisherLogoUrl: string;
  publisherDomain?: string;
  authorName?: string;
  articleSection?: string;
  publishedAt?: string;
  existingDatePublished?: string;
  nowIso?: string;
  imageUrl?: string;
  publicUrl?: string;
}

function normalizeAuthorToken(str: string): string {
  return (str || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves Schema.org author field (Person, Organization, or array of both)
 * from raw CMS author string and the portal's publisher name.
 */
export function resolveSchemaAuthor(
  rawAuthor?: string,
  pubName?: string
): Record<string, any> | Array<Record<string, any>> {
  const effectivePubName = (pubName || 'Newsmax Balkans').trim();
  const normPubName = normalizeAuthorToken(effectivePubName);

  const raw = (rawAuthor || '').trim();
  const parts = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.toLowerCase() !== 'none' && s !== '(N/A)')
    : [];

  if (parts.length === 0) {
    return { '@type': 'Organization', name: effectivePubName };
  }

  const resolved = parts.map((part): Record<string, any> => {
    const normPart = normalizeAuthorToken(part);

    // 1. Publisher of any configured portal in PUBLISHER_INFO (exact match)
    const matchedPublisher = Object.values(PUBLISHER_INFO).find(
      (p) => normalizeAuthorToken(p.name) === normPart
    );
    if (matchedPublisher) {
      return { '@type': 'Organization', name: matchedPublisher.name };
    }

    // 2. This portal's publisher: contains pubName, whole word from NEWSROOM_AUTHOR_WORDS,
    //    contains marker from SYSTEM_AUTHOR_MARKERS, or ends with LEGAL_ENTITY_SUFFIXES
    const containsPubName = Boolean(normPubName && normPart.includes(normPubName));
    const hasNewsroomWord = NEWSROOM_AUTHOR_WORDS.some((word) => {
      const nw = normalizeAuthorToken(word);
      if (!nw) return false;
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(nw)}(?![\\p{L}\\p{N}])`, 'u');
      return re.test(normPart);
    });
    const hasSystemMarker = SYSTEM_AUTHOR_MARKERS.some((marker) => {
      const nm = normalizeAuthorToken(marker);
      return Boolean(nm && normPart.includes(nm));
    });
    const hasLegalSuffix = LEGAL_ENTITY_SUFFIXES.some((suffix) => {
      const ns = normalizeAuthorToken(suffix);
      if (!ns) return false;
      if (normPart === ns) return true;
      if (normPart.endsWith(' ' + ns)) {
        const rawTail = part.trim().slice(-ns.length);
        if (ns === 'doo' && rawTail === 'Doo') return false;
        return true;
      }
      return false;
    });

    if (containsPubName || hasNewsroomWord || hasSystemMarker || hasLegalSuffix) {
      return { '@type': 'Organization', name: effectivePubName };
    }

    // 3. News agency: whole value equals an entry in NEWS_AGENCIES
    const matchedAgency = NEWS_AGENCIES.find(
      (agency) => normalizeAuthorToken(agency) === normPart
    );
    if (matchedAgency) {
      return { '@type': 'Organization', name: matchedAgency };
    }

    // 4. Otherwise: Person (as received)
    return { '@type': 'Person', name: part };
  });

  // Deduplicate by (@type + name), preserving input order
  const seen = new Set<string>();
  const deduped: Array<Record<string, any>> = [];
  for (const item of resolved) {
    const key = `${item['@type']}::${item.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  if (deduped.length === 0) {
    return { '@type': 'Organization', name: effectivePubName };
  }
  return deduped.length === 1 ? deduped[0] : deduped;
}

/**
 * Deterministically sets the core NewsArticle Schema.org fields after cleanSchemaMarkup,
 * while preserving LLM-generated semantic fields (description, articleBody, about, mentions, keywords).
 */
export function finalizeSchema(input: FinalizeSchemaInput): Record<string, any> {
  const cleaned = (input.cleanedSchema && typeof input.cleanedSchema === 'object') ? input.cleanedSchema : {};
  const langConfig = getLanguageConfig(input.language);
  const now = input.nowIso || new Date().toISOString();

  // Never overwrite an existing datePublished unless publishedAt is explicitly provided from the CMS form
  const datePublished =
    (input.publishedAt && input.publishedAt.trim()) ||
    (input.existingDatePublished && input.existingDatePublished.trim()) ||
    now;
  const dateModified = now;

  const pubName = (input.publisherName || 'Newsmax Balkans').trim();
  const pubLogo = (input.publisherLogoUrl || 'https://newsmaxbalkans.com/files/img/logo.png').trim();

  const author = resolveSchemaAuthor(input.authorName, pubName);

  // Article section: Title Case if present, omitted otherwise
  const formattedSection = toTitleCase(input.articleSection);

  // Image: prefix relative paths with https://<portal_domain>; omit if absent
  let resolvedImageUrl = '';
  const rawImg = (input.imageUrl || '').trim();
  if (rawImg && rawImg.toLowerCase() !== 'none' && rawImg !== '(N/A)') {
    if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
      resolvedImageUrl = rawImg;
    } else if (rawImg.startsWith('/')) {
      const domain =
        (input.portalId && PORTAL_DOMAINS[input.portalId]) ||
        input.publisherDomain ||
        PORTAL_DOMAINS.newsmax;
      resolvedImageUrl = `https://${domain}${rawImg}`;
    }
  }

  // Canonical URL & mainEntityOfPage: only when publicUrl is known; replace slug with slugify(headline)
  const canonicalUrl = buildCanonicalUrlFromPublicUrl(input.publicUrl, input.headline);

  const finalSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.headline,
  };

  const desc = (typeof cleaned.description === 'string' && cleaned.description.trim())
    ? cleaned.description.trim()
    : (input.metaDescription || '').trim();
  if (desc) {
    finalSchema.description = desc;
  }

  if (typeof cleaned.articleBody === 'string' && cleaned.articleBody.trim()) {
    finalSchema.articleBody = cleaned.articleBody.trim();
  }

  finalSchema.inLanguage = langConfig.bcp47;

  if (formattedSection) {
    finalSchema.articleSection = formattedSection;
  }

  finalSchema.datePublished = datePublished;
  finalSchema.dateModified = dateModified;
  finalSchema.author = author;
  finalSchema.publisher = {
    '@type': 'Organization',
    name: pubName,
    logo: {
      '@type': 'ImageObject',
      url: pubLogo,
    },
  };

  if (resolvedImageUrl) {
    finalSchema.image = {
      '@type': 'ImageObject',
      url: resolvedImageUrl,
    };
  }

  if (canonicalUrl) {
    finalSchema.mainEntityOfPage = {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    };
    finalSchema.url = canonicalUrl;
  }

  if (cleaned.about !== undefined) {
    finalSchema.about = cleaned.about;
  }
  if (cleaned.mentions !== undefined) {
    finalSchema.mentions = cleaned.mentions;
  }
  if (cleaned.keywords !== undefined) {
    finalSchema.keywords = cleaned.keywords;
  } else if (input.keywordsLine) {
    finalSchema.keywords = input.keywordsLine;
  }

  return finalSchema;
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

// Language-specific fallback strings for deterministic SEO output
const deterministicStrings: Record<string, {
  titleSuffix: string;
  metaTemplate: (primary: string, secondary: string) => string;
  secondaryFallback: string;
  mdTitle: string;
  mdMeta: string;
  mdKeywords: string;
}> = {
  sr: {
    titleSuffix: 'Sve što treba da znate',
    metaTemplate: (p, s) => `${capitalize(p)} utiče na vašu publiku i rezultate. Saznajte kako se odnosi na ${s || 'ključne pojmove'} i zašto je važno za SEO. Pročitajte kompletnu analizu.`,
    secondaryFallback: 'ključne pojmove',
    mdTitle: '1. SEO Naslov (Title Tag)',
    mdMeta: '2. Meta Opis (Meta Description)',
    mdKeywords: '3. Formatirana Lista Ključnih Reči',
  },
  sq: {
    titleSuffix: 'Gjithçka që duhet të dini',
    metaTemplate: (p, s) => `${capitalize(p)} ndikon në audiencën tuaj dhe rezultatet. Zbuloni si lidhet me ${s || 'termat kryesore'} dhe pse ka rëndësi për SEO. Lexoni analizën e plotë.`,
    secondaryFallback: 'termat kryesore',
    mdTitle: '1. Titulli SEO (Title Tag)',
    mdMeta: '2. Meta Përshkrimi (Meta Description)',
    mdKeywords: '3. Lista e Fjalëve Kyçe',
  },
  pl: {
    titleSuffix: 'Wszystko, co musisz wiedzieć',
    metaTemplate: (p, s) => `${capitalize(p)} wpływa na Twoją publiczność i wyniki. Dowiedz się, jak odnosi się do ${s || 'kluczowych pojęć'} i dlaczego jest ważne dla SEO. Przeczytaj pełną analizę.`,
    secondaryFallback: 'kluczowych pojęć',
    mdTitle: '1. Tytuł SEO (Title Tag)',
    mdMeta: '2. Meta Opis (Meta Description)',
    mdKeywords: '3. Sformatowana Lista Słów Kluczowych',
  },
  en: {
    titleSuffix: 'Everything You Need to Know',
    metaTemplate: (p, s) => `${capitalize(p)} impacts your audience and results. Learn how it relates to ${s || 'key concepts'} and why it matters for SEO. Read the full analysis.`,
    secondaryFallback: 'key concepts',
    mdTitle: '1. SEO Title (Title Tag)',
    mdMeta: '2. Meta Description',
    mdKeywords: '3. Formatted Keyword List',
  },
};

export function buildDeterministicSEO(
  params: { title?: string; keyTerms: string[]; mainTopics: string[]; searchIntentType: string },
  _sourceText?: string,
  language?: SupportedLanguage
): SEOOutputs {
  const lang = language || 'sr';
  const strings = deterministicStrings[lang] || deterministicStrings.sr;
  const primary = params.keyTerms[0] || params.mainTopics[0] || (params.title || '').split(' ').slice(0, 3).join(' ');
  const secondary = params.keyTerms[1] || params.mainTopics[1] || '';
  let rawTitle = `${capitalize(primary)}: ${strings.titleSuffix}`;
  rawTitle = truncate(rawTitle, 60);
  let baseMeta = strings.metaTemplate(primary, secondary);
  baseMeta = truncate(baseMeta, 160);

  // Remove trailing period from title and meta description (SEO best practice)
  rawTitle = rawTitle.trim().replace(/\.$/, '');
  baseMeta = baseMeta.trim().replace(/\.$/, '');

  const uniq = Array.from(new Set(params.keyTerms.filter(k => k && k.length > 2)));
  const keywordsLine = joinWithCharLimit(uniq.slice(0, 14), 300, ', ');
  const schemaMarkup = '';
  const markdown = [
    strings.mdTitle,
    '',
    '```',
    rawTitle,
    '```',
    '',
    strings.mdMeta,
    '',
    '```',
    baseMeta,
    '```',
    '',
    strings.mdKeywords,
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
      portalId?: string;
      authorName?: string;
      publishedTime?: string;
      existingDatePublished?: string;
      dateModified?: string;
      imageUrl?: string;
      publicUrl?: string;
      publisherName?: string;
      publisherLogoUrl?: string;
      publisherDomain?: string;
      articleSection?: string;
    };
  },
  options?: { model?: string; strictModel?: boolean; skipTitleGeneration?: boolean },
  language?: SupportedLanguage
): Promise<SEOOutputs> {
  // Allow per-request override; fallback to env
  const requireLLM = (process.env.SEO_LLM_REQUIRED || '').toLowerCase() === 'true';
  const strictModel = options?.strictModel ?? ((process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true');
  const skipTitleGeneration = options?.skipTitleGeneration ?? false;

  // Guardrails za kvalitet i usklađenost sa smernicama (sažeto iz dokumenta):
  const bannedTokens = [
    'kliknite ovde', 'odmah', 'besplatno', 'najbolje ikad', 'šokantno', 'neverovatno', 'viralno', 'ekskluzivno', '!!!',
    // Publisher brand names — never a keyword
    'newsmax', 'newsmax balkans', 'newsmax polska', 'newsmaxbalkans',
    // Common stop words that slip through TF-IDF
    'nije', 'biti', 'prema', 'takođe', 'može', 'samo', 'zbog', 'nakon', 'kroz',
  ];

  const primaryKW = context.keyTerms?.[0] || context.mainTopics?.[0] || (context.documentTitle || '').split(' ').slice(0, 3).join(' ');
  const secondaryKWs = context.keyTerms?.slice(1, 6) || [];

  const jsonSchema = skipTitleGeneration
    ? `{
  "meta_description": string,  // Answer Nugget, max 160 karaktera, sa CTA na kraju
  "keywords": string[],        // 8–10 fraza: long-tail (3-4), mid-tail (3-4), core entiteti (2)
  "subtopics": string[],       // 4–6 tematskih podtema/aspekata koje članak pokriva
  "schema_markup": string      // validan JSON-LD za NewsArticle schemu
}`
    : `{
  "title": string,             // ≤ 70 karaktera SEO naslov
  "meta_description": string,  // Answer Nugget, max 160 karaktera, sa CTA na kraju
  "keywords": string[],        // 8–10 fraza: long-tail (3-4), mid-tail (3-4), core entiteti (2)
  "subtopics": string[],       // 4–6 tematskih podtema/aspekata koje članak pokriva
  "schema_markup": string      // validan JSON-LD za NewsArticle schemu
}`;

  const titleInstructions = skipTitleGeneration
    ? `**NASLOV JE VEĆ ODREĐEN:** ${context.documentTitle}
**TVOJ ZADATAK:** Generiši Meta opis (Answer Nugget), Keywords (Long-Tail First hijerarhija) i Schema Markup na osnovu ovog naslova i teksta.`
    : `**Generiši SEO naslov:** ≤ 70 karaktera, uključi primarnu ključnu reč, bez clickbaita, koristi srpsku transkripciju imena kako je u tekstu.`;

  // Build prompt using i18n-aware prompt builder
  const effectiveLang = language || 'sr';
  const { systemPrompt: seoSystemPrompt, userPrompt } = getSEOPrompt(effectiveLang, {
    primaryKW,
    secondaryKWs,
    mainTopics: context.mainTopics,
    searchIntentType: context.searchIntentType,
    documentTitle: context.documentTitle,
    textSample: context.textSample,
    articleUrl: context.articleUrl,
    skipTitleGeneration,
    articleMetadata: context.articleMetadata,
  });
  const prompt = userPrompt;

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
    const langConfig = getLanguageConfig(effectiveLang);
    const stop = new Set([...langConfig.stopWords.filter(w => w.length <= 5), ...langConfig.bannedTokens]);
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

  // Remove hallucinated/placeholder values from schema markup
  function cleanSchemaMarkup(obj: any): any {
    if (obj == null) return undefined;

    // Check for placeholder string values
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (!s || s === '(N/A)' || s === 'N/A' || s === 'n/a') return undefined;
      if (s.includes('example.com') || s.includes('example.org')) return undefined;
      return s;
    }

    // Clean arrays — also remove publisher from mentions
    if (Array.isArray(obj)) {
      const publisherNames = ['newsmax balkans', 'newsmax polska', 'newsmax albania', 'newsmax'];
      const cleaned = obj
        .map(item => cleanSchemaMarkup(item))
        .filter(item => {
          if (item == null) return false;
          // Remove publisher entities from mentions array
          if (typeof item === 'object' && item.name) {
            if (publisherNames.includes(item.name.toLowerCase())) return false;
          }
          return true;
        });
      return cleaned.length > 0 ? cleaned : undefined;
    }

    // Clean objects recursively
    if (typeof obj === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = cleanSchemaMarkup(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      // Don't return empty objects (except @context which is always needed)
      const keys = Object.keys(cleaned);
      if (keys.length === 0) return undefined;
      if (keys.length === 1 && keys[0] === '@type') return undefined; // only @type left = useless
      return cleaned;
    }

    return obj; // numbers, booleans, etc.
  }

  function parseOutput(outRaw: any): SEOOutputs {
    const out = ensureText(outRaw);
    let title = fallback.title;
    let meta = fallback.metaDescription;
    let kwLine = fallback.keywordsLine;
    let schemaMarkup = '';
    let subtopics: string[] = [];
    let cleanedSchemaObj: Record<string, any> | null = null;
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
      // Parse subtopics
      if (Array.isArray(obj?.subtopics)) {
        subtopics = obj.subtopics
          .map((x: any) => (x?.toString?.() || '').trim())
          .filter((s: string) => s.length > 3);
        console.log(`📋 [LLM] Subtopics parsed: ${subtopics.length} items:`, subtopics);
      }
      // Parse schema_markup — could be a string or an object
      if (obj?.schema_markup) {
        let schemaObj: any;
        if (typeof obj.schema_markup === 'string') {
          try { schemaObj = JSON.parse(obj.schema_markup); } catch { schemaMarkup = obj.schema_markup; }
        } else if (typeof obj.schema_markup === 'object') {
          schemaObj = obj.schema_markup;
        }
        // Clean hallucinated values from schema
        if (schemaObj) {
          cleanedSchemaObj = cleanSchemaMarkup(schemaObj) || null;
          if (cleanedSchemaObj) {
            schemaMarkup = JSON.stringify(cleanedSchemaObj);
          }
        }
      }
    } catch {
      // Fallback: heuristike iz prethodne verzije (ako model nije poslao JSON)
      const text = ensureText(out);
      const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      const idx1 = lines.findIndex((l: string) => l.toLowerCase().includes('1. seo naslov') || l.toLowerCase().includes('1. seo title') || l.toLowerCase().includes('1. titulli seo') || l.toLowerCase().includes('1. tytuł seo') || /^1\./.test(l));
      const idx2 = lines.findIndex((l: string) => l.toLowerCase().includes('2. meta opis') || l.toLowerCase().includes('2. meta description') || l.toLowerCase().includes('2. meta përshkrimi') || /^2\./.test(l));
      const idx3 = lines.findIndex((l: string) => l.toLowerCase().includes('3. formatirana') || l.toLowerCase().includes('3. formatted') || l.toLowerCase().includes('3. lista e') || l.toLowerCase().includes('3. sformatowana') || /^3\./.test(l));
      if (idx1 >= 0 && idx2 > idx1) title = lines[idx1 + 1] || title;
      if (idx2 >= 0 && ((idx3 > idx2) || idx3 === -1)) meta = lines[idx2 + 1] || meta;
      if (idx3 >= 0) kwLine = lines[idx3 + 1] || kwLine;
    }
    title = truncate(title, 70);
    meta = truncate(meta, 160);
    kwLine = kwLine ? kwLine.slice(0, 300) : '';

    // Remove trailing period from title (SEO best practice), keep meta as-is (has CTA with period)
    title = title.trim().replace(/\.$/, '');

    // Deterministically finalize schema when articleMetadata is provided (CMS generate flow)
    if (context.articleMetadata && (cleanedSchemaObj || schemaMarkup)) {
      const md = context.articleMetadata;
      const effectiveHeadline = (skipTitleGeneration && context.documentTitle)
        ? context.documentTitle.trim()
        : title;
      const finalized = finalizeSchema({
        cleanedSchema: cleanedSchemaObj,
        headline: effectiveHeadline,
        metaDescription: meta,
        keywordsLine: kwLine,
        language: effectiveLang,
        portalId: md.portalId,
        publisherName: md.publisherName || 'Newsmax Balkans',
        publisherLogoUrl: md.publisherLogoUrl || 'https://newsmaxbalkans.com/files/img/logo.png',
        publisherDomain: md.publisherDomain,
        authorName: md.authorName,
        articleSection: md.articleSection,
        publishedAt: md.publishedTime,
        existingDatePublished: md.existingDatePublished,
        nowIso: md.dateModified,
        imageUrl: md.imageUrl,
        publicUrl: md.publicUrl,
      });
      schemaMarkup = JSON.stringify(finalized);
    }

    // Use language-aware labels for markdown output
    const mdStrings = deterministicStrings[effectiveLang] || deterministicStrings.sr;
    const schemaLabel = effectiveLang === 'sq' ? '(nuk u gjenerua)' : effectiveLang === 'pl' ? '(nie wygenerowano)' : effectiveLang === 'en' ? '(not generated)' : '(nije generisan)';
    const markdown = [mdStrings.mdTitle, '', '```', title, '```', '', mdStrings.mdMeta, '', '```', meta, '```', '', mdStrings.mdKeywords + ' / Tagovi (Named Entities)', '', '```', kwLine, '```', '', '4. Schema Markup (JSON-LD)', '', '```json', schemaMarkup || schemaLabel, '```'].join('\n');
    return { title, metaDescription: meta, keywordsLine: kwLine, schemaMarkup, markdown, subtopics };
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
            { role: 'system', content: seoSystemPrompt },
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
    // maxOutputTokens: 8192 — Gemini 2.5 uses ~2000-3000 thinking tokens that count against this limit
    // thinkingConfig: disabled to reduce latency (SEO generation doesn't need chain-of-thought reasoning)
    const genConfig = {
      temperature: 0.6,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    } as any;

    let lastErrMsg: string | undefined;
    async function tryGemini(modelName: string): Promise<string | null> {
      try {
        console.log(`🔵 [Gemini] Trying model: ${modelName}`);
        const model = client.getGenerativeModel({ model: modelName, generationConfig: genConfig });
        // Prefer JSON response; pass plain text prompt
        const result = await model.generateContent(prompt as any);
        console.log(`📈 [Usage/generate] model=${modelName}`, JSON.stringify(result?.response?.usageMetadata || {}));
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
      portalId?: string;
      authorName?: string;
      publishedTime?: string;
      existingDatePublished?: string;
      dateModified?: string;
      imageUrl?: string;
      publicUrl?: string;
      publisherName?: string;
      publisherLogoUrl?: string;
      publisherDomain?: string;
      articleSection?: string;
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
