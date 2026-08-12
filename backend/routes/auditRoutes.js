/**
 * Security Audit Log API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/audit-logs` endpoints for auditing user actions.
 */

import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdminOrSubAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdminOrSubAdmin);

router.get('/', getAuditLogs);

export default router;
