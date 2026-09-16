CREATE TABLE IF NOT EXISTS chiron_horizon_smoke (
  id BIGSERIAL PRIMARY KEY,
  note TEXT NOT NULL,
  nullable_value TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chiron_horizon_smoke_note ON chiron_horizon_smoke (note);
INSERT INTO chiron_horizon_smoke (note, nullable_value) VALUES ('Chiron Horizon smoke 中文 🚀', NULL);
