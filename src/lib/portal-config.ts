export const PORTAL_DOMAINS: Record<string, string> = {
  newsmax: 'newsmaxbalkans.com',
  newsmax_en: 'newsmaxbalkans.com',
  newsmax_al: 'newsmaxbalkans.al',
  newsmax_pl: 'newsmaxpolska.pl',
  insajder: 'insajder.net',
};

export const PUBLISHER_INFO: Record<string, { name: string; logoUrl: string; domain: string }> = {
  newsmax: {
    name: 'Newsmax Balkans',
    logoUrl: 'https://newsmaxbalkans.com/files/img/logo.png',
    domain: 'newsmaxbalkans.com',
  },
  newsmax_en: {
    name: 'Newsmax Balkans',
    logoUrl: 'https://newsmaxbalkans.com/files/img/logo.png',
    domain: 'newsmaxbalkans.com',
  },
  newsmax_al: {
    name: 'Newsmax Balkans',
    logoUrl: 'https://newsmaxbalkans.al/files/img/logo.png',
    domain: 'newsmaxbalkans.al',
  },
  newsmax_pl: {
    name: 'Newsmax Polska',
    logoUrl: 'https://newsmaxpolska.pl/files/img/logo.png',
    domain: 'newsmaxpolska.pl',
  },
  insajder: {
    name: 'Insajder',
    logoUrl: 'https://insajder.net/apple-icon.png',
    domain: 'insajder.net',
  },
};

// Oznake redakcije: poređenje po celoj reči, bez obzira na veličinu slova
export const NEWSROOM_AUTHOR_WORDS = ['redakcija', 'redakcije', 'redaksia', 'redakcja', 'redaktion', 'redazione', 'uredništvo', 'urednistvo', 'desk', 'newsroom'];
// Sistemski nalozi CMS-a: poređenje "sadrži", bez obzira na veličinu slova
export const SYSTEM_AUTHOR_MARKERS = ['cubes'];
// Pravne forme: ime se njima završava (posle trim-a), bez obzira na veličinu slova
export const LEGAL_ENTITY_SUFFIXES = ['d.o.o.', 'd.o.o', 'doo', 'a.d.', 'sp. z o.o.', 'sp. z o. o.', 'sh.p.k.', 'shpk', 'ltd', 'llc', 'inc', 'gmbh', 's.r.l.', 'srl'];
// Agencije: cela vrednost jednaka imenu, bez obzira na veličinu slova (u podacima do sada viđena: Beta)
export const NEWS_AGENCIES = ['Beta', 'Tanjug', 'FoNet', 'Hina', 'Reuters', 'AP', 'AFP', 'DPA', 'ANSA', 'PAP', 'ATSH', 'ATA'];

// Transliteration map (Serbian, Polish, Albanian)
const TRANSLITERATE: Record<string, string> = {
  // Serbian
  'š': 's', 'đ': 'd', 'č': 'c', 'ć': 'c', 'ž': 'z',
  'Š': 's', 'Đ': 'd', 'Č': 'c', 'Ć': 'c', 'Ž': 'z',
  // Polish (ć already covered above)
  'ą': 'a', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'a', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o',
  'Ś': 's', 'Ź': 'z', 'Ż': 'z',
  // Albanian
  'ë': 'e', 'ç': 'c', 'Ë': 'e', 'Ç': 'c',
};

export function transliterate(text: string): string {
  return (text || '').normalize('NFC').split('').map(c => TRANSLITERATE[c] || c).join('');
}

/**
 * Generates Cubes-compatible URL slug from title:
 * - lowercase + transliteration (sr/pl/sq)
 * - strips punctuation , . : ; ! ? ( ) quotes apostrophes % ("1,7" -> "17")
 * - replaces remaining non-alphanumeric sequences with "-"
 * - collapses multiple "-" and trims leading/trailing "-"
 * - no length truncation
 */
export function titleToSlug(title: string): string {
  return transliterate(title)
    .toLowerCase()
    .replace(/[.,:;!?()"'„“”‘’‚«»%]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Builds canonical public article URL from known publicUrl:
 * - Cleans query/hash and rejects non-http(s) or admin/local URLs (backoffice, cubesdev, mpanel, localhost).
 * - If the path contains a Cubes numeric ID segment /{4+ digits}/{slug}, replaces {slug} with titleToSlug(seoTitle).
 * - Otherwise (no numeric ID in path, e.g. insajder.net/{rubrika}/{slug}), returns the cleaned URL as-is.
 */
export function buildCanonicalUrlFromPublicUrl(publicUrl?: string, seoTitle?: string): string {
  if (!publicUrl) return '';
  const clean = publicUrl.trim().split('?')[0].split('#')[0];
  if (
    !/^https?:\/\//i.test(clean) ||
    clean.includes('backoffice') ||
    clean.includes('cubesdev') ||
    clean.includes('mpanel') ||
    clean.includes('localhost')
  ) {
    return '';
  }
  const m = clean.match(/^(https?:\/\/[^/]+(?:\/[^/]+)*\/\d{4,}\/)([^/]+)(\/.*)?$/);
  if (m) {
    if (!seoTitle) return '';
    const slug = titleToSlug(seoTitle);
    if (!slug) return '';
    return `${m[1]}${slug}${m[3] || ''}`;
  }
  return clean;
}

/**
 * Converts section/category string (e.g. "MAGAZIN") to Title Case ("Magazin").
 */
export function toTitleCase(str?: string): string {
  const trimmed = (str || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed === '(N/A)') return '';
  return trimmed
    .toLowerCase()
    .replace(/(?:^|[\s\-/])(\p{L})/gu, (match) => match.toUpperCase());
}
