/**
 * Blueprint Templates API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/templates` endpoints for listing, creating, and deleting templates.
 */

import express from 'express';
import { getTemplates, createTemplate, deleteTemplate, uploadOriginalFile, updateGridData } from '../controllers/templateController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTemplates);
router.post('/', requireAdmin, createTemplate);
router.post('/:id/original-file', requireAdmin, upload.single('file'), uploadOriginalFile);
router.patch('/:id/grid-data', requireAdmin, updateGridData);
router.delete('/:id', requireAdmin, deleteTemplate);

export default router;
