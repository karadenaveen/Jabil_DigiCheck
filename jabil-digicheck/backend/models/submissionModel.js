/**
 * Submission & Approvals Data Access Model
 * --------------------------------------------------------------------
 * Handles SQL operations for operator checklist submissions, normalized item responses,
 * QA supervisor approval history, dashboard statistics, soft deletes, and Excel exports.
 */

import { pool } from '../config/db.js';

export const submissionModel = {
  getSubmissions: async ({ page = 1, limit = 50, search = '', date = '', status = 'All', shift = '' }) => {
    let baseSql = `WHERE s.deleted_at IS NULL`;
    const queryParams = [];

    if (search) {
      baseSql += ` AND (s.template_title LIKE ? OR s.operator_name LIKE ? OR s.doc_number LIKE ? OR s.operator_ntid LIKE ?)`;
      const pattern = `%${search}%`;
      queryParams.push(pattern, pattern, pattern, pattern);
    }

    if (date) {
      baseSql += ` AND s.date = ?`;
      queryParams.push(date);
    }

    if (status && status !== 'All') {
      baseSql += ` AND s.status = ?`;
      queryParams.push(status);
    }

    if (shift) {
      baseSql += ` AND s.shift = ?`;
      queryParams.push(shift);
    }

    const offset = (page - 1) * limit;
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM submissions s ${baseSql}`, queryParams);
    const total = countRows[0].total;

    const sql = `
      SELECT s.id, s.template_id as templateId, s.template_title as templateTitle,
             s.doc_number as docNumber, s.revision, s.shift, s.user_id as userId,
             s.operator_name as operatorName, s.operator_ntid as operatorNTID,
             s.submitted_at as submittedAt, DATE_FORMAT(s.date, '%Y-%m-%d') as date,
             s.status, s.rejection_remark as rejectionRemark, s.reviewed_at as reviewedAt,
             s.created_at as createdAt
      FROM submissions s
      ${baseSql}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?;
    `;
    queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await pool.query(sql, queryParams);

    // Fetch normalized answers for each submission to construct `checks` and `proofPhotos`
    const submissionsWithDetails = await Promise.all(rows.map(async (sub) => {
      const [answers] = await pool.query(`
        SELECT row_no, station_1, station_2, station_3, station_4, proof_photo_url
        FROM submission_answers
        WHERE submission_id = ? AND deleted_at IS NULL;
      `, [sub.id]);

      const checks = {};
      const proofPhotos = {};

      answers.forEach(a => {
        checks[a.row_no] = {
          1: a.station_1,
          2: a.station_2,
          3: a.station_3,
          4: a.station_4
        };
        if (a.proof_photo_url) {
          proofPhotos[a.row_no] = a.proof_photo_url;
        }
      });

      return {
        ...sub,
        checks,
        proofPhotos
      };
    }));

    return {
      submissions: submissionsWithDetails,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit)
    };
  },

  getSubmissionById: async (id) => {
    const [rows] = await pool.query(`
      SELECT s.id, s.template_id as templateId, s.template_title as templateTitle,
             s.doc_number as docNumber, s.revision, s.shift, s.user_id as userId,
             s.operator_name as operatorName, s.operator_ntid as operatorNTID,
             s.submitted_at as submittedAt, DATE_FORMAT(s.date, '%Y-%m-%d') as date,
             s.status, s.rejection_remark as rejectionRemark, s.reviewed_at as reviewedAt,
             s.created_at as createdAt
      FROM submissions s
      WHERE s.id = ? AND s.deleted_at IS NULL
      LIMIT 1;
    `, [id]);

    if (!rows.length) return null;

    const sub = rows[0];
    const [answers] = await pool.query(`
      SELECT row_no, station_1, station_2, station_3, station_4, proof_photo_url
      FROM submission_answers
      WHERE submission_id = ? AND deleted_at IS NULL;
    `, [id]);

    const checks = {};
    const proofPhotos = {};
    answers.forEach(a => {
      checks[a.row_no] = {
        1: a.station_1,
        2: a.station_2,
        3: a.station_3,
        4: a.station_4
      };
      if (a.proof_photo_url) {
        proofPhotos[a.row_no] = a.proof_photo_url;
      }
    });

    return { ...sub, checks, proofPhotos };
  },

  createSubmission: async (submissionData, dbConnection = null) => {
    const executor = dbConnection || pool;
    const id = submissionData.id || `sub-${Date.now()}`;
    const submittedAt = submissionData.submittedAt || new Date().toLocaleString();
    const dateStr = submissionData.date || new Date().toISOString().split('T')[0];

    const sql = `
      INSERT INTO submissions (id, template_id, template_title, doc_number, revision, shift, user_id, operator_name, operator_ntid, submitted_at, date, status, rejection_remark, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', ?, ?);
    `;

    await executor.query(sql, [
      id,
      submissionData.templateId,
      submissionData.templateTitle,
      submissionData.docNumber,
      submissionData.revision || 'A',
      submissionData.shift || 'Shift A',
      submissionData.userId || 'usr-op1',
      submissionData.operatorName,
      submissionData.operatorNTID,
      submittedAt,
      dateStr,
      submissionData.operatorName,
      submissionData.operatorName
    ]);

    // Insert normalized answers if provided
    if (submissionData.checks && typeof submissionData.checks === 'object') {
      const rowIds = Object.keys(submissionData.checks);
      for (const rId of rowIds) {
        const stationObj = submissionData.checks[rId] || {};
        const proofUrl = submissionData.proofPhotos?.[rId] || null;
        const ansId = `ans-${id}-${rId}`;

        await executor.query(`
          INSERT INTO submission_answers (id, submission_id, row_no, station_1, station_2, station_3, station_4, proof_photo_url, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          ansId,
          id,
          parseInt(rId, 10),
          stationObj[1] || 'V',
          stationObj[2] || 'V',
          stationObj[3] || 'V',
          stationObj[4] || 'V',
          proofUrl,
          submissionData.operatorName,
          submissionData.operatorName
        ]);
      }
    }

    // Return constructed payload (avoid pool read mid-transaction)
    return {
      id,
      templateId: submissionData.templateId,
      templateTitle: submissionData.templateTitle,
      docNumber: submissionData.docNumber,
      revision: submissionData.revision || 'A',
      shift: submissionData.shift || 'Shift A',
      userId: submissionData.userId || 'usr-op1',
      operatorName: submissionData.operatorName,
      operatorNTID: submissionData.operatorNTID,
      submittedAt,
      date: dateStr,
      status: 'Pending',
      rejectionRemark: '',
      checks: submissionData.checks || {},
      proofPhotos: submissionData.proofPhotos || {}
    };
  },

  updateStatus: async (id, status, rejectionRemark = '', reviewerName = 'ADMIN', reviewerId = 'usr-admin', dbConnection = null) => {
    const executor = dbConnection || pool;
    const reviewedAt = new Date().toLocaleString();

    const [result] = await executor.query(`
      UPDATE submissions
      SET status = ?, rejection_remark = ?, reviewed_at = ?, reviewed_by = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL;
    `, [
      status,
      status === 'Rejected' ? rejectionRemark : '',
      reviewedAt,
      reviewerName,
      reviewerName,
      id
    ]);

    if (!result.affectedRows) {
      return null;
    }

    const historyId = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await executor.query(`
      INSERT INTO approval_history (id, submission_id, reviewer_id, action, remark, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [
      historyId,
      id,
      reviewerId || 'usr-admin',
      status === 'Approved' ? 'APPROVED' : 'REJECTED',
      rejectionRemark || null,
      reviewerName,
      reviewerName
    ]);

    return submissionModel.getSubmissionById(id);
  },

  // Soft delete method as required in requirement #2
  softDeleteSubmission: async (id, deletedBy = 'ADMIN', dbConnection = null) => {
    const executor = dbConnection || pool;
    const [result] = await executor.query(`
      UPDATE submissions SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ? AND deleted_at IS NULL;
    `, [deletedBy, id]);

    if (!result.affectedRows) return false;

    await executor.query(`
      UPDATE submission_answers SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE submission_id = ?;
    `, [deletedBy, id]);

    return true;
  },

  getDashboardMetrics: async () => {
    const [counts] = await pool.query(`
      SELECT 
        COUNT(*) as totalRecords,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as completedForms,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pendingForms,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejectedForms
      FROM submissions
      WHERE deleted_at IS NULL;
    `);

    const stats = counts[0];
    const total = parseInt(stats.totalRecords || 0, 10);
    const completed = parseInt(stats.completedForms || 0, 10);
    const pending = parseInt(stats.pendingForms || 0, 10);
    const rejected = parseInt(stats.rejectedForms || 0, 10);
    const decided = completed + rejected;

    return {
      totalRecords: total,
      completedForms: completed,
      pendingForms: pending,
      rejectedForms: rejected,
      uploadSuccessRate: decided > 0 ? Number(((completed / decided) * 100).toFixed(1)) : 100
    };
  }
};
