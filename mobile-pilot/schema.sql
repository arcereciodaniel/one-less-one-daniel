CREATE TABLE IF NOT EXISTS pilot_inbox (
 id TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL,
 imported_at TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','imported'))
);
CREATE INDEX IF NOT EXISTS idx_pilot_inbox_pending ON pilot_inbox(status,created_at);
CREATE TABLE IF NOT EXISTS pilot_catalog (
 id INTEGER PRIMARY KEY CHECK(id=1),
 payload TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
