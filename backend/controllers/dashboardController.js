/**
 * Dashboard & Analytics Controller
 * --------------------------------------------------------------------
 * Compiles plant operations metrics, submission trends, status breakdown distributions,
 * and live recent activity feeds.
 */

import { submissionModel } from '../models/submissionModel.js';
import { auditModel } from '../models/auditModel.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const getDashboardStats = async (req, res) => {
  try {
    const metrics = await submissionModel.getDashboardMetrics();
    const auditLogsResult = await auditModel.getLogs({ page: 1, limit: 5 });

    // Recent activity feed compiled from audit logs and submissions
    const recentActivities = auditLogsResult.logs.slice(0, 5).map((log, idx) => ({
      id: log.id || idx + 1,
      user: log.user_name || 'System Operator',
      action: log.action.replace('_', ' '),
      target: log.resource || 'DigiCheck Platform',
      time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: log.action.includes('APPROVE') ? 'Approved' : log.action.includes('REJECT') ? 'Rejected' : 'Active',
      statusColor: log.action.includes('APPROVE') ? 'bg-emerald-100 text-emerald-700' : log.action.includes('REJECT') ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
    }));

    return sendSuccess(res, {
      metrics,
      recentActivities
    }, 'Dashboard metrics fetched successfully');
  } catch (error) {
    logger.error('Error compiling dashboard stats:', error);
    return sendError(res, 'Failed to compile dashboard metrics.', 500, error);
  }
};
