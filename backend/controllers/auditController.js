/**
 * Security Audit Log Controller
 * --------------------------------------------------------------------
 * Retrieves system audit logs for user logins, access control toggles,
 * submission reviews, and blueprint changes.
 */

import { auditModel } from '../models/auditModel.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;

    const result = await auditModel.getLogs({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search
    });

    return sendSuccess(res, result.logs, 'Audit logs fetched successfully', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    return sendError(res, 'Failed to fetch security audit logs.', 500, error);
  }
};
