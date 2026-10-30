/**
 * Smart Google Autocomplete queries (currently used for Serbian).
 *
 * Problem this solves: the old flow sent ONE "primary keyword" to Google Suggest.
 * That keyword was often a single function word ("nakon", "tokom", "prekid"),
 * which returned noise ("nakon svih ovih godina", "prekidači za svetlo") that the
 * prompt then forced into titles.
 *
 * New flow:
 *  1. Build MEANINGFUL multi-word queries (mid-tail 2–3 words, long-tail up to 4)
 *     from the article itself — no single-word queries.
 *  2. Ask Google Suggest for each (parallel, 2s timeout, cached).
 *  3. Keep only suggestions with 2+ words whose words all appear in the article
 *     (inflection- and diacritics-tolerant), except common function/question words.
 */
import { getLanguageConfig, type SupportedLanguage } from './i18n';
import { getGoogleSuggestions } from './google-suggest';

// Short words allowed INSIDE a query phrase (never at the start/end), e.g. "vodič za lečenje"
const CONNECTORS: Record<string, Set<string>> = {
  sr: new Set(['za', 'i', 'u', 'na', 'od', 'o', 'sa', 'iz', 'do', 'po', 'protiv', 'bez', 'kod', 'pod', 'nad', 'pred']),
};

// Words a suggestion may contain even if they are not in the article (function + question words)
const FREE_WORDS: Record<string, Set<string>> = {
  sr: new Set(['za', 'i', 'u', 'na', 'od', 'o', 'sa', 'iz', 'do', 'po', 'protiv', 'bez', 'kod', 'pod', 'nad', 'pred', 'pre', 'posle', 'nakon', 'tokom',
    'da', 'li', 'je', 'se', 'su', 'kako', 'sta', 'zasto', 'gde', 'kada', 'koji', 'koja', 'koje', 'ko', 'koliko', 'cemu', 'sto']),
};

const MAX_BASE_QUERIES = 3;
const MAX_QUERIES = 5;
const MAX_SUGGESTIONS = 6;

/** lowercase + strip Serbian diacritics (users often type without them) */
function fold(s: string): string {
  return s.toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj');
}

function words(s: string): string[] {
  return (s.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

function isContent(w: string, stop: Set<string>): boolean {
  return w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w);
}

/** crude stem for inflection-tolerant comparison */
function stem(w: string): string {
  const f = fold(w);
  return f.slice(0, Math.max(4, Math.min(5, f.length - 1)));
}

export interface SuggestQueryCandidate { phrase: string; freq: number; score: number; }

/**
 * Build meaningful multi-word search queries from the article.
 * A phrase: 2–4 consecutive words, starts and ends with a content word,
 * at most one connector word inside, no other stop words.
 * Longer phrases win over their sub-phrases when they occur (almost) as often.
 */
export function buildSuggestQueries(text: string, title: string, language: SupportedLanguage): SuggestQueryCandidate[] {
  const stop = new Set(getLanguageConfig(language).stopWords);
  const connectors = CONNECTORS[language] || new Set<string>();
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
  const leadText = sentences.slice(0, 2).join(' ').toLowerCase();
  const titleLower = (title || '').toLowerCase();

  const wf = new Map<string, number>();
  words(text).forEach((w) => { if (isContent(w, stop)) wf.set(w, (wf.get(w) || 0) + 1); });
  const maxWf = Math.max(1, ...Array.from(wf.values()));

  const freq = new Map<string, number>();
  for (const sentence of sentences) {
    const ws = words(sentence);
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= ws.length; i++) {
        const win = ws.slice(i, i + n);
        if (!isContent(win[0], stop) || !isContent(win[n - 1], stop)) continue;
        const inner = win.slice(1, -1);
        const innerConnectors = inner.filter((w) => connectors.has(w)).length;
        const innerOk = inner.every((w) => connectors.has(w) || isContent(w, stop));
        if (!innerOk || innerConnectors > 1) continue;
        const phrase = win.join(' ');
        freq.set(phrase, (freq.get(phrase) || 0) + 1);
      }
    }
  }

  // eligible phrases: repeated, or in the lead / title
  const eligible = new Map<string, number>();
  freq.forEach((f, p) => {
    if (f >= 2 || leadText.includes(p) || titleLower.includes(p)) eligible.set(p, f);
  });
  // maximal-phrase rule: drop a phrase if a longer eligible phrase contains it with ≥80% of its frequency
  const phrases = Array.from(eligible.keys());
  const maximal = phrases.filter((p) => !phrases.some((q) => q !== p && q.length > p.length && ` ${q} `.includes(` ${p} `) && (eligible.get(q)! >= 0.8 * eligible.get(p)!)));

  const candidates: SuggestQueryCandidate[] = maximal.map((phrase) => {
    const f = eligible.get(phrase)!;
    const content = words(phrase).filter((w) => isContent(w, stop));
    const weight = content.reduce((s, w) => s + (wf.get(w) || 0) / maxWf, 0) / Math.max(1, content.length);
    const n = words(phrase).length;
    const lengthBonus = n === 2 ? 0.6 : n === 3 ? 0.5 : 0.2; // mid-tail first, then long-tail
    const score = f + (leadText.includes(phrase) ? 1.5 : 0) + (titleLower.includes(phrase) ? 2 : 0) + weight * 2 + lengthBonus;
    return { phrase, freq: f, score };
  });
  candidates.sort((a, b) => b.score - a.score);

  // diversity: skip phrases whose content stems are all covered by an already chosen phrase (or vice versa)
  const chosen: SuggestQueryCandidate[] = [];
  for (const c of candidates) {
    const cs = new Set(words(c.phrase).filter((w) => isContent(w, stop)).map(stem));
    const covered = chosen.some((x) => {
      const xs = new Set(words(x.phrase).filter((w) => isContent(w, stop)).map(stem));
      return Array.from(cs).every((s) => xs.has(s)) || Array.from(xs).every((s) => cs.has(s));
    });
    if (covered) continue;
    chosen.push(c);
    if (chosen.length >= MAX_BASE_QUERIES) break;
  }
  return chosen;
}

/** Final query list: chosen phrases + for each long-tail (3–4 words) a 2-word sub-phrase as fallback. */
export function expandQueries(chosen: SuggestQueryCandidate[], language: SupportedLanguage): string[] {
  const stop = new Set(getLanguageConfig(language).stopWords);
  const out: string[] = [];
  for (const c of chosen) {
    out.push(c.phrase);
    const ws = words(c.phrase);
    if (ws.length >= 3) {
      const subs: string[] = [];
      for (let i = 0; i + 2 <= ws.length; i++) {
        if (isContent(ws[i], stop) && isContent(ws[i + 1], stop)) subs.push(`${ws[i]} ${ws[i + 1]}`);
      }
      if (subs.length) out.push(subs[subs.length - 1]); // head noun phrase is usually at the end in Serbian
    }
  }
  return Array.from(new Set(out)).slice(0, MAX_QUERIES);
}

/**
 * Keep only suggestions that (a) have 2+ words and (b) whose words all exist in the article
 * (inflection/diacritics tolerant), except function and question words. Numbers and short
 * tokens/acronyms (≤3 letters) must appear exactly.
 */
export function filterSuggestions(suggestions: string[], text: string, language: SupportedLanguage): { kept: string[]; dropped: string[] } {
  const free = FREE_WORDS[language] || new Set<string>();
  const articleStems = new Set(words(text).map(stem));
  const articleFolded = new Set(words(text).map(fold));
  const kept: string[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  for (const s of suggestions) {
    const norm = s.trim().toLowerCase();
    const key = fold(norm);
    if (!norm || seen.has(key)) continue;
    seen.add(key);
    const ws = words(norm);
    const ok = ws.length >= 2 && ws.some((w) => !free.has(fold(w))) && ws.every((w) => {
      const f = fold(w);
      if (free.has(f)) return true;
      if (/^\d+$/.test(w)) return articleFolded.has(w);
      if (f.length <= 3) return articleFolded.has(f);
      return articleStems.has(stem(w));
    });
    (ok ? kept : dropped).push(norm);
  }
  return { kept: kept.slice(0, MAX_SUGGESTIONS), dropped };
}

/**
 * Full pipeline: meaningful queries → Google Suggest → relevance filter.
 */
export async function getRelevantSuggestions(text: string, title: string, language: SupportedLanguage): Promise<{
  queries: string[];
  suggestions: string[];
  dropped: string[];
}> {
  const queries = expandQueries(buildSuggestQueries(text, title, language), language);
  if (queries.length === 0) return { queries, suggestions: [], dropped: [] };
  const results = await Promise.all(queries.map((q) => getGoogleSuggestions(q, language, 10, true)));
  const { kept, dropped } = filterSuggestions(results.flat(), text, language);
  console.log(`🔍 [SmartSuggest] queries=${JSON.stringify(queries)} → kept ${kept.length}, dropped ${dropped.length}`);
  return { queries, suggestions: kept, dropped };
}
