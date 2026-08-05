-- ====================================================================
-- JABIL DIGICHECK PLANT EXECUTION PLATFORM - MYSQL SCHEMATICS
-- Generated SQL Create Table Statements & Relationships
-- Supports Audit Logs, Soft Delete, Audit Metadata Columns,
-- Database Normalization, and Historical Quality Tracking.
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `jabil_digicheck` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `jabil_digicheck`;

-- Disable Foreign Key Checks for smooth table creation
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- Table 1: ROLES (RBAC Permissions)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 2: USERS (System Operators & QA Supervisors)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `role_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `ntid` VARCHAR(50) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR',
  `status` ENUM('ALLOWED', 'DENIED') NOT NULL DEFAULT 'ALLOWED',
  `avatar` VARCHAR(10) DEFAULT 'OP',

  `password_change` BOOLEAN DEFAULT FALSE,

  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_users_roles` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 3: MACHINES (Plant Line & Equipment Registry)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `machines`;
CREATE TABLE `machines` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `line_name` VARCHAR(100) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'Active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 4: TEMPLATES (Checksheet Blueprints)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `templates`;
CREATE TABLE `templates` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `short_title` VARCHAR(255) DEFAULT NULL,
  `doc_number` VARCHAR(100) NOT NULL,
  `revision` VARCHAR(20) DEFAULT 'A',
  `category` VARCHAR(50) DEFAULT 'Form',
  `uploaded_by` VARCHAR(255) DEFAULT NULL,
  `uploaded_date` DATE DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT 'Active',
  `sheets_count` INT DEFAULT 1,
  `cover_page` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 5: TEMPLATE_FIELDS (Normalized Sheet Check Points)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `template_fields`;
CREATE TABLE `template_fields` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `template_id` VARCHAR(50) NOT NULL,
  `sheet_index` INT NOT NULL DEFAULT 0,
  `sheet_title` VARCHAR(255) NOT NULL,
  `row_no` INT NOT NULL,
  `nature` TEXT NOT NULL,
  `marathi` VARCHAR(255) DEFAULT NULL,
  `type` VARCHAR(100) NOT NULL,
  `type_marathi` VARCHAR(100) DEFAULT NULL,
  `photo_ref` VARCHAR(100) DEFAULT 'cleaning',
  `method` TEXT DEFAULT NULL,
  `method_marathi` VARCHAR(255) DEFAULT NULL,
  `when_to_do` VARCHAR(100) DEFAULT 'Every Shift',
  `proof_required` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_fields_templates` FOREIGN KEY (`template_id`) REFERENCES `templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 6: SUBMISSIONS (Operator Checklist Headers)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `submissions`;
CREATE TABLE `submissions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `template_id` VARCHAR(50) NOT NULL,
  `machine_id` VARCHAR(50) DEFAULT NULL,
  `template_title` VARCHAR(255) NOT NULL,
  `doc_number` VARCHAR(100) NOT NULL,
  `revision` VARCHAR(20) DEFAULT 'A',
  `shift` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `operator_name` VARCHAR(255) NOT NULL,
  `operator_ntid` VARCHAR(50) NOT NULL,
  `submitted_at` VARCHAR(100) NOT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  `rejection_remark` TEXT DEFAULT NULL,
  `reviewed_at` VARCHAR(100) DEFAULT NULL,
  `reviewed_by` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_submissions_templates` FOREIGN KEY (`template_id`) REFERENCES `templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 7: SUBMISSION_ANSWERS (Normalized Checklist Item Responses)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `submission_answers`;
CREATE TABLE `submission_answers` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `submission_id` VARCHAR(50) NOT NULL,
  `field_id` VARCHAR(50) DEFAULT NULL,
  `row_no` INT NOT NULL,
  `station_1` VARCHAR(10) DEFAULT 'V',
  `station_2` VARCHAR(10) DEFAULT 'V',
  `station_3` VARCHAR(10) DEFAULT 'V',
  `station_4` VARCHAR(10) DEFAULT 'V',
  `proof_photo_url` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_answers_submissions` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 8: ATTACHMENTS (File & Image Upload Storage Registry)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `attachments`;
CREATE TABLE `attachments` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `submission_id` VARCHAR(50) DEFAULT NULL,
  `template_id` VARCHAR(50) DEFAULT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_type` VARCHAR(100) NOT NULL,
  `file_size` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 9: APPROVAL_HISTORY (QA Supervisor Audit Log Trail)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `approval_history`;
CREATE TABLE `approval_history` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `submission_id` VARCHAR(50) NOT NULL,
  `reviewer_id` VARCHAR(50) NOT NULL,
  `action` ENUM('APPROVED', 'REJECTED') NOT NULL,
  `remark` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_history_submissions` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_history_users` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 10: NOTIFICATIONS (Real-time Operator & Manager Alerts)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'INFO',
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_notifications_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 11: SETTINGS (Plant Operations System Parameters)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 12: AUDIT_LOGS (Security & Audit Trail Logging)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(50) DEFAULT NULL,
  `user_name` VARCHAR(255) DEFAULT NULL,
  `user_role` VARCHAR(50) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `resource` VARCHAR(100) DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `updated_by` VARCHAR(50) DEFAULT 'SYSTEM',
  `deleted_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable Foreign Key Checks
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- SEED DATA INITIALIZATION
-- ====================================================================

-- Insert Default Roles
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
('role-admin', 'ADMIN', 'System Administrator with full access to blueprints, user access controls, and QA approvals.'),
('role-operator', 'OPERATOR', 'Plant Line Operator allowed to access assigned shifts and submit digital checklists.');


-- --------------------------------------------------------------------
-- Table 13: PASSWORD RESET LOGS (Password Recovery Audit Trail)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS `password_reset_logs`;

CREATE TABLE `password_reset_logs` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(50) NOT NULL,
  `reset_by` VARCHAR(50) NOT NULL,
  `old_password_reset_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT `fk_password_reset_users`
  FOREIGN KEY (`user_id`)
  REFERENCES `users` (`id`)
  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;






-- Note: User passwords below will be hashed automatically by the Express backend auto-seeder if not initialized.
-- Default bcrypt passwords:
-- admin / admin123 -> $2a$10$wO8yOqXn...
-- operator / operator123 -> $2a$10$eE58Y.m...
