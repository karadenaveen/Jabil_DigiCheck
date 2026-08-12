/**
 * Authentication Controller
 * --------------------------------------------------------------------
 * Handles user authentication with bcrypt password verification, JWT token 
 * generation, active session validation, and security audit log recording.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { userModel } from '../models/userModel.js';
import { auditModel } from '../models/auditModel.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const login = async (req, res) => {
  try {
    const { usernameOrNTID, password } = req.body;

    const user = await userModel.findByUsernameOrNTID(usernameOrNTID);

    if (!user) {
      return sendError(res, 'Invalid Username/NTID or Password', 400);
    }

    // Verify bcrypt password hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return sendError(res, 'Invalid Username/NTID or Password', 400);
    }

    // Check Access Permission Status ('ALLOWED' vs 'DENIED')
    if (user.status === 'DENIED') {
      const errorMsg = `Access Denied for NTID [${user.ntid}]. Administrator has restricted your login access.`;
      
      // Log failed access attempt in audit logs
      await auditModel.createLog({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'LOGIN_DENIED',
        resource: 'AUTH',
        details: { ntid: user.ntid, reason: 'NTID Restricted' },
        ipAddress: req.ip
      });

      return sendError(res, errorMsg, 403);
    }

    // Sign JWT Authentication Token
    const token = jwt.sign(
      { id: user.id, role: user.role, ntid: user.ntid },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN }
    );

    // Record Successful Login Event in Audit Trail
    await auditModel.createLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      resource: 'AUTH',
      details: { ntid: user.ntid, role: user.role },
      ipAddress: req.ip
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      username: user.username,
      ntid: user.ntid,
      role: user.role,
      status: user.status,
      avatar: user.avatar,
      shiftLeaderId: user.shift_leader_id,
      subAdminId: user.sub_admin_id,
      createdDate: user.created_at
    };

    logger.info(`User logged in successfully: ${user.name} (${user.ntid})`);

    return sendSuccess(res, { user: userPayload, token }, 'Login successful');
  } catch (error) {
    logger.error('Login Error:', error);
    return sendError(res, 'Failed to authenticate user.', 500, error);
  }
};

export const getMe = async (req, res) => {
  try {
    const user = req.user;
    return sendSuccess(res, { user }, 'User session validated');
  } catch (error) {
    return sendError(res, 'Failed to retrieve session user info', 500, error);
  }
};
