/**
 * Template Blueprints Controller
 * --------------------------------------------------------------------
 * Manages operations for checklist blueprint templates and multi-sheet row tables.
 * Supports soft deletes (`deleted_at`), pagination, status filtering, and audit trail logs.
 */

import { templateModel } from '../models/templateModel.js';
import { auditModel } from '../models/auditModel.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const getTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = 'All' } = req.query;

    const result = await templateModel.getTemplates({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      status
    });

    return sendSuccess(res, result.templates, 'Templates fetched successfully', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    return sendError(res, 'Failed to fetch checklist blueprint templates.', 500, error);
  }
};

export const createTemplate = async (req, res) => {
  try {
    const templateData = req.body;

    if (!templateData.title || !templateData.docNumber) {
      return sendError(res, 'Template Title and Document Number are required fields.', 400);
    }

    const newTemplate = await templateModel.createTemplate({
      ...templateData,
      createdBy: req.user ? req.user.name : 'ADMIN'
    });

    // Record Audit Log Event
    await auditModel.createLog({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'ADMIN',
      userRole: req.user ? req.user.role : 'ADMIN',
      action: 'CREATE_TEMPLATE',
      resource: 'TEMPLATES',
      details: { templateId: newTemplate.id, title: newTemplate.title, docNumber: newTemplate.docNumber },
      ipAddress: req.ip
    });

    logger.info(`Blueprint template created: ${newTemplate.title} (${newTemplate.docNumber})`);

    const allTemplatesResult = await templateModel.getTemplates({ page: 1, limit: 100 });
    return sendSuccess(res, allTemplatesResult.templates, 'Blueprint template created successfully', 201);
  } catch (error) {
    logger.error('Error creating template:', error);
    return sendError(res, 'Failed to save blueprint template.', 500, error);
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await templateModel.softDeleteTemplate(id, req.user ? req.user.name : 'ADMIN');
    if (!success) {
      return sendError(res, 'Blueprint template not found.', 404);
    }

    // Record Audit Log Event
    await auditModel.createLog({
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'ADMIN',
      userRole: req.user ? req.user.role : 'ADMIN',
      action: 'DELETE_TEMPLATE',
      resource: 'TEMPLATES',
      details: { templateId: id },
      ipAddress: req.ip
    });

    logger.info(`Blueprint template deleted (soft delete): ${id}`);

    const allTemplatesResult = await templateModel.getTemplates({ page: 1, limit: 100 });
    return sendSuccess(res, allTemplatesResult.templates, 'Blueprint template deleted successfully (Soft Delete)');
  } catch (error) {
    logger.error('Error deleting template:', error);
    return sendError(res, 'Failed to delete template blueprint.', 500, error);
  }
};

/**
 * Stores the exact original .xlsx file the admin uploaded, on disk, and
 * links it to the template record — a real file, not just parsed JSON.
 */
export const uploadOriginalFile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return sendError(res, 'No file was uploaded.', 400);
    }

    const relativePath = `/uploads/${req.file.filename}`;
    const updated = await templateModel.setOriginalFilePath(id, relativePath);

    if (!updated) {
      return sendError(res, 'Template not found.', 404);
    }

    logger.info(`Original Excel file stored for template ${id}: ${relativePath}`);
    return sendSuccess(res, updated, 'Original Excel file saved successfully');
  } catch (error) {
    logger.error('Error saving original Excel file:', error);
    return sendError(res, 'Failed to save the original Excel file.', 500, error);
  }
};

/**
 * Updates a template's stored gridData — used when an admin manually adds
 * an image (or otherwise edits the extracted grid) after upload.
 */
export const updateGridData = async (req, res) => {
  try {
    const { id } = req.params;
    const { gridData } = req.body;

    if (!gridData || !Array.isArray(gridData.sheets)) {
      return sendError(res, 'Valid gridData with a sheets array is required.', 400);
    }

    const updated = await templateModel.updateGridData(id, gridData);
    if (!updated) {
      return sendError(res, 'Template not found.', 404);
    }

    logger.info(`Grid data updated for template ${id}`);
    return sendSuccess(res, updated, 'Grid data updated successfully');
  } catch (error) {
    logger.error('Error updating grid data:', error);
    return sendError(res, 'Failed to update grid data.', 500, error);
  }
};
