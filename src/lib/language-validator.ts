/**
 * Language Validation Module (Hybrid Approach)
 * 
 * Strategy:
 *   1. franc trigram detection (works well for SR, PL, EN)
 *   2. Word/character marker fallback (for SQ and edge cases)
 *   3. "Negative check" logic: only BLOCK when we're SURE it's wrong
 * 
 * Decision tree:
 *   franc detects EXPECTED language      → ✅ pass
 *   franc detects KNOWN WRONG language   → ⚠️ block (trigger retry)
 *   franc returns unknown/undetermined   → run marker check:
 *     markers confirm expected language  → ✅ pass
 *     markers detect wrong language      → ⚠️ block (trigger retry)
 *     markers inconclusive              → ✅ pass (fail open)
 */

// franc ISO 639-3 → our codes
const ISO639_3_TO_OURS: Record<string, string> = {
  srp: 'sr', hbs: 'sr', bos: 'sr', hrv: 'sr',
  pol: 'pl',
  sqi: 'sq',
  eng: 'en',
};

// Our codes → franc ISO 639-3 (acceptable matches)
const OUR_TO_ISO639_3: Record<string, string[]> = {
  sr: ['srp', 'hbs', 'bos', 'hrv'],
  pl: ['pol'],
  sq: ['sqi'],
  en: ['eng'],
};

/**
 * Word markers unique to each language.
 * Function words + common short words that are highly distinctive.
 * We match whole words only (word boundary).
 */
const LANGUAGE_MARKERS: Record<string, { words: string[]; chars: RegExp | null }> = {
  sq: {
    // Albanian function words — very distinctive
    words: ['në', 'dhe', 'për', 'që', 'nga', 'është', 'ka', 'pas', 'ose', 'por', 'edhe', 'mund', 'duke', 'ndaj', 'sipas', 'gjatë', 'deri', 'tek', 'çdo', 'asnjë', 'kjo', 'kush', 'pse', 'gjithë', 'vetëm', 'rreth', 'midis', 'nën', 'mbi', 'tjera'],
    chars: /[ëç]/i,
  },
  pl: {
    words: ['jest', 'nie', 'się', 'dla', 'jak', 'czy', 'już', 'też', 'ale', 'gdzie', 'przez', 'które', 'został', 'między', 'jednak', 'przed', 'według', 'podczas', 'bardzo', 'nowej'],
    chars: /[ąęśźżłń]/i,
  },
  sr: {
    words: ['je', 'su', 'koji', 'koja', 'koje', 'ali', 'kako', 'što', 'kod', 'prema', 'nakon', 'zbog', 'nego', 'već', 'između', 'može', 'samo', 'biti', 'ovaj', 'tako'],
    chars: /[đ]/i, // đ is uniquely Serbian (ć, č, š, ž exist in Croatian too but that's OK)
  },
  en: {
    words: ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'which', 'have', 'been', 'will', 'after', 'about', 'between', 'during', 'before', 'against', 'through'],
    chars: null,
  },
};

/**
 * Count how many marker words from a language appear in the text.
 * Returns a score 0..1 (fraction of markers found).
 */
function markerScore(text: string, lang: string): number {
  const markers = LANGUAGE_MARKERS[lang];
  if (!markers) return 0;

  const lowerText = ' ' + text.toLowerCase() + ' ';
  let found = 0;

  // Check character markers
  if (markers.chars && markers.chars.test(text)) {
    found += 3; // Character markers are strong signals
  }

  // Check word markers (whole word match)
  for (const word of markers.words) {
    // Match word boundaries using spaces, punctuation, start/end
    const regex = new RegExp(`(?:^|[\\s.,;:!?()\\[\\]"'])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s.,;:!?()\\[\\]"'])`, 'i');
    if (regex.test(lowerText)) {
      found++;
    }
  }

  return found / (markers.words.length + 3); // +3 for char marker weight
}

export interface LanguageValidationResult {
  expected: string;
  detected: string;
  detectedRaw: string;
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low' | 'undetermined';
  method: 'franc' | 'markers' | 'both' | 'fail-open';
  combinedTextLength: number;
}

export async function validateTitleLanguage(
  titles: string[],
  expectedLang: string
): Promise<LanguageValidationResult> {
  const combinedText = titles.join('. ');
  const textLength = combinedText.length;

  // === Step 1: franc detection ===
  let francResult = 'und';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const francModule = require('franc-min');
    const francFn = francModule.franc || francModule;
    francResult = francFn(combinedText);
  } catch {
    console.warn('⚠️ [LangValidator] franc-min not available');
  }

  const francLang = ISO639_3_TO_OURS[francResult] || null;
  const francMatch = francLang === expectedLang ||
    (OUR_TO_ISO639_3[expectedLang] || []).includes(francResult);

  // === Step 2: If franc gives clear answer, use it ===
  if (francResult !== 'und' && francLang !== null) {
    if (francMatch) {
      console.log(`✅ [LangValidator] franc: ${expectedLang}==${francLang} ✓ (${francResult}, ${textLength} chars)`);
      return {
        expected: expectedLang,
        detected: francLang,
        detectedRaw: francResult,
        isMatch: true,
        confidence: textLength >= 300 ? 'high' : 'medium',
        method: 'franc',
        combinedTextLength: textLength,
      };
    }
    // franc detected a KNOWN DIFFERENT language → strong mismatch signal
    console.warn(`⚠️ [LangValidator] franc: expected ${expectedLang}, got ${francLang} (${francResult}) — MISMATCH`);
    return {
      expected: expectedLang,
      detected: francLang,
      detectedRaw: francResult,
      isMatch: false,
      confidence: textLength >= 300 ? 'high' : 'medium',
      method: 'franc',
      combinedTextLength: textLength,
    };
  }

  // === Step 3: franc inconclusive → use marker scoring ===
  console.log(`🔍 [LangValidator] franc inconclusive (${francResult}), falling back to markers...`);

  const expectedScore = markerScore(combinedText, expectedLang);

  // Check if any OTHER language scores higher
  const otherLangs = Object.keys(LANGUAGE_MARKERS).filter(l => l !== expectedLang);
  let highestOther = { lang: '', score: 0 };
  for (const lang of otherLangs) {
    const score = markerScore(combinedText, lang);
    if (score > highestOther.score) {
      highestOther = { lang, score };
    }
  }

  console.log(`🔍 [LangValidator] Marker scores: ${expectedLang}=${expectedScore.toFixed(2)}, best other=${highestOther.lang}:${highestOther.score.toFixed(2)}`);

  // Decision: if expected language has reasonable markers OR no other language dominates
  if (expectedScore >= 0.05) {
    // Expected language markers found
    console.log(`✅ [LangValidator] Markers confirm ${expectedLang} (score: ${expectedScore.toFixed(2)})`);
    return {
      expected: expectedLang,
      detected: expectedLang,
      detectedRaw: francResult,
      isMatch: true,
      confidence: expectedScore >= 0.15 ? 'high' : 'medium',
      method: 'markers',
      combinedTextLength: textLength,
    };
  }

  if (highestOther.score > expectedScore && highestOther.score >= 0.1) {
    // Another language clearly dominates
    console.warn(`⚠️ [LangValidator] Markers suggest ${highestOther.lang} (${highestOther.score.toFixed(2)}) instead of ${expectedLang} (${expectedScore.toFixed(2)})`);
    return {
      expected: expectedLang,
      detected: highestOther.lang,
      detectedRaw: francResult,
      isMatch: false,
      confidence: 'medium',
      method: 'markers',
      combinedTextLength: textLength,
    };
  }

  // Inconclusive — fail open (don't block)
  console.log(`🤷 [LangValidator] Inconclusive, failing open for ${expectedLang}`);
  return {
    expected: expectedLang,
    detected: expectedLang,
    detectedRaw: francResult,
    isMatch: true,
    confidence: 'undetermined',
    method: 'fail-open',
    combinedTextLength: textLength,
  };
}
