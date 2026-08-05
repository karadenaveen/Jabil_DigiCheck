/**
 * Authentication API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/auth/login` and `/api/auth/me` endpoints.
 */

import express from 'express';
import { login, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateLogin } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.post('/login', validateLogin, login);
router.get('/me', authenticateToken, getMe);

export default router;
