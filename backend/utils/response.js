/**
 * Standardized JSON Response Utility Module
 * --------------------------------------------------------------------
 * Formats API HTTP responses with consistent JSON structures across
 * all controllers, providing success indicators, data payloads,
 * pagination details, status codes, and error messages.
 */

export const sendSuccess = (res, data = null, message = 'Operation successful', statusCode = 200, pagination = null) => {
  const responseBody = {
    success: true,
    message,
    data
  };

  if (pagination) {
    responseBody.pagination = pagination;
  }

  return res.status(statusCode).json(responseBody);
};

export const sendError = (res, message = 'Internal Server Error', statusCode = 500, error = null) => {
  const responseBody = {
    success: false,
    message,
    error: error ? (typeof error === 'string' ? error : error.message || error) : null
  };

  return res.status(statusCode).json(responseBody);
};
