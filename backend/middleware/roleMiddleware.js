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

export const requireAdmin = requireRole(['ADMIN']);
export const requireOperator = requireRole(['OPERATOR', 'ADMIN']);
