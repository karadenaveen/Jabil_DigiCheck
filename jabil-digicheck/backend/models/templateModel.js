/**
 * Template Data Access Model
 * --------------------------------------------------------------------
 * Manages SQL operations for digital checksheet templates and their normalized
 * row fields. Supports soft deletes (`deleted_at`), pagination, search filters,
 * and multi-sheet blueprint structure construction.
 */

import { pool } from '../config/db.js';

export const templateModel = {
  getTemplates: async ({ page = 1, limit = 50, search = '', status = 'All' }) => {
    let baseSql = `WHERE deleted_at IS NULL`;
    const queryParams = [];

    if (search) {
      baseSql += ` AND (title LIKE ? OR doc_number LIKE ?)`;
      const pattern = `%${search}%`;
      queryParams.push(pattern, pattern);
    }

    if (status !== 'All') {
      baseSql += ` AND status = ?`;
      queryParams.push(status);
    }

    const offset = (page - 1) * limit;
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM templates ${baseSql}`, queryParams);
    const total = countRows[0].total;

    const sql = `
      SELECT id, title, short_title as shortTitle, doc_number as docNumber, revision, 
             category, uploaded_by as uploadedBy, DATE_FORMAT(uploaded_date, '%Y-%m-%d') as uploadedDate,
             status, sheets_count as sheetsCount, cover_page as coverPage, created_at
      FROM templates
      ${baseSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?;
    `;
    queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await pool.query(sql, queryParams);

    // Fetch fields for each template to construct full `sheets` payload
    const templatesWithSheets = await Promise.all(rows.map(async (tmpl) => {
      const cover = typeof tmpl.coverPage === 'string' ? JSON.parse(tmpl.coverPage) : tmpl.coverPage;

      const [fields] = await pool.query(`
        SELECT id, sheet_index, sheet_title, row_no as no, nature, marathi, type, type_marathi as typeMarathi,
               photo_ref as photoRef, method, method_marathi as methodMarathi, when_to_do as \`when\`, proof_required as proofRequired
        FROM template_fields
        WHERE template_id = ? AND deleted_at IS NULL
        ORDER BY sheet_index ASC, row_no ASC;
      `, [tmpl.id]);

      // Group fields by sheet_title
      const sheetsMap = {};
      fields.forEach(f => {
        const sKey = `sheet-${f.sheet_index + 1}`;
        if (!sheetsMap[sKey]) {
          sheetsMap[sKey] = {
            id: sKey,
            title: f.sheet_title,
            rows: []
          };
        }
        sheetsMap[sKey].rows.push({
          id: f.no,
          no: f.no,
          nature: f.nature,
          marathi: f.marathi,
          type: f.type,
          typeMarathi: f.typeMarathi,
          photoRef: f.photoRef,
          method: f.method,
          methodMarathi: f.methodMarathi,
          when: f.when,
          proofRequired: Boolean(f.proofRequired)
        });
      });

      const sheets = Object.values(sheetsMap);

      return {
        ...tmpl,
        coverPage: cover,
        sheets: sheets.length > 0 ? sheets : [
          {
            id: 'sheet-1',
            title: tmpl.title,
            rows: [
              {
                id: 1,
                no: 1,
                nature: 'Clean Machine inside burr & outer surface of machine.',
                marathi: '(YOUR ROW (SHIFT EVERY DAY (हर दिन)))',
                type: 'Cleaning',
                typeMarathi: 'सफाई',
                photoRef: 'cleaning',
                method: 'Inspect visually to verify compliance.',
                methodMarathi: '(देखकर सत्यापित करें)',
                when: 'Every Day (हर दिन)',
                proofRequired: true
              }
            ]
          }
        ]
      };
    }));

    return {
      templates: templatesWithSheets,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit)
    };
  },

  getTemplateById: async (id) => {
    const [rows] = await pool.query(`
      SELECT id, title, short_title as shortTitle, doc_number as docNumber, revision, 
             category, uploaded_by as uploadedBy, DATE_FORMAT(uploaded_date, '%Y-%m-%d') as uploadedDate,
             status, sheets_count as sheetsCount, cover_page as coverPage, created_at
      FROM templates
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1;
    `, [id]);

    if (!rows.length) return null;

    const tmpl = rows[0];
    const cover = typeof tmpl.coverPage === 'string' ? JSON.parse(tmpl.coverPage) : tmpl.coverPage;

    const [fields] = await pool.query(`
      SELECT id, sheet_index, sheet_title, row_no as no, nature, marathi, type, type_marathi as typeMarathi,
             photo_ref as photoRef, method, method_marathi as methodMarathi, when_to_do as \`when\`, proof_required as proofRequired
      FROM template_fields
      WHERE template_id = ? AND deleted_at IS NULL
      ORDER BY sheet_index ASC, row_no ASC;
    `, [id]);

    const sheetsMap = {};
    fields.forEach(f => {
      const sKey = `sheet-${f.sheet_index + 1}`;
      if (!sheetsMap[sKey]) {
        sheetsMap[sKey] = {
          id: sKey,
          title: f.sheet_title,
          rows: []
        };
      }
      sheetsMap[sKey].rows.push({
        id: f.no,
        no: f.no,
        nature: f.nature,
        marathi: f.marathi,
        type: f.type,
        typeMarathi: f.typeMarathi,
        photoRef: f.photoRef,
        method: f.method,
        methodMarathi: f.methodMarathi,
        when: f.when,
        proofRequired: Boolean(f.proofRequired)
      });
    });

    const sheets = Object.values(sheetsMap);

    return {
      ...tmpl,
      coverPage: cover,
      sheets: sheets.length > 0 ? sheets : []
    };
  },

  createTemplate: async (templateData, dbConnection = null) => {
    const executor = dbConnection || pool;
    const id = templateData.id || `tmpl-${Date.now()}`;
    const coverPageJson = JSON.stringify(templateData.coverPage || {});

    const sql = `
      INSERT INTO templates (id, title, short_title, doc_number, revision, category, uploaded_by, uploaded_date, status, sheets_count, cover_page, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await executor.query(sql, [
      id,
      templateData.title,
      templateData.shortTitle || `${templateData.title.substring(0, 45)}...`,
      templateData.docNumber,
      templateData.revision || 'A',
      templateData.category || 'Form',
      templateData.uploadedBy || 'Admin Supervisor',
      templateData.uploadedDate || new Date().toISOString().split('T')[0],
      templateData.status || 'Active',
      templateData.sheets ? templateData.sheets.length : 1,
      coverPageJson,
      templateData.createdBy || 'ADMIN',
      templateData.createdBy || 'ADMIN'
    ]);

    // Insert normalized template fields if provided
    if (templateData.sheets && Array.isArray(templateData.sheets)) {
      for (let sIdx = 0; sIdx < templateData.sheets.length; sIdx++) {
        const sheet = templateData.sheets[sIdx];
        if (sheet.rows && Array.isArray(sheet.rows)) {
          for (let rIdx = 0; rIdx < sheet.rows.length; rIdx++) {
            const row = sheet.rows[rIdx];
            const fieldId = `fld-${id}-${sIdx}-${rIdx + 1}`;
            
            await executor.query(`
              INSERT INTO template_fields (id, template_id, sheet_index, sheet_title, row_no, nature, marathi, type, type_marathi, photo_ref, method, method_marathi, when_to_do, proof_required, created_by, updated_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `, [
              fieldId,
              id,
              sIdx,
              sheet.title || `Sheet ${sIdx + 1}`,
              row.no || rIdx + 1,
              row.nature,
              row.marathi || '(YOUR ROW (SHIFT EVERY DAY (हर दिन)))',
              row.type || 'Inspection',
              row.typeMarathi || 'निरीक्षण',
              row.photoRef || 'cleaning',
              row.method || 'Inspect visually to verify compliance.',
              row.methodMarathi || '(देखकर सत्यापित करें)',
              row.when || 'Every Shift (हर शिफ्ट)',
              row.proofRequired ? 1 : 0,
              templateData.createdBy || 'ADMIN',
              templateData.createdBy || 'ADMIN'
            ]);
          }
        }
      }
    }

    return templateModel.getTemplateById(id);
  },

  // Soft Delete implementation as required in requirement #2
  softDeleteTemplate: async (id, deletedBy = 'ADMIN', dbConnection = null) => {
    const executor = dbConnection || pool;
    const [result] = await executor.query(`
      UPDATE templates SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ? AND deleted_at IS NULL;
    `, [deletedBy, id]);

    if (!result.affectedRows) return false;

    await executor.query(`
      UPDATE template_fields SET deleted_at = CURRENT_TIMESTAMP, updated_by = ? WHERE template_id = ?;
    `, [deletedBy, id]);

    return true;
  }
};
