/**
 * AI & Agentic Analysis API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/ai` endpoints for automated visual inspection & agentic quality auditing.
 */

import express from 'express';
import { analyzeChecklistProof } from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateToken);
router.post('/analyze-proof', analyzeChecklistProof);

export default router;
