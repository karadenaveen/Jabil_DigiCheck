/**
 * Assignment & Grouping Controller
 * --------------------------------------------------------------------
 * Manages the operator → shift leader → sub admin hierarchy:
 *  - List shift leaders, sub admins, and operators (with assignment info)
 *  - Assign operators to a shift leader (with capacity check)
 *  - Assign shift leaders to a sub admin
 *  - Reassign / unassign users
 *  - Get the full grouping tree (for the Operator Groups page)
 */

import { userModel } from '../models/userModel.js';
import { pool } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

const MAX_OPS_DEFAULT = 30;

async function getMaxOperatorsPerShiftLeader() {
  try {
    const [rows] = await pool.query(
      `SELECT setting_value FROM settings WHERE setting_key = 'max_operators_per_shift_leader' LIMIT 1;`
    );
    return rows[0] ? parseInt(rows[0].setting_value, 10) : MAX_OPS_DEFAULT;
  } catch {
    return MAX_OPS_DEFAULT;
  }
}

export const getShiftLeaders = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const leaders = await userModel.getUsersByRole('SHIFT_LEADER', { search });
    // Include operator count for each leader
    const withCounts = await Promise.all(
      leaders.map(async (sl) => {
        const count = await userModel.countOperatorsForShiftLeader(sl.id);
        const max = await getMaxOperatorsPerShiftLeader();
        return { ...sl, assignedOperatorCount: count, maxOperators: max };
      })
    );
    return sendSuccess(res, withCounts, 'Shift Leaders fetched successfully');
  } catch (error) {
    logger.error('Error fetching shift leaders:', error);
    return sendError(res, 'Failed to fetch shift leaders.', 500, error);
  }
};

export const getSubAdmins = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const subAdmins = await userModel.getUsersByRole('SUBADMIN', { search });
    const withCounts = await Promise.all(
      subAdmins.map(async (sa) => {
        const [rows] = await pool.query(
          `SELECT COUNT(*) as count FROM users WHERE sub_admin_id = ? AND role = 'SHIFT_LEADER' AND deleted_at IS NULL;`,
          [sa.id]
        );
        return { ...sa, assignedShiftLeaderCount: parseInt(rows[0].count, 10) };
      })
    );
    return sendSuccess(res, withCounts, 'Sub Admins fetched successfully');
  } catch (error) {
    logger.error('Error fetching sub admins:', error);
    return sendError(res, 'Failed to fetch sub admins.', 500, error);
  }
};

export const getOperators = async (req, res) => {
  try {
    const { search = '', shiftLeaderId } = req.query;
    const operators = await userModel.getUsersByRole('OPERATOR', {
      search,
      parentField: shiftLeaderId ? 'shift_leader_id' : null,
      parentId: shiftLeaderId || null
    });
    return sendSuccess(res, operators, 'Operators fetched successfully');
  } catch (error) {
    logger.error('Error fetching operators:', error);
    return sendError(res, 'Failed to fetch operators.', 500, error);
  }
};

export const assignOperator = async (req, res) => {
  try {
    const { operatorId, shiftLeaderId, subAdminId } = req.body;

    if (!operatorId) {
      return sendError(res, 'Operator ID is required.', 400);
    }

    // Capacity check if assigning to a shift leader
    if (shiftLeaderId) {
      const currentCount = await userModel.countOperatorsForShiftLeader(shiftLeaderId);
      const max = await getMaxOperatorsPerShiftLeader();
      // Exclude the operator being assigned (they might already be counted)
      const operator = await userModel.findById(operatorId);
      const isAlreadyAssigned = operator?.shift_leader_id === shiftLeaderId;
      if (!isAlreadyAssigned && currentCount >= max) {
        return sendError(
          res,
          `This Shift Leader already has ${currentCount} operators assigned (max: ${max}). Please choose another Shift Leader or increase the capacity in Settings.`,
          400
        );
      }
    }

    const updated = await userModel.updateAssignment(operatorId, {
      shiftLeaderId: shiftLeaderId || null,
      subAdminId: subAdminId || null
    });

    if (!updated) {
      return sendError(res, 'Operator not found.', 404);
    }

    logger.info(`Operator ${operatorId} assigned to SL:${shiftLeaderId || 'none'}, SA:${subAdminId || 'none'} by ${req.user?.name || 'ADMIN'}`);
    return sendSuccess(res, updated, 'Operator assigned successfully');
  } catch (error) {
    logger.error('Error assigning operator:', error);
    return sendError(res, 'Failed to assign operator.', 500, error);
  }
};

export const assignShiftLeader = async (req, res) => {
  try {
    const { shiftLeaderId, subAdminId } = req.body;

    if (!shiftLeaderId) {
      return sendError(res, 'Shift Leader ID is required.', 400);
    }

    const updated = await userModel.updateAssignment(shiftLeaderId, {
      shiftLeaderId: null,
      subAdminId: subAdminId || null
    });

    if (!updated) {
      return sendError(res, 'Shift Leader not found.', 404);
    }

    logger.info(`Shift Leader ${shiftLeaderId} assigned to SA:${subAdminId || 'none'} by ${req.user?.name || 'ADMIN'}`);
    return sendSuccess(res, updated, 'Shift Leader assigned successfully');
  } catch (error) {
    logger.error('Error assigning shift leader:', error);
    return sendError(res, 'Failed to assign shift leader.', 500, error);
  }
};

// Full grouping tree: sub admins → shift leaders → operators
export const getGroupingTree = async (req, res) => {
  try {
    const subAdmins = await userModel.getUsersByRole('SUBADMIN');
    const shiftLeaders = await userModel.getUsersByRole('SHIFT_LEADER');
    const operators = await userModel.getUsersByRole('OPERATOR');

    const max = await getMaxOperatorsPerShiftLeader();

    // Build nested tree
    const tree = subAdmins.map((sa) => ({
      ...sa,
      shiftLeaders: shiftLeaders
        .filter((sl) => sl.sub_admin_id === sa.id)
        .map((sl) => ({
          ...sl,
          maxOperators: max,
          assignedOperatorCount: operators.filter((op) => op.shift_leader_id === sl.id).length,
          operators: operators.filter((op) => op.shift_leader_id === sl.id)
        }))
    }));

    // Unassigned shift leaders (no sub admin)
    const unassignedShiftLeaders = shiftLeaders
      .filter((sl) => !sl.sub_admin_id)
      .map((sl) => ({
        ...sl,
        maxOperators: max,
        assignedOperatorCount: operators.filter((op) => op.shift_leader_id === sl.id).length,
        operators: operators.filter((op) => op.shift_leader_id === sl.id)
      }));

    // Unassigned operators (no shift leader)
    const unassignedOperators = operators.filter((op) => !op.shift_leader_id);

    return sendSuccess(res, {
      subAdmins: tree,
      unassignedShiftLeaders,
      unassignedOperators,
      totalOperators: operators.length,
      totalShiftLeaders: shiftLeaders.length,
      totalSubAdmins: subAdmins.length,
      maxOperatorsPerShiftLeader: max
    }, 'Grouping tree fetched successfully');
  } catch (error) {
    logger.error('Error fetching grouping tree:', error);
    return sendError(res, 'Failed to fetch grouping tree.', 500, error);
  }
};

export const updateCapacity = async (req, res) => {
  try {
    const { maxOperators } = req.body;
    if (!maxOperators || maxOperators < 1) {
      return sendError(res, 'A positive max operators value is required.', 400);
    }

    await pool.query(
      `INSERT INTO settings (id, setting_key, setting_value, description)
       VALUES ('set-max-ops-sl', 'max_operators_per_shift_leader', ?, 'Maximum operators assignable to a single Shift Leader')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);`,
      [String(parseInt(maxOperators, 10))]
    );

    logger.info(`Max operators per shift leader updated to ${maxOperators} by ${req.user?.name || 'ADMIN'}`);
    return sendSuccess(res, { maxOperatorsPerShiftLeader: parseInt(maxOperators, 10) }, 'Capacity updated successfully');
  } catch (error) {
    logger.error('Error updating capacity:', error);
    return sendError(res, 'Failed to update capacity setting.', 500, error);
  }
};

export const getCapacity = async (req, res) => {
  try {
    const max = await getMaxOperatorsPerShiftLeader();
    return sendSuccess(res, { maxOperatorsPerShiftLeader: max }, 'Capacity fetched successfully');
  } catch (error) {
    logger.error('Error fetching capacity:', error);
    return sendError(res, 'Failed to fetch capacity setting.', 500, error);
  }
};
