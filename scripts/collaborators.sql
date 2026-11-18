CREATE TABLE IF NOT EXISTS collaborator_users(
 email TEXT PRIMARY KEY, role TEXT NOT NULL DEFAULT 'collaborator', active INTEGER NOT NULL DEFAULT 0,
 games TEXT NOT NULL DEFAULT '[]', github_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collaborator_proposals(
 id TEXT PRIMARY KEY, email TEXT NOT NULL, base_sha TEXT NOT NULL, data TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', github_pr_url TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS collaborator_proposals_status ON collaborator_proposals(status,created_at DESC);
