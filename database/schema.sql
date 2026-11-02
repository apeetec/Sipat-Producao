-- Portal SIPAT - schema relacional de producao para phpMyAdmin/Hostinger
-- Compatibilidade alvo: MySQL 8.0+ e MariaDB 10.5+
-- IDs: UUID v4 em CHAR(36), gerados pela futura API Node.js.
-- Datas: armazenar em UTC; converter para America/Sao_Paulo na aplicacao.
-- Antes de importar, crie e selecione o banco no hPanel/phpMyAdmin.
-- Para ambiente local ou VPS, execute create-database.sql primeiro.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `organizations` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_organizations_slug` (`slug`),
  KEY `idx_organizations_active_deleted` (`active`, `deleted_at`),
  CONSTRAINT `ck_organizations_active` CHECK (`active` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `units` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_units_org_slug` (`organization_id`, `slug`),
  KEY `idx_units_org_active_sort` (`organization_id`, `active`, `sort_order`),
  KEY `idx_units_deleted` (`deleted_at`),
  CONSTRAINT `fk_units_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_units_active` CHECK (`active` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unit_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `employee_number` VARCHAR(64) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `display_name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'collaborator',
  `company_name` VARCHAR(180) NULL,
  `admin_comment` TEXT NULL,
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 1,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_org_employee` (`organization_id`, `employee_number`),
  UNIQUE KEY `uq_users_org_email` (`organization_id`, `email`),
  KEY `idx_users_unit_active` (`unit_id`, `active`),
  KEY `idx_users_org_role_active` (`organization_id`, `role`, `active`),
  KEY `idx_users_display_name` (`display_name`),
  KEY `idx_users_deleted` (`deleted_at`),
  CONSTRAINT `fk_users_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_users_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT `ck_users_role` CHECK (`role` IN ('admin', 'collaborator')),
  CONSTRAINT `ck_users_must_change_password` CHECK (`must_change_password` IN (0, 1)),
  CONSTRAINT `ck_users_active` CHECK (`active` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  `starts_at` DATETIME(3) NULL,
  `ends_at` DATETIME(3) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_campaigns_org_slug` (`organization_id`, `slug`),
  KEY `idx_campaigns_org_year_active` (`organization_id`, `year`, `active`),
  KEY `idx_campaigns_deleted` (`deleted_at`),
  CONSTRAINT `fk_campaigns_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_campaigns_year` CHECK (`year` BETWEEN 2000 AND 2200),
  CONSTRAINT `ck_campaigns_window` CHECK (`ends_at` IS NULL OR `starts_at` IS NULL OR `ends_at` > `starts_at`),
  CONSTRAINT `ck_campaigns_active` CHECK (`active` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_settings` (
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `primary_logo_url` VARCHAR(2048) NULL,
  `desktop_banner_url` VARCHAR(2048) NULL,
  `mobile_banner_url` VARCHAR(2048) NULL,
  `video_completion_threshold_percent` DECIMAL(5,2) NOT NULL DEFAULT 99.00,
  `show_correct_answers_after_submit` TINYINT(1) NOT NULL DEFAULT 0,
  `mask_employee_number_in_winners` TINYINT(1) NOT NULL DEFAULT 1,
  `initial_password_help_text` VARCHAR(500) NULL,
  `privacy_policy_url` VARCHAR(2048) NULL,
  `brand_name` VARCHAR(180) NULL,
  `brand_subtitle` VARCHAR(255) NULL,
  `primary_color` CHAR(7) NULL,
  `primary_dark_color` CHAR(7) NULL,
  `action_color` CHAR(7) NULL,
  `background_color` CHAR(7) NULL,
  `login_title` VARCHAR(180) NULL,
  `login_subtitle` VARCHAR(500) NULL,
  `login_badge_text` VARCHAR(120) NULL,
  `home_headline` VARCHAR(180) NULL,
  `home_description` TEXT NULL,
  `regulation_title` VARCHAR(180) NULL,
  `support_contact` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`campaign_id`),
  CONSTRAINT `fk_campaign_settings_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `ck_campaign_settings_threshold` CHECK (`video_completion_threshold_percent` BETWEEN 0 AND 100),
  CONSTRAINT `ck_campaign_settings_show_answers` CHECK (`show_correct_answers_after_submit` IN (0, 1)),
  CONSTRAINT `ck_campaign_settings_mask_employee` CHECK (`mask_employee_number_in_winners` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_links` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  `url` VARCHAR(2048) NOT NULL,
  `open_in_new_tab` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_campaign_links_campaign_sort` (`campaign_id`, `sort_order`),
  CONSTRAINT `fk_campaign_links_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `ck_campaign_links_new_tab` CHECK (`open_in_new_tab` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `regulations` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `version` VARCHAR(40) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content_html` LONGTEXT NOT NULL,
  `pdf_url` VARCHAR(2048) NULL,
  `published` TINYINT(1) NOT NULL DEFAULT 0,
  `effective_from` DATETIME(3) NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_regulations_campaign_version` (`campaign_id`, `version`),
  KEY `idx_regulations_campaign_published` (`campaign_id`, `published`, `effective_from`),
  CONSTRAINT `fk_regulations_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_regulations_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT `ck_regulations_published` CHECK (`published` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `regulation_acceptances` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `regulation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `accepted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `user_agent_summary` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_regulation_acceptance_user` (`regulation_id`, `user_id`),
  KEY `idx_regulation_acceptances_user_date` (`user_id`, `accepted_at`),
  CONSTRAINT `fk_regulation_acceptances_regulation` FOREIGN KEY (`regulation_id`) REFERENCES `regulations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_regulation_acceptances_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `event_days` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_date_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `parent_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `date_label` VARCHAR(150) NOT NULL,
  `attraction` VARCHAR(255) NULL,
  `theme` VARCHAR(255) NULL,
  `opens_at` DATETIME(3) NOT NULL,
  `closes_at` DATETIME(3) NOT NULL,
  `video_url` VARCHAR(2048) NULL,
  `video_storage_path` VARCHAR(1024) NULL,
  `video_embed_url` VARCHAR(2048) NULL,
  `video_type` VARCHAR(20) NULL,
  `video_attachment_name` VARCHAR(255) NULL,
  `card_cover_image_url` VARCHAR(2048) NULL,
  `banner_image_url` VARCHAR(2048) NULL,
  `attendance_code_hash` VARCHAR(255) NULL,
  `attendance_code_length` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `counts_for_full_week` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_days_campaign_slug` (`campaign_id`, `slug`),
  KEY `idx_event_days_campaign_active_sort` (`campaign_id`, `active`, `sort_order`),
  KEY `idx_event_days_event_date_sort` (`event_date_id`, `sort_order`),
  KEY `idx_event_days_window` (`opens_at`, `closes_at`),
  KEY `idx_event_days_parent` (`parent_id`),
  CONSTRAINT `fk_event_days_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_event_days_event_date` FOREIGN KEY (`event_date_id`) REFERENCES `event_dates` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_event_days_parent` FOREIGN KEY (`parent_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT `ck_event_days_window` CHECK (`closes_at` > `opens_at`),
  CONSTRAINT `ck_event_days_video_type` CHECK (`video_type` IS NULL OR `video_type` IN ('url', 'attachment')),
  CONSTRAINT `ck_event_days_active` CHECK (`active` IN (0, 1)),
  CONSTRAINT `ck_event_days_full_week` CHECK (`counts_for_full_week` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `speakers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `role_title` VARCHAR(255) NULL,
  `image_url` VARCHAR(2048) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_speakers_org_name` (`organization_id`, `name`),
  KEY `idx_speakers_deleted` (`deleted_at`),
  CONSTRAINT `fk_speakers_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_day_speakers` (
  `event_day_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `speaker_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`event_day_id`, `speaker_id`),
  KEY `idx_event_day_speakers_speaker` (`speaker_id`),
  CONSTRAINT `fk_event_day_speakers_day` FOREIGN KEY (`event_day_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `fk_event_day_speakers_speaker` FOREIGN KEY (`speaker_id`) REFERENCES `speakers` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_unit_videos` (
  `event_day_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unit_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `video_url` VARCHAR(2048) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`event_day_id`, `unit_id`),
  KEY `idx_event_unit_videos_unit` (`unit_id`),
  CONSTRAINT `fk_event_unit_videos_day` FOREIGN KEY (`event_day_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `fk_event_unit_videos_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `questions` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_day_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` TEXT NOT NULL,
  `type` VARCHAR(30) NOT NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 1,
  `scored` TINYINT(1) NOT NULL DEFAULT 1,
  `suggestion_prompt` VARCHAR(500) NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_questions_day_active_sort` (`event_day_id`, `active`, `sort_order`),
  KEY `idx_questions_deleted` (`deleted_at`),
  CONSTRAINT `fk_questions_event_day` FOREIGN KEY (`event_day_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_questions_type` CHECK (`type` IN ('single_choice', 'free_text', 'rating')),
  CONSTRAINT `ck_questions_required` CHECK (`required` IN (0, 1)),
  CONSTRAINT `ck_questions_scored` CHECK (`scored` IN (0, 1)),
  CONSTRAINT `ck_questions_active` CHECK (`active` IN (0, 1)),
  CONSTRAINT `ck_questions_scored_type` CHECK (`scored` = 0 OR `type` = 'single_choice')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `question_options` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `question_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` TEXT NOT NULL,
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
  `rating_value` SMALLINT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_question_options_id_question` (`id`, `question_id`),
  KEY `idx_question_options_question_sort` (`question_id`, `sort_order`),
  KEY `idx_question_options_question_correct` (`question_id`, `is_correct`),
  CONSTRAINT `fk_question_options_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_question_options_correct` CHECK (`is_correct` IN (0, 1)),
  CONSTRAINT `ck_question_options_rating` CHECK (`rating_value` IS NULL OR `rating_value` BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `participations` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_day_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `first_access_at` DATETIME(3) NULL,
  `last_access_at` DATETIME(3) NULL,
  `modality` VARCHAR(20) NULL,
  `attendance_validated_at` DATETIME(3) NULL,
  `video_progress_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `video_completed_at` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'not_started',
  `submitted_at` DATETIME(3) NULL,
  `correct_count` INT UNSIGNED NULL,
  `scored_question_count` INT UNSIGNED NULL,
  `percentage` DECIMAL(5,2) NULL,
  `perfect_score` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_participations_user_day` (`user_id`, `event_day_id`),
  KEY `idx_participations_day_status_score` (`event_day_id`, `status`, `perfect_score`),
  KEY `idx_participations_user_status` (`user_id`, `status`),
  KEY `idx_participations_submitted_at` (`submitted_at`),
  CONSTRAINT `fk_participations_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_participations_event_day` FOREIGN KEY (`event_day_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_participations_modality` CHECK (`modality` IS NULL OR `modality` IN ('in_person', 'remote')),
  CONSTRAINT `ck_participations_status` CHECK (`status` IN ('not_started', 'in_progress', 'submitted')),
  CONSTRAINT `ck_participations_video_progress` CHECK (`video_progress_percent` BETWEEN 0 AND 100),
  CONSTRAINT `ck_participations_percentage` CHECK (`percentage` IS NULL OR `percentage` BETWEEN 0 AND 100),
  CONSTRAINT `ck_participations_perfect_score` CHECK (`perfect_score` IN (0, 1)),
  CONSTRAINT `ck_participations_submission` CHECK (`status` <> 'submitted' OR `submitted_at` IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `participation_answers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `participation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `question_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `selected_option_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `text_answer` LONGTEXT NULL,
  `rating_value` SMALLINT NULL,
  `suggestion_text` TEXT NULL,
  `is_correct` TINYINT(1) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_participation_answers_question` (`participation_id`, `question_id`),
  KEY `idx_participation_answers_question` (`question_id`),
  KEY `idx_participation_answers_option_question` (`selected_option_id`, `question_id`),
  CONSTRAINT `fk_participation_answers_participation` FOREIGN KEY (`participation_id`) REFERENCES `participations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_participation_answers_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_participation_answers_option_question` FOREIGN KEY (`selected_option_id`, `question_id`) REFERENCES `question_options` (`id`, `question_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_participation_answers_rating` CHECK (`rating_value` IS NULL OR `rating_value` BETWEEN 1 AND 10),
  CONSTRAINT `ck_participation_answers_correct` CHECK (`is_correct` IS NULL OR `is_correct` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `video_progress_events` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `participation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `client_event_id` VARCHAR(100) NULL,
  `current_seconds` DECIMAL(12,3) NOT NULL,
  `duration_seconds` DECIMAL(12,3) NOT NULL,
  `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_video_progress_client_event` (`participation_id`, `client_event_id`),
  KEY `idx_video_progress_participation_date` (`participation_id`, `reported_at`),
  CONSTRAINT `fk_video_progress_participation` FOREIGN KEY (`participation_id`) REFERENCES `participations` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `ck_video_progress_seconds` CHECK (`current_seconds` >= 0 AND `duration_seconds` > 0 AND `current_seconds` <= `duration_seconds`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance_attempts` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `event_day_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `result` VARCHAR(20) NOT NULL,
  `ip_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_attendance_attempts_rate_limit` (`user_id`, `event_day_id`, `attempted_at`),
  CONSTRAINT `fk_attendance_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_attendance_attempts_day` FOREIGN KEY (`event_day_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_attendance_attempts_result` CHECK (`result` IN ('success', 'failure', 'rate_limited'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `draws` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `scope_type` VARCHAR(20) NOT NULL,
  `scope_event_day_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `prize_name` VARCHAR(255) NOT NULL,
  `prize_image_url` VARCHAR(2048) NULL,
  `prize_image_storage_path` VARCHAR(1024) NULL,
  `group_name` VARCHAR(180) NOT NULL,
  `requested_winner_count` INT UNSIGNED NOT NULL,
  `actual_winner_count` INT UNSIGNED NOT NULL,
  `exclude_previous_winners` TINYINT(1) NOT NULL DEFAULT 1,
  `eligible_count` INT UNSIGNED NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  `void_reason` VARCHAR(1000) NULL,
  `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `voided_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `voided_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_draws_campaign_status_created` (`campaign_id`, `status`, `created_at`),
  KEY `idx_draws_scope_day` (`scope_event_day_id`),
  CONSTRAINT `fk_draws_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_draws_scope_event_day` FOREIGN KEY (`scope_event_day_id`) REFERENCES `event_days` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_draws_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_draws_voided_by` FOREIGN KEY (`voided_by`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_draws_scope` CHECK ((`scope_type` = 'day' AND `scope_event_day_id` IS NOT NULL) OR (`scope_type` = 'full_week' AND `scope_event_day_id` IS NULL)),
  CONSTRAINT `ck_draws_counts` CHECK (`requested_winner_count` > 0 AND `actual_winner_count` <= `requested_winner_count` AND `actual_winner_count` <= `eligible_count`),
  CONSTRAINT `ck_draws_exclude_previous` CHECK (`exclude_previous_winners` IN (0, 1)),
  CONSTRAINT `ck_draws_status` CHECK (`status` IN ('published', 'voided')),
  CONSTRAINT `ck_draws_void_data` CHECK ((`status` = 'published' AND `voided_at` IS NULL) OR (`status` = 'voided' AND `voided_at` IS NOT NULL AND `void_reason` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `draw_units` (
  `draw_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unit_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`draw_id`, `unit_id`),
  KEY `idx_draw_units_unit` (`unit_id`),
  CONSTRAINT `fk_draw_units_draw` FOREIGN KEY (`draw_id`) REFERENCES `draws` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `fk_draw_units_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `draw_eligible_users` (
  `draw_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`draw_id`, `user_id`),
  KEY `idx_draw_eligible_users_user` (`user_id`),
  CONSTRAINT `fk_draw_eligible_users_draw` FOREIGN KEY (`draw_id`) REFERENCES `draws` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT `fk_draw_eligible_users_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `draw_winners` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `draw_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `winner_position` INT UNSIGNED NOT NULL,
  `employee_number_snapshot` VARCHAR(64) NOT NULL,
  `name_snapshot` VARCHAR(200) NOT NULL,
  `email_snapshot` VARCHAR(254) NOT NULL,
  `unit_name_snapshot` VARCHAR(150) NOT NULL,
  `company_name_snapshot` VARCHAR(180) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_draw_winners_position` (`draw_id`, `winner_position`),
  UNIQUE KEY `uq_draw_winners_user` (`draw_id`, `user_id`),
  KEY `idx_draw_winners_user` (`user_id`),
  CONSTRAINT `fk_draw_winners_draw` FOREIGN KEY (`draw_id`) REFERENCES `draws` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_draw_winners_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_draw_winners_position` CHECK (`winner_position` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `campaign_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `actor_user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `actor_name_snapshot` VARCHAR(200) NOT NULL,
  `action` VARCHAR(120) NOT NULL,
  `entity_type` VARCHAR(120) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `before_data` JSON NULL,
  `after_data` JSON NULL,
  `ip_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_org_date` (`organization_id`, `occurred_at`),
  KEY `idx_audit_logs_campaign_date` (`campaign_id`, `occurred_at`),
  KEY `idx_audit_logs_actor_date` (`actor_user_id`, `occurred_at`),
  KEY `idx_audit_logs_entity` (`entity_type`, `entity_id`),
  CONSTRAINT `fk_audit_logs_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_audit_logs_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT `fk_audit_logs_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `access_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `employee_number_attempted` VARCHAR(64) NOT NULL,
  `result` VARCHAR(20) NOT NULL,
  `failure_reason` VARCHAR(255) NULL,
  `ip_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `user_agent_summary` VARCHAR(500) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_access_logs_org_date` (`organization_id`, `occurred_at`),
  KEY `idx_access_logs_user_date` (`user_id`, `occurred_at`),
  KEY `idx_access_logs_employee_date` (`employee_number_attempted`, `occurred_at`),
  CONSTRAINT `fk_access_logs_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_access_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT `ck_access_logs_result` CHECK (`result` IN ('success', 'failure', 'rate_limited'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `auth_refresh_tokens` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auth_refresh_tokens_hash` (`token_hash`),
  KEY `idx_auth_refresh_tokens_user_expiry` (`user_id`, `expires_at`),
  CONSTRAINT `fk_auth_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS `user_import_jobs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `organization_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `source_filename` VARCHAR(255) NULL,
  `total_rows` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `error_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `started_at` DATETIME(3) NULL,
  `finished_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_import_jobs_org_date` (`organization_id`, `created_at`),
  KEY `idx_user_import_jobs_status` (`status`),
  CONSTRAINT `fk_user_import_jobs_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_user_import_jobs_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `ck_user_import_jobs_status` CHECK (`status` IN ('pending', 'processing', 'completed', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_import_errors` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `import_job_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `row_number` INT UNSIGNED NOT NULL,
  `employee_number` VARCHAR(64) NULL,
  `email` VARCHAR(254) NULL,
  `error_code` VARCHAR(80) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_user_import_errors_job_row` (`import_job_id`, `row_number`),
  CONSTRAINT `fk_user_import_errors_job` FOREIGN KEY (`import_job_id`) REFERENCES `user_import_jobs` (`id`) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
