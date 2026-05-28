import { supabase } from './supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TitleOption {
  text: string;
  style: 'informativni' | 'geo_pitanje' | 'discover_hook';
  length: number;
  reasoning: string;
}

export interface TitleChoice {
  articleUrl: string;
  articleText: string;
  offeredTitles: TitleOption[];
  selectedTitle: string;
  selectionType: 'ai_option_1' | 'ai_option_2' | 'ai_option_3' | 'custom';
  metaDescription: string;
  keywords: string;
  portalId?: string; // Multi-tenant: 'newsmax', 'web_app', etc.
}

export interface SimilarExample {
  id: number;
  article_url: string;
  article_text: string;
  offered_titles: TitleOption[];
  selected_title: string;
  selection_type: string;
  similarity: number; // kept for backward compat; set to 1.0 for style-based results
}

/**
 * Generate embedding for article text using OpenAI
 * Used only when SAVING new title choices (for potential future semantic search)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000), // Max 8k chars
  });
  return response.data[0].embedding;
}

/**
 * Save title choice to Supabase with embedding for future RAG
 */
export async function saveTitleChoice(choice: TitleChoice): Promise<void> {
  try {
    console.log('💾 Saving title choice to Supabase...', {
      url: choice.articleUrl,
      selectedTitle: choice.selectedTitle,
      selectionType: choice.selectionType,
      textLength: choice.articleText.length
    });

    // Generate embedding (kept for future semantic search if needed)
    const embedding = await generateEmbedding(choice.articleText);
    console.log('🧮 Generated embedding:', embedding.length, 'dimensions');

    // Insert into Supabase
    const { error } = await supabase.from('title_history').insert({
      article_url: choice.articleUrl,
      article_text: choice.articleText,
      article_embedding: embedding,
      offered_titles: choice.offeredTitles,
      selected_title: choice.selectedTitle,
      selection_type: choice.selectionType,
      meta_description: choice.metaDescription,
      keywords: choice.keywords,
      portal_id: choice.portalId || 'web_app',
    });

    if (error) {
      console.error('❌ Failed to save title choice:', error);
      throw error;
    }

    console.log('✅ Title choice saved to Supabase successfully');
  } catch (error) {
    console.error('❌ Error in saveTitleChoice:', error);
    // Don't throw - we don't want to fail the whole request if saving fails
  }
}

/**
 * Get recent title choices from the same portal for style-based RAG.
 * 
 * PURPOSE: Teach the AI the journalist's title STRUCTURE preferences
 * (informativni vs geo_pitanje vs discover_hook, length, tone, formatting)
 * regardless of article topic.
 * 
 * Fetches a broad sample (last 30 valid records) to compute aggregate stats,
 * then returns a representative subset as few-shot examples.
 */
export async function getSimilarTitleExamples(
  articleText: string,
  limit: number = 5,
  portalId?: string
): Promise<SimilarExample[]> {
  try {
    const effectivePortal = portalId || 'web_app';
    console.log(`🔍 [RAG] Fetching title style history for portal: ${effectivePortal}`);

    // Fetch broader sample for pattern analysis (30 records, then filter)
    const { data, error } = await supabase
      .from('title_history')
      .select('id, article_url, article_text, offered_titles, selected_title, selection_type')
      .eq('portal_id', effectivePortal)
      .not('offered_titles', 'is', null)
      .order('created_at', { ascending: false })
      .limit(120); // fetch 120, filter to ~30 valid

    if (error) {
      console.error('❌ [RAG] Failed to get style examples:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`ℹ️ [RAG] No title history for portal ${effectivePortal} — cold start`);
      return [];
    }

    // Filter: only records with valid offered_titles (≥3 titles with style tags)
    const validExamples = data.filter((row: any) =>
      Array.isArray(row.offered_titles) &&
      row.offered_titles.length >= 3 &&
      row.offered_titles.some((t: any) => t?.style && t?.text)
    );

    if (validExamples.length === 0) {
      console.log(`ℹ️ [RAG] No valid title records for portal ${effectivePortal}`);
      return [];
    }

    // Select diverse representatives: pick from different style preferences
    const byPickedStyle: Record<string, any[]> = { informativni: [], geo_pitanje: [], discover_hook: [], custom_new: [] };
    validExamples.forEach((row: any) => {
      const match = row.offered_titles.find((t: any) => t?.text === row.selected_title);
      const style = match?.style || 'custom_new';
      if (byPickedStyle[style]) byPickedStyle[style].push(row);
      else byPickedStyle[style] = [row];
    });

    // Pick representatives: prioritize diversity across styles
    const representatives: any[] = [];
    const stylesPresent = Object.entries(byPickedStyle).filter(([, arr]) => arr.length > 0);
    // Round-robin across styles up to limit
    let round = 0;
    while (representatives.length < limit && round < 10) {
      for (const [, arr] of stylesPresent) {
        if (round < arr.length && representatives.length < limit) {
          const candidate = arr[round];
          if (!representatives.find((r: any) => r.id === candidate.id)) {
            representatives.push(candidate);
          }
        }
      }
      round++;
    }

    // If still under limit, fill from most recent
    if (representatives.length < limit) {
      for (const row of validExamples) {
        if (representatives.length >= limit) break;
        if (!representatives.find((r: any) => r.id === row.id)) {
          representatives.push(row);
        }
      }
    }

    // Map to SimilarExample interface
    const result: SimilarExample[] = representatives.map((row: any) => ({
      id: row.id,
      article_url: row.article_url,
      article_text: row.article_text || '',
      offered_titles: row.offered_titles,
      selected_title: row.selected_title,
      selection_type: row.selection_type,
      similarity: 1.0,
    }));

    console.log(`✅ [RAG] ${validExamples.length} total records analyzed, ${result.length} diverse examples selected for portal ${effectivePortal}`);

    return result;
  } catch (error) {
    console.error('❌ [RAG] Error in getSimilarTitleExamples:', error);
    return []; // Graceful degradation
  }
}

/**
 * Analyze pattern from the RAG examples to produce rich aggregate statistics.
 * Returns a structured insight string that tells the AI:
 * - Which style the journalist prefers
 * - Average title length
 * - How often they modify AI suggestions
 * - Total sample size (so AI understands confidence level)
 */
export function analyzePattern(examples: SimilarExample[], language: string = 'sr'): string {
  const patternStrings: Record<string, {
    noData: string;
    analyzed: (n: number) => string;
    preferredStyle: string;
    modifies: (pct: number, mod: number, total: number) => string;
    alwaysPicks: string;
    avgLength: (len: number) => string;
  }> = {
    sr: {
      noData: 'Nema prethodnih podataka — koristi podrazumevani informativni stil.',
      analyzed: (n) => `Analizirano ${n} prethodnih izbora novinara.`,
      preferredStyle: 'Preferiran stil',
      modifies: (pct, mod, total) => `Novinar menja AI predlog u ${pct}% slučajeva (${mod}/${total}).`,
      alwaysPicks: 'Novinar uvek bira jedan od ponuđenih AI naslova.',
      avgLength: (len) => `Prosečna dužina izabranog naslova: ${len} karaktera.`,
    },
    en: {
      noData: 'No previous data — use default informative style.',
      analyzed: (n) => `Analyzed ${n} previous editor choices.`,
      preferredStyle: 'Preferred style',
      modifies: (pct, mod, total) => `Editor modifies AI suggestion in ${pct}% of cases (${mod}/${total}).`,
      alwaysPicks: 'Editor always picks one of the offered AI titles.',
      avgLength: (len) => `Average selected title length: ${len} characters.`,
    },
    pl: {
      noData: 'Brak poprzednich danych — użyj domyślnego stylu informacyjnego.',
      analyzed: (n) => `Przeanalizowano ${n} poprzednich wyborów redaktora.`,
      preferredStyle: 'Preferowany styl',
      modifies: (pct, mod, total) => `Redaktor zmienia sugestię AI w ${pct}% przypadków (${mod}/${total}).`,
      alwaysPicks: 'Redaktor zawsze wybiera jeden z zaproponowanych tytułów AI.',
      avgLength: (len) => `Średnia długość wybranego tytułu: ${len} znaków.`,
    },
    sq: {
      noData: 'Nuk ka të dhëna të mëparshme — përdor stilin informativ të paracaktuar.',
      analyzed: (n) => `U analizuan ${n} zgjedhje të mëparshme të redaktorit.`,
      preferredStyle: 'Stili i preferuar',
      modifies: (pct, mod, total) => `Redaktori ndryshon sugjerimin e AI në ${pct}% të rasteve (${mod}/${total}).`,
      alwaysPicks: 'Redaktori gjithmonë zgjedh një nga titujt e ofruar nga AI.',
      avgLength: (len) => `Gjatësia mesatare e titullit të zgjedhur: ${len} karaktere.`,
    },
  };

  const s = patternStrings[language] || patternStrings.sr;
  if (examples.length === 0) return s.noData;

  // Count which style was picked
  const styleCounts: Record<string, number> = {};
  const titleLengths: number[] = [];
  let exactAiPick = 0;
  let customModified = 0;

  examples.forEach((ex) => {
    // Track title length
    if (ex.selected_title) titleLengths.push(ex.selected_title.length);

    // Find if selected matches one of the offered
    const match = ex.offered_titles?.find((t) => t?.text === ex.selected_title);
    if (match?.style) {
      styleCounts[match.style] = (styleCounts[match.style] || 0) + 1;
      exactAiPick++;
    } else {
      customModified++;
    }
  });

  const total = examples.length;
  const avgLen = titleLengths.length > 0 ? Math.round(titleLengths.reduce((s, l) => s + l, 0) / titleLengths.length) : 0;

  // Build insight string
  const parts: string[] = [];
  parts.push(s.analyzed(total));

  // Style preference
  const sorted = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const styleDescriptions = sorted.map(([style, count]) => {
      const pct = Math.round((count / total) * 100);
      return `${style}: ${count}x (${pct}%)`;
    });
    parts.push(`${s.preferredStyle}: ${styleDescriptions.join(', ')}.`);
  }

  // Modification rate
  if (customModified > 0) {
    const modPct = Math.round((customModified / total) * 100);
    parts.push(s.modifies(modPct, customModified, total));
  } else {
    parts.push(s.alwaysPicks);
  }

  // Average length
  if (avgLen > 0) {
    parts.push(s.avgLength(avgLen));
  }

  return parts.join(' ');
}

