/**
 * User Data Access Model
 * --------------------------------------------------------------------
 * Encapsulates MySQL queries for system user operations, including authentication 
 * lookups, user creation with hashed credentials, soft deletes, access status toggles,
 * and paginated queries.
 */

import { pool } from '../config/db.js';

export const userModel = {
  findByUsernameOrNTID: async (identifier) => {
    const sql = `
      SELECT id, role_id, name, username, ntid, password, role, status, avatar, created_at, updated_at
      FROM users
      WHERE (LOWER(username) = LOWER(?) OR ntid = ?) AND deleted_at IS NULL;
    `;
    const [rows] = await pool.query(sql, [identifier, identifier]);
    return rows[0] || null;
  },

  findById: async (id) => {
    const sql = `
      SELECT id, role_id, name, username, ntid, role, status, avatar, created_at, updated_at
      FROM users
      WHERE id = ? AND deleted_at IS NULL;
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
  },

  getUsers: async ({ page = 1, limit = 50, search = '', sortBy = 'created_at', sortOrder = 'DESC' }) => {
    const offset = (page - 1) * limit;
    let baseSql = `WHERE deleted_at IS NULL`;
    const queryParams = [];

    if (search) {
      baseSql += ` AND (name LIKE ? OR ntid LIKE ? OR username LIKE ?)`;
      const pattern = `%${search}%`;
      queryParams.push(pattern, pattern, pattern);
    }

    const validSortColumns = ['name', 'ntid', 'username', 'role', 'status', 'created_at'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM users ${baseSql}`, queryParams);
    const total = countRows[0].total;

    const sql = `
      SELECT id, role_id, name, username, ntid, role, status, avatar, DATE_FORMAT(created_at, '%Y-%m-%d') as createdDate
      FROM users
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

  createUser: async ({ name, username, ntid, password, role = 'OPERATOR', avatar, createdBy = 'ADMIN' }, dbConnection = null) => {
    const executor = dbConnection || pool;
    const id = `usr-${Date.now()}`;
    const roleId = role === 'ADMIN' ? 'role-admin' : 'role-operator';
    const userAvatar = avatar || (name ? name.substring(0, 2).toUpperCase() : 'OP');

    const sql = `
      INSERT INTO users (id, role_id, name, username, ntid, password, role, status, avatar, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ALLOWED', ?, ?, ?);
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
      createdBy,
      createdBy
    ]);

    return userModel.findById(id);
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

  // Soft delete method as required in requirement #2
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
