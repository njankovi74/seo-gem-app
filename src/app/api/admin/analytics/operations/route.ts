/**
 * GET /api/admin/analytics/operations
 * 
 * Returns generation operation metrics from generation_log table.
 * Used by the Operations tab in the admin dashboard.
 * 
 * Query params:
 *   - portal: portal_id (optional, returns all if omitted)
 *   - days: number of days to look back (default: 7)
 *   - admin_key: admin password
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, adminErrorResponse } from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET(request: NextRequest) {
  const auth = authenticateAdmin(request);
  if (!auth.valid) {
    return adminErrorResponse(auth.error || 'Unauthorized', 401);
  }

  const url = new URL(request.url);
  const portalFilter = url.searchParams.get('portal');
  const days = parseInt(url.searchParams.get('days') || '7', 10);

  const sb = getSupabase();

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Fetch all logs for the period
    let query = sb
      .from('generation_log')
      .select('*')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false });

    if (portalFilter) {
      query = query.eq('portal_id', portalFilter);
    }

    // Paginate to get all rows (1000 per page per AGENTS.md rules)
    const allLogs: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('[operations] Query error:', error.message);
        break;
      }

      if (data && data.length > 0) {
        allLogs.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // === Aggregate metrics ===

    // 1. Summary counts
    const total = allLogs.length;
    const successCount = allLogs.filter(l => l.status === 'success').length;
    const errorCount = allLogs.filter(l => l.status === 'error').length;
    const partialCount = allLogs.filter(l => l.status === 'partial').length;

    // 2. Latency stats (only for successful calls)
    const successLogs = allLogs.filter(l => l.status === 'success' && l.latency_ms);
    const avgLatency = successLogs.length > 0
      ? Math.round(successLogs.reduce((sum, l) => sum + l.latency_ms, 0) / successLogs.length)
      : 0;
    const maxLatency = successLogs.length > 0
      ? Math.max(...successLogs.map(l => l.latency_ms))
      : 0;

    // 3. Style breakdown (from titles endpoint only)
    const titleLogs = allLogs.filter(l => l.endpoint === 'titles' && l.style_breakdown);
    const styleBreakdown: Record<string, number> = {};
    titleLogs.forEach(l => {
      if (l.style_breakdown && typeof l.style_breakdown === 'object') {
        Object.entries(l.style_breakdown).forEach(([style, count]) => {
          styleBreakdown[style] = (styleBreakdown[style] || 0) + (count as number);
        });
      }
    });

    // 4. RAG usage
    const ragLogs = allLogs.filter(l => l.endpoint === 'titles');
    const ragUsedCount = ragLogs.filter(l => l.rag_used).length;
    const ragRate = ragLogs.length > 0
      ? Math.round((ragUsedCount / ragLogs.length) * 1000) / 10
      : 0;
    const avgRagExamples = ragLogs.filter(l => l.rag_used && l.rag_examples_count).length > 0
      ? Math.round(
          ragLogs.filter(l => l.rag_used).reduce((sum, l) => sum + (l.rag_examples_count || 0), 0)
          / ragLogs.filter(l => l.rag_used).length * 10
        ) / 10
      : 0;

    // 5. Google Suggest usage
    const suggestLogs = ragLogs.filter(l => l.google_suggestions_count !== undefined);
    const suggestUsedCount = suggestLogs.filter(l => l.google_suggestions_count > 0).length;
    const suggestRate = suggestLogs.length > 0
      ? Math.round((suggestUsedCount / suggestLogs.length) * 1000) / 10
      : 0;
    const avgSuggestCount = suggestLogs.filter(l => l.google_suggestions_count > 0).length > 0
      ? Math.round(
          suggestLogs.filter(l => l.google_suggestions_count > 0)
            .reduce((sum, l) => sum + l.google_suggestions_count, 0)
          / suggestLogs.filter(l => l.google_suggestions_count > 0).length * 10
        ) / 10
      : 0;

    // 6. Error types breakdown
    const errorLogs = allLogs.filter(l => l.status === 'error' || l.status === 'partial');
    const errorTypes: Record<string, number> = {};
    errorLogs.forEach(l => {
      const type = l.error_type || 'unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });

    // 7. Recent errors (last 20)
    const recentErrors = errorLogs.slice(0, 20).map(l => ({
      time: l.created_at,
      portal_id: l.portal_id,
      endpoint: l.endpoint,
      error_type: l.error_type || 'unknown',
      error_message: l.error_message || '',
      article_url: l.article_url || '',
      status: l.status,
    }));

    // 8. Daily trend (per day)
    const dailyTrend: Record<string, { total: number; success: number; error: number; partial: number }> = {};
    allLogs.forEach(l => {
      const day = l.created_at.split('T')[0];
      if (!dailyTrend[day]) dailyTrend[day] = { total: 0, success: 0, error: 0, partial: 0 };
      dailyTrend[day].total++;
      dailyTrend[day][l.status as 'success' | 'error' | 'partial']++;
    });

    // 9. Per-portal summary (for landing page cards)
    const portalSummary: Record<string, { total: number; success: number; error: number; partial: number; today: number; todayErrors: number }> = {};
    const today = new Date().toISOString().split('T')[0];
    allLogs.forEach(l => {
      const pid = l.portal_id;
      if (!portalSummary[pid]) portalSummary[pid] = { total: 0, success: 0, error: 0, partial: 0, today: 0, todayErrors: 0 };
      portalSummary[pid].total++;
      portalSummary[pid][l.status as 'success' | 'error' | 'partial']++;
      if (l.created_at.startsWith(today)) {
        portalSummary[pid].today++;
        if (l.status === 'error') portalSummary[pid].todayErrors++;
      }
    });

    // 10. Endpoint breakdown
    const titlesCount = allLogs.filter(l => l.endpoint === 'titles').length;
    const generateCount = allLogs.filter(l => l.endpoint === 'generate').length;

    // 11. Top keywords
    const keywordCounts: Record<string, number> = {};
    allLogs.filter(l => l.primary_keyword).forEach(l => {
      const kw = l.primary_keyword.toLowerCase();
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    // 12. Model usage
    const modelCounts: Record<string, number> = {};
    allLogs.filter(l => l.model_used).forEach(l => {
      modelCounts[l.model_used] = (modelCounts[l.model_used] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      period: { days, since: sinceISO },
      summary: {
        total,
        success: successCount,
        error: errorCount,
        partial: partialCount,
        successRate: total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0,
        avgLatencyMs: avgLatency,
        maxLatencyMs: maxLatency,
      },
      endpoints: { titles: titlesCount, generate: generateCount },
      styles: styleBreakdown,
      rag: {
        usageRate: ragRate,
        avgExamples: avgRagExamples,
        totalUsed: ragUsedCount,
        totalCalls: ragLogs.length,
      },
      googleSuggest: {
        usageRate: suggestRate,
        avgCount: avgSuggestCount,
        totalUsed: suggestUsedCount,
        totalCalls: suggestLogs.length,
      },
      errorTypes,
      recentErrors,
      dailyTrend: Object.entries(dailyTrend)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, counts]) => ({ date, ...counts })),
      portalSummary,
      topKeywords,
      models: modelCounts,
    });

  } catch (error) {
    console.error('[operations] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
