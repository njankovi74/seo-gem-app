export const PORTAL_DOMAINS: Record<string, string> = {
  newsmax: 'newsmaxbalkans.com',
  newsmax_en: 'newsmaxbalkans.com',
  newsmax_al: 'newsmaxbalkans.al',
  newsmax_pl: 'newsmaxpolska.pl',
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
};

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
 * Builds canonical public article URL by taking prefix up to /{id}/ and suffix (/vest or /news)
 * from known publicUrl, and replacing the slug segment with titleToSlug(seoTitle).
 * Returns '' if publicUrl is missing or does not contain a valid /{id}/{slug} pattern.
 */
export function buildCanonicalUrlFromPublicUrl(publicUrl?: string, seoTitle?: string): string {
  if (!publicUrl || !seoTitle) return '';
  const clean = publicUrl.trim().split('?')[0].split('#')[0];
  if (!clean.startsWith('http') || clean.includes('backoffice') || clean.includes('cubesdev')) {
    return '';
  }
  const m = clean.match(/^(https?:\/\/[^/]+(?:\/[^/]+)*\/\d{4,}\/)([^/]+)(\/.*)?$/);
  if (!m) return '';
  const slug = titleToSlug(seoTitle);
  if (!slug) return '';
  return `${m[1]}${slug}${m[3] || ''}`;
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
