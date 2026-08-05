/**
 * Blueprint Templates API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/templates` endpoints for listing, creating, and deleting templates.
 */

import express from 'express';
import { getTemplates, createTemplate, deleteTemplate } from '../controllers/templateController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTemplates);
router.post('/', requireAdmin, createTemplate);
router.delete('/:id', requireAdmin, deleteTemplate);

export default router;
