BEGIN;

ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS provisional_bond_required BOOLEAN;

UPDATE dossiers
SET provisional_bond_required = provisional_bond_amount IS NOT NULL
WHERE provisional_bond_required IS NULL OR provisional_bond_required = FALSE;

ALTER TABLE dossiers
  ALTER COLUMN provisional_bond_required SET DEFAULT FALSE,
  ALTER COLUMN provisional_bond_required SET NOT NULL;

COMMIT;
