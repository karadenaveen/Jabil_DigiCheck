/**
 * User Management Controller
 * --------------------------------------------------------------------
 * Manages operations for system users and NTID access controls.
 * Features pagination, search filters, bcrypt password hashing, soft delete,
 * and security audit logs for operator creation and permission toggling.
 */


import bcrypt from 'bcryptjs';
import { pool } from "../config/db.js";
import { userModel } from '../models/userModel.js';
import { auditModel } from '../models/auditModel.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    const result = await userModel.getUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      sortBy,
      sortOrder
    });

    return sendSuccess(res, result.users, 'Users fetched successfully', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return sendError(res, 'Failed to fetch system users.', 500, error);
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, ntid, username, password = 'password123', role = 'OPERATOR' } = req.body;

    // Only Operator, Shift Leader, and Sub Admin accounts can be created —
    // there is exactly one Main Admin (the seeded account), and it can't
    // be created or duplicated through this endpoint.
    const allowedRoles = ['OPERATOR', 'SHIFT_LEADER', 'SUBADMIN'];
    if (!allowedRoles.includes(role)) {
      return sendError(res, `Role must be one of: ${allowedRoles.join(', ')}.`, 400);
    }

    const existingNTID = await userModel.findByUsernameOrNTID(ntid);
    if (existingNTID) {
      return sendError(res, `Account with NTID [${ntid}] already exists in system.`, 400);
    }

    const cleanUsername = username || name.toLowerCase().replace(/\s+/g, '.');
    const existingUsername = await userModel.findByUsernameOrNTID(cleanUsername);
    if (existingUsername) {
      return sendError(res, `Username [${cleanUsername}] is already in use.`, 400);
    }

    // Hash user password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userModel.createUser({
      name,
      ntid,
      username: cleanUsername,
      password: hashedPassword,
      role,
      createdBy: req.user ? req.user.name : 'ADMIN'
    });

    // Record Audit Log Event
    await auditModel.createLog({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'ADMIN',
      userRole: req.user ? req.user.role : 'ADMIN',
      action: 'CREATE_USER',
      resource: 'USERS',
      details: { newUserId: newUser.id, name, ntid, role },
      ipAddress: req.ip
    });

    logger.info(`New operator account created: ${name} (NTID: ${ntid})`);

    const allUsersResult = await userModel.getUsers({ page: 1, limit: 100 });
    return sendSuccess(res, allUsersResult.users, 'Operator account created successfully', 201);
  } catch (error) {
    logger.error('Error creating user:', error);
    // MySQL throws this when a role like SHIFT_LEADER/SUBADMIN is inserted
    // but the users.role ENUM in the database hasn't been migrated yet.
    if (error.code === 'WARN_DATA_TRUNCATED' || error.code === 'ER_DATA_TOO_LONG' || error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      return sendError(
        res,
        'This role isn\'t recognized by the database yet. Run migration_shiftleader_subadmin.sql against your database, then try again.',
        500,
        error
      );
    }
    return sendError(res, 'Failed to create operator account.', 500, error);
  }
};

export const toggleAccess = async (req, res) => {
  try {
    const { ntid } = req.params;

    const updatedUser = await userModel.toggleAccessStatus(
      ntid, 
      req.user ? req.user.name : 'ADMIN'
    );

    if (!updatedUser) {
      return sendError(res, `User with NTID [${ntid}] not found.`, 404);
    }

    // Record Audit Log Event
    await auditModel.createLog({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'ADMIN',
      userRole: req.user ? req.user.role : 'ADMIN',
      action: 'TOGGLE_USER_ACCESS',
      resource: 'USERS',
      details: { ntid, newStatus: updatedUser.status },
      ipAddress: req.ip
    });

    logger.info(`User access status updated for NTID [${ntid}]: ${updatedUser.status}`);

    const allUsersResult = await userModel.getUsers({ page: 1, limit: 100 });
    return sendSuccess(res, allUsersResult.users, `User access set to ${updatedUser.status}`);
  } catch (error) {
    logger.error('Error toggling access:', error);
    return sendError(res, 'Failed to update user access status.', 500, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await userModel.softDeleteUser(id, req.user ? req.user.name : 'ADMIN');
    if (!success) {
      return sendError(res, 'User account not found.', 404);
    }

    // Record Audit Log Event
    await auditModel.createLog({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'ADMIN',
      userRole: req.user ? req.user.role : 'ADMIN',
      action: 'DELETE_USER',
      resource: 'USERS',
      details: { deletedUserId: id },
      ipAddress: req.ip
    });

    const allUsersResult = await userModel.getUsers({ page: 1, limit: 100 });
    return sendSuccess(res, allUsersResult.users, 'User account deleted successfully (Soft Delete)');
  } catch (error) {
    logger.error('Error deleting user:', error);
    return sendError(res, 'Failed to delete user account.', 500, error);
  }
};



export const resetPassword = async (req, res) => {
  try {

    const { ntid } = req.params;

    // Temporary password generated by admin
    const temporaryPassword = "Jabil@123";

    // Encrypt password
    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      10
    );


    // Update user password
    const [result] = await pool.query(
      `
      UPDATE users
      SET 
        password = ?,
        password_change = TRUE,
        updated_by = 'ADMIN',
        updated_at = CURRENT_TIMESTAMP
      WHERE ntid = ?
      `,
      [
        hashedPassword,
        ntid
      ]
    );


    if(result.affectedRows === 0)
    {
      return res.status(404).json({
        success:false,
        message:"User not found"
      });
    }


    res.json({
      success:true,
      message:"Password reset successful",
      temporaryPassword
    });


  }
  catch(error)
  {

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
    });

  }
};