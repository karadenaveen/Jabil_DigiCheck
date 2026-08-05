/**
 * Checklist Submissions & Approvals API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/submissions` endpoints for submitting forms, reviewing approvals,
 * soft deletes, and exporting Excel reports.
 */

import express from 'express';
import { getSubmissions, createSubmission, updateStatus, deleteSubmission, exportExcel } from '../controllers/submissionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { validateSubmission, validateStatusUpdate } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getSubmissions);
router.get('/export/excel', exportExcel);
router.post('/', validateSubmission, createSubmission);
router.patch('/:id/status', requireAdmin, validateStatusUpdate, updateStatus);
router.delete('/:id', requireAdmin, deleteSubmission);

export default router;
