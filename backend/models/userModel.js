/**
 * User Data Access Model
 * --------------------------------------------------------------------
 * Encapsulates MySQL queries for system user operations, including authentication
 * lookups, user creation with hashed credentials + hierarchy assignment, soft
 * deletes, access status toggles, paginated queries, and role-filtered lists
 * for the grouping hierarchy (operators / shift leaders / sub admins).
 */

import { pool } from '../config/db.js';

export const userModel = {
  findByUsernameOrNTID: async (identifier) => {
    const sql = `
      SELECT id, role_id, name, username, ntid, password, role, status, avatar,
             shift_leader_id, sub_admin_id, created_at, updated_at
      FROM users
      WHERE (LOWER(username) = LOWER(?) OR ntid = ?) AND deleted_at IS NULL;
    `;
    const [rows] = await pool.query(sql, [identifier, identifier]);
    return rows[0] || null;
  },

  findById: async (id) => {
    const sql = `
      SELECT id, role_id, name, username, ntid, role, status, avatar,
             shift_leader_id, sub_admin_id, created_at, updated_at
      FROM users
      WHERE id = ? AND deleted_at IS NULL;
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
  },

  getUsers: async ({ page = 1, limit = 50, search = '', sortBy = 'created_at', sortOrder = 'DESC', role = '' }) => {
    const offset = (page - 1) * limit;
    let baseSql = `WHERE deleted_at IS NULL`;
    const queryParams = [];

    if (search) {
      baseSql += ` AND (name LIKE ? OR ntid LIKE ? OR username LIKE ?)`;
      const pattern = `%${search}%`;
      queryParams.push(pattern, pattern, pattern);
    }

    if (role) {
      baseSql += ` AND role = ?`;
      queryParams.push(role);
    }

    const validSortColumns = ['name', 'ntid', 'username', 'role', 'status', 'created_at'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM users ${baseSql}`, queryParams);
    const total = countRows[0].total;

    const sql = `
      SELECT u.id, u.role_id, u.name, u.username, u.ntid, u.role, u.status, u.avatar,
             u.shift_leader_id, u.sub_admin_id,
             DATE_FORMAT(u.created_at, '%Y-%m-%d') as createdDate,
             sl.name as shiftLeaderName,
             sa.name as subAdminName
      FROM users u
      LEFT JOIN users sl ON sl.id = u.shift_leader_id AND sl.deleted_at IS NULL
      LEFT JOIN users sa ON sa.id = u.sub_admin_id AND sa.deleted_at IS NULL
      ${baseSql}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?;
    `;
    queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await pool.query(sql, queryParams);
    return {
      users: rows,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit)
    };
  },

  createUser: async ({ name, username, ntid, password, role = 'OPERATOR', avatar, createdBy = 'ADMIN', shiftLeaderId = null, subAdminId = null }, dbConnection = null) => {
    const executor = dbConnection || pool;
    const id = `usr-${Date.now()}`;
    const ROLE_ID_MAP = {
      ADMIN: 'role-admin',
      SUBADMIN: 'role-subadmin',
      SHIFT_LEADER: 'role-shiftleader',
      OPERATOR: 'role-operator'
    };
    const roleId = ROLE_ID_MAP[role] || 'role-operator';
    const userAvatar = avatar || (name ? name.substring(0, 2).toUpperCase() : 'OP');

    const sql = `
      INSERT INTO users (id, role_id, name, username, ntid, password, role, status, avatar,
                        shift_leader_id, sub_admin_id, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ALLOWED', ?, ?, ?, ?);
    `;

    await executor.query(sql, [
      id,
      roleId,
      name,
      username,
      ntid,
      password,
      role,
      userAvatar,
      shiftLeaderId,
      subAdminId,
      createdBy,
      createdBy
    ]);

    return userModel.findById(id);
  },

  updateAssignment: async (userId, { shiftLeaderId, subAdminId }, dbConnection = null) => {
    const executor = dbConnection || pool;
    await executor.query(`
      UPDATE users
      SET shift_leader_id = ?, sub_admin_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL;
    `, [shiftLeaderId || null, subAdminId || null, userId]);
    return userModel.findById(userId);
  },

  // Role-filtered list: all users of a given role, optionally scoped to a
  // parent in the hierarchy (e.g. operators under a specific shift leader).
  // `parentField` is 'shift_leader_id' or 'sub_admin_id'.
  getUsersByRole: async (role, { parentField = null, parentId = null, search = '' } = {}) => {
    let sql = `
      SELECT u.id, u.name, u.username, u.ntid, u.role, u.status, u.avatar,
             u.shift_leader_id, u.sub_admin_id,
             sl.name as shiftLeaderName,
             sa.name as subAdminName
      FROM users u
      LEFT JOIN users sl ON sl.id = u.shift_leader_id AND sl.deleted_at IS NULL
      LEFT JOIN users sa ON sa.id = u.sub_admin_id AND sa.deleted_at IS NULL
      WHERE u.role = ? AND u.deleted_at IS NULL
    `;
    const params = [role];

    if (parentField && parentId) {
      sql += ` AND u.${parentField} = ?`;
      params.push(parentId);
    }

    if (search) {
      sql += ` AND (u.name LIKE ? OR u.ntid LIKE ? OR u.username LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += ` ORDER BY u.name ASC;`;

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  // Count operators assigned to a specific shift leader (for capacity check).
  countOperatorsForShiftLeader: async (shiftLeaderId, dbConnection = null) => {
    const executor = dbConnection || pool;
    const [rows] = await executor.query(`
      SELECT COUNT(*) as count FROM users
      WHERE shift_leader_id = ? AND role = 'OPERATOR' AND deleted_at IS NULL;
    `, [shiftLeaderId]);
    return parseInt(rows[0].count, 10);
  },

  toggleAccessStatus: async (ntid, updatedBy = 'ADMIN', dbConnection = null) => {
    const executor = dbConnection || pool;
    const user = await userModel.findByUsernameOrNTID(ntid);
    if (!user) return null;

    const newStatus = user.status === 'ALLOWED' ? 'DENIED' : 'ALLOWED';
    const sql = `
      UPDATE users
      SET status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `;

    await executor.query(sql, [newStatus, updatedBy, user.id]);
    return { ...user, status: newStatus };
  },

  softDeleteUser: async (id, deletedBy = 'ADMIN', dbConnection = null) => {
    const executor = dbConnection || pool;
    const sql = `
      UPDATE users
      SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?;
    `;
    const [result] = await executor.query(sql, [deletedBy, id]);
    return result.affectedRows > 0;
  }
};
