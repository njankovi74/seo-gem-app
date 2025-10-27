import type { AuthorMetrics } from './author-metrics';

export interface AuthorRecommendations {
  categories: Array<{ category: string; items: string[] }>
}

export function buildAuthorRecommendations(params: {
  metrics: AuthorMetrics;
  mainTopics: string[];
  prioritizedKeywords: string[];
  seoTitle?: string;
  seoMeta?: string;
}): AuthorRecommendations {
  const { metrics, mainTopics, prioritizedKeywords, seoTitle, seoMeta } = params;
  const cats: Array<{ category: string; items: string[] }> = [];

  // Struktura i pokrivenost
  const missingTopics = mainTopics.filter(t => t && t.trim()).filter(t => {
    return !(t.toLowerCase() && (seoMeta || '').toLowerCase().includes(t.toLowerCase()));
  }).slice(0, 3);

  const structure: string[] = [];
  if (missingTopics.length > 0 || metrics.topicCoverage < 0.7) {
    structure.push(`Dodaj H2/H3 sekcije za nedostajuće teme: ${missingTopics.join(', ') || mainTopics.slice(0,2).join(', ')}`);
  }
  if (metrics.avgSentenceLength > 24) {
    structure.push('Skrati preduge rečenice (>24 reči) i razbij pasuse radi veće čitljivosti.');
  }
  if (structure.length) cats.push({ category: 'Struktura i pokrivenost', items: structure });

  // Ključne reči i long-tail
  const kw: string[] = [];
  if (metrics.primaryDensity < 0.008) kw.push('Pojačaj prisustvo primarne ključne reči (prirodno, ~0.8–1.5%).');
  if (metrics.secondaryDensity < 0.02) kw.push('Uvedi 2–3 sekundarne fraze u relevantne pasuse (0.3–0.8%).');
  if (metrics.longTailUsage < 0.6) {
    const longs = prioritizedKeywords.filter(k => k.trim().split(/\s+/).length >= 2).slice(0,3);
    if (longs.length) kw.push(`Ubaci 2–3 long-tail varijante: ${longs.join(', ')}`);
  }
  if (kw.length) cats.push({ category: 'Ključne reči (long-tail first)', items: kw });

  // Naslov i meta
  const nm: string[] = [];
  if (seoTitle) {
    if (seoTitle.length > 75) nm.push('Skrati SEO naslov na ≤ 75 karaktera.');
    if (seoTitle.length < 40) nm.push('Pojačaj SEO naslov (40–75 karaktera, uključujući primarnu).');
  }
  if (seoMeta) {
    if (seoMeta.length > 160) nm.push('Skrati meta opis na 150–160 karaktera.');
    if (seoMeta.length < 140) nm.push('Produbi meta opis (150–160 karaktera, informativno, bez CTA).');
  }
  if (nm.length) cats.push({ category: 'Naslov i meta', items: nm });

  // Stil i jasnoća
  const style: string[] = [];
  if (metrics.repetitionScore > 0.1) style.push('Smanji ponavljanja isto-slednih fraza; koristi sinonime.');
  if (metrics.typeTokenRatio < 0.35) style.push('Povećaj raznolikost reči (TTR), dodaj primere i konkretne pojmove.');
  if (style.length) cats.push({ category: 'Stil i jasnoća', items: style });

  // FAQ
  const faq: string[] = [];
  const firstLongs = prioritizedKeywords.filter(k => k.trim().split(/\s+/).length >= 2).slice(0,2);
  if (firstLongs.length) faq.push(`Dodaj FAQ sa 2–3 pitanja na kraju (npr: "Šta je ${firstLongs[0]}?", "Kako rešiti ${firstLongs[1] || firstLongs[0]}?")`);
  if (faq.length) cats.push({ category: 'FAQ (featured snippets)', items: faq });

  return { categories: cats };
}
