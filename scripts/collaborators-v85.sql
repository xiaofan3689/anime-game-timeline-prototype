CREATE TABLE IF NOT EXISTS collaborator_account_meta (
 email TEXT PRIMARY KEY,
 requested_at TEXT,
 approved_at INTEGER,
 last_login_at INTEGER
);
INSERT OR IGNORE INTO collaborator_account_meta(email,requested_at,approved_at)
SELECT i.email,a.created_at,i.created_at FROM collaborator_invitations i
JOIN collaborator_applications a ON a.id=i.application_id
WHERE a.status='approved' ORDER BY i.created_at DESC;
