/**
 * Submissions & Approvals Controller
 * --------------------------------------------------------------------
 * Handles digital checklist submissions, QA supervisor reviews (Approve/Reject),
 * soft deletes, MySQL isolated transactions, security audit logging, and Excel report exports.
 */

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { submissionModel } from '../models/submissionModel.js';
import { templateModel } from '../models/templateModel.js';
import { userModel } from '../models/userModel.js';
import { auditModel } from '../models/auditModel.js';
import { notificationModel } from '../models/notificationModel.js';
import { withTransaction } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { buildFilledWorkbookBuffer } from '../utils/excelBuilder.js';

// Build role-scoped filter for submission queries — each role sees only
// the submissions in their slice of the hierarchy.
function buildScope(user) {
  if (!user) return null;
  if (user.role === 'OPERATOR') return { role: 'OPERATOR', userId: user.id };
  if (user.role === 'SHIFT_LEADER') return { role: 'SHIFT_LEADER', userId: user.id };
  if (user.role === 'SUBADMIN') return { role: 'SUBADMIN', userId: user.id };
  return null; // ADMIN sees all
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const submissionsUploadDir = path.join(__dirname, '../uploads/submissions');

export const getSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', date = '', status = 'All', shift = '' } = req.query;

    // Role-scoped filtering: each role sees only their slice of submissions.
    const scope = buildScope(req.user);

    const result = await submissionModel.getSubmissions({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      date,
      status,
      shift,
      scope
    });

    return sendSuccess(res, result.submissions, 'Submissions fetched successfully', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    return sendError(res, 'Failed to fetch checklist submissions.', 500, error);
  }
};

export const createSubmission = async (req, res) => {
  try {
    const submissionData = req.body;

    // Derive hierarchy routing from the authenticated operator's user record
    const operatorUser = req.user;
    const shiftLeaderId = operatorUser?.shift_leader_id || null;
    const subAdminId = operatorUser?.sub_admin_id || null;
    let subAdminName = null;
    if (subAdminId) {
      const subAdmin = await userModel.findById(subAdminId);
      subAdminName = subAdmin?.name || null;
    }

    // Execute multi-table insertion inside an atomic MySQL Transaction
    const newSubmission = await withTransaction(async (dbConnection) => {
      const created = await submissionModel.createSubmission({
        ...submissionData,
        userId: operatorUser ? operatorUser.id : 'usr-op1',
        operatorName: operatorUser ? operatorUser.name : (submissionData.operatorName || 'Dummy Operator'),
        operatorNTID: operatorUser ? operatorUser.ntid : (submissionData.operatorNTID || '1234567'),
        shiftLeaderId,
        subAdminId,
        subAdminName
      }, dbConnection);

      // Record Audit Log Event inside transaction
      await auditModel.createLog({
        userId: req.user ? req.user.id : null,
        userName: req.user ? req.user.name : 'OPERATOR',
        userRole: req.user ? req.user.role : 'OPERATOR',
        action: 'SUBMIT_CHECKLIST',
        resource: 'SUBMISSIONS',
        details: { 
          submissionId: created.id, 
          templateId: created.templateId, 
          shift: created.shift, 
          date: created.date 
        },
        ipAddress: req.ip,
        dbConnection
      });

      return created;
    });

    // If this was a real-Excel-grid submission, reconstruct and save an
    // actual .xlsx file to disk — not just JSON in the database.
    if (submissionData.gridAnswers && Object.keys(submissionData.gridAnswers).length > 0) {
      try {
        const template = await templateModel.getTemplateById(newSubmission.templateId);
        if (template && template.gridData) {
          const buffer = await buildFilledWorkbookBuffer(template.gridData, submissionData.gridAnswers);
          if (!fs.existsSync(submissionsUploadDir)) {
            fs.mkdirSync(submissionsUploadDir, { recursive: true });
          }
          const fileName = `${newSubmission.id}.xlsx`;
          fs.writeFileSync(path.join(submissionsUploadDir, fileName), buffer);
          const relativePath = `/uploads/submissions/${fileName}`;
          await submissionModel.setFilledExcelPath(newSubmission.id, relativePath);
          newSubmission.filledExcelPath = relativePath;
        }
      } catch (fileErr) {
        // Non-fatal — the submission itself already succeeded and is safe;
        // the file can still be regenerated on demand from stored JSON.
        logger.warn('Could not generate filled .xlsx file on disk:', fileErr.message);
      }
    }

    // Notify admin after successful commit
    try {
      await notificationModel.createNotification({
        userId: 'usr-admin',
        title: 'New Checklist Pending Review',
        message: `${newSubmission.operatorName} submitted ${newSubmission.templateTitle} (${newSubmission.shift}) for QA approval.`,
        type: 'APPROVAL',
        createdBy: newSubmission.operatorName
      });
    } catch (notifErr) {
      logger.warn('Notification create skipped:', notifErr.message);
    }

    logger.info(`Checklist submitted successfully: ${newSubmission.id} by ${newSubmission.operatorName}`);

    const allSubsResult = await submissionModel.getSubmissions({ page: 1, limit: 100 });
    return sendSuccess(res, allSubsResult.submissions, 'Checklist submitted successfully to Approvals Queue', 201);
  } catch (error) {
    logger.error('Error creating submission:', error);
    return sendError(res, 'Failed to submit checklist form.', 500, error);
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: decision, rejectionRemark = '' } = req.body; // decision = the reviewer's intent: Approve or Reject

    if (!['Approved', 'Rejected'].includes(decision)) {
      return sendError(res, 'Status must be either Approved or Rejected.', 400);
    }

    if (decision === 'Rejected' && !rejectionRemark.trim()) {
      return sendError(res, 'Please provide a rejection remark detailing the corrective action required.', 400);
    }

    const existing = await submissionModel.getSubmissionById(id);
    if (!existing) {
      return sendError(res, 'Submission not found.', 404);
    }

    const role = req.user ? req.user.role : 'ADMIN';
    const isShiftLeader = role === 'SHIFT_LEADER';
    const isAdminLike = role === 'ADMIN' || role === 'SUBADMIN';
    const reviewerName = req.user ? req.user.name : 'ADMIN';

    // Two-stage workflow: Shift Leader decides on 'Pending' submissions
    // (Operator -> Shift Leader). Approving there does NOT finalize the
    // record — it forwards it to Admin as 'PendingAdmin'. Only Admin/Sub
    // Admin can give the final decision on a 'PendingAdmin' submission.
    let newStatus;
    let extra = {};

    if (existing.status === 'Pending') {
      if (!isShiftLeader && !isAdminLike) {
        return sendError(res, `Access denied. Role '${role}' cannot review submissions at this stage.`, 403);
      }
      newStatus = decision === 'Approved' ? 'PendingAdmin' : 'RejectedByShiftLeader';
      if (decision === 'Approved') extra.shiftLeaderName = reviewerName;
    } else if (existing.status === 'PendingAdmin') {
      if (!isAdminLike) {
        return sendError(res, 'Only Admin can give the final approval or rejection on a Shift-Leader-approved submission.', 403);
      }
      newStatus = decision === 'Approved' ? 'Approved' : 'RejectedByAdmin';
      if (role === 'SUBADMIN') {
        extra.subAdminReviewedAt = new Date().toLocaleString();
        extra.subAdminReviewedBy = reviewerName;
      }
    } else {
      return sendError(
        res,
        `This submission is already "${existing.status}" and can't be actioned again at this stage. It needs to be edited and resubmitted first.`,
        409
      );
    }

    // Execute status update & approval history inside an atomic MySQL Transaction
    const updated = await withTransaction(async (dbConnection) => {
      const result = await submissionModel.updateStatus(
        id,
        newStatus,
        rejectionRemark,
        reviewerName,
        req.user ? req.user.id : 'usr-admin',
        dbConnection,
        extra
      );

      if (!result) {
        throw Object.assign(new Error('Submission not found.'), { statusCode: 404 });
      }

      // Record Audit Log Event
      await auditModel.createLog({
        userId: req.user ? req.user.id : null,
        userName: reviewerName,
        userRole: role,
        action: newStatus.includes('Rejected') ? 'REJECT_SUBMISSION' : 'APPROVE_SUBMISSION',
        resource: 'SUBMISSIONS',
        details: { submissionId: id, previousStatus: existing.status, newStatus, rejectionRemark },
        ipAddress: req.ip,
        dbConnection
      });

      return result;
    });

    // Notify the right person after successful commit:
    // - Shift Leader approved -> forwarded to Admin, no operator notification yet.
    // - Shift Leader rejected -> notify the Operator to edit & resubmit.
    // - Admin approved -> final, notify the Operator it's fully approved.
    // - Admin rejected -> bounces back to Shift Leader(s), not the operator.
    try {
      if (newStatus === 'RejectedByShiftLeader') {
        await notificationModel.createNotification({
          userId: updated.userId,
          title: 'Checklist Rejected by Shift Leader',
          message: `Your submission ${updated.templateTitle} (${updated.shift}) was rejected: ${rejectionRemark}. Please edit and resubmit.`,
          type: 'WARNING',
          createdBy: reviewerName
        });
      } else if (newStatus === 'Approved') {
        await notificationModel.createNotification({
          userId: updated.userId,
          title: 'Checklist Approved',
          message: `Your submission ${updated.templateTitle} (${updated.shift}) was approved by Admin.`,
          type: 'SUCCESS',
          createdBy: reviewerName
        });
      }
      // RejectedByAdmin and PendingAdmin don't notify the operator directly —
      // they stay inside the Admin/Shift-Leader review loop.
    } catch (notifErr) {
      logger.warn('Notification create skipped:', notifErr.message);
    }

    logger.info(`Submission ${id} status updated from '${existing.status}' to '${newStatus}' by ${reviewerName} (${role})`);

    const allSubsResult = await submissionModel.getSubmissions({ page: 1, limit: 100 });
    return sendSuccess(res, allSubsResult.submissions, `Submission moved to '${newStatus}' successfully`);
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, 'Submission not found.', 404);
    }
    logger.error('Error updating submission status:', error);
    return sendError(res, 'Failed to update submission status.', 500, error);
  }
};

export const resubmitToAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await submissionModel.getSubmissionById(id);
    if (!existing) {
      return sendError(res, 'Submission not found.', 404);
    }

    const role = req.user ? req.user.role : 'SHIFT_LEADER';
    const isShiftLeader = role === 'SHIFT_LEADER';
    const isAdminLike = role === 'ADMIN' || role === 'SUBADMIN';
    if (!isShiftLeader && !isAdminLike) {
      return sendError(res, `Access denied. Role '${role}' cannot resubmit submissions.`, 403);
    }

    // Only makes sense on a submission Admin bounced back to the Shift Leader
    if (existing.status !== 'RejectedByAdmin') {
      return sendError(res, `Only an Admin-rejected submission can be resubmitted to Admin. Current status: "${existing.status}".`, 409);
    }

    const reviewerName = req.user ? req.user.name : 'SHIFT_LEADER';

    const updated = await withTransaction(async (dbConnection) => {
      const result = await submissionModel.resubmitToAdmin(
        id,
        reviewerName,
        req.user ? req.user.id : 'usr-shiftleader',
        dbConnection
      );

      if (!result) {
        throw Object.assign(new Error('Submission not found.'), { statusCode: 404 });
      }

      await auditModel.createLog({
        userId: req.user ? req.user.id : null,
        userName: reviewerName,
        userRole: role,
        action: 'RESUBMIT_SUBMISSION',
        resource: 'SUBMISSIONS',
        details: { submissionId: id, newStatus: 'PendingAdmin' },
        ipAddress: req.ip,
        dbConnection
      });

      return result;
    });

    logger.info(`Submission ${id} edited & resubmitted to Admin by ${reviewerName} (${role})`);

    const allSubsResult = await submissionModel.getSubmissions({ page: 1, limit: 100 });
    return sendSuccess(res, allSubsResult.submissions, 'Submission resubmitted to Admin for review.');
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, 'Submission not found.', 404);
    }
    logger.error('Error resubmitting submission to admin:', error);
    return sendError(res, 'Failed to resubmit submission.', 500, error);
  }
};

export const updateChecks = async (req, res) => {
  try {
    const { id } = req.params;
    const { checks, proofPhotos = {} } = req.body;

    if (!checks || typeof checks !== 'object') {
      return sendError(res, 'Checks payload is required.', 400);
    }

    const existing = await submissionModel.getSubmissionById(id);
    if (!existing) {
      return sendError(res, 'Submission not found.', 404);
    }

    const role = req.user ? req.user.role : 'SHIFT_LEADER';
    const isShiftLeader = role === 'SHIFT_LEADER';
    const isAdminLike = role === 'ADMIN' || role === 'SUBADMIN';
    if (!isShiftLeader && !isAdminLike) {
      return sendError(res, `Access denied. Role '${role}' cannot edit submission answers.`, 403);
    }

    // Editing is only allowed while it's actionable at the Shift Leader's
    // stage — awaiting their first review, or bounced back by Admin.
    if (!['Pending', 'RejectedByAdmin'].includes(existing.status)) {
      return sendError(res, `This submission can't be edited while it's "${existing.status}".`, 409);
    }

    const reviewerName = req.user ? req.user.name : 'SHIFT_LEADER';
    const updated = await submissionModel.updateChecks(id, checks, proofPhotos, reviewerName);

    logger.info(`Submission ${id} checklist answers edited by ${reviewerName} (${role})`);

    return sendSuccess(res, updated, 'Checklist answers updated successfully.');
  } catch (error) {
    logger.error('Error updating submission checks:', error);
    return sendError(res, 'Failed to update checklist answers.', 500, error);
  }
};

export const deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await submissionModel.softDeleteSubmission(id, req.user ? req.user.name : 'ADMIN');
    if (!success) {
      return sendError(res, 'Submission not found.', 404);
    }

    // Record Audit Log Event
    await auditModel.createLog({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'ADMIN',
      userRole: req.user ? req.user.role : 'ADMIN',
      action: 'DELETE_SUBMISSION',
      resource: 'SUBMISSIONS',
      details: { submissionId: id },
      ipAddress: req.ip
    });

    const allSubsResult = await submissionModel.getSubmissions({ page: 1, limit: 100 });
    return sendSuccess(res, allSubsResult.submissions, 'Submission deleted successfully (Soft Delete)');
  } catch (error) {
    logger.error('Error deleting submission:', error);
    return sendError(res, 'Failed to delete submission.', 500, error);
  }
};

/**
 * Excel Export Controller Endpoint (Requirement #5)
 * Generates an Excel report of checklist records using ExcelJS.
 */
export const exportExcel = async (req, res) => {
  try {
    const { status = 'All', search = '' } = req.query;

    const result = await submissionModel.getSubmissions({
      page: 1,
      limit: 1000,
      search,
      status
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Jabil DigiCheck Engine';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Master Checklist Records');

    // Header Columns
    sheet.columns = [
      { header: 'Submission ID', key: 'id', width: 18 },
      { header: 'Template Title', key: 'templateTitle', width: 35 },
      { header: 'Document Number', key: 'docNumber', width: 25 },
      { header: 'Revision', key: 'revision', width: 10 },
      { header: 'Shift', key: 'shift', width: 12 },
      { header: 'Operator Name', key: 'operatorName', width: 22 },
      { header: 'Operator NTID', key: 'operatorNTID', width: 15 },
      { header: 'Submitted At', key: 'submittedAt', width: 22 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Rejection Remark / Feedback', key: 'rejectionRemark', width: 45 }
    ];

    // Style Header Row
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '00529B' }
    };

    // Populate rows
    result.submissions.forEach(sub => {
      sheet.addRow({
        id: sub.id,
        templateTitle: sub.templateTitle,
        docNumber: sub.docNumber,
        revision: sub.revision,
        shift: sub.shift,
        operatorName: sub.operatorName,
        operatorNTID: sub.operatorNTID,
        submittedAt: sub.submittedAt,
        date: sub.date,
        status: sub.status,
        rejectionRemark: sub.rejectionRemark || 'N/A'
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Jabil_DigiCheck_Report_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Error exporting Excel report:', error);
    return sendError(res, 'Failed to generate Excel report.', 500, error);
  }
};
