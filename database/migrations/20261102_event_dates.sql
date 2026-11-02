-- Migração aditiva: cria Datas (categorias) e associa todas as sessões existentes.
-- Compatível com MySQL 8+ e MariaDB 10.5+. Execute uma única vez no phpMyAdmin
-- antes de publicar a versão do backend que exige event_date_id.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `event_dates` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `event_date` DATE NOT NULL,
  `date_label` VARCHAR(150) NOT NULL,
  `description` VARCHAR(500) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_dates_campaign_date` (`campaign_id`, `event_date`),
  KEY `idx_event_dates_campaign_active_sort` (`campaign_id`, `active`, `sort_order`),
  CONSTRAINT `fk_event_dates_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_event_dates_active` CHECK (`active` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @event_date_column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_days' AND COLUMN_NAME = 'event_date_id'
);
SET @migration_sql = IF(
  @event_date_column_exists = 0,
  'ALTER TABLE `event_days` ADD COLUMN `event_date_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER `campaign_id`',
  'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- opens_at é UTC; desde 2019 America/Sao_Paulo permanece em UTC-03:00.
INSERT IGNORE INTO `event_dates`
  (`id`, `campaign_id`, `name`, `event_date`, `date_label`, `active`, `sort_order`)
SELECT
  LOWER(UUID()),
  `campaign_id`,
  COALESCE(NULLIF(MAX(`date_label`), ''), DATE_FORMAT(DATE(DATE_SUB(MIN(`opens_at`), INTERVAL 3 HOUR)), '%d/%m/%Y')),
  DATE(DATE_SUB(`opens_at`, INTERVAL 3 HOUR)),
  COALESCE(NULLIF(MAX(`date_label`), ''), DATE_FORMAT(DATE(DATE_SUB(MIN(`opens_at`), INTERVAL 3 HOUR)), '%d/%m/%Y')),
  MAX(`active`),
  MIN(`sort_order`)
FROM `event_days`
WHERE `deleted_at` IS NULL
GROUP BY `campaign_id`, DATE(DATE_SUB(`opens_at`, INTERVAL 3 HOUR));

UPDATE `event_days` AS events
JOIN `event_dates` AS dates
  ON dates.`campaign_id` = events.`campaign_id`
 AND dates.`event_date` = DATE(DATE_SUB(events.`opens_at`, INTERVAL 3 HOUR))
 AND dates.`deleted_at` IS NULL
SET events.`event_date_id` = dates.`id`
WHERE events.`event_date_id` IS NULL;

ALTER TABLE `event_days` MODIFY COLUMN `event_date_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

SET @event_date_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_days' AND INDEX_NAME = 'idx_event_days_event_date_sort'
);
SET @migration_sql = IF(
  @event_date_index_exists = 0,
  'ALTER TABLE `event_days` ADD KEY `idx_event_days_event_date_sort` (`event_date_id`, `sort_order`)',
  'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @event_date_fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'event_days' AND CONSTRAINT_NAME = 'fk_event_days_event_date'
);
SET @migration_sql = IF(
  @event_date_fk_exists = 0,
  'ALTER TABLE `event_days` ADD CONSTRAINT `fk_event_days_event_date` FOREIGN KEY (`event_date_id`) REFERENCES `event_dates` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
