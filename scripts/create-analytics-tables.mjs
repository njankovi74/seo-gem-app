/**
 * create-analytics-tables.mjs
 * 
 * Creates the analytics integration tables in Supabase:
 *   - portal_analytics_config
 *   - article_gsc_metrics
 *   - article_ga4_metrics
 * 
 * Tries multiple approaches:
 *   1. Supabase Management API (query endpoint)
 *   2. Direct REST /pg endpoint
 *   3. Falls back to printing SQL for manual execution
 * 
 * Usage: node scripts/create-analytics-tables.mjs
 */

const SUPABASE_URL = 'https://dmtcbjniidawbamvrqwd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdGNiam5paWRhd2JhbXZycXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU2MTA2OCwiZXhwIjoyMDc3MTM3MDY4fQ.LLMJVLxachDtoPQYmNDuKSiEVFeGqTQx1xx1soMZ8jw';

// ── SQL Statements ──────────────────────────────────────────────────────────

const SQL_STATEMENTS = [
  {
    name: 'portal_analytics_config',
    sql: `
CREATE TABLE IF NOT EXISTS portal_analytics_config (
  portal_id TEXT PRIMARY KEY,
  portal_name TEXT NOT NULL,
  gsc_property TEXT,
  gsc_refresh_token TEXT,
  ga4_property_id TEXT,
  ga4_refresh_token TEXT,
  last_gsc_sync_at TIMESTAMPTZ,
  last_ga4_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`
  },
  {
    name: 'article_gsc_metrics',
    sql: `
CREATE TABLE IF NOT EXISTS article_gsc_metrics (
  id SERIAL PRIMARY KEY,
  portal_id TEXT NOT NULL,
  article_url TEXT NOT NULL,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  ctr FLOAT DEFAULT 0,
  avg_position FLOAT DEFAULT 0,
  search_type TEXT DEFAULT 'web',
  device TEXT,
  top_queries JSONB DEFAULT '[]'::jsonb,
  title_history_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portal_id, article_url, date, search_type)
);`
  },
  {
    name: 'article_ga4_metrics',
    sql: `
CREATE TABLE IF NOT EXISTS article_ga4_metrics (
  id SERIAL PRIMARY KEY,
  portal_id TEXT NOT NULL,
  article_url TEXT NOT NULL,
  date DATE NOT NULL,
  pageviews INT DEFAULT 0,
  sessions INT DEFAULT 0,
  avg_engagement_seconds FLOAT DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  pages_per_session FLOAT DEFAULT 0,
  organic_pct FLOAT DEFAULT 0,
  discover_pct FLOAT DEFAULT 0,
  direct_pct FLOAT DEFAULT 0,
  social_pct FLOAT DEFAULT 0,
  country_breakdown JSONB DEFAULT '{}'::jsonb,
  title_history_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portal_id, article_url, date)
);`
  }
];

// Also add RLS policies and indexes
const SQL_EXTRAS = `
-- Enable RLS on all analytics tables
ALTER TABLE portal_analytics_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_gsc_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_ga4_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (these policies let the backend work)
CREATE POLICY IF NOT EXISTS "Service role full access" ON portal_analytics_config
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Service role full access" ON article_gsc_metrics
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Service role full access" ON article_ga4_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_portal_date ON article_gsc_metrics(portal_id, date);
CREATE INDEX IF NOT EXISTS idx_gsc_metrics_url ON article_gsc_metrics(article_url);
CREATE INDEX IF NOT EXISTS idx_ga4_metrics_portal_date ON article_ga4_metrics(portal_id, date);
CREATE INDEX IF NOT EXISTS idx_ga4_metrics_url ON article_ga4_metrics(article_url);

-- Updated_at trigger for portal_analytics_config
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_portal_analytics_config_updated_at ON portal_analytics_config;
CREATE TRIGGER update_portal_analytics_config_updated_at
  BEFORE UPDATE ON portal_analytics_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

const FULL_SQL = SQL_STATEMENTS.map(s => s.sql).join('\n') + '\n' + SQL_EXTRAS;

// ── Approach 1: Supabase SQL API (POST /pg/query) ───────────────────────────
async function tryPgQuery() {
  console.log('⏳ Trying POST /pg/query ...');
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: FULL_SQL }),
  });
  
  if (res.ok) {
    const data = await res.json().catch(() => null);
    console.log('✅ /pg/query succeeded!', data);
    return true;
  }
  
  const text = await res.text();
  console.log(`❌ /pg/query failed (${res.status}): ${text.slice(0, 300)}`);
  return false;
}

// ── Approach 2: RPC exec_sql (if a helper function exists) ──────────────────
async function tryRpcExecSql() {
  console.log('⏳ Trying POST /rest/v1/rpc/exec_sql ...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ query: FULL_SQL }),
  });
  
  if (res.ok) {
    const data = await res.json().catch(() => null);
    console.log('✅ /rest/v1/rpc/exec_sql succeeded!', data);
    return true;
  }
  
  const text = await res.text();
  console.log(`❌ /rest/v1/rpc/exec_sql failed (${res.status}): ${text.slice(0, 300)}`);
  return false;
}

// ── Approach 3: Supabase Management API ─────────────────────────────────────
async function tryManagementApi() {
  // The management API uses a different base URL and requires the project ref
  const projectRef = 'dmtcbjniidawbamvrqwd';
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  console.log('⏳ Trying Supabase Management API ...');
  const res = await fetch(mgmtUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: FULL_SQL }),
  });
  
  if (res.ok) {
    const data = await res.json().catch(() => null);
    console.log('✅ Management API succeeded!', data);
    return true;
  }
  
  const text = await res.text();
  console.log(`❌ Management API failed (${res.status}): ${text.slice(0, 300)}`);
  return false;
}

// ── Approach 4: Try individual table creation via separate statements ────────
async function tryIndividualStatements() {
  console.log('⏳ Trying individual SQL statements via /pg/query ...');
  let allOk = true;
  
  for (const stmt of [...SQL_STATEMENTS, { name: 'extras', sql: SQL_EXTRAS }]) {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ query: stmt.sql }),
    });
    
    if (res.ok) {
      console.log(`  ✅ ${stmt.name} created`);
    } else {
      const text = await res.text();
      console.log(`  ❌ ${stmt.name} failed (${res.status}): ${text.slice(0, 200)}`);
      allOk = false;
    }
  }
  
  return allOk;
}

// ── Verify tables exist by querying them ────────────────────────────────────
async function verifyTables() {
  console.log('\n🔍 Verifying tables exist via REST API...');
  const tables = ['portal_analytics_config', 'article_gsc_metrics', 'article_ga4_metrics'];
  const results = {};
  
  for (const table of tables) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    });
    
    results[table] = {
      status: res.status,
      exists: res.ok,
    };
    
    if (res.ok) {
      console.log(`  ✅ ${table} - exists`);
    } else {
      console.log(`  ❌ ${table} - not found (${res.status})`);
    }
  }
  
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Creating analytics tables in Supabase...\n');
  
  // First check if tables already exist
  const preCheck = await verifyTables();
  const allExist = Object.values(preCheck).every(v => v.exists);
  
  if (allExist) {
    console.log('\n✅ All 3 analytics tables already exist! No action needed.');
    return;
  }
  
  console.log('\n📝 Some tables are missing. Attempting to create them...\n');
  
  // Try each approach in order
  let success = false;
  
  success = await tryPgQuery();
  if (!success) success = await tryRpcExecSql();
  if (!success) success = await tryManagementApi();
  if (!success) success = await tryIndividualStatements();
  
  if (success) {
    console.log('\n🎉 Tables created successfully!');
    await verifyTables();
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  AUTOMATED CREATION FAILED');
    console.log('='.repeat(70));
    console.log('\nPlease run the following SQL manually in the Supabase Dashboard:');
    console.log('  1. Go to: https://supabase.com/dashboard/project/dmtcbjniidawbamvrqwd/sql');
    console.log('  2. Paste the SQL below and click "Run"\n');
    console.log('─'.repeat(70));
    console.log(FULL_SQL);
    console.log('─'.repeat(70));
    console.log('\nSQL has also been saved to: scripts/analytics-tables.sql');
    
    // Save SQL to file for easy copy-paste
    const fs = await import('fs');
    fs.writeFileSync(
      new URL('./analytics-tables.sql', import.meta.url),
      FULL_SQL,
      'utf-8'
    );
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
