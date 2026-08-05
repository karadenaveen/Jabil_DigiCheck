/**
 * Audit Log Data Access Model
 * --------------------------------------------------------------------
 * Handles inserting and querying security audit log events for user 
 * authentications, checklist submissions, status approvals, access toggles,
 * and template blueprint updates.
 */

import { pool } from '../config/db.js';

export const auditModel = {
  createLog: async ({ userId, userName, userRole, action, resource, details, ipAddress = '127.0.0.1', dbConnection = null }) => {
    const id = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sql = `
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, resource, details, ip_address, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      id,
      userId || null,
      userName || 'SYSTEM',
      userRole || 'SYSTEM',
      action,
      resource || null,
      JSON.stringify(details || {}),
      ipAddress,
      userName || 'SYSTEM'
    ];

    const executor = dbConnection || pool;
    await executor.query(sql, params);
    return id;
  },

  getLogs: async ({ page = 1, limit = 50, search = '' }) => {
    const offset = (page - 1) * limit;
    let baseSql = `WHERE deleted_at IS NULL`;
    const queryParams = [];

    if (search) {
      baseSql += ` AND (action LIKE ? OR user_name LIKE ? OR resource LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM audit_logs ${baseSql}`, queryParams);
    const total = countRows[0].total;

    const sql = `
      SELECT id, user_id, user_name, user_role, action, resource, details, ip_address, created_at
      FROM audit_logs
      ${baseSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?;
    `;
    queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await pool.query(sql, queryParams);
    return {
      logs: rows.map(r => ({ ...r, details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
};
