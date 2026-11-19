CREATE TABLE IF NOT EXISTS collaborator_credentials (
 email TEXT PRIMARY KEY, github_user_id INTEGER NOT NULL, login TEXT NOT NULL,
 fork_repo TEXT NOT NULL, cipher TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collaborator_drafts_v79 (
 email TEXT PRIMARY KEY, base_sha TEXT NOT NULL, snapshot TEXT NOT NULL,
 catalog TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collaborator_reviews_v79 (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, github_user_id INTEGER NOT NULL,
 login TEXT NOT NULL, fork_repo TEXT NOT NULL, branch TEXT NOT NULL,
 base_sha TEXT NOT NULL, snapshot TEXT NOT NULL, proposed TEXT NOT NULL,
 scope TEXT NOT NULL, status TEXT NOT NULL, head_sha TEXT, pr_number INTEGER,
 pr_url TEXT, merge_sha TEXT, note TEXT NOT NULL DEFAULT '',
 draft_revision INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS collaborator_review_revision ON collaborator_reviews_v79(email,draft_revision);
CREATE UNIQUE INDEX IF NOT EXISTS collaborator_review_active ON collaborator_reviews_v79(email) WHERE status IN ('preparing','pending','merging');
CREATE TABLE IF NOT EXISTS collaborator_audit_v79 (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, proposal_id TEXT,
 action TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL
);
