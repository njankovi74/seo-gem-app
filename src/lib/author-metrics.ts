export interface AuthorMetrics {
  wordCount: number;
  readingTimeMin: number;
  avgSentenceLength: number;
  typeTokenRatio: number;
  repetitionScore: number; // 0-1 (više = repetitivnije)
  primaryDensity: number; // 0-1
  secondaryDensity: number; // 0-1
  topicCoverage: number; // 0-1
  keywordCoverage: number; // 0-1
  longTailUsage: number; // 0-1
  // New: expose generated long-tail phrases for recommendations
  detectedLongTails: string[];
  missingTopics: string[];
}

// Serbian stop words that should be ignored in n-gram analysis
const STOP_WORDS = new Set([
  'i', 'u', 'na', 'je', 'da', 'se', 'za', 'su', 'sa', 'od', 'do', 'ne', 'iz',
  'to', 'ili', 'ali', 'kao', 'što', 'bi', 'su', 'bio', 'bila', 'bilo', 'biti',
  'može', 'koji', 'koja', 'koje', 'koje', 'tog', 'taj', 'ta', 'te', 'ovo',
  'sve', 'svi', 'tim', 'tom', 'tom', 'već', 'samo', 'još', 'kad', 'dok',
  'po', 'pri', 'pre', 'bez', 'kroz', 'među', 'oko', 'prema', 'nakon',
  'ima', 'nije', 'nema', 'mogu', 'ima', 'jer', 'ako', 'što', 'čak',
  'jedno', 'jedan', 'jedna', 'ove', 'oni', 'one', 'ona', 'ono', 'ovaj',
  'tog', 'ovi', 'ovih', 'onih', 'ovom', 'onom', 'ovoj', 'onoj',
  'će', 'su', 'sam', 'si', 'smo', 'ste', 'čemu', 'čime', 'čega',
  'tako', 'više', 'manje', 'između', 'posebno', 'takođe', 'zatim',
  'međutim', 'ipak', 'dakle', 'stoga', 'naime', 'odnosno',
  'the', 'is', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'with',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sčćžšđČĆŽŠĐ-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function contentWords(words: string[]): string[] {
  return words.filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function sentences(text: string): string[] {
  return text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
}

function ngrams(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    out.push(words.slice(i, i + n).join(' '));
  }
  return out;
}

function densityOfPhrase(text: string, phrase: string): number {
  if (!phrase) return 0;
  const re = new RegExp(`(^|[^a-z0-9čćžšđ])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9čćžšđ]|$)`, 'gi');
  const matches = text.toLowerCase().match(re)?.length || 0;
  const wc = tokenize(text).length || 1;
  return Math.min(1, matches / wc);
}

/**
 * Compute topicCoverage using word-level matching:
 * For each topic label, split into individual words, remove stop words,
 * and check how many of those words appear in the text.
 * A topic is "covered" if >=50% of its content words appear.
 */
function computeTopicCoverage(text: string, topics: string[]): { coverage: number; missing: string[] } {
  if (!topics.length) return { coverage: 0, missing: [] };
  
  const lower = text.toLowerCase();
  const textWords = new Set(tokenize(text));
  let coveredCount = 0;
  const missing: string[] = [];
  
  for (const topic of topics) {
    if (!topic || !topic.trim()) continue;
    
    const topicWords = contentWords(tokenize(topic));
    
    if (topicWords.length === 0) {
      // Single short word or all stop words — just do direct check
      if (lower.includes(topic.toLowerCase())) {
        coveredCount++;
      } else {
        missing.push(topic);
      }
      continue;
    }
    
    // Count how many topic words appear in the text
    const presentWords = topicWords.filter(w => textWords.has(w) || lower.includes(w));
    const ratio = presentWords.length / topicWords.length;
    
    if (ratio >= 0.5) {
      coveredCount++;
    } else {
      missing.push(topic);
    }
  }
  
  const validTopics = topics.filter(t => t && t.trim());
  return {
    coverage: validTopics.length ? coveredCount / validTopics.length : 0,
    missing
  };
}

/**
 * Compute longTailUsage by generating actual bigrams and trigrams from text,
 * filtering stop words, and measuring what percentage of meaningful text
 * is composed of recurring multi-word phrases.
 */
function computeLongTailUsage(words: string[], prioritizedKeywords: string[]): {
  usage: number;
  detected: string[];
} {
  const content = contentWords(words);
  if (content.length < 4) return { usage: 0, detected: [] };
  
  // Generate bigrams and trigrams from content words in original order
  // (use original words array to preserve adjacency, but filter)
  const allBigrams = ngrams(words, 2)
    .filter(bg => {
      const parts = bg.split(' ');
      return parts.every(p => p.length > 2) && !parts.every(p => STOP_WORDS.has(p));
    });
  
  const allTrigrams = ngrams(words, 3)
    .filter(tg => {
      const parts = tg.split(' ');
      const contentParts = parts.filter(p => !STOP_WORDS.has(p) && p.length > 2);
      return contentParts.length >= 2; // At least 2 content words in trigram
    });
  
  // Count frequencies
  const bigramFreq: Record<string, number> = {};
  for (const bg of allBigrams) bigramFreq[bg] = (bigramFreq[bg] || 0) + 1;
  
  const trigramFreq: Record<string, number> = {};
  for (const tg of allTrigrams) trigramFreq[tg] = (trigramFreq[tg] || 0) + 1;
  
  // Get meaningful phrases (appear 2+ times)
  const meaningfulBigrams = Object.entries(bigramFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase]) => phrase);
  
  const meaningfulTrigrams = Object.entries(trigramFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
  
  // Also check prioritized keywords that are multi-word
  const lower = words.join(' ');
  const kwLongTails = prioritizedKeywords
    .filter(k => k.trim().split(/\s+/).length >= 2 && k.trim().split(/\s+/).length <= 4)
    .filter(k => lower.includes(k.toLowerCase()));
  
  // Combine all detected long-tail phrases
  const allDetected = [...new Set([...meaningfulTrigrams, ...meaningfulBigrams, ...kwLongTails])];
  
  // Usage score: ratio of text words covered by long-tail phrases
  // Count total word occurrences that are part of detected phrases
  let coveredWords = 0;
  for (const phrase of allDetected) {
    const phraseWords = phrase.split(' ').length;
    const freq = bigramFreq[phrase] || trigramFreq[phrase] || 1;
    coveredWords += phraseWords * freq;
  }
  
  // Normalize: what % of content words are in long-tail phrases
  // Cap at 1.0, reasonable range 0.3-0.8
  const usage = Math.min(1, coveredWords / Math.max(1, content.length));
  
  return {
    usage,
    detected: allDetected.slice(0, 10) // Top 10 for display
  };
}

export function computeAuthorMetrics(params: {
  text: string;
  topics: string[];
  prioritizedKeywords: string[]; // already cleaned, ordered by priority
}): AuthorMetrics {
  const { text } = params;
  const words = tokenize(text);
  const sents = sentences(text);
  const wc = words.length;
  const uniq = new Set(words);
  const ttr = wc ? uniq.size / wc : 0;

  // repetition via 2-gram repetition ratio
  const bigs = ngrams(words, 2);
  const freq: Record<string, number> = {};
  for (const b of bigs) freq[b] = (freq[b] || 0) + 1;
  const repeated = Object.values(freq).filter(v => v > 1).reduce((a, b) => a + (b - 1), 0);
  const repetitionScore = Math.min(1, repeated / Math.max(1, bigs.length));

  const avgSentenceLength = sents.length ? wc / sents.length : wc;

  const primary = params.prioritizedKeywords[0] || '';
  const secondaries = params.prioritizedKeywords.slice(1, 6);

  const primaryDensity = densityOfPhrase(text, primary);
  const secMatchSum = secondaries.reduce((sum, p) => sum + densityOfPhrase(text, p), 0);
  const secondaryDensity = Math.min(1, secMatchSum);

  // Topic coverage — improved word-level matching
  const { coverage: topicCoverage, missing: missingTopics } = computeTopicCoverage(text, params.topics);

  // Keyword coverage — unchanged but slightly relaxed
  const kw = params.prioritizedKeywords.slice(0, 12);
  const lower = text.toLowerCase();
  const kwHits = kw.filter(k => lower.includes(k.toLowerCase())).length;
  const keywordCoverage = kw.length ? kwHits / kw.length : 0;

  // Long-tail usage — improved with actual n-gram analysis
  const { usage: longTailUsage, detected: detectedLongTails } = computeLongTailUsage(words, params.prioritizedKeywords);

  // reading time in minutes
  const readingTimeMin = Math.max(1, Math.round(wc / 200));

  return {
    wordCount: wc,
    readingTimeMin,
    avgSentenceLength,
    typeTokenRatio: ttr,
    repetitionScore,
    primaryDensity,
    secondaryDensity,
    topicCoverage,
    keywordCoverage,
    longTailUsage,
    detectedLongTails,
    missingTopics,
  };
}
