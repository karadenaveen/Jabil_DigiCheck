/**
 * Machine & Equipment Data Access Model
 * --------------------------------------------------------------------
 * Manages plant line CNC machines and manufacturing lines registry.
 */

import { pool } from '../config/db.js';

export const machineModel = {
  getMachines: async () => {
    const [rows] = await pool.query(`
      SELECT id, name, code, line_name as lineName, status, created_at as createdAt
      FROM machines
      WHERE deleted_at IS NULL
      ORDER BY name ASC;
    `);
    return rows;
  }
};
