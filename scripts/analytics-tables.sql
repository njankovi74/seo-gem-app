
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
);

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
);

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
);

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
