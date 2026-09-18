CREATE TABLE IF NOT EXISTS assistant_turn_locks (
  session_hash TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  steps_used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS assistant_turn_locks_expiry
  ON assistant_turn_locks (expires_at);

CREATE TABLE IF NOT EXISTS assistant_rate_windows (
  scope_key TEXT NOT NULL,
  window_seconds INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  PRIMARY KEY (scope_key, window_seconds, window_start)
);

CREATE INDEX IF NOT EXISTS assistant_rate_windows_expiry
  ON assistant_rate_windows (window_start);
