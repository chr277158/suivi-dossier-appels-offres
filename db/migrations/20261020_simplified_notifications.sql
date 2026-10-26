BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'user_reminders'
      AND column_name = 'workflow_type'
  ) THEN
    DELETE FROM user_reminders
    WHERE workflow_type IN ('committee_decision', 'follow_up');
  END IF;
END;
$$;

DROP INDEX IF EXISTS user_reminders_delivery_idx;

ALTER TABLE user_reminders
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_delivery_error TEXT;

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

UPDATE user_reminders
SET delivery_status = 'sent'
WHERE is_sent = TRUE AND delivery_status = 'pending';

ALTER TABLE user_reminders
  DROP CONSTRAINT IF EXISTS user_reminders_workflow_type_check,
  DROP CONSTRAINT IF EXISTS user_reminders_workflow_step_check,
  DROP COLUMN IF EXISTS event_key,
  DROP COLUMN IF EXISTS workflow_type,
  DROP COLUMN IF EXISTS workflow_step,
  DROP COLUMN IF EXISTS is_resolved;

CREATE INDEX IF NOT EXISTS user_reminders_delivery_idx
  ON user_reminders(delivery_status, next_delivery_at, reminder_at)
  WHERE is_sent = FALSE;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions(user_id);

DROP TABLE IF EXISTS user_companion_dates;
DROP TABLE IF EXISTS user_companion_date_fields;
DROP TABLE IF EXISTS user_preferences;

COMMIT;
