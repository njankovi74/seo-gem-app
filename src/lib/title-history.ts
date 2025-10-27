import { supabase } from './supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TitleOption {
  text: string;
  style: 'faktografski' | 'kontekstualni' | 'detaljni';
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
}

export interface SimilarExample {
  id: number;
  article_url: string;
  article_text: string;
  offered_titles: TitleOption[];
  selected_title: string;
  selection_type: string;
  similarity: number;
}

/**
 * Generate embedding for article text using OpenAI
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

    // Generate embedding for semantic search
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
 * Get similar past articles using semantic search (RAG)
 * Returns top N most similar title choices for few-shot prompting
 */
export async function getSimilarTitleExamples(
  articleText: string,
  limit: number = 5
): Promise<SimilarExample[]> {
  try {
    console.log('🔍 Searching for similar articles in Supabase...', {
      textLength: articleText.length,
      limit
    });

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(articleText);
    console.log('🧮 Query embedding generated:', queryEmbedding.length, 'dimensions');

    // Call Supabase RPC function for semantic search
    const { data, error } = await supabase.rpc('match_title_examples', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7, // 70% similarity threshold
      match_count: limit,
    });

    if (error) {
      console.error('❌ Failed to get similar examples:', error);
      return [];
    }

    console.log(`✅ Found ${data?.length || 0} similar examples from Supabase`);
    if (data && data.length > 0) {
      console.log('📊 Similarity scores:', data.map((ex: SimilarExample) => ({
        similarity: ex.similarity,
        title: ex.selected_title.substring(0, 50)
      })));
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Error in getSimilarTitleExamples:', error);
    return []; // Return empty array on error - graceful degradation
  }
}

/**
 * Analyze pattern from similar examples
 * Used to understand user's style preferences
 */
export function analyzePattern(examples: SimilarExample[]): string {
  if (examples.length === 0) return 'Informativni stil (default)';

  const styles: Record<string, number> = {};
  examples.forEach((ex) => {
    const selected = ex.offered_titles.find((t) => t.text === ex.selected_title);
    if (selected) {
      styles[selected.style] = (styles[selected.style] || 0) + 1;
    }
  });

  const preferred = Object.entries(styles).sort((a, b) => b[1] - a[1])[0];
  return preferred ? `${preferred[0]} (${preferred[1]}/${examples.length})` : 'Informativni stil';
}
