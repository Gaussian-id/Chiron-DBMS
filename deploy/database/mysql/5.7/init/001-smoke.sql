CREATE TABLE IF NOT EXISTS chiron_horizon_smoke (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(255) NOT NULL,
  nullable_value VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chiron_horizon_smoke_note (note)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO chiron_horizon_smoke (note, nullable_value) VALUES ('Chiron Horizon smoke 中文 🚀', NULL);
