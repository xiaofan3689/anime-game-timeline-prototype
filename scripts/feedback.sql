CREATE TABLE IF NOT EXISTS user_feedback (
 id TEXT PRIMARY KEY, category TEXT NOT NULL, email TEXT NOT NULL,
 description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 notification TEXT NOT NULL DEFAULT 'sending', created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_created ON user_feedback(created_at DESC);
CREATE TABLE IF NOT EXISTS feedback_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL);
