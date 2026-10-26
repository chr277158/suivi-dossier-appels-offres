ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS provisional_bond_return_status TEXT NOT NULL DEFAULT 'not_returned';

ALTER TABLE dossiers
  DROP CONSTRAINT IF EXISTS dossiers_provisional_bond_return_status_check;

ALTER TABLE dossiers
  ADD CONSTRAINT dossiers_provisional_bond_return_status_check
  CHECK (provisional_bond_return_status IN ('returned', 'not_returned'));

UPDATE dossiers d
SET provisional_bond_return_status = 'returned',
    provisional_bond_return_date = COALESCE(d.provisional_bond_return_date, s.completed_at)
FROM dossier_tracking_steps s
WHERE s.dossier_id = d.id
  AND s.step_key = 'provisional_bond_returned'
  AND s.completed_at IS NOT NULL;

UPDATE dossiers
SET provisional_bond_return_status = 'returned'
WHERE provisional_bond_return_date IS NOT NULL;

INSERT INTO dossier_tracking_steps (dossier_id, step_key, completed_at)
SELECT id, 'provisional_bond_returned', provisional_bond_return_date
FROM dossiers
WHERE provisional_bond_return_status = 'returned'
  AND provisional_bond_return_date IS NOT NULL
ON CONFLICT (dossier_id, step_key) DO UPDATE
SET completed_at = COALESCE(dossier_tracking_steps.completed_at, EXCLUDED.completed_at);
