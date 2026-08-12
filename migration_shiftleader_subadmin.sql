-- ====================================================================
-- MIGRATION: Shift Leader role + Sub Admin role + two-stage approval
-- --------------------------------------------------------------------
-- Run this ONCE against your EXISTING `jabil_digicheck` database.
-- It only ALTERs tables and adds new lookup rows — it does NOT drop
-- or touch any existing data. Safe to run on a live database.
--
-- Usage:
--   mysql -u <user> -p jabil_digicheck < migration_shiftleader_subadmin.sql
-- ====================================================================

USE `jabil_digicheck`;

-- 1. Add the two new roles to the RBAC roles table (idempotent)
INSERT IGNORE INTO `roles` (`id`, `name`, `description`) VALUES
('role-subadmin', 'SUBADMIN', 'Sub Administrator with the same day-to-day access as Admin (Dashboard, Templates, Approvals, Records), except Settings & user account management.'),
('role-shiftleader', 'SHIFT_LEADER', 'Shift Leader who reviews operator checklist submissions first, can edit them, and approves them forward to Admin for final sign-off.');

-- 2. Expand the users.role ENUM to allow the two new roles
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('ADMIN', 'SUBADMIN', 'SHIFT_LEADER', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR';

-- 3. Expand the submissions.status ENUM for the two-stage workflow.
--    Existing 'Pending' / 'Approved' / 'Rejected' rows are untouched —
--    'Rejected' is kept for backward compatibility with old records.
ALTER TABLE `submissions`
  MODIFY COLUMN `status` ENUM('Pending', 'PendingAdmin', 'Approved', 'Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin') DEFAULT 'Pending';

-- 4. Track which Shift Leader approved a submission at stage 1, so the
--    Admin's queue can still show that name after Admin's own review
--    overwrites reviewed_by/reviewed_at.
ALTER TABLE `submissions`
  ADD COLUMN `shift_leader_name` VARCHAR(255) DEFAULT NULL AFTER `reviewed_by`,
  ADD COLUMN `shift_leader_reviewed_at` VARCHAR(100) DEFAULT NULL AFTER `shift_leader_name`;

-- 5. Allow a RESUBMITTED action in the approval history audit trail
--    (used when a Shift Leader edits and resends an Admin-rejected form)
ALTER TABLE `approval_history`
  MODIFY COLUMN `action` ENUM('APPROVED', 'REJECTED', 'RESUBMITTED') NOT NULL;

-- Done. Existing users, templates, and submissions are unaffected —
-- only new optional columns and new allowed enum values were added.
