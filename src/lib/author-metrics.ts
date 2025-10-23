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
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sčćžšđČĆŽŠĐ-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
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

  // coverage
  const lower = text.toLowerCase();
  const topicHits = params.topics.filter(t => lower.includes((t || '').toLowerCase())).length;
  const topicCoverage = params.topics.length ? topicHits / params.topics.length : 0;

  const kw = params.prioritizedKeywords.slice(0, 12);
  const kwHits = kw.filter(k => lower.includes(k.toLowerCase())).length;
  const keywordCoverage = kw.length ? kwHits / kw.length : 0;

  // long-tail usage among keywords present in text
  const isLong = (s: string) => s.trim().split(/\s+/).length >= 2 && s.trim().split(/\s+/).length <= 4;
  const presentLong = kw.filter(k => isLong(k) && lower.includes(k.toLowerCase())).length;
  const longTailUsage = kw.length ? presentLong / kw.length : 0;

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
  };
}
