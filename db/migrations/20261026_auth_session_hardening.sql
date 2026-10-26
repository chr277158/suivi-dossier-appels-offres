ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS family_id UUID DEFAULT gen_random_uuid();
UPDATE refresh_sessions SET family_id = id WHERE family_id IS NULL;
ALTER TABLE refresh_sessions ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE refresh_sessions ALTER COLUMN family_id SET DEFAULT gen_random_uuid();
ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS replaced_by_session_id UUID REFERENCES refresh_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS refresh_sessions_family_idx ON refresh_sessions(family_id);
