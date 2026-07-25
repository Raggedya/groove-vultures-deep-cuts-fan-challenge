CREATE TABLE IF NOT EXISTS record_companies (
  record_company_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  official_url TEXT NOT NULL,
  canonical_domain TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  supplied_logo_path TEXT,
  brand_palette_json TEXT NOT NULL DEFAULT '{}',
  hero_asset TEXT,
  location TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  founded_year INTEGER,
  source_evidence_json TEXT NOT NULL DEFAULT '[]',
  confidence_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS record_company_artists (
  artist_id TEXT PRIMARY KEY,
  record_company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  official_label_profile_url TEXT NOT NULL,
  official_website_url TEXT,
  biography TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  location TEXT,
  hero_asset TEXT,
  source_evidence_json TEXT NOT NULL DEFAULT '[]',
  confidence_score REAL NOT NULL DEFAULT 0,
  publication_status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(record_company_id, slug),
  FOREIGN KEY(record_company_id) REFERENCES record_companies(record_company_id)
);

CREATE TABLE IF NOT EXISTS record_company_links (
  link_id TEXT PRIMARY KEY,
  record_company_id TEXT NOT NULL,
  artist_id TEXT,
  link_type TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  validation_status TEXT NOT NULL,
  http_status INTEGER,
  redirect_url TEXT,
  last_checked_at TEXT NOT NULL,
  UNIQUE(record_company_id, artist_id, link_type, url)
);

CREATE TABLE IF NOT EXISTS record_company_quizzes (
  quiz_id TEXT PRIMARY KEY,
  record_company_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 0,
  questions_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS record_company_qr_codes (
  qr_id TEXT PRIMARY KEY,
  record_company_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  tracking_code TEXT NOT NULL UNIQUE,
  png_path TEXT,
  svg_path TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_destination TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS record_company_jobs (
  job_id TEXT PRIMARY KEY,
  record_company_id TEXT,
  source_url TEXT NOT NULL,
  notification_email TEXT,
  project_name TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  progress_completed INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  ingestion_report_json TEXT NOT NULL DEFAULT '{}',
  exception_report_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  error_summary TEXT,
  notification_email_status TEXT,
  email_provider_id TEXT,
  FOREIGN KEY(record_company_id) REFERENCES record_companies(record_company_id)
);

CREATE TABLE IF NOT EXISTS record_company_analytics (
  event_id TEXT PRIMARY KEY,
  record_company_id TEXT NOT NULL,
  artist_id TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_metadata_json TEXT NOT NULL DEFAULT '{}',
  referring_source TEXT,
  device_category TEXT,
  country_code TEXT,
  region_code TEXT,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS record_company_sources (
  source_id TEXT PRIMARY KEY,
  record_company_id TEXT NOT NULL,
  artist_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT,
  extracted_summary TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rc_artists_company_status
  ON record_company_artists(record_company_id, publication_status, name);
CREATE INDEX IF NOT EXISTS idx_rc_jobs_status
  ON record_company_jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_rc_analytics_company_time
  ON record_company_analytics(record_company_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_rc_sources_entity
  ON record_company_sources(entity_type, entity_id);
