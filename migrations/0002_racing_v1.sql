CREATE TABLE IF NOT EXISTS racing_races (
  race_id TEXT PRIMARY KEY,
  race_date TEXT NOT NULL,
  location TEXT NOT NULL,
  race_number INTEGER NOT NULL,
  race_name TEXT NOT NULL,
  scheduled_time TEXT,
  distance_metres INTEGER,
  race_class TEXT,
  track_condition TEXT,
  field_size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_retrieved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(race_date, location, race_number)
);

CREATE TABLE IF NOT EXISTS racing_runners (
  race_id TEXT NOT NULL REFERENCES racing_races(race_id) ON DELETE CASCADE,
  runner_id TEXT NOT NULL,
  runner_number INTEGER,
  horse_name TEXT NOT NULL,
  barrier INTEGER,
  jockey TEXT,
  trainer TEXT,
  weight_kg REAL,
  current_odds REAL,
  scratched INTEGER NOT NULL DEFAULT 0,
  normalized_json TEXT NOT NULL,
  PRIMARY KEY(race_id, runner_id)
);

CREATE TABLE IF NOT EXISTS racing_predictions (
  prediction_id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL REFERENCES racing_races(race_id) ON DELETE CASCADE,
  analysed_at TEXT NOT NULL,
  model_version TEXT NOT NULL,
  status TEXT NOT NULL,
  predicted_winner_id TEXT,
  predicted_top_three_json TEXT NOT NULL,
  market_favourite_id TEXT,
  tipster_consensus_id TEXT,
  confidence TEXT NOT NULL,
  verdict TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  data_points_used INTEGER NOT NULL,
  source_summary_json TEXT NOT NULL,
  prediction_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_racing_predictions_race_time ON racing_predictions(race_id, analysed_at DESC);

CREATE TABLE IF NOT EXISTS racing_tipsters (
  prediction_id TEXT NOT NULL REFERENCES racing_predictions(prediction_id) ON DELETE CASCADE,
  opinion_id TEXT NOT NULL,
  tipster_name TEXT NOT NULL,
  outlet TEXT NOT NULL,
  first_selection TEXT,
  second_selection TEXT,
  third_selection TEXT,
  reasoning TEXT,
  published_at TEXT,
  source_url TEXT NOT NULL,
  PRIMARY KEY(prediction_id, opinion_id)
);

CREATE TABLE IF NOT EXISTS racing_results (
  race_id TEXT PRIMARY KEY REFERENCES racing_races(race_id) ON DELETE CASCADE,
  official_at TEXT NOT NULL,
  winner_id TEXT,
  second_id TEXT,
  third_id TEXT,
  finishing_order_json TEXT NOT NULL,
  margins_json TEXT NOT NULL,
  scratchings_json TEXT NOT NULL,
  track_condition TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS racing_post_race_reviews (
  prediction_id TEXT PRIMARY KEY REFERENCES racing_predictions(prediction_id) ON DELETE CASCADE,
  race_id TEXT NOT NULL REFERENCES racing_races(race_id) ON DELETE CASCADE,
  predicted_winner_won INTEGER NOT NULL,
  predicted_winner_top_three INTEGER NOT NULL,
  predicted_top_three_hits INTEGER NOT NULL,
  actual_winner_probability INTEGER,
  late_change INTEGER NOT NULL DEFAULT 0,
  review_note TEXT,
  reviewed_at TEXT NOT NULL
);
