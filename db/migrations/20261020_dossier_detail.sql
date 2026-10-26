ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provisional_bond_amount NUMERIC(14, 3);
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS launch_specification_reference TEXT;

CREATE TABLE IF NOT EXISTS dossier_tracking_steps (
  dossier_id BIGINT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  completed_at DATE,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dossier_id, step_key)
);

CREATE INDEX IF NOT EXISTS dossier_tracking_steps_dossier_idx
  ON dossier_tracking_steps(dossier_id);
