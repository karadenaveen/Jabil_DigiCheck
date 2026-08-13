/**
 * Submission & Approvals Data Access Model
 * --------------------------------------------------------------------
 * Handles SQL operations for operator checklist submissions, normalized item responses,
 * QA supervisor approval history, dashboard statistics, soft deletes, and Excel exports.
 */

import { pool } from '../config/db.js';

export const submissionModel = {
  getSubmissions: async ({ page = 1, limit = 50, search = '', date = '', status = 'All', shift = '', scope = null }) => {
    let baseSql = `WHERE s.deleted_at IS NULL`;
    const queryParams = [];

    // Role-scoped filtering: restrict which submissions each role sees.
    // scope = { role, userId } — operators see only their own, shift leaders
    // see their assigned operators' submissions, sub admins see their
    // assigned shift leaders' submissions, admin/subadmin-admin see all.
    if (scope) {
      if (scope.role === 'OPERATOR') {
        baseSql += ` AND s.user_id = ?`;
        queryParams.push(scope.userId);
      } else if (scope.role === 'SHIFT_LEADER') {
        baseSql += ` AND s.shift_leader_id = ?`;
        queryParams.push(scope.userId);
      } else if (scope.role === 'SUBADMIN') {
        baseSql += ` AND s.sub_admin_id = ?`;
        queryParams.push(scope.userId);
      }
    }

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
             s.shift_leader_id as shiftLeaderId, s.sub_admin_id as subAdminId,
             s.sub_admin_name as subAdminName,
             s.submitted_at as submittedAt, DATE_FORMAT(s.date, '%Y-%m-%d') as date,
             s.status, s.rejection_remark as rejectionRemark, s.reviewed_at as reviewedAt,
             s.shift_leader_name as shiftLeaderName, s.shift_leader_reviewed_at as shiftLeaderReviewedAt,
             s.shift_leader_resubmitted_at as shiftLeaderResubmittedAt,
             s.sub_admin_reviewed_at as subAdminReviewedAt, s.sub_admin_reviewed_by as subAdminReviewedBy,
             s.final_approved_at as finalApprovedAt,
             s.resubmission_count as resubmissionCount, s.last_resubmitted_at as lastResubmittedAt,
             s.operator_resubmitted_at as operatorResubmittedAt,
             s.grid_answers as gridAnswers, s.filled_excel_path as filledExcelPath, s.created_at as createdAt
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
        proofPhotos,
        gridAnswers: (() => {
          try { return sub.gridAnswers ? JSON.parse(sub.gridAnswers) : null; }
          catch { return null; }
        })()
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
             s.shift_leader_id as shiftLeaderId, s.sub_admin_id as subAdminId,
             s.sub_admin_name as subAdminName,
             s.submitted_at as submittedAt, DATE_FORMAT(s.date, '%Y-%m-%d') as date,
             s.status, s.rejection_remark as rejectionRemark, s.reviewed_at as reviewedAt,
             s.shift_leader_name as shiftLeaderName, s.shift_leader_reviewed_at as shiftLeaderReviewedAt,
             s.shift_leader_resubmitted_at as shiftLeaderResubmittedAt,
             s.sub_admin_reviewed_at as subAdminReviewedAt, s.sub_admin_reviewed_by as subAdminReviewedBy,
             s.final_approved_at as finalApprovedAt,
             s.resubmission_count as resubmissionCount, s.last_resubmitted_at as lastResubmittedAt,
             s.operator_resubmitted_at as operatorResubmittedAt,
             s.grid_answers as gridAnswers, s.filled_excel_path as filledExcelPath, s.created_at as createdAt
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

    let parsedGridAnswers = null;
    try {
      parsedGridAnswers = sub.gridAnswers ? JSON.parse(sub.gridAnswers) : null;
    } catch {
      parsedGridAnswers = null;
    }

    return { ...sub, checks, proofPhotos, gridAnswers: parsedGridAnswers };
  },

  createSubmission: async (submissionData, dbConnection = null) => {
    const executor = dbConnection || pool;
    const id = submissionData.id || `sub-${Date.now()}`;
    const submittedAt = submissionData.submittedAt || new Date().toLocaleString();
    const dateStr = submissionData.date || new Date().toISOString().split('T')[0];
    const gridAnswersJson = submissionData.gridAnswers ? JSON.stringify(submissionData.gridAnswers) : null;

    const sql = `
      INSERT INTO submissions (id, template_id, template_title, doc_number, revision, shift, user_id, operator_name, operator_ntid,
                               shift_leader_id, sub_admin_id, sub_admin_name,
                               submitted_at, date, status, rejection_remark, grid_answers, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', ?, ?, ?);
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
      submissionData.shiftLeaderId || null,
      submissionData.subAdminId || null,
      submissionData.subAdminName || null,
      submittedAt,
      dateStr,
      gridAnswersJson,
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

  updateStatus: async (id, status, rejectionRemark = '', reviewerName = 'ADMIN', reviewerId = 'usr-admin', dbConnection = null, extra = {}) => {
    const executor = dbConnection || pool;
    const reviewedAt = new Date().toLocaleString();
    const isRejection = status.startsWith('Rejected');

    // When a Shift Leader approves a submission forward to Admin
    // (status becomes 'PendingAdmin'), remember their name/time separately
    // so the Admin's queue can still show who reviewed it at stage 1 even
    // after Admin's own decision overwrites reviewed_by/reviewed_at.
    const shiftLeaderName = extra.shiftLeaderName ?? null;
    const shiftLeaderReviewedAt = extra.shiftLeaderName ? reviewedAt : null;
    const finalApprovedAt = status === 'Approved' ? reviewedAt : null;
    const subAdminReviewedAt = extra.subAdminReviewedAt ?? null;
    const subAdminReviewedBy = extra.subAdminReviewedBy ?? null;

    let sql, params;
    if (shiftLeaderName) {
      sql = `UPDATE submissions
             SET status = ?, rejection_remark = ?, reviewed_at = ?, reviewed_by = ?,
                 shift_leader_name = ?, shift_leader_reviewed_at = ?,
                 updated_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND deleted_at IS NULL;`;
      params = [status, isRejection ? rejectionRemark : '', reviewedAt, reviewerName, shiftLeaderName, shiftLeaderReviewedAt, reviewerName, id];
    } else if (subAdminReviewedAt) {
      sql = `UPDATE submissions
             SET status = ?, rejection_remark = ?, reviewed_at = ?, reviewed_by = ?,
                 sub_admin_reviewed_at = ?, sub_admin_reviewed_by = ?,
                 final_approved_at = ?,
                 updated_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND deleted_at IS NULL;`;
      params = [status, isRejection ? rejectionRemark : '', reviewedAt, reviewerName, subAdminReviewedAt, subAdminReviewedBy, finalApprovedAt, reviewerName, id];
    } else {
      sql = `UPDATE submissions
             SET status = ?, rejection_remark = ?, reviewed_at = ?, reviewed_by = ?,
                 final_approved_at = ?,
                 updated_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND deleted_at IS NULL;`;
      params = [status, isRejection ? rejectionRemark : '', reviewedAt, reviewerName, finalApprovedAt, reviewerName, id];
    }

    const [result] = await executor.query(sql, params);

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
      isRejection ? 'REJECTED' : 'APPROVED',
      rejectionRemark || null,
      reviewerName,
      reviewerName
    ]);

    return submissionModel.getSubmissionById(id);
  },

  // Shift Leader edits & resends an Admin-rejected submission — same
  // record, status goes back to 'PendingAdmin' for a fresh Admin decision.
  resubmitToAdmin: async (id, reviewerName = 'SHIFT_LEADER', reviewerId = 'usr-shiftleader', dbConnection = null) => {
    const executor = dbConnection || pool;
    const reviewedAt = new Date().toLocaleString();

    const [result] = await executor.query(`
      UPDATE submissions
      SET status = 'PendingAdmin', rejection_remark = '', reviewed_at = ?, reviewed_by = ?,
          shift_leader_name = ?, shift_leader_reviewed_at = ?,
          shift_leader_resubmitted_at = ?,
          resubmission_count = resubmission_count + 1, last_resubmitted_at = ?,
          updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL;
    `, [reviewedAt, reviewerName, reviewerName, reviewedAt, reviewedAt, reviewedAt, reviewerName, id]);

    if (!result.affectedRows) return null;

    const historyId = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await executor.query(`
      INSERT INTO approval_history (id, submission_id, reviewer_id, action, remark, created_by, updated_by)
      VALUES (?, ?, ?, 'RESUBMITTED', ?, ?, ?);
    `, [historyId, id, reviewerId || 'usr-shiftleader', 'Edited and resubmitted to Admin for review.', reviewerName, reviewerName]);

    return submissionModel.getSubmissionById(id);
  },

  // Operator edits & resends a Shift-Leader-rejected submission back to
  // Shift Leader for a fresh review. Same record, no new row — just
  // flips status back to 'Pending', bumps the resubmission counter, and
  // stamps the operator resubmission timestamp.
  resubmitToShiftLeader: async (id, operatorName = 'OPERATOR', operatorId = 'usr-op1', dbConnection = null) => {
    const executor = dbConnection || pool;
    const reviewedAt = new Date().toLocaleString();

    const [result] = await executor.query(`
      UPDATE submissions
      SET status = 'Pending', rejection_remark = '',
          resubmission_count = resubmission_count + 1,
          last_resubmitted_at = ?, operator_resubmitted_at = ?,
          updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL;
    `, [reviewedAt, reviewedAt, operatorName, id]);

    if (!result.affectedRows) return null;

    const historyId = `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await executor.query(`
      INSERT INTO approval_history (id, submission_id, reviewer_id, action, remark, created_by, updated_by)
      VALUES (?, ?, ?, 'RESUBMITTED', ?, ?, ?);
    `, [historyId, id, operatorId || 'usr-op1', 'Operator edited and resubmitted to Shift Leader.', operatorName, operatorName]);

    return submissionModel.getSubmissionById(id);
  },

  // Shift Leader edits row check marks (V/X per station) and/or proof
  // photos while the submission is at their stage ('Pending' or
  // 'RejectedByAdmin'), through the same full checklist edit form the
  // Operator uses.
  updateChecks: async (id, checks, proofPhotos = {}, updatedBy = 'SHIFT_LEADER', dbConnection = null) => {
    const executor = dbConnection || pool;
    const rowIds = Object.keys(checks || {});

    for (const rId of rowIds) {
      const stationObj = checks[rId] || {};
      const photoUrl = proofPhotos ? proofPhotos[rId] : undefined;

      if (photoUrl !== undefined) {
        await executor.query(`
          UPDATE submission_answers
          SET station_1 = ?, station_2 = ?, station_3 = ?, station_4 = ?,
              proof_photo_url = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE submission_id = ? AND row_no = ? AND deleted_at IS NULL;
        `, [
          stationObj[1] || 'V',
          stationObj[2] || 'V',
          stationObj[3] || 'V',
          stationObj[4] || 'V',
          photoUrl || null,
          updatedBy,
          id,
          parseInt(rId, 10)
        ]);
      } else {
        await executor.query(`
          UPDATE submission_answers
          SET station_1 = ?, station_2 = ?, station_3 = ?, station_4 = ?,
              updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE submission_id = ? AND row_no = ? AND deleted_at IS NULL;
        `, [
          stationObj[1] || 'V',
          stationObj[2] || 'V',
          stationObj[3] || 'V',
          stationObj[4] || 'V',
          updatedBy,
          id,
          parseInt(rId, 10)
        ]);
      }
    }

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
        SUM(CASE WHEN status IN ('Pending', 'PendingAdmin') THEN 1 ELSE 0 END) as pendingForms,
        SUM(CASE WHEN status IN ('Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin') THEN 1 ELSE 0 END) as rejectedForms
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
  },

  /**
   * Real submission trend series, bucketed three ways so the dashboard's
   * Day / Month / Year filter can switch client-side without refetching.
   * Every bucket is derived directly from `submissions.date` — no synthetic data.
   */
  getTrendSeries: async () => {
    const [dayRows] = await pool.query(`
      SELECT DATE_FORMAT(s.date, '%b %d') as name, s.date as sortKey,
        COUNT(*) as submissions,
        SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN s.status IN ('Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin') THEN 1 ELSE 0 END) as rejected
      FROM submissions s
      WHERE s.deleted_at IS NULL AND s.date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY s.date
      ORDER BY s.date ASC;
    `);

    const [monthRows] = await pool.query(`
      SELECT DATE_FORMAT(s.date, '%b %Y') as name, DATE_FORMAT(s.date, '%Y-%m') as sortKey,
        COUNT(*) as submissions,
        SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN s.status IN ('Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin') THEN 1 ELSE 0 END) as rejected
      FROM submissions s
      WHERE s.deleted_at IS NULL AND s.date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
      GROUP BY DATE_FORMAT(s.date, '%Y-%m')
      ORDER BY sortKey ASC;
    `);

    const [yearRows] = await pool.query(`
      SELECT DATE_FORMAT(s.date, '%Y') as name, DATE_FORMAT(s.date, '%Y') as sortKey,
        COUNT(*) as submissions,
        SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN s.status IN ('Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin') THEN 1 ELSE 0 END) as rejected
      FROM submissions s
      WHERE s.deleted_at IS NULL
      GROUP BY DATE_FORMAT(s.date, '%Y')
      ORDER BY sortKey ASC;
    `);

    const clean = (rows) => rows.map(r => ({
      name: r.name,
      submissions: parseInt(r.submissions, 10),
      approved: parseInt(r.approved, 10),
      rejected: parseInt(r.rejected, 10)
    }));

    return {
      Day: clean(dayRows),
      Month: clean(monthRows),
      Year: clean(yearRows)
    };
  },

  /**
   * Top performing operators ranked by submission volume & approval rate.
   * Purely derived from existing submissions rows.
   */
  getTopPerformers: async (limit = 5) => {
    const [rows] = await pool.query(`
      SELECT s.operator_name as operatorName, s.operator_ntid as operatorNTID,
        COUNT(*) as totalSubmissions,
        SUM(CASE WHEN s.status = 'Approved' THEN 1 ELSE 0 END) as approvedCount,
        SUM(CASE WHEN s.status IN ('Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin') THEN 1 ELSE 0 END) as rejectedCount
      FROM submissions s
      WHERE s.deleted_at IS NULL
      GROUP BY s.operator_name, s.operator_ntid
      ORDER BY totalSubmissions DESC
      LIMIT ?;
    `, [parseInt(limit, 10)]);

    return rows.map(r => {
      const total = parseInt(r.totalSubmissions, 10);
      const approved = parseInt(r.approvedCount, 10);
      const rejected = parseInt(r.rejectedCount, 10);
      const decided = approved + rejected;
      return {
        operatorName: r.operatorName,
        operatorNTID: r.operatorNTID,
        totalSubmissions: total,
        approvedCount: approved,
        rejectedCount: rejected,
        approvalRate: decided > 0 ? Number(((approved / decided) * 100).toFixed(1)) : null
      };
    });
  },

  /**
   * Most recent submissions that include at least one uploaded proof photo.
   */
  getLatestUploads: async (limit = 6) => {
    const [rows] = await pool.query(`
      SELECT s.id, s.template_title as templateTitle, s.operator_name as operatorName,
        s.status, s.submitted_at as submittedAt, s.created_at as createdAt,
        COUNT(a.id) as photoCount,
        MIN(a.proof_photo_url) as sampleProofUrl
      FROM submissions s
      INNER JOIN submission_answers a
        ON a.submission_id = s.id AND a.deleted_at IS NULL AND a.proof_photo_url IS NOT NULL
      WHERE s.deleted_at IS NULL
      GROUP BY s.id, s.template_title, s.operator_name, s.status, s.submitted_at, s.created_at
      ORDER BY s.created_at DESC
      LIMIT ?;
    `, [parseInt(limit, 10)]);

    return rows.map(r => ({
      id: r.id,
      templateTitle: r.templateTitle,
      operatorName: r.operatorName,
      status: r.status,
      submittedAt: r.submittedAt,
      photoCount: parseInt(r.photoCount, 10),
      sampleProofUrl: r.sampleProofUrl
    }));
  },

  setFilledExcelPath: async (id, filePath, dbConnection = null) => {
    const executor = dbConnection || pool;
    await executor.query(`
      UPDATE submissions SET filled_excel_path = ? WHERE id = ?;
    `, [filePath, id]);
  }
};
