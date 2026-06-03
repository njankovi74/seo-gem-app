/**
 * Google Autocomplete / Suggest integration
 * Fetches real search suggestions for a keyword in the target language.
 * Used to bridge the gap between article keywords and actual user search queries.
 */

// In-memory cache: keyword+lang → { suggestions, timestamp }
const cache = new Map<string, { suggestions: string[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const LANG_TO_HL: Record<string, string> = {
  sr: 'sr',
  pl: 'pl',
  sq: 'sq',
  en: 'en',
};

const LANG_TO_GL: Record<string, string> = {
  sr: 'RS',
  pl: 'PL',
  sq: 'AL',
  en: 'US',
};

/**
 * Fetches Google Autocomplete suggestions for a given keyword.
 * Returns up to `maxResults` real search queries.
 * 
 * - 2s timeout to avoid slowing down the pipeline
 * - In-memory cache (5 min TTL)
 * - Graceful fallback: returns [] on any error
 */
export async function getGoogleSuggestions(
  keyword: string,
  language: string,
  maxResults: number = 6
): Promise<string[]> {
  if (!keyword || keyword.trim().length < 3) return [];

  const normalizedKW = keyword.trim().toLowerCase();
  const hl = LANG_TO_HL[language] || 'sr';
  const gl = LANG_TO_GL[language] || 'RS';
  const cacheKey = `${normalizedKW}:${hl}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.suggestions;
  }

  try {
    const encoded = encodeURIComponent(normalizedKW);
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encoded}&hl=${hl}&gl=${gl}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`⚠️ [GoogleSuggest] HTTP ${response.status} for "${normalizedKW}"`);
      return [];
    }

    // Response format: ["query", ["suggestion1", "suggestion2", ...]]
    const data = await response.json();
    const suggestions: string[] = Array.isArray(data[1])
      ? data[1]
          .filter((s: string) => typeof s === 'string' && s !== normalizedKW)
          .slice(0, maxResults)
      : [];

    // Cache result
    cache.set(cacheKey, { suggestions, ts: Date.now() });

    // Evict old cache entries (prevent memory leak)
    if (cache.size > 200) {
      const now = Date.now();
      for (const [key, val] of cache.entries()) {
        if (now - val.ts > CACHE_TTL_MS) cache.delete(key);
      }
    }

    console.log(`🔍 [GoogleSuggest] "${normalizedKW}" (${hl}) → ${suggestions.length} results`);
    return suggestions;

  } catch (error) {
    // Graceful fallback — never break the pipeline
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort')) {
      console.warn(`⚠️ [GoogleSuggest] Timeout for "${normalizedKW}" (2s limit)`);
    } else {
      console.warn(`⚠️ [GoogleSuggest] Error for "${normalizedKW}": ${msg}`);
    }
    return [];
  }
}
