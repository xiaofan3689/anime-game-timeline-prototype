-- Back up D1 first. Run after email-reminders.sql; execute as one D1 script.
CREATE TABLE IF NOT EXISTS email_sessions(token_hash TEXT PRIMARY KEY, account_hash TEXT NOT NULL);
-- Keep latest verified email snapshot; never union completed flags (undo must survive).
INSERT OR IGNORE INTO email_sessions(token_hash,account_hash)
SELECT token_hash,FIRST_VALUE(token_hash) OVER (PARTITION BY lower(email) ORDER BY updated_at DESC,token_hash)
FROM email_subscriptions WHERE email IS NOT NULL;
UPDATE email_subscriptions SET active=0,email=NULL,pending_email=NULL,code_hash=NULL
WHERE token_hash IN (SELECT token_hash FROM email_sessions WHERE token_hash<>account_hash);
CREATE UNIQUE INDEX IF NOT EXISTS email_verified_unique ON email_subscriptions(email) WHERE email IS NOT NULL;
