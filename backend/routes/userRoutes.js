/**
 * User Management API Routes
 * --------------------------------------------------------------------
 * Mounts `/api/users` endpoints for listing users, creating operators,
 * toggling access permissions, and soft deleting accounts.
 */

import express from 'express';
import { getUsers, createUser, toggleAccess, deleteUser } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { validateCreateUser } from '../middleware/validationMiddleware.js';
import { resetPassword } from "../controllers/userController.js";

const router = express.Router();

router.use(authenticateToken);

router.get('/', getUsers);
router.post('/', requireAdmin, validateCreateUser, createUser);
router.patch('/toggle-access/:ntid', requireAdmin, toggleAccess);
router.delete('/:id', requireAdmin, deleteUser);

export default router;

router.patch(
"/reset-password/:ntid",
resetPassword
);