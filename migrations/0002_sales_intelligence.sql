CREATE TABLE IF NOT EXISTS sales_briefings (
  briefing_id TEXT PRIMARY KEY,
  access_token_hash TEXT NOT NULL,
  business_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_identity_json TEXT NOT NULL,
  offering_json TEXT NOT NULL,
  report_json TEXT NOT NULL,
  researched_at TEXT NOT NULL,
  research_cutoff TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_briefings_expiry ON sales_briefings (expires_at);

CREATE TABLE IF NOT EXISTS sales_research_runs (
  run_id TEXT PRIMARY KEY,
  briefing_id TEXT,
  business_id TEXT,
  status TEXT NOT NULL,
  stages_json TEXT NOT NULL,
  failure_code TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (briefing_id) REFERENCES sales_briefings(briefing_id)
);

CREATE TABLE IF NOT EXISTS sales_events (
  event_id TEXT PRIMARY KEY,
  briefing_id TEXT,
  event_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  session_id TEXT,
  section_id TEXT,
  device_category TEXT,
  metadata_json TEXT,
  FOREIGN KEY (briefing_id) REFERENCES sales_briefings(briefing_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_events_time ON sales_events (event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sales_events_briefing ON sales_events (briefing_id, occurred_at);
