import { supabase } from './supabase';

export interface GenerationLogEntry {
  portal_id: string;
  endpoint: 'titles' | 'generate';
  status: 'success' | 'error' | 'partial';
  article_url?: string;
  titles_count?: number;
  style_breakdown?: Record<string, number>;
  model_used?: string;
  latency_ms: number;
  language?: string;
  rag_used?: boolean;
  rag_examples_count?: number;
  google_suggestions_count?: number;
  primary_keyword?: string;
  error_message?: string;
  error_type?: string;
}

/**
 * Asinhrono loguje CMS generisanje u generation_log tabelu.
 * Fire-and-forget — NE blokira response klijentu.
 * Greške se loguju u console ali ne bacaju izuzetke.
 */
export function logGeneration(entry: GenerationLogEntry): void {
  // Fire-and-forget: ne koristimo await, ne blokiramo caller
  Promise.resolve(
    supabase
      .from('generation_log')
      .insert({
        portal_id: entry.portal_id,
        endpoint: entry.endpoint,
        status: entry.status,
        article_url: entry.article_url || null,
        titles_count: entry.titles_count || 0,
        style_breakdown: entry.style_breakdown || null,
        model_used: entry.model_used || null,
        latency_ms: entry.latency_ms,
        language: entry.language || null,
        rag_used: entry.rag_used || false,
        rag_examples_count: entry.rag_examples_count || 0,
        google_suggestions_count: entry.google_suggestions_count || 0,
        primary_keyword: entry.primary_keyword || null,
        error_message: entry.error_message || null,
        error_type: entry.error_type || null,
      })
  ).then(({ error }) => {
    if (error) {
      console.error('[generation-logger] Insert failed:', error.message);
    }
  }).catch((err) => {
    console.error('[generation-logger] Unexpected error:', err);
  });
}

/**
 * Helper: kreira timer za merenje latency-ja.
 * Koristi se: const timer = startTimer(); ... logGeneration({ latency_ms: timer() });
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
