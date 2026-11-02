import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { authenticateCmsRequest, corsHeaders, cmsErrorResponse } from '@/lib/cms-auth';

/**
 * PATCH /api/cms/update-article-id
 * 
 * Embed poziva ovaj endpoint kad novinar sačuva članak i URL dobije article_id.
 * Ažurira title_history zapis sa pravim article_id i article_url.
 */
export async function PATCH(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  const auth = authenticateCmsRequest(request);
  if (!auth.valid || !auth.portalId) {
    return cmsErrorResponse(auth.error || 'Unauthorized', 401, origin);
  }

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

    // Store article_url only if it is a public http(s) URL (never backoffice or cubesdev).
    // Note: title_history.article_url has a NOT NULL constraint in Postgres (defaults to ''),
    // so when validArticleUrl is null we omit article_url from the update payload.
    const validArticleUrl =
      typeof article_url === 'string' &&
      article_url.startsWith('http') &&
      !article_url.includes('backoffice') &&
      !article_url.includes('cubesdev')
        ? article_url
        : null;

    const updatePayload: { article_id: string; article_url?: string } = {
      article_id: String(article_id),
    };
    if (validArticleUrl) {
      updatePayload.article_url = validArticleUrl;
    }

    // Update title_history record only if it belongs to this portal and article_id is still null
    const { data, error } = await supabase
      .from('title_history')
      .update(updatePayload)
      .eq('id', title_history_id)
      .eq('portal_id', auth.portalId)
      .is('article_id', null)
      .select('id');

    if (error) {
      console.error('[update-article-id] DB error:', error.message);
      return NextResponse.json(
        { success: false, error: 'Database update failed' },
        { status: 500, headers }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'not found or already linked' },
        { status: 404, headers }
      );
    }

    console.log(`✅ [update-article-id] Updated TH#${title_history_id} (${auth.portalId}) → article_id=${article_id}`);

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
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
