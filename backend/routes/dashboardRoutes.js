/**
 * Dashboard & Analytics API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/dashboard` endpoints for real-time metrics and activity feed.
 */

import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.get('/', getDashboardStats);

export default router;
