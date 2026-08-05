/**
 * Global Centralized Express Error Handling Middleware
 * --------------------------------------------------------------------
 * Catches all unhandled route errors and logs error tracebacks with Winston.
 */

import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled Exception Captured:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return sendError(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
};
