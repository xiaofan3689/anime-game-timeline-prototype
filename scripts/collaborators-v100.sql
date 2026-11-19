CREATE TABLE IF NOT EXISTS collaborator_account_modes(email TEXT PRIMARY KEY, use_github INTEGER NOT NULL CHECK(use_github IN (0,1)));
INSERT OR IGNORE INTO collaborator_account_modes(email,use_github) SELECT lower(trim(email)),CASE WHEN use_github=1 THEN 1 ELSE 0 END FROM collaborator_applications WHERE status='approved' ORDER BY created_at DESC;
