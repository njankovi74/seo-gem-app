import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('admin_key');

  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const results: string[] = [];

  // Add new columns for absolute PV counts per channel
  const columns = [
    { name: 'organic_pv', type: 'INTEGER', default: '0' },
    { name: 'direct_pv', type: 'INTEGER', default: '0' },
    { name: 'social_pv', type: 'INTEGER', default: '0' },
    { name: 'referral_pv', type: 'INTEGER', default: '0' },
  ];

  for (const col of columns) {
    // Test if column exists by trying to select it
    const { error } = await sb
      .from('article_ga4_metrics')
      .select(col.name)
      .limit(1);

    if (error) {
      // Column doesn't exist — we need to add it via raw SQL
      // Since Supabase JS client can't run DDL, we'll use the REST endpoint
      const pgUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
      if (pgUrl) {
        // Direct Postgres connection not available in serverless
        results.push(`Column ${col.name}: needs manual creation via Supabase Dashboard SQL Editor`);
      } else {
        results.push(`Column ${col.name}: needs manual creation — run in Supabase SQL Editor:`);
        results.push(`  ALTER TABLE article_ga4_metrics ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} DEFAULT ${col.default};`);
      }
    } else {
      results.push(`Column ${col.name}: already exists ✅`);
    }
  }

  return NextResponse.json({
    success: true,
    results,
    sql: `-- Run this in Supabase SQL Editor:
ALTER TABLE article_ga4_metrics ADD COLUMN IF NOT EXISTS organic_pv INTEGER DEFAULT 0;
ALTER TABLE article_ga4_metrics ADD COLUMN IF NOT EXISTS direct_pv INTEGER DEFAULT 0;
ALTER TABLE article_ga4_metrics ADD COLUMN IF NOT EXISTS social_pv INTEGER DEFAULT 0;
ALTER TABLE article_ga4_metrics ADD COLUMN IF NOT EXISTS referral_pv INTEGER DEFAULT 0;`
  });
}
