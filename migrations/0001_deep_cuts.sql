CREATE TABLE IF NOT EXISTS editions (
  edition_id TEXT PRIMARY KEY,
  band_name TEXT NOT NULL,
  config_path TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  deployed_at TEXT,
  commit_sha TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  session_id TEXT,
  referring_source TEXT,
  device_category TEXT,
  destination_platform TEXT,
  share_method TEXT,
  country_code TEXT,
  region_code TEXT,
  metadata_json TEXT,
  FOREIGN KEY (edition_id) REFERENCES editions(edition_id)
);

CREATE INDEX IF NOT EXISTS idx_events_edition_time
  ON analytics_events (edition_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_name_time
  ON analytics_events (event_name, occurred_at);

CREATE TABLE IF NOT EXISTS production_jobs (
  job_id TEXT PRIMARY KEY,
  edition_id TEXT,
  band_name TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  research_started_at TEXT,
  research_completed_at TEXT,
  artwork_completed_at TEXT,
  validation_completed_at TEXT,
  deployed_at TEXT,
  email_accepted_at TEXT,
  email_delivered_at TEXT,
  completed_at TEXT,
  total_duration_ms INTEGER,
  commit_sha TEXT,
  failure_stage TEXT,
  failure_message TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_submitted
  ON production_jobs (submitted_at);

CREATE TABLE IF NOT EXISTS delivery_events (
  delivery_event_id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  job_id TEXT,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

