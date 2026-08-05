/**
 * Real-Time Notifications Model
 * --------------------------------------------------------------------
 * Manages user alert notifications for pending approvals, rejection notices,
 * and system updates.
 */

import { pool } from '../config/db.js';

export const notificationModel = {
  createNotification: async ({ userId, title, message, type = 'INFO', createdBy = 'SYSTEM' }) => {
    const id = `notif-${Date.now()}`;
    await pool.query(`
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?);
    `, [id, userId, title, message, type, createdBy, createdBy]);
    return id;
  },

  getUserNotifications: async (userId) => {
    const [rows] = await pool.query(`
      SELECT id, title, message, type, is_read as isRead, created_at as createdAt
      FROM notifications
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20;
    `, [userId]);
    return rows;
  }
};
