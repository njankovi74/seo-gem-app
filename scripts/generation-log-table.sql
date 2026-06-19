CREATE TABLE IF NOT EXISTS generation_log (
  id SERIAL PRIMARY KEY,
  portal_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL,
  article_url TEXT,
  titles_count INT DEFAULT 0,
  style_breakdown JSONB,
  model_used TEXT,
  latency_ms INT,
  language TEXT,
  rag_used BOOLEAN DEFAULT false,
  rag_examples_count INT DEFAULT 0,
  google_suggestions_count INT DEFAULT 0,
  primary_keyword TEXT,
  error_message TEXT,
  error_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genlog_portal_date ON generation_log(portal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_genlog_status ON generation_log(status);

ALTER TABLE generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_generation_log ON generation_log FOR ALL USING (true) WITH CHECK (true);
