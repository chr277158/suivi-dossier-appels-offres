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
