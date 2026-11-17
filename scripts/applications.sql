CREATE TABLE IF NOT EXISTS application_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT OR IGNORE INTO application_settings VALUES ('generation','1');
CREATE TABLE IF NOT EXISTS collaborator_applications (
id TEXT PRIMARY KEY,generation TEXT NOT NULL,client_id TEXT NOT NULL,email TEXT NOT NULL,
has_github INTEGER NOT NULL,use_github INTEGER NOT NULL,username TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,
UNIQUE(generation,client_id),UNIQUE(generation,email));
