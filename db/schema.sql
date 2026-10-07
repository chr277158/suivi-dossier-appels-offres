CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'reader')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions(user_id);

CREATE TABLE IF NOT EXISTS dossiers (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  estimated_cost NUMERIC(14, 3),
  expense_nature TEXT,
  procedure_type TEXT,
  committee TEXT,
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'evaluation', 'awarded', 'unsuccessful', 'cancelled')),
  announcement_date DATE,
  submission_deadline DATE,
  bid_opening_date DATE,
  committee_decision_date DATE,
  specification_approval_date DATE,
  evaluation_report_date DATE,
  contract_notification_date DATE,
  results_publication_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dossiers_status_idx ON dossiers(status);
CREATE INDEX IF NOT EXISTS dossiers_deadline_idx ON dossiers(submission_deadline);
CREATE INDEX IF NOT EXISTS dossiers_subject_search_idx ON dossiers USING GIN (to_tsvector('simple', subject || ' ' || reference));

CREATE TABLE IF NOT EXISTS contracts (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  holder TEXT,
  amount NUMERIC(14, 3),
  currency CHAR(3) NOT NULL DEFAULT 'TND',
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'in_progress', 'active', 'archived', 'cancelled')),
  date_first_legal_document DATE,
  date_send_admin_signature DATE,
  date_admin_signed_return DATE,
  date_send_client_signature DATE,
  date_client_signed_return DATE,
  date_send_registration DATE,
  date_registered_return DATE,
  date_effective DATE,
  date_archived DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contracts_dossier_idx ON contracts(dossier_id);
CREATE INDEX IF NOT EXISTS contracts_state_idx ON contracts(state);

CREATE TABLE IF NOT EXISTS clarification_requests (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  received_at DATE,
  response TEXT,
  sent_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clarification_dossier_idx ON clarification_requests(dossier_id);

CREATE TABLE IF NOT EXISTS dossier_notes (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS dossiers_set_updated_at ON dossiers;
CREATE TRIGGER dossiers_set_updated_at BEFORE UPDATE ON dossiers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS contracts_set_updated_at ON contracts;
CREATE TRIGGER contracts_set_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
