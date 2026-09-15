CREATE TABLE IF NOT EXISTS gauss_horizon_smoke (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(255) NOT NULL,
  nullable_value VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gauss_horizon_smoke_note (note)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO gauss_horizon_smoke (note, nullable_value) VALUES ('Gauss Horizon smoke 中文 🚀', NULL);
