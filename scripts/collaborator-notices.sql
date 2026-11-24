CREATE INDEX IF NOT EXISTS collaborator_applications_email_normalized
 ON collaborator_applications(lower(trim(email)));
CREATE INDEX IF NOT EXISTS collaborator_users_email_normalized
 ON collaborator_users(lower(trim(email)));

CREATE TABLE IF NOT EXISTS collaborator_application_notices (
 id TEXT PRIMARY KEY,
 client_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 acknowledged_at INTEGER
);
CREATE INDEX IF NOT EXISTS collaborator_application_notices_client
 ON collaborator_application_notices(client_id, acknowledged_at, created_at);

CREATE TABLE IF NOT EXISTS collaborator_announcements (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 expires_at INTEGER,
 requires_confirmation INTEGER NOT NULL CHECK(requires_confirmation IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collaborator_announcement_receipts (
 announcement_id TEXT NOT NULL,
 email TEXT NOT NULL,
 revision INTEGER NOT NULL,
 seen_at INTEGER NOT NULL,
 confirmed_at INTEGER,
 PRIMARY KEY (announcement_id, email)
);
