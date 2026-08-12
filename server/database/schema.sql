-- Nexora AI simple MySQL schema. No Prisma is used.

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `role` ENUM('user','admin') NOT NULL DEFAULT 'user',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `users_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `theme` VARCHAR(30) NOT NULL DEFAULT 'system',
  `preferred_model` VARCHAR(100) NULL,
  `long_term_memory_enabled` BOOLEAN NOT NULL DEFAULT true,
  `telemetry_enabled` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_settings_user_id_key` (`user_id`),
  CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `conversations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_conversations_user_updated` (`user_id`, `updated_at`),
  CONSTRAINT `conversations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workflow_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `user_request` LONGTEXT NOT NULL,
  `state` ENUM('IDLE','PLANNING','EXECUTING','WAITING_FOR_AGENT','REVIEWING','RETRYING','COMPLETED','FAILED','TIMEOUT','CANCELLED') NOT NULL DEFAULT 'IDLE',
  `plan` JSON NULL,
  `final_response` LONGTEXT NULL,
  `token_usage` INTEGER NOT NULL DEFAULT 0,
  `error` TEXT NULL,
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_workflow_runs_user_created` (`user_id`, `created_at`),
  INDEX `idx_workflow_runs_conversation_created` (`conversation_id`, `created_at`),
  INDEX `idx_workflow_runs_state` (`state`),
  CONSTRAINT `workflow_runs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `workflow_runs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `workflow_run_id` BIGINT UNSIGNED NULL,
  `role` ENUM('user','assistant','system') NOT NULL,
  `content` LONGTEXT NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_messages_conversation_created` (`conversation_id`, `created_at`),
  INDEX `idx_messages_workflow_run` (`workflow_run_id`),
  CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `messages_workflow_run_id_fkey` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `workflow_run_id` BIGINT UNSIGNED NOT NULL,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `task_key` VARCHAR(120) NOT NULL,
  `agent_name` ENUM('Nexora Core','Nexora Scout','Nexora Logic','Nexora Forge','Nexora Scribe','Nexora Sentinel','Nexora Memory') NOT NULL,
  `task` TEXT NOT NULL,
  `dependencies` JSON NULL,
  `status` ENUM('pending','running','completed','failed','retrying','cancelled','timeout') NOT NULL DEFAULT 'pending',
  `result` JSON NULL,
  `error_message` TEXT NULL,
  `attempt` INTEGER NOT NULL DEFAULT 0,
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_agent_tasks_workflow_task_key` (`workflow_run_id`, `task_key`),
  INDEX `idx_agent_tasks_conversation_created` (`conversation_id`, `created_at`),
  INDEX `idx_agent_tasks_agent_status` (`agent_name`, `status`),
  CONSTRAINT `agent_tasks_workflow_run_id_fkey` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `agent_tasks_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` BIGINT UNSIGNED NOT NULL,
  `agent_name` ENUM('Nexora Core','Nexora Scout','Nexora Logic','Nexora Forge','Nexora Scribe','Nexora Sentinel','Nexora Memory') NOT NULL,
  `status` ENUM('running','completed','failed','cancelled','timeout') NOT NULL,
  `execution_time_ms` INTEGER NULL,
  `input_tokens` INTEGER NOT NULL DEFAULT 0,
  `output_tokens` INTEGER NOT NULL DEFAULT 0,
  `token_usage` INTEGER NOT NULL DEFAULT 0,
  `tool_calls` INTEGER NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_agent_runs_task_created` (`task_id`, `created_at`),
  INDEX `idx_agent_runs_agent_status` (`agent_name`, `status`),
  CONSTRAINT `agent_runs_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `agent_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` ENUM('Nexora Core','Nexora Scout','Nexora Logic','Nexora Forge','Nexora Scribe','Nexora Sentinel','Nexora Memory') NOT NULL,
  `role` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `max_tools` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `agents_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `file_type` VARCHAR(100) NULL,
  `file_size` BIGINT UNSIGNED NULL,
  `storage_path` TEXT NULL,
  `status` ENUM('processing','ready','failed') NOT NULL DEFAULT 'processing',
  `chunk_count` INTEGER NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_documents_user_created` (`user_id`, `created_at`),
  INDEX `idx_documents_status` (`status`),
  CONSTRAINT `documents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `memories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `memory_type` VARCHAR(100) NULL,
  `memory_key` VARCHAR(160) NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_memories_user_key` (`user_id`, `memory_key`),
  INDEX `idx_memories_user_type_updated` (`user_id`, `memory_type`, `updated_at`),
  CONSTRAINT `memories_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tool_calls` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `agent_run_id` BIGINT UNSIGNED NOT NULL,
  `tool_name` VARCHAR(100) NOT NULL,
  `input_data` JSON NULL,
  `output_data` JSON NULL,
  `status` VARCHAR(50) NULL,
  `execution_time_ms` INTEGER NULL,
  `error_message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_tool_calls_run_created` (`agent_run_id`, `created_at`),
  INDEX `idx_tool_calls_tool_status` (`tool_name`, `status`),
  CONSTRAINT `tool_calls_agent_run_id_fkey` FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usage_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `conversation_id` BIGINT UNSIGNED NULL,
  `model_name` VARCHAR(100) NULL,
  `input_tokens` INTEGER NOT NULL DEFAULT 0,
  `output_tokens` INTEGER NOT NULL DEFAULT 0,
  `total_tokens` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_usage_logs_user_created` (`user_id`, `created_at`),
  INDEX `idx_usage_logs_conversation` (`conversation_id`),
  CONSTRAINT `usage_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `usage_logs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `workflow_run_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(80) NOT NULL,
  `agent_name` ENUM('Nexora Core','Nexora Scout','Nexora Logic','Nexora Forge','Nexora Scribe','Nexora Sentinel','Nexora Memory') NULL,
  `message` VARCHAR(500) NOT NULL,
  `data` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_agent_events_workflow_created` (`workflow_run_id`, `created_at`),
  INDEX `idx_agent_events_type` (`type`),
  CONSTRAINT `agent_events_workflow_run_id_fkey` FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `agents` (`name`,`role`,`description`,`enabled`,`max_tools`,`created_at`,`updated_at`) VALUES
('Nexora Core','Orchestrator / Manager','Plans the workflow, delegates tasks, manages retries, sends work for review, and finalizes the response.',true,0,NOW(3),NOW(3)),
('Nexora Scout','Research Specialist','Collects reliable web and document evidence and returns source-aware structured research.',true,4,NOW(3),NOW(3)),
('Nexora Logic','Analysis Specialist','Compares evidence, identifies patterns, evaluates tradeoffs, and performs calculations.',true,4,NOW(3),NOW(3)),
('Nexora Forge','Technical Builder','Handles coding, architecture, debugging, implementation planning, and technical solution construction.',true,3,NOW(3),NOW(3)),
('Nexora Scribe','Writing Specialist','Converts evidence and analysis into polished reports, documentation, summaries, proposals, and content.',true,1,NOW(3),NOW(3)),
('Nexora Sentinel','Quality Reviewer','Checks factual consistency, completeness, contradictions, requested format, and quality before approval.',true,0,NOW(3),NOW(3)),
('Nexora Memory','Memory and Retrieval Specialist','Retrieves conversation context, long-term memories, and uploaded-document evidence without treating untrusted content as instructions.',true,2,NOW(3),NOW(3));
