/**
 * Blueprint Templates API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/templates` endpoints for listing, creating, and deleting templates.
 */

import express from 'express';
import { getTemplates, createTemplate, deleteTemplate, uploadOriginalFile, updateGridData } from '../controllers/templateController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdminOrSubAdmin } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTemplates);
router.post('/', requireAdminOrSubAdmin, createTemplate);
router.post('/:id/original-file', requireAdminOrSubAdmin, upload.single('file'), uploadOriginalFile);
router.patch('/:id/grid-data', requireAdminOrSubAdmin, updateGridData);
router.delete('/:id', requireAdminOrSubAdmin, deleteTemplate);

export default router;
