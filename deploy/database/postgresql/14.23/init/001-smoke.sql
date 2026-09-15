CREATE TABLE IF NOT EXISTS gauss_horizon_smoke (
  id BIGSERIAL PRIMARY KEY,
  note TEXT NOT NULL,
  nullable_value TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gauss_horizon_smoke_note ON gauss_horizon_smoke (note);
INSERT INTO gauss_horizon_smoke (note, nullable_value) VALUES ('Gauss Horizon smoke 中文 🚀', NULL);
