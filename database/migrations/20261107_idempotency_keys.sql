-- Compatibilidade para instalações antigas. O schema.sql já contém esta tabela.
CREATE TABLE IF NOT EXISTS `idempotency_keys` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `operation` VARCHAR(120) NOT NULL,
  `idempotency_key` VARCHAR(150) NOT NULL,
  `request_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `response_status` SMALLINT UNSIGNED NULL,
  `response_body` JSON NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idempotency_user_operation_key` (`user_id`, `operation`, `idempotency_key`),
  KEY `idx_idempotency_expiry` (`expires_at`),
  CONSTRAINT `fk_idempotency_keys_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `ck_idempotency_response_status` CHECK (`response_status` IS NULL OR `response_status` BETWEEN 100 AND 599)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
