CREATE TABLE IF NOT EXISTS gauss_horizon_smoke (
  id UInt64,
  note String,
  nullable_value Nullable(String),
  created_at DateTime DEFAULT now()
) ENGINE = MergeTree
ORDER BY id;
INSERT INTO gauss_horizon_smoke (id, note, nullable_value) VALUES (1, 'Gauss Horizon smoke 中文 🚀', NULL);
