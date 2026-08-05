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
import { auditModel } from '../models/auditModel.js';
import { notificationModel } from '../models/notificationModel.js';
import { withTransaction } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { buildFilledWorkbookBuffer } from '../utils/excelBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const submissionsUploadDir = path.join(__dirname, '../uploads/submissions');

export const getSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', date = '', status = 'All', shift = '' } = req.query;

    const result = await submissionModel.getSubmissions({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      date,
      status,
      shift
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

    // Execute multi-table insertion inside an atomic MySQL Transaction
    const newSubmission = await withTransaction(async (dbConnection) => {
      const created = await submissionModel.createSubmission({
        ...submissionData,
        userId: req.user ? req.user.id : 'usr-op1',
        operatorName: req.user ? req.user.name : (submissionData.operatorName || 'Dummy Operator'),
        operatorNTID: req.user ? req.user.ntid : (submissionData.operatorNTID || '1234567')
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
    const { status, rejectionRemark = '' } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return sendError(res, 'Status must be either Approved or Rejected.', 400);
    }

    if (status === 'Rejected' && !rejectionRemark.trim()) {
      return sendError(res, 'Please provide a rejection remark detailing the corrective action required.', 400);
    }

    // Execute status update & approval history inside an atomic MySQL Transaction
    const updated = await withTransaction(async (dbConnection) => {
      const result = await submissionModel.updateStatus(
        id,
        status,
        rejectionRemark,
        req.user ? req.user.name : 'ADMIN',
        req.user ? req.user.id : 'usr-admin',
        dbConnection
      );

      if (!result) {
        throw Object.assign(new Error('Submission not found.'), { statusCode: 404 });
      }

      // Record Audit Log Event
      await auditModel.createLog({
        userId: req.user ? req.user.id : null,
        userName: req.user ? req.user.name : 'ADMIN',
        userRole: req.user ? req.user.role : 'ADMIN',
        action: status === 'Approved' ? 'APPROVE_SUBMISSION' : 'REJECT_SUBMISSION',
        resource: 'SUBMISSIONS',
        details: { submissionId: id, status, rejectionRemark },
        ipAddress: req.ip,
        dbConnection
      });

      return result;
    });

    // Notify operator after successful commit
    try {
      await notificationModel.createNotification({
        userId: updated.userId,
        title: status === 'Approved' ? 'Checklist Approved' : 'Checklist Rejected',
        message: status === 'Approved'
          ? `Your submission ${updated.templateTitle} (${updated.shift}) was approved.`
          : `Your submission ${updated.templateTitle} was rejected: ${rejectionRemark}`,
        type: status === 'Approved' ? 'SUCCESS' : 'WARNING',
        createdBy: req.user ? req.user.name : 'ADMIN'
      });
    } catch (notifErr) {
      logger.warn('Notification create skipped:', notifErr.message);
    }

    logger.info(`Submission ${id} status updated to '${status}' by ${req.user ? req.user.name : 'ADMIN'}`);

    const allSubsResult = await submissionModel.getSubmissions({ page: 1, limit: 100 });
    return sendSuccess(res, allSubsResult.submissions, `Submission ${status.toLowerCase()} successfully`);
  } catch (error) {
    if (error.statusCode === 404) {
      return sendError(res, 'Submission not found.', 404);
    }
    logger.error('Error updating submission status:', error);
    return sendError(res, 'Failed to update submission status.', 500, error);
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
