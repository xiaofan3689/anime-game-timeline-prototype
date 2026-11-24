-- Apply once after collaborator-notices.sql.
ALTER TABLE collaborator_applications ADD COLUMN reactivation_reason TEXT;
CREATE INDEX IF NOT EXISTS collaborator_applications_client_recent ON collaborator_applications(client_id, created_at DESC, id);
