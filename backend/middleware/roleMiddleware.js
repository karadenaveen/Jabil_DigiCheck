/**
 * Role-Based Access Control (RBAC) Middleware
 * --------------------------------------------------------------------
 * Restricts endpoint access based on user role (e.g. ADMIN vs OPERATOR).
 */

import { sendError } from '../utils/response.js';

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthenticated user context.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res, 
        `Access denied. Role '${req.user.role}' does not have authorization to perform this action.`, 
        403
      );
    }

    next();
  };
};

// Main Admin only — Settings page & user account management. Sub Admins
// intentionally do NOT get this, per "sees everything except Settings".
export const requireAdmin = requireRole(['ADMIN']);

// Full day-to-day operational access (Templates, Approvals, Records,
// Dashboard) — Main Admin and Sub Admin both qualify, Sub Admin just can't
// reach Settings/user management (enforced separately by requireAdmin above).
export const requireAdminOrSubAdmin = requireRole(['ADMIN', 'SUBADMIN']);

// Stage-1 approval queue (Shift Leader review) — Admin/Sub Admin can also
// act here as an oversight capability, but the controller still enforces
// which stage each role is allowed to decide on.
export const requireApprovalStageRole = requireRole(['SHIFT_LEADER', 'ADMIN', 'SUBADMIN']);

export const requireOperator = requireRole(['OPERATOR', 'ADMIN', 'SUBADMIN']);
