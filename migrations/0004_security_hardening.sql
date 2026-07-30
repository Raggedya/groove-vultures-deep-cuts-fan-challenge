-- Phase 0 acquisition hardening.
-- This small aggregate table enforces a configurable daily ceiling on public,
-- cost-bearing research operations. It contains no visitor identifiers or
-- personal information.
CREATE TABLE IF NOT EXISTS security_daily_usage (
  usage_date TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (usage_date, usage_type)
);

CREATE INDEX IF NOT EXISTS idx_security_daily_usage_updated
  ON security_daily_usage(updated_at);
