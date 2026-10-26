ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS matricule TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS service_label TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS fonction TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS balance_before NUMERIC(7, 2);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS balance_after NUMERIC(7, 2);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS address_during_leave TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS telephone TEXT;

CREATE TABLE IF NOT EXISTS leave_balances (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  balance NUMERIC(7, 2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE leave_requests AS l
SET matricule = COALESCE(l.matricule, u.matricule),
    fonction = COALESCE(l.fonction, u.fonction),
    telephone = COALESCE(l.telephone, u.tel)
FROM app_users AS u
WHERE l.user_id = u.id
  AND (l.matricule IS NULL OR l.fonction IS NULL OR l.telephone IS NULL);
