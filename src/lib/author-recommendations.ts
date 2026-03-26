import type { AuthorMetrics } from './author-metrics';

export interface AuthorRecommendations {
  categories: Array<{ category: string; items: string[]; type: 'critical' | 'missing' | 'positive' }>
}

export function buildAuthorRecommendations(params: {
  metrics: AuthorMetrics;
  mainTopics: string[];
  prioritizedKeywords: string[];
  subtopics?: string[];  // LLM-generated subtopics for better FAQ suggestions
  seoTitle?: string;
  seoMeta?: string;
}): AuthorRecommendations {
  const { metrics, mainTopics, prioritizedKeywords, subtopics, seoTitle, seoMeta } = params;
  const cats: Array<{ category: string; items: string[]; type: 'critical' | 'missing' | 'positive' }> = [];

  // ============================================================
  // 🔴 CRITICAL — Red scorecard items need immediate attention
  // ============================================================
  const critical: string[] = [];

  // Topic coverage issues
  if (metrics.topicCoverage < 0.5) {
    const missing = metrics.missingTopics?.slice(0, 3) || mainTopics.slice(0, 3);
    if (missing.length) {
      critical.push(`Pokrivenost tema je ${(metrics.topicCoverage*100).toFixed(0)}%. Dodajte H2/H3 sekcije za: ${missing.join(', ')}.`);
    }
  }

  // Long-tail issues
  if (metrics.longTailUsage < 0.3) {
    // Use subtopics for better long-tail suggestions
    const suggestions = subtopics?.slice(0, 3) ||
      prioritizedKeywords.filter(k => k.trim().split(/\s+/).length >= 2).slice(0, 3);
    if (suggestions.length > 0) {
      critical.push(`Long-tail fraze su slabo zastupljene (${(metrics.longTailUsage*100).toFixed(0)}%). Pojačajte upotrebu fraza poput: "${suggestions.join('", "')}".`);
    } else {
      critical.push(`Long-tail fraze su slabo zastupljene. Ubacite višerečne fraze (npr. "kako rešiti X", "zašto je Y važno") za bolji rang na long-tail pretrage.`);
    }
  }

  // Primary keyword density
  const pd = metrics.primaryDensity * 100;
  if (pd < 0.5) {
    const primary = prioritizedKeywords[0] || 'primarna ključna reč';
    critical.push(`Gustina primarne ključne reči "${primary}" je samo ${pd.toFixed(2)}%. Ciljajte 1-2.5% za optimalan SEO.`);
  } else if (pd > 3) {
    critical.push(`Gustina primarne ključne reči je ${pd.toFixed(2)}% — rizik od keyword stuffing-a. Smanjite na 1-2.5%.`);
  }

  // Repetition
  if (metrics.repetitionScore > 0.15) {
    critical.push(`Visok nivo ponavljanja (${(metrics.repetitionScore*100).toFixed(0)}%). Koristite sinonime i varijacije fraza za prirodniji tekst.`);
  }

  // Readability
  if (metrics.avgSentenceLength > 24) {
    critical.push(`Prosečna rečenica ima ${metrics.avgSentenceLength.toFixed(0)} reči. Skratite na 15-20 reči za bolju čitljivost i Discover.`);
  }

  if (critical.length) cats.push({ category: '🔴 Kritične popravke', items: critical, type: 'critical' });

  // ============================================================
  // 🟡 MISSING — Elements that would improve SEO but are absent
  // ============================================================
  const missing: string[] = [];

  // Secondary keyword usage
  if (metrics.secondaryDensity < 0.02) {
    const secs = prioritizedKeywords.slice(1, 4);
    if (secs.length) {
      missing.push(`Uvedi sekundarne ključne reči u tekst: ${secs.join(', ')} (ciljajte 0.3-0.8% gustine).`);
    }
  }

  // Keyword coverage
  if (metrics.keywordCoverage < 0.75) {
    missing.push(`Pokrivenost ključnih reči je ${(metrics.keywordCoverage*100).toFixed(0)}%. Probajte da prirodno ubacite više relevantnih pojmova.`);
  }

  // TTR / vocabulary diversity
  if (metrics.typeTokenRatio < 0.35) {
    missing.push(`Raznolikost rečnika je niska (${(metrics.typeTokenRatio*100).toFixed(0)}%). Dodajte primere, konkretne pojmove i stručnu terminologiju.`);
  }

  // FAQ suggestion — use LLM subtopics for meaningful questions
  if (subtopics && subtopics.length >= 2) {
    missing.push(`Dodajte FAQ sekciju sa 2-3 pitanja (npr: "Šta znači ${subtopics[0].toLowerCase()}?", "Kako utiče ${subtopics[1].toLowerCase()}?") za featured snippets.`);
  } else if (mainTopics.length >= 2) {
    missing.push(`Dodajte FAQ sekciju sa 2-3 pitanja o temama: ${mainTopics.slice(0, 2).join(', ')} — ovo poboljšava šanse za featured snippets.`);
  } else {
    missing.push(`Dodajte FAQ sekciju na kraju teksta sa 2-3 pitanja vezana za temu — ovo poboljšava šanse za featured snippets.`);
  }

  // Naslov i meta
  if (seoTitle) {
    if (seoTitle.length > 75) missing.push(`SEO naslov ima ${seoTitle.length} karaktera — skratite na ≤75 za prikaz u rezultatima.`);
    if (seoTitle.length < 40) missing.push(`SEO naslov je kratak (${seoTitle.length} karaktera) — proširite na 40-75 za bolji CTR.`);
  }
  if (seoMeta) {
    if (seoMeta.length > 160) missing.push(`Meta opis ima ${seoMeta.length} karaktera — skratite na 150-160.`);
    if (seoMeta.length < 140) missing.push(`Meta opis je kratak (${seoMeta.length} karaktera) — proširite na 150-160 za bolju vidljivost.`);
  }

  if (missing.length) cats.push({ category: '🟡 Nedostajući elementi', items: missing, type: 'missing' });

  // ============================================================
  // 🟢 POSITIVE — What's working well
  // ============================================================
  const positive: string[] = [];

  if (metrics.typeTokenRatio >= 0.5) {
    positive.push(`Odlična raznolikost rečnika (${(metrics.typeTokenRatio*100).toFixed(0)}%) — tekst je bogat i informativan.`);
  } else if (metrics.typeTokenRatio >= 0.4) {
    positive.push(`Dobra raznolikost rečnika (${(metrics.typeTokenRatio*100).toFixed(0)}%).`);
  }

  if (metrics.repetitionScore <= 0.08) {
    positive.push(`Nisko ponavljanje (${(metrics.repetitionScore*100).toFixed(0)}%) — tekst je prirodan i čitljiv.`);
  }

  if (metrics.keywordCoverage >= 0.75) {
    positive.push(`Visoka pokrivenost ključnih reči (${(metrics.keywordCoverage*100).toFixed(0)}%) — algoritmi jasno prepoznaju temu.`);
  }

  if (pd >= 1 && pd <= 2.5) {
    positive.push(`Optimalna gustina primarne ključne reči (${pd.toFixed(2)}%).`);
  }

  if (metrics.topicCoverage >= 0.7) {
    positive.push(`Odlična pokrivenost tema (${(metrics.topicCoverage*100).toFixed(0)}%) — tekst temeljno pokriva sve aspekte.`);
  }

  if (metrics.longTailUsage >= 0.5) {
    positive.push(`Dobra upotreba long-tail fraza (${(metrics.longTailUsage*100).toFixed(0)}%) — pogodno za AI pretraživače.`);
  }

  if (metrics.avgSentenceLength >= 10 && metrics.avgSentenceLength <= 20) {
    positive.push(`Optimalna dužina rečenica (${metrics.avgSentenceLength.toFixed(0)} reči) — lako čitljivo.`);
  }

  if (positive.length) cats.push({ category: '🟢 Dobro urađeno', items: positive, type: 'positive' });

  return { categories: cats };
}
