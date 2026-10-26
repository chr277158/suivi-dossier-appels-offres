CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'reader')),
  matricule TEXT,
  service TEXT,
  fonction TEXT,
  tel TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS matricule TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS fonction TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS tel TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS app_users_matricule_unique_idx ON app_users (LOWER(matricule)) WHERE matricule IS NOT NULL AND matricule <> '';

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id UUID REFERENCES refresh_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS refresh_sessions_family_idx ON refresh_sessions(family_id);

CREATE TABLE IF NOT EXISTS dossiers (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  estimated_cost NUMERIC(14, 3),
  estimated_currency CHAR(3) NOT NULL DEFAULT 'TND',
  provisional_bond_amount NUMERIC(14, 3),
  provisional_bond_return_status TEXT NOT NULL DEFAULT 'not_returned' CHECK (provisional_bond_return_status IN ('returned', 'not_returned')),
  launch_specification_reference TEXT,
  launch_specification_status TEXT NOT NULL DEFAULT 'in_preparation' CHECK (launch_specification_status IN ('completed', 'in_preparation')),
  expense_nature TEXT,
  request_type TEXT,
  procedure_type TEXT,
  committee TEXT,
  owner_name TEXT,
  owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  status_manually_set BOOLEAN NOT NULL DEFAULT FALSE,
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  via_tuneps BOOLEAN NOT NULL DEFAULT FALSE,
  status_manual_until TIMESTAMPTZ,
  announcement_date DATE,
  submission_deadline TIMESTAMP WITHOUT TIME ZONE,
  bid_opening_date TIMESTAMP WITHOUT TIME ZONE,
  committee_decision_date DATE,
  specification_approval_date DATE,
  evaluation_report_date DATE,
  contract_notification_date DATE,
  results_publication_date DATE,
  provisional_bond_return_date DATE,
  definitive_bond_request_date DATE,
  contract_preparation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dossiers_status_idx ON dossiers(status);
CREATE INDEX IF NOT EXISTS dossiers_deadline_idx ON dossiers(submission_deadline);
CREATE INDEX IF NOT EXISTS dossiers_subject_search_idx ON dossiers USING GIN (to_tsvector('simple', subject || ' ' || reference));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provisional_bond_return_date DATE;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS estimated_currency CHAR(3) NOT NULL DEFAULT 'TND';
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provisional_bond_amount NUMERIC(14, 3);
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS provisional_bond_return_status TEXT NOT NULL DEFAULT 'not_returned';
ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_provisional_bond_return_status_check;
ALTER TABLE dossiers ADD CONSTRAINT dossiers_provisional_bond_return_status_check CHECK (provisional_bond_return_status IN ('returned', 'not_returned'));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS launch_specification_reference TEXT;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS launch_specification_status TEXT NOT NULL DEFAULT 'in_preparation';
ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_launch_specification_status_check;
ALTER TABLE dossiers ADD CONSTRAINT dossiers_launch_specification_status_check CHECK (launch_specification_status IN ('completed', 'in_preparation'));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL;
UPDATE dossiers d SET owner_user_id = u.id FROM app_users u WHERE d.owner_user_id IS NULL AND d.owner_name IS NOT NULL AND LOWER(BTRIM(d.owner_name)) = LOWER(BTRIM(u.full_name));
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS definitive_bond_request_date DATE;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS contract_preparation_date DATE;
ALTER TABLE dossiers ALTER COLUMN submission_deadline TYPE TIMESTAMP WITHOUT TIME ZONE USING submission_deadline::timestamp;
ALTER TABLE dossiers ALTER COLUMN bid_opening_date TYPE TIMESTAMP WITHOUT TIME ZONE USING bid_opening_date::timestamp;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS status_manually_set BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS via_tuneps BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS status_manual_until TIMESTAMPTZ;
ALTER TABLE dossiers DROP CONSTRAINT IF EXISTS dossiers_status_check;

CREATE TABLE IF NOT EXISTS dossier_owner_history (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  previous_owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  previous_owner_name TEXT,
  new_owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  new_owner_name TEXT,
  transferred_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  transferred_by_name TEXT NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dossier_owner_history_dossier_idx ON dossier_owner_history(dossier_id, transferred_at DESC);

CREATE TABLE IF NOT EXISTS dossier_tracking_steps (
  dossier_id BIGINT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  completed_at DATE,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dossier_id, step_key)
);
CREATE INDEX IF NOT EXISTS dossier_tracking_steps_dossier_idx ON dossier_tracking_steps(dossier_id);

CREATE TABLE IF NOT EXISTS configurable_options (
  id BIGSERIAL PRIMARY KEY,
  list_key TEXT NOT NULL,
  option_value TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_key, option_value)
);
CREATE INDEX IF NOT EXISTS configurable_options_list_idx ON configurable_options(list_key, sort_order, id);
CREATE TABLE IF NOT EXISTS application_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO application_settings (setting_key, setting_value)
VALUES (
  'reference_rules',
  '{
    "masks": {
      "dossier": "AA.99.3.9999",
      "contract": "AP.99.3.9999",
      "annual": "AA.99.3.9999"
    },
    "thresholds": {
      "study": { "craMax": 15000, "caeMax": 200000 },
      "servicesAndGoods": { "craMin": 20000, "craMax": 200000, "caeMax": 2000000 }
    }
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;
INSERT INTO configurable_options (list_key, option_value, label_fr, label_ar, sort_order) VALUES
  ('expense_nature', 'Exploitation', 'Exploitation', 'التشغيل', 10),
  ('expense_nature', 'Investissement', 'Investissement', 'الاستثمار', 20),
  ('procedure_type', 'استشارة مضيقة', 'استشارة مضيقة', 'استشارة مضيقة', 10),
  ('procedure_type', 'استشارة مفتوحة', 'استشارة مفتوحة', 'استشارة مفتوحة', 20),
  ('procedure_type', 'استشارة بالتفاوض المباشر', 'استشارة بالتفاوض المباشر', 'استشارة بالتفاوض المباشر', 30),
  ('procedure_type', 'طلب عروض مفتوح', 'طلب عروض مفتوح', 'طلب عروض مفتوح', 40),
  ('committee', 'CRA', 'CRA', 'CRA', 10),
  ('committee', 'CAE', 'CAE', 'CAE', 20),
  ('committee', 'CME', 'CME', 'CME', 30),
  ('committee', 'CSM', 'CSM', 'CSM', 40),
  ('currency', 'TND', 'Dinar tunisien (TND)', 'الدينار التونسي (TND)', 10),
  ('currency', 'USD', 'Dollar américain (USD)', 'الدولار الأمريكي (USD)', 20),
  ('currency', 'EUR', 'Euro (EUR)', 'اليورو (EUR)', 30),
  ('dossier_status', 'draft', 'En préparation', 'قيد الإعداد', 10),
  ('dossier_status', 'published', 'Lancé', 'تم الإعلان', 20),
  ('dossier_status', 'evaluation', 'En évaluation', 'قيد التقييم', 30),
  ('dossier_status', 'awarded', 'Attribué', 'تم الإسناد', 40),
  ('dossier_status', 'unsuccessful', 'Infructueux', 'غير مثمر', 50),
  ('dossier_status', 'cancelled', 'Annulé', 'ملغى', 60),
  ('contract_state', 'pending', 'En attente', 'قيد الانتظار', 10),
  ('contract_state', 'in_progress', 'En cours', 'قيد التنفيذ', 20),
  ('contract_state', 'active', 'Actif', 'ساري', 30),
  ('contract_state', 'archived', 'Archivé', 'مؤرشف', 40),
  ('contract_state', 'cancelled', 'Annulé', 'ملغى', 50),
  ('reminder_importance', 'low', 'Basse', 'منخفضة', 10),
  ('reminder_importance', 'normal', 'Normale', 'عادية', 20),
  ('reminder_importance', 'high', 'Haute', 'مرتفعة', 30),
  ('reminder_importance', 'urgent', 'Urgente', 'عاجلة', 40)
ON CONFLICT (list_key, option_value) DO NOTHING;

CREATE TABLE IF NOT EXISTS contracts (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE SET NULL,
  contract_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  holder TEXT,
  amount NUMERIC(14, 3),
  currency CHAR(3) NOT NULL DEFAULT 'TND',
  state TEXT NOT NULL DEFAULT 'pending',
  date_first_legal_document DATE,
  date_send_admin_signature DATE,
  date_admin_signed_return DATE,
  date_send_client_signature DATE,
  date_client_signed_return DATE,
  date_send_registration DATE,
  date_registered_return DATE,
  date_effective DATE,
  date_end DATE,
  date_archived DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contracts_dossier_idx ON contracts(dossier_id);
CREATE INDEX IF NOT EXISTS contracts_state_idx ON contracts(state);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS date_end DATE;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_state_check;

CREATE TABLE IF NOT EXISTS surveillance_events (
  id BIGSERIAL PRIMARY KEY,
  rule_key TEXT NOT NULL,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  contract_id BIGINT REFERENCES contracts(id) ON DELETE CASCADE,
  annual_program_id BIGINT,
  started_at DATE NOT NULL,
  completed_at DATE,
  note TEXT,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT surveillance_events_single_parent_check CHECK ((dossier_id IS NOT NULL)::int + (contract_id IS NOT NULL)::int + (annual_program_id IS NOT NULL)::int = 1),
  CONSTRAINT surveillance_events_completion_order_check CHECK (completed_at IS NULL OR completed_at >= started_at)
);
ALTER TABLE surveillance_events ADD COLUMN IF NOT EXISTS annual_program_id BIGINT;
ALTER TABLE surveillance_events DROP CONSTRAINT IF EXISTS surveillance_events_check;
ALTER TABLE surveillance_events DROP CONSTRAINT IF EXISTS surveillance_events_check1;
ALTER TABLE surveillance_events DROP CONSTRAINT IF EXISTS surveillance_events_single_parent_check;
ALTER TABLE surveillance_events DROP CONSTRAINT IF EXISTS surveillance_events_completion_order_check;
ALTER TABLE surveillance_events ADD CONSTRAINT surveillance_events_single_parent_check CHECK ((dossier_id IS NOT NULL)::int + (contract_id IS NOT NULL)::int + (annual_program_id IS NOT NULL)::int = 1);
ALTER TABLE surveillance_events ADD CONSTRAINT surveillance_events_completion_order_check CHECK (completed_at IS NULL OR completed_at >= started_at);
CREATE INDEX IF NOT EXISTS surveillance_events_dossier_idx ON surveillance_events(dossier_id, started_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_events_contract_idx ON surveillance_events(contract_id, started_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_events_annual_idx ON surveillance_events(annual_program_id, started_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_events_rule_idx ON surveillance_events(rule_key, started_at);

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

CREATE TABLE IF NOT EXISTS user_reminders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT,
  reminder_at TIMESTAMPTZ NOT NULL,
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high', 'urgent')),
  lead_minutes INTEGER NOT NULL DEFAULT 0 CHECK (lead_minutes >= 0),
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  visible_until DATE,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  delivery_claimed_at TIMESTAMPTZ,
  next_delivery_at TIMESTAMPTZ,
  last_delivery_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS dossier_id BIGINT REFERENCES dossiers(id) ON DELETE CASCADE;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS visible_until DATE;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS delivery_claimed_at TIMESTAMPTZ;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS next_delivery_at TIMESTAMPTZ;
ALTER TABLE user_reminders ADD COLUMN IF NOT EXISTS last_delivery_error TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reminders_delivery_status_check') THEN
    ALTER TABLE user_reminders ADD CONSTRAINT user_reminders_delivery_status_check
      CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reminders_delivery_attempts_check') THEN
    ALTER TABLE user_reminders ADD CONSTRAINT user_reminders_delivery_attempts_check
      CHECK (delivery_attempts >= 0) NOT VALID;
  END IF;
END;
$$;
UPDATE user_reminders SET delivery_status = 'sent' WHERE is_sent = TRUE AND delivery_status = 'pending';
CREATE INDEX IF NOT EXISTS user_reminders_due_idx ON user_reminders(user_id, reminder_at);
CREATE INDEX IF NOT EXISTS user_reminders_delivery_idx ON user_reminders(delivery_status, next_delivery_at, reminder_at) WHERE is_sent = FALSE;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS overtime_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  employee_label TEXT NOT NULL,
  work_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  hours NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0),
  comment TEXT,
  period TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS overtime_entries_date_idx ON overtime_entries(work_date);

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  employee_label TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  requested_days NUMERIC(5, 2) NOT NULL CHECK (requested_days > 0),
  holidays INTEGER NOT NULL DEFAULT 0 CHECK (holidays >= 0),
  matricule TEXT,
  service_label TEXT,
  fonction TEXT,
  balance_before NUMERIC(7,2),
  balance_after NUMERIC(7,2),
  address_during_leave TEXT,
  telephone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at DATE NOT NULL DEFAULT CURRENT_DATE,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS leave_requests_user_idx ON leave_requests(user_id, start_date);
CREATE TABLE IF NOT EXISTS leave_balances (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  balance NUMERIC(7,2) NOT NULL CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS annual_programs (
  id BIGSERIAL PRIMARY KEY,
  fiscal_year INTEGER NOT NULL,
  reference TEXT NOT NULL,
  subject TEXT NOT NULL,
  request_type TEXT,
  committee TEXT,
  procedure_type TEXT,
  estimated_cost NUMERIC(14, 3),
  funding_source TEXT,
  estimated_duration_days INTEGER CHECK (estimated_duration_days >= 0),
  estimated_start_date DATE,
  estimated_announcement_date DATE,
  estimated_opening_date DATE,
  UNIQUE (fiscal_year, reference)
);
ALTER TABLE surveillance_events DROP CONSTRAINT IF EXISTS surveillance_events_annual_program_fk;
ALTER TABLE surveillance_events ADD CONSTRAINT surveillance_events_annual_program_fk FOREIGN KEY (annual_program_id) REFERENCES annual_programs(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS annual_programs_year_idx ON annual_programs(fiscal_year, estimated_start_date);

CREATE TABLE IF NOT EXISTS work_schedule (
  id BIGSERIAL PRIMARY KEY,
  fiscal_year INTEGER NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS work_schedule_year_idx ON work_schedule(fiscal_year, start_date);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  summary TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS new_values JSONB;
CREATE INDEX IF NOT EXISTS audit_events_changed_idx ON audit_events(changed_at DESC);

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
DROP TRIGGER IF EXISTS surveillance_events_set_updated_at ON surveillance_events;
CREATE TRIGGER surveillance_events_set_updated_at BEFORE UPDATE ON surveillance_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
