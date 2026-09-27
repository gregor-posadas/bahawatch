CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  place TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('oo','hindi','di_sigurado')),
  device TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX reports_at ON reports(at);
CREATE INDEX reports_dev ON reports(device, place, at);
CREATE TABLE readings (sensor TEXT NOT NULL, at INTEGER NOT NULL, depth_cm REAL NOT NULL, PRIMARY KEY (sensor, at));
CREATE TABLE rain (site TEXT PRIMARY KEY, now_mm REAL NOT NULL, next_mm REAL NOT NULL, at INTEGER NOT NULL);
CREATE TABLE status (place TEXT PRIMARY KEY, answer TEXT NOT NULL, reason TEXT NOT NULL, eta_min INTEGER,
  updated_at INTEGER, still_there TEXT, changed_at INTEGER NOT NULL);
CREATE TABLE heartbeat (id INTEGER PRIMARY KEY CHECK (id = 1), ran_at INTEGER NOT NULL, newest_at INTEGER);
CREATE TABLE hourly_counts (place TEXT NOT NULL, hour INTEGER NOT NULL, oo INTEGER NOT NULL, hindi INTEGER NOT NULL,
  unsure INTEGER NOT NULL, PRIMARY KEY (place, hour));
-- Round two (spec §5): anonymous push subscriptions. Created now, not used yet.
CREATE TABLE push_subs (endpoint TEXT PRIMARY KEY, place TEXT NOT NULL, created_at INTEGER NOT NULL);
