/**
 * Request Validation Middleware using express-validator
 * --------------------------------------------------------------------
 * Validates incoming request payloads (login credentials, user fields, checklist submissions)
 * and returns standardized 400 Bad Request error responses if validation fails.
 */

import { validationResult, body, param } from 'express-validator';
import { sendError } from '../utils/response.js';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0].msg;
    return sendError(res, firstError, 400, errors.array());
  }
  next();
};

export const validateLogin = [
  body('usernameOrNTID')
    .trim()
    .notEmpty()
    .withMessage('Username or NTID is required.'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required.'),
  handleValidationErrors
];

export const validateCreateUser = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Operator Name is required.'),
  body('ntid')
    .trim()
    .notEmpty()
    .withMessage('Numeric NTID is required.'),
  handleValidationErrors
];

export const validateSubmission = [
  body('templateId')
    .trim()
    .notEmpty()
    .withMessage('Template ID is required.'),
  body('shift')
    .trim()
    .notEmpty()
    .withMessage('Shift selection is required.'),
  handleValidationErrors
];

export const validateStatusUpdate = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Submission ID parameter is required.'),
  body('status')
    .isIn(['Approved', 'Rejected'])
    .withMessage('Status must be either Approved or Rejected.'),
  handleValidationErrors
];
