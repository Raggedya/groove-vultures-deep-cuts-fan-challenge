CREATE TABLE IF NOT EXISTS bar_publisher_activations (
  installation_id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  email_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bar_activations_requested
  ON bar_publisher_activations (requested_at);

CREATE TABLE IF NOT EXISTS bar_publisher_devices (
  installation_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  app_version TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bar_publication_jobs (
  job_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  master_id TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  previous_record_json TEXT,
  base_url TEXT NOT NULL,
  video_key TEXT NOT NULL,
  qr_key TEXT NOT NULL,
  video_sha256 TEXT NOT NULL,
  qr_sha256 TEXT,
  email_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bar_jobs_installation
  ON bar_publication_jobs (installation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bar_jobs_edition
  ON bar_publication_jobs (edition_id, created_at);

CREATE TABLE IF NOT EXISTS bar_editions (
  edition_id TEXT PRIMARY KEY,
  master_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  venue_name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  video_key TEXT NOT NULL,
  qr_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bar_editions_status
  ON bar_editions (status, updated_at);
