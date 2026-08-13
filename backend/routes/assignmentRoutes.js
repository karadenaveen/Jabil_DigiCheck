/**
 * Assignment & Grouping Routes
 * --------------------------------------------------------------------
 * Endpoints for managing the operator → shift leader → sub admin hierarchy.
 * All routes require Admin authentication.
 */

import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import {
  getShiftLeaders,
  getSubAdmins,
  getOperators,
  assignOperator,
  assignShiftLeader,
  getGroupingTree,
  updateCapacity,
  getCapacity
} from '../controllers/assignmentController.js';

const router = express.Router();

// All assignment management is Admin-only
router.use(authenticateToken, requireAdmin);

// List people by role (with assignment info)
router.get('/shift-leaders', getShiftLeaders);
router.get('/sub-admins', getSubAdmins);
router.get('/operators', getOperators);

// Full grouping tree for the Operator Groups page
router.get('/tree', getGroupingTree);

// Assign / reassign operators and shift leaders
router.post('/assign-operator', assignOperator);
router.post('/assign-shift-leader', assignShiftLeader);

// Capacity setting (max operators per shift leader)
router.get('/capacity', getCapacity);
router.put('/capacity', updateCapacity);

export default router;
