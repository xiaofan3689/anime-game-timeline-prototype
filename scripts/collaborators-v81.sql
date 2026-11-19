CREATE TABLE IF NOT EXISTS collaborator_oauth_states (
 state_hash TEXT PRIMARY KEY, email TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collaborator_oauth_locks (email TEXT PRIMARY KEY, until_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS collaborator_invitations (
 application_id TEXT PRIMARY KEY, email TEXT NOT NULL, games TEXT NOT NULL,
 status TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS collaborator_invitation_email ON collaborator_invitations(email,status);
CREATE TABLE IF NOT EXISTS collaborator_webhook_deliveries (id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS collaborator_review_channels (id TEXT PRIMARY KEY, mode TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS collaborator_release_status (id TEXT PRIMARY KEY, detail TEXT NOT NULL, checked_at INTEGER NOT NULL);
