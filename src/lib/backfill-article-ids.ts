import { supabase } from './supabase';

/**
 * Backfill article_id za title_history zapise koji nemaju ID.
 * Koristi title→slug matching sa GA4 podacima.
 * 
 * Logika:
 * 1. Nađi sve title_history zapise bez article_id (starije od 24h)
 * 2. Iz GA4 metrika izvuci sve poznate article URL-ove
 * 3. Za svaki naslov, napravi slug i traži poklapanje
 * 4. Ako nađe — ažuriraj title_history
 * 
 * Poziva se iz sync crona dnevno.
 */

// Serbian transliteration map
const TRANSLITERATE: Record<string, string> = {
  // Serbian
  'š': 's', 'đ': 'd', 'č': 'c', 'ć': 'c', 'ž': 'z',
  'Š': 's', 'Đ': 'd', 'Č': 'c', 'Ć': 'c', 'Ž': 'z',
  // Polish (ć already covered above)
  'ą': 'a', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'a', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o',
  'Ś': 's', 'Ź': 'z', 'Ż': 'z',
};

function transliterate(text: string): string {
  return text.split('').map(c => TRANSLITERATE[c] || c).join('');
}

function titleToSlug(title: string): string {
  return transliterate(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/(\d{4,})\//);
  return match ? match[1] : null;
}

interface BackfillResult {
  total_without_id: number;
  matched: number;
  failed: number;
  skipped: number;
}

export async function backfillArticleIds(): Promise<BackfillResult> {
  const result: BackfillResult = {
    total_without_id: 0,
    matched: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // 1. Get title_history records without article_id (older than 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: unmatched, error: thError } = await supabase
      .from('title_history')
      .select('id, selected_title, portal_id, article_url')
      .is('article_id', null)
      .lt('created_at', cutoff)
      .limit(500);

    if (thError) {
      console.error('[backfill-ids] Error fetching title_history:', thError.message);
      return result;
    }

    if (!unmatched || unmatched.length === 0) {
      console.log('[backfill-ids] No unmatched records found');
      return result;
    }

    result.total_without_id = unmatched.length;
    console.log(`[backfill-ids] Found ${unmatched.length} records without article_id`);

    // 2. Build slug→article_id index from GA4 metrics
    const slugIndex = new Map<string, { id: string; url: string }>();
    
    let offset = 0;
    while (true) {
      const { data: ga4Data, error: ga4Error } = await supabase
        .from('article_ga4_metrics')
        .select('article_url')
        .not('article_url', 'is', null)
        .range(offset, offset + 999);

      if (ga4Error || !ga4Data || ga4Data.length === 0) break;

      for (const row of ga4Data) {
        const url = row.article_url;
        const articleId = extractIdFromUrl(url);
        if (articleId && url.includes('/')) {
          // Extract slug from URL
          const parts = url.split('/').filter(Boolean);
          const slug = parts[parts.length - 1] || parts[parts.length - 2] || '';
          if (slug && slug.length > 3) {
            slugIndex.set(slug.toLowerCase(), { id: articleId, url });
          }
        }
      }

      if (ga4Data.length < 1000) break;
      offset += 1000;
    }

    console.log(`[backfill-ids] Built slug index: ${slugIndex.size} entries`);

    // 3. Match each unmatched title_history record
    for (const record of unmatched) {
      if (!record.selected_title) {
        result.skipped++;
        continue;
      }

      const titleSlug = titleToSlug(record.selected_title);
      if (!titleSlug || titleSlug.length < 5) {
        result.skipped++;
        continue;
      }

      // Try exact match first
      let matched = slugIndex.get(titleSlug);

      // Try partial match — check if any slug contains most words from title slug
      if (!matched) {
        const titleWords = titleSlug.split('-').filter(w => w.length > 2);
        let bestScore = 0;
        let bestEntry: { id: string; url: string } | null = null;

        for (const [slug, entry] of slugIndex.entries()) {
          let matchCount = 0;
          for (const word of titleWords) {
            if (slug.includes(word)) matchCount++;
          }
          const score = matchCount / Math.max(titleWords.length, 1);
          if (score > bestScore && score >= 0.5 && matchCount >= 3) {
            bestScore = score;
            bestEntry = entry;
          }
        }
        if (bestEntry) matched = bestEntry;
      }

      if (matched) {
        const { error: updateError } = await supabase
          .from('title_history')
          .update({ article_id: matched.id })
          .eq('id', record.id);

        if (updateError) {
          console.error(`[backfill-ids] Update failed for TH#${record.id}:`, updateError.message);
          result.failed++;
        } else {
          result.matched++;
        }
      }
    }

    console.log(`[backfill-ids] Done: ${result.matched} matched, ${result.failed} failed, ${result.skipped} skipped of ${result.total_without_id}`);
    return result;

  } catch (error) {
    console.error('[backfill-ids] Unexpected error:', error);
    return result;
  }
}
