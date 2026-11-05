import { supabase } from './supabase';
import { PORTAL_DOMAINS, titleToSlug } from './portal-config';

/**
 * Backfill article_id za title_history zapise koji nemaju ID.
 * Koristi tačno poklapanje sluga izabranog naslova sa GA4 URL-ovima istog portala.
 *
 * Logika:
 * 1. Kandidati: title_history bez article_id, created_at u poslednjih `days` (default 14) dana,
 *    sortirano created_at DESC, limit 500.
 * 2. URL indeks: article_ga4_metrics za date >= danas - (days + 7), paginirano po 1000.
 *    Za svaki URL: match /\/(\d{4,})\/([^/]+)/ -> id = grupa 1, slug = grupa 2.
 *    Ključ indeksa: `${portal_id}|${slug}`; vrednost { id, path, firstSeen }.
 *    Ako isti ključ vodi na dva različita id-a -> označi kao ambiguous i preskoči.
 * 3. Poklapanje: samo tačno (${portal}|${titleSlug}), nije ambiguous,
 *    firstSeen u [created_at - 1 dan, created_at + 7 dana].
 * 4. Upis (osim kad je dryRun=true): article_id = id, article_url = 'https://' + domen(portal) + path.
 */

function normalizePath(urlOrPath: string): string {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      return new URL(urlOrPath).pathname;
    } catch {
      // fallback below
    }
  }
  return urlOrPath.startsWith('/') ? urlOrPath : '/' + urlOrPath;
}

export interface BackfillExample {
  title: string;
  url: string;
}

export interface BackfillResult {
  total_without_id: number;
  matched: number;
  ambiguous: number;
  skipped: number;
  failed: number;
  examples: BackfillExample[];
}

export interface BackfillOptions {
  dryRun?: boolean;
  days?: number;
}

export async function backfillArticleIds(options?: BackfillOptions): Promise<BackfillResult> {
  const dryRun = options?.dryRun ?? false;
  const days = options?.days ?? 14;

  const result: BackfillResult = {
    total_without_id: 0,
    matched: 0,
    ambiguous: 0,
    skipped: 0,
    failed: 0,
    examples: [],
  };

  try {
    // 1. Kandidati: title_history bez article_id u poslednjih `days` dana, created_at DESC, limit 500
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: unmatched, error: thError } = await supabase
      .from('title_history')
      .select('id, selected_title, portal_id, article_url, created_at')
      .is('article_id', null)
      .gte('created_at', cutoffDate)
      .order('created_at', { ascending: false })
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
    console.log(`[backfill-ids] Found ${unmatched.length} records without article_id (days=${days}, dryRun=${dryRun})`);

    // 2. URL indeks: article_ga4_metrics za date >= danas - (days + 7), paginirano po 1000
    const ga4StartDate = new Date(Date.now() - (days + 7) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const slugIndex = new Map<string, { id: string; path: string; firstSeen: string; ambiguous?: boolean }>();

    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: ga4Data, error: ga4Error } = await supabase
        .from('article_ga4_metrics')
        .select('portal_id, article_url, date')
        .gte('date', ga4StartDate)
        .not('article_url', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (ga4Error) {
        console.error('[backfill-ids] Error fetching article_ga4_metrics:', ga4Error.message);
        break;
      }
      if (!ga4Data || ga4Data.length === 0) break;

      for (const row of ga4Data) {
        if (!row.portal_id || !row.article_url || !row.date) continue;
        const path = normalizePath(row.article_url);
        const match = path.match(/\/(\d{4,})\/([^/]+)/);
        if (!match) continue;

        const id = match[1];
        const slug = match[2].toLowerCase();
        if (!slug) continue;

        const key = `${row.portal_id}|${slug}`;
        const existing = slugIndex.get(key);

        if (!existing) {
          slugIndex.set(key, { id, path, firstSeen: row.date });
        } else if (existing.ambiguous) {
          // Already marked ambiguous
        } else if (existing.id !== id) {
          existing.ambiguous = true;
        } else {
          if (row.date < existing.firstSeen) {
            existing.firstSeen = row.date;
          }
        }
      }

      if (ga4Data.length < pageSize) break;
      offset += pageSize;
    }

    console.log(`[backfill-ids] Built slug index: ${slugIndex.size} keys (from date >= ${ga4StartDate})`);

    // 3. Poklapanje kandidata (samo tačno poklapanje)
    for (const record of unmatched) {
      if (!record.selected_title || !record.portal_id || !record.created_at) {
        result.skipped++;
        continue;
      }

      const domain = PORTAL_DOMAINS[record.portal_id];
      if (!domain) {
        result.skipped++;
        continue;
      }

      const titleSlug = titleToSlug(record.selected_title);
      if (!titleSlug) {
        result.skipped++;
        continue;
      }

      const key = `${record.portal_id}|${titleSlug}`;
      const entry = slugIndex.get(key);

      if (!entry) {
        result.skipped++;
        continue;
      }

      if (entry.ambiguous) {
        result.ambiguous++;
        continue;
      }

      // Check that firstSeen is within [created_at - 1 day, created_at + 7 days]
      const createdDate = new Date(record.created_at);
      const minD = new Date(createdDate);
      minD.setUTCDate(minD.getUTCDate() - 1);
      const maxD = new Date(createdDate);
      maxD.setUTCDate(maxD.getUTCDate() + 7);
      const minDateStr = minD.toISOString().split('T')[0];
      const maxDateStr = maxD.toISOString().split('T')[0];

      if (entry.firstSeen < minDateStr || entry.firstSeen > maxDateStr) {
        result.skipped++;
        continue;
      }

      const fullUrl = 'https://' + domain + entry.path;

      if (dryRun) {
        result.matched++;
        if (result.examples.length < 5) {
          result.examples.push({ title: record.selected_title, url: fullUrl });
          console.log(`[backfill-ids][dryRun] Match: "${record.selected_title}" → ${fullUrl} (id=${entry.id})`);
        }
        continue;
      }

      const { error: updateError } = await supabase
        .from('title_history')
        .update({
          article_id: entry.id,
          article_url: fullUrl,
        })
        .eq('id', record.id)
        .is('article_id', null);

      if (updateError) {
        console.error(`[backfill-ids] Update failed for TH#${record.id}:`, updateError.message);
        result.failed++;
      } else {
        result.matched++;
        if (result.examples.length < 5) {
          result.examples.push({ title: record.selected_title, url: fullUrl });
        }
      }
    }

    console.log(
      `[backfill-ids] Done (dryRun=${dryRun}): ${result.matched} matched, ${result.ambiguous} ambiguous, ${result.skipped} skipped, ${result.failed} failed of ${result.total_without_id}`
    );
    return result;

  } catch (error) {
    console.error('[backfill-ids] Unexpected error:', error);
    return result;
  }
}
