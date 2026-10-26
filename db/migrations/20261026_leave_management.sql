ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS matricule TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS service_label TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS fonction TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS balance_before NUMERIC(7,2);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS balance_after NUMERIC(7,2);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS address_during_leave TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS telephone TEXT;
CREATE TABLE IF NOT EXISTS leave_balances (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  balance NUMERIC(7,2) NOT NULL CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
