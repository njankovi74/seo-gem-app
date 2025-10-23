export type KeywordCategory = 'primary' | 'secondary' | 'tertiary';

export interface PrioritizedKeyword {
  term: string;
  score: number; // 0-100
  category: KeywordCategory;
  reasons: string[];
}

interface TFIDFItem { word: string; tf: number; idf: number; tfidf: number; }

interface TFIDFAnalysis {
  semanticCore: TFIDFItem[];
  keyPhrases: string[];
}

interface LSACluster { name: string; terms: string[]; strength: number; }
interface LSAAnalysis { topicClusters: LSACluster[]; conceptVectors?: { concept: string; weight: number; }[] }

interface SearchIntent { type: 'informational' | 'commercial' | 'transactional' | 'navigational'; confidence: number; indicators: string[]; }

export function prioritizeKeywords(
  text: string,
  tfidf: TFIDFAnalysis,
  lsa: LSAAnalysis,
  intent: SearchIntent
): PrioritizedKeyword[] {
  // Osnovno čišćenje i zaštita od šuma
  const banned = new Set<string>([
    'autor','društvo','hronika','video','foto','komentar','najnovije','vesti','portal','izvor','uredništvo','politika','ekonomija','sport','pre','juče','danas'
  ]);
  function cleanTerm(s: string): string | null {
    const t = (s || '').toString().trim().toLowerCase();
    if (!t || t.length < 3) return null;
    if (banned.has(t)) return null;
    if (/\d{1,2}:\d{2}/.test(t)) return null; // vreme
    if (/\d{1,2}\.\d{1,2}\.\d{2,4}/.test(t)) return null; // datum
    return t;
  }
  const reasonsMap: Record<string, string[]> = {};

  // Prepare candidate pool: union of top TF-IDF terms and recurring key phrases (split as needed)
  const candidates = new Set<string>();
  tfidf.semanticCore.slice(0, 60).forEach(t => {
    const ct = cleanTerm(t.word);
    if (ct) candidates.add(ct);
  });
  tfidf.keyPhrases.forEach(p => {
    const phrase = cleanTerm(p);
    if (phrase && phrase.includes(' ')) candidates.add(phrase);
  });

  const tfidfMap = new Map<string, number>();
  let maxTfidf = 0;
  tfidf.semanticCore.forEach(t => {
    const ct = cleanTerm(t.word);
    if (!ct) return;
    tfidfMap.set(ct, t.tfidf);
    if (t.tfidf > maxTfidf) maxTfidf = t.tfidf;
  });

  const textLower = text.toLowerCase();

  // Intent keyword hints
  const intentHints: Record<SearchIntent['type'], string[]> = {
    informational: ['kako', 'šta', 'zašto', 'vodič', 'definicija', 'primeri', 'saveti'],
    commercial: ['najbolji', 'recenzija', 'poređenje', 'iskustva', 'preporuke', 'alternativa', 'vs'],
    transactional: ['cena', 'kupi', 'naruči', 'popust', 'akcija', 'preuzmi', 'rezerviši'],
    navigational: ['sajt', 'zvanični', 'kontakt', 'adresa', 'prijava', 'registracija']
  };

  const clusters = lsa.topicClusters || [];

  function inClusters(term: string): boolean {
    const t = term.toLowerCase();
    return clusters.some(c => c.terms?.some(x => t.includes(x.toLowerCase()) || x.toLowerCase().includes(t)));
  }

  function normalize(n: number, max: number): number { return max > 0 ? n / max : 0; }

  const items: PrioritizedKeyword[] = [];
  candidates.forEach(term => {
    const termLower = term.toLowerCase();
    const r: string[] = [];

    // 1) Relevance by TF-IDF (0..1)
    const rel = normalize(tfidfMap.get(term) || 0, maxTfidf);
    if (rel > 0) r.push('visoka relevantnost (TF‑IDF)');

    // 2) Intent fit (0..1)
    const hints = intentHints[intent.type];
    const intentHit = hints.some(h => termLower.includes(h) || textLower.includes(`${h} ${termLower}`));
    const intentScore = intentHit ? 1 : 0;
    if (intentHit) r.push(`usklađeno sa ${intent.type} intentom`);

    // 3) Long‑tail bonus: phrases 2–3 reči ili prisutno u keyPhrases
    const wordsCount = term.trim().split(/\s+/).length;
    const isPhrase = wordsCount >= 2 && wordsCount <= 4;
  const appearsAsPhrase = tfidf.keyPhrases.some(p => (cleanTerm(p) || '') === term);
    const longTail = (isPhrase || appearsAsPhrase) ? 1 : 0;
    if (longTail) r.push('long‑tail fraza');

    // 4) Topical coverage: da li je u/oko klastera
    const topical = inClusters(term) ? 1 : 0;
  const candidates = new Set<string>();
  // Primarna fraza (seed) za long‑tail varijante
  const primarySeed = (tfidf.keyPhrases.find(p => (p || '').split(/\s+/).length >= 2) || tfidf.semanticCore[0]?.word || '').toLowerCase();

    // 5) Diversity bonus: penalize too-short single words
  const diversity = wordsCount === 1 && termLower.length <= 4 ? 0 : 1;

  // 6) Rigorous topical filter: odbaci očigledno nerelevantne (nema TF‑IDF, nije u klasterima, nema intent signala)
  const obviouslyOff = rel < 0.05 && !topical && intentScore === 0 && termLower.length < 5;
  if (obviouslyOff) return;

    // Weighted score to 0..100

  // Syntetiši long‑tail varijante oko primarne fraze (ako postoji)
  if (primarySeed) {
    const topWords = tfidf.semanticCore.slice(0, 10).map(t => cleanTerm(t.word)).filter(Boolean) as string[];
    for (const w of topWords) {
      if (w === primarySeed) continue;
      const combo1 = `${primarySeed} ${w}`;
      const combo2 = `${w} ${primarySeed}`;
      if (combo1.split(' ').length <= 4) candidates.add(combo1);
      if (combo2.split(' ').length <= 4) candidates.add(combo2);
    }
  }
    const score01 = rel * 0.4 + intentScore * 0.25 + longTail * 0.2 + topical * 0.15;
    const adj = score01 * (0.8 + 0.2 * diversity);
    const score = Math.round(Math.min(1, adj) * 100);

    reasonsMap[term] = r.length ? r : ['osnovna relevantnost'];
    items.push({ term, score, category: 'tertiary', reasons: reasonsMap[term] });
  });

  // Categorize by score percentiles
  items.sort((a, b) => b.score - a.score);
  const n = items.length;
  const p33 = items[Math.floor(n * 0.33)]?.score ?? 0;
  const p66 = items[Math.floor(n * 0.66)]?.score ?? 0;
  for (const it of items) {
    if (it.score >= p66) it.category = 'primary';
    else if (it.score >= p33) it.category = 'secondary';
    else it.category = 'tertiary';
  }

  // deduplikacija i rez
  const seen = new Set<string>();
  const unique = items.filter(i => { if (seen.has(i.term)) return false; seen.add(i.term); return true; });
  return unique.slice(0, 50);
}

export function prioritizedAsCSV(items: PrioritizedKeyword[]): string {
  const header = 'term,score,category';
  const rows = items.map(i => `${i.term.replace(/,/g, ' ')} ,${i.score},${i.category}`);
  return [header, ...rows].join('\n');
}

export function prioritizedAsCommaList(items: PrioritizedKeyword[], max = 20): string {
  const seen = new Set<string>();
  const list = [] as string[];
  for (const it of items) {
    if (list.length >= max) break;
    if (seen.has(it.term)) continue;
    seen.add(it.term);
    list.push(it.term);
  }
  return list.join(',');
}
