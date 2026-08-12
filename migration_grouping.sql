-- ====================================================================
-- MIGRATION: Operator / Shift Leader / Sub Admin Grouping Hierarchy
-- --------------------------------------------------------------------
-- Adds assignment columns to users, routing/timestamp columns to
-- submissions, expands approval_history for the full audit timeline,
-- and seeds a configurable capacity setting.
--
-- Safe to run on an existing live database — only ALTERs tables with
-- ADD COLUMN / MODIFY COLUMN. No DROP, no data loss. Existing rows
-- get NULL/defaults and continue to work.
--
-- Usage:
--   mysql -u <user> -p jabil_digicheck < migration_grouping.sql
-- ====================================================================

USE `jabil_digicheck`;

-- 1. Assignment columns on users table
--    Operator: shift_leader_id + sub_admin_id filled
--    Shift Leader: sub_admin_id filled (shift_leader_id NULL)
--    Sub Admin / Admin: both NULL
ALTER TABLE `users`
  ADD COLUMN `shift_leader_id` VARCHAR(50) DEFAULT NULL AFTER `avatar`,
  ADD COLUMN `sub_admin_id` VARCHAR(50) DEFAULT NULL AFTER `shift_leader_id`;

-- 2. Routing + timestamp columns on submissions table
ALTER TABLE `submissions`
  ADD COLUMN `shift_leader_id` VARCHAR(50) DEFAULT NULL AFTER `operator_ntid`,
  ADD COLUMN `sub_admin_id` VARCHAR(50) DEFAULT NULL AFTER `shift_leader_id`,
  ADD COLUMN `sub_admin_name` VARCHAR(255) DEFAULT NULL AFTER `sub_admin_id`,
  ADD COLUMN `shift_leader_resubmitted_at` VARCHAR(100) DEFAULT NULL AFTER `shift_leader_reviewed_at`,
  ADD COLUMN `sub_admin_reviewed_at` VARCHAR(100) DEFAULT NULL AFTER `shift_leader_resubmitted_at`,
  ADD COLUMN `sub_admin_reviewed_by` VARCHAR(50) DEFAULT NULL AFTER `sub_admin_reviewed_at`,
  ADD COLUMN `final_approved_at` VARCHAR(100) DEFAULT NULL AFTER `sub_admin_reviewed_by`;

-- 3. Expand approval_history action enum for the full audit timeline
ALTER TABLE `approval_history`
  MODIFY COLUMN `action` ENUM(
    'APPROVED', 'REJECTED', 'RESUBMITTED',
    'SUBMITTED', 'SHIFT_LEADER_APPROVED', 'SHIFT_LEADER_REJECTED',
    'SHIFT_LEADER_RESUBMITTED', 'SUB_ADMIN_APPROVED', 'SUB_ADMIN_REJECTED'
  ) NOT NULL;

-- 4. Configurable max operators per shift leader (default 30)
INSERT IGNORE INTO `settings` (`id`, `setting_key`, `setting_value`, `description`)
VALUES ('set-max-ops-sl', 'max_operators_per_shift_leader', '30', 'Maximum operators assignable to a single Shift Leader');

-- Done. No existing data is modified — all new columns default to NULL.
-- Existing users show as "Unassigned" until the Admin assigns them.
-- Existing submissions show with "Legacy / Assignment Unknown" routing.
