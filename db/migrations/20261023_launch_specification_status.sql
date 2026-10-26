ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS launch_specification_status TEXT NOT NULL DEFAULT 'in_preparation';

ALTER TABLE dossiers
  DROP CONSTRAINT IF EXISTS dossiers_launch_specification_status_check;

ALTER TABLE dossiers
  ADD CONSTRAINT dossiers_launch_specification_status_check
  CHECK (launch_specification_status IN ('completed', 'in_preparation'));
