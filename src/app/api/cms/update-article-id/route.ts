import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * PATCH /api/cms/update-article-id
 * 
 * Embed poziva ovaj endpoint kad novinar sačuva članak i URL dobije article_id.
 * Ažurira title_history zapis sa pravim article_id i article_url.
 */
export async function PATCH(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  };

  try {
    const body = await request.json();
    const { title_history_id, article_id, article_url } = body;

    if (!title_history_id || !article_id) {
      return NextResponse.json(
        { success: false, error: 'title_history_id and article_id are required' },
        { status: 400, headers }
      );
    }

    // Validate article_id is numeric and reasonable
    if (!/^\d{4,}$/.test(String(article_id))) {
      return NextResponse.json(
        { success: false, error: 'article_id must be a numeric ID (4+ digits)' },
        { status: 400, headers }
      );
    }

    // Update title_history record
    const { error, count } = await supabase
      .from('title_history')
      .update({
        article_id: String(article_id),
        article_url: article_url || null,
      })
      .eq('id', title_history_id)
      .is('article_id', null); // Only update if article_id is still null (safety)

    if (error) {
      console.error('[update-article-id] DB error:', error.message);
      return NextResponse.json(
        { success: false, error: 'Database update failed' },
        { status: 500, headers }
      );
    }

    console.log(`✅ [update-article-id] Updated TH#${title_history_id} → article_id=${article_id}`);

    return NextResponse.json(
      { success: true, updated: true },
      { headers }
    );

  } catch (error) {
    console.error('[update-article-id] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
}
