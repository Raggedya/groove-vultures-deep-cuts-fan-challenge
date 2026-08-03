CREATE TABLE IF NOT EXISTS aggits_jukebox_publication_jobs (
  job_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_aggits_jukebox_jobs_installation ON aggits_jukebox_publication_jobs (installation_id,created_at);
CREATE INDEX IF NOT EXISTS idx_aggits_jukebox_jobs_project ON aggits_jukebox_publication_jobs (project_id,created_at);

CREATE TABLE IF NOT EXISTS aggits_jukebox_editions (
  edition_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  config_json TEXT NOT NULL,
  video_key TEXT NOT NULL,
  qr_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aggits_jukebox_editions_status ON aggits_jukebox_editions (status,updated_at);
