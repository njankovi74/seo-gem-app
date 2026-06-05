/**
 * Language Validation Module
 * 
 * Uses franc trigram analysis to detect the language of generated titles.
 * All 6 titles are concatenated for reliable detection (~350+ chars).
 * 
 * Flow:
 *   1. Concatenate all titles → franc detects language
 *   2. If detected == expected → pass
 *   3. If mismatch → flag for retry
 *   4. Log all results for monitoring
 */

// franc-min uses ISO 639-3 codes
// Our app uses: 'sr' (Serbian), 'pl' (Polish), 'sq' (Albanian), 'en' (English)
const OUR_TO_ISO639_3: Record<string, string[]> = {
  sr: ['srp', 'hbs', 'bos', 'hrv'], // Serbian + related (Bosnian, Croatian — trigrams overlap)
  pl: ['pol'],
  sq: ['sqi'],
  en: ['eng'],
};

const ISO639_3_TO_OURS: Record<string, string> = {
  srp: 'sr', hbs: 'sr', bos: 'sr', hrv: 'sr',
  pol: 'pl',
  sqi: 'sq',
  eng: 'en',
};

export interface LanguageValidationResult {
  expected: string;
  detected: string;       // our code (sr/pl/sq/en)
  detectedRaw: string;    // franc ISO 639-3 code
  isMatch: boolean;
  confidence: string;     // 'high' | 'low' | 'undetermined'
  combinedTextLength: number;
}

/**
 * Validate that generated titles are in the expected language.
 * 
 * @param titles - Array of generated title strings
 * @param expectedLang - Expected language code ('sr', 'pl', 'sq', 'en')
 * @returns Validation result with match status
 */
export async function validateTitleLanguage(
  titles: string[],
  expectedLang: string
): Promise<LanguageValidationResult> {
  // Combine all titles for better detection accuracy
  const combinedText = titles.join('. ');
  const textLength = combinedText.length;

  // Dynamic import for franc-min (ESM module)
  let francDetect: (text: string) => string;
  try {
    // franc-min exports { franc } as named export
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const francModule = require('franc-min');
    francDetect = francModule.franc || francModule;
  } catch (e) {
    console.warn('⚠️ [LangValidator] franc-min not available, skipping validation');
    return {
      expected: expectedLang,
      detected: expectedLang,
      detectedRaw: 'und',
      isMatch: true, // fail open if library not available
      confidence: 'undetermined',
      combinedTextLength: textLength,
    };
  }

  const detectedRaw = francDetect(combinedText);

  // Map franc result to our language code
  const detectedLang = ISO639_3_TO_OURS[detectedRaw] || 'unknown';

  // Check if it matches expected
  const acceptableCodes = OUR_TO_ISO639_3[expectedLang] || [];
  const isMatch = acceptableCodes.includes(detectedRaw);

  // Confidence based on text length
  const confidence = textLength >= 300 ? 'high' : textLength >= 150 ? 'low' : 'undetermined';

  // If undetermined by franc (too short), fail open
  if (detectedRaw === 'und') {
    return {
      expected: expectedLang,
      detected: 'undetermined',
      detectedRaw,
      isMatch: true, // don't block if we can't determine
      confidence: 'undetermined',
      combinedTextLength: textLength,
    };
  }

  const emoji = isMatch ? '✅' : '⚠️';
  console.log(`${emoji} [LangValidator] Expected: ${expectedLang}, Detected: ${detectedLang} (${detectedRaw}), Match: ${isMatch}, Confidence: ${confidence}, Text: ${textLength} chars`);

  return {
    expected: expectedLang,
    detected: detectedLang,
    detectedRaw,
    isMatch,
    confidence,
    combinedTextLength: textLength,
  };
}
