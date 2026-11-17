CREATE TABLE IF NOT EXISTS email_subscriptions (
 token_hash TEXT PRIMARY KEY, email TEXT, pending_email TEXT, code_hash TEXT,
 code_expires INTEGER, code_sent INTEGER DEFAULT 0, attempts INTEGER DEFAULT 0,
 games TEXT NOT NULL DEFAULT '[]', completed TEXT NOT NULL DEFAULT '[]',
 active INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL, checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS email_deliveries (
 token_hash TEXT NOT NULL, event_id TEXT NOT NULL, status TEXT NOT NULL,
 created_at INTEGER NOT NULL, PRIMARY KEY(token_hash,event_id)
);
CREATE TABLE IF NOT EXISTS email_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS email_active_check ON email_subscriptions(active,checked_at);
