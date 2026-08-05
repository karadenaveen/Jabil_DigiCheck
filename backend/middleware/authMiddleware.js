/**
 * JWT Authentication Middleware
 * --------------------------------------------------------------------
 * Intercepts incoming HTTP requests, extracts the JWT Bearer token from the
 * `Authorization` header, verifies token signature, and attaches user payload to `req.user`.
 */

import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { sendError } from '../utils/response.js';
import { userModel } from '../models/userModel.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return sendError(res, 'Access token required. Please login.', 401);
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    const user = await userModel.findById(decoded.id);

    if (!user) {
      return sendError(res, 'Invalid or expired user session. User not found.', 401);
    }

    if (user.status === 'DENIED') {
      return sendError(res, `Access Denied for NTID [${user.ntid}]. Administrator has restricted your login access.`, 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'JWT Token has expired. Please sign in again.', 401);
    }
    return sendError(res, 'Invalid authentication token.', 401, error);
  }
};
