/**
 * Checklist Submissions & Approvals API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/submissions` endpoints for submitting forms, the two-stage
 * Shift Leader -> Admin review workflow, soft deletes, and Excel exports.
 */

import express from 'express';
import {
  getSubmissions, createSubmission, updateStatus, resubmitToAdmin,
  resubmitToShiftLeader, updateChecks, deleteSubmission, exportExcel
} from '../controllers/submissionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdminOrSubAdmin, requireApprovalStageRole } from '../middleware/roleMiddleware.js';
import { validateSubmission, validateStatusUpdate } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSubmissions);
router.get('/export/excel', exportExcel);
router.post('/', validateSubmission, createSubmission);

// Two-stage approval: Shift Leader decides on 'Pending' items (-> PendingAdmin
// or RejectedByShiftLeader); Admin/Sub Admin gives the final decision on
// 'PendingAdmin' items (-> Approved or RejectedByAdmin). The controller
// enforces exactly which stage each role may act on.
router.patch('/:id/status', requireApprovalStageRole, validateStatusUpdate, updateStatus);

// Shift Leader edits & resends an Admin-rejected submission back to Admin.
router.patch('/:id/resubmit-to-admin', requireApprovalStageRole, resubmitToAdmin);

// Operator edits & resends a Shift-Leader-rejected submission back to Shift Leader.
router.patch('/:id/resubmit-to-shift-leader', resubmitToShiftLeader);

// Shift Leader or Operator edits checklist answers while a submission is at
// their respective stage. The controller enforces which role may act on which
// status.
router.patch('/:id/checks', updateChecks);

router.delete('/:id', requireAdminOrSubAdmin, deleteSubmission);

export default router;
