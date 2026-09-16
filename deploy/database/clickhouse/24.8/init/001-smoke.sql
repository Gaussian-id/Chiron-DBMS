CREATE TABLE IF NOT EXISTS chiron_horizon_smoke (
  id UInt64,
  note String,
  nullable_value Nullable(String),
  created_at DateTime DEFAULT now()
) ENGINE = MergeTree
ORDER BY id;
INSERT INTO chiron_horizon_smoke (id, note, nullable_value) VALUES (1, 'Chiron Horizon smoke 中文 🚀', NULL);
