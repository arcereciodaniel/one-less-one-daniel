CREATE TABLE IF NOT EXISTS v17_staging_identity (
 id INTEGER PRIMARY KEY CHECK(id=1),
 purpose TEXT NOT NULL CHECK(purpose='olo-v17-staging-synthetic-v1')
);
INSERT OR IGNORE INTO v17_staging_identity(id,purpose) VALUES(1,'olo-v17-staging-synthetic-v1');
CREATE TABLE IF NOT EXISTS v17_staging_inbox (
 id TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL,
 imported_at TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','imported'))
);
CREATE INDEX IF NOT EXISTS idx_v17_staging_pending ON v17_staging_inbox(status,created_at);
CREATE TABLE IF NOT EXISTS v17_staging_catalog (
 id INTEGER PRIMARY KEY CHECK(id=1),
 payload TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
