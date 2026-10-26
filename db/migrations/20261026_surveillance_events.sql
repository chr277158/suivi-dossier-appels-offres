CREATE TABLE IF NOT EXISTS surveillance_events (
  id BIGSERIAL PRIMARY KEY,
  rule_key TEXT NOT NULL,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  contract_id BIGINT REFERENCES contracts(id) ON DELETE CASCADE,
  annual_program_id BIGINT REFERENCES annual_programs(id) ON DELETE CASCADE,
  started_at DATE NOT NULL,
  completed_at DATE,
  note TEXT,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT surveillance_events_single_parent_check CHECK ((dossier_id IS NOT NULL)::int + (contract_id IS NOT NULL)::int + (annual_program_id IS NOT NULL)::int = 1),
  CONSTRAINT surveillance_events_completion_order_check CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX IF NOT EXISTS surveillance_events_dossier_idx ON surveillance_events(dossier_id, started_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_events_contract_idx ON surveillance_events(contract_id, started_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_events_annual_idx ON surveillance_events(annual_program_id, started_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_events_rule_idx ON surveillance_events(rule_key, started_at);

DROP TRIGGER IF EXISTS surveillance_events_set_updated_at ON surveillance_events;
CREATE TRIGGER surveillance_events_set_updated_at BEFORE UPDATE ON surveillance_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
