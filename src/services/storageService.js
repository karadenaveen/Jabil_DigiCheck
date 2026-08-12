/**
 * API Service Layer for Jabil DigiCheck Application
 * --------------------------------------------------------------------
 * Replaces client-side localStorage mock storage with real Express + MySQL REST APIs.
 * Connects all React components using async/await, handling JWT authentication,
 * blueprint templates, checklist submissions, status approvals, and user access.
 */

import { api } from './api';

// Static files (uploaded originals, generated filled .xlsx) are served
// from the backend's root, not under /api.
const FILE_SERVER_ROOT = 'http://localhost:5000';
export const getFileUrl = (relativePath) => (relativePath ? `${FILE_SERVER_ROOT}${relativePath}` : null);

export const storageService = {
  // Initialize and check connection health
  init: async () => {
    try {
      const res = await api.get('/health');
      return res.data;
    } catch (err) {
      console.warn('Backend API connection warning:', err);
      return null;
    }
  },

  // Authenticate user against MySQL backend with JWT token storage
  authenticateUser: async (usernameOrNTID, password) => {
    try {
      const res = await api.post('/auth/login', { usernameOrNTID, password });
      if (res.data && res.data.success) {
        const { user, token } = res.data.data;
        localStorage.setItem('jabil_digicheck_jwt_token', token);
        localStorage.setItem('jabil_digicheck_current_user', JSON.stringify(user));
        return { success: true, user };
      }
      return { success: false, error: res.data.message || 'Login failed' };
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || 'Invalid Username/NTID or Password';
      return { success: false, error: msg };
    }
  },

  // Validate active JWT session user profile
  getCurrentUserAsync: async () => {
    try {
      const token = localStorage.getItem('jabil_digicheck_jwt_token');
      if (!token) return null;
      const res = await api.get('/auth/me');
      if (res.data && res.data.success) {
        const user = res.data.data.user;
        localStorage.setItem('jabil_digicheck_current_user', JSON.stringify(user));
        return user;
      }
      return null;
    } catch {
      return storageService.getCurrentUser();
    }
  },

  getCurrentUser: () => {
    const raw = localStorage.getItem('jabil_digicheck_current_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem('jabil_digicheck_jwt_token');
    localStorage.removeItem('jabil_digicheck_current_user');
    localStorage.removeItem('jabil_digicheck_active_shift');
  },

  // Active Shift UI Session
  getActiveShift: () => {
    return localStorage.getItem('jabil_digicheck_active_shift') || null;
  },

  setActiveShift: (shift) => {
    localStorage.setItem('jabil_digicheck_active_shift', shift);
  },

  // User Management APIs
  getUsers: async (search = '') => {
    try {
      const res = await api.get('/users', { params: { search, limit: 100 } });
      return res.data.data || [];
    } catch (error) {
      console.error('Error fetching users from API:', error);
      return [];
    }
  },

  addUser: async (newUser) => {
    try {
      const res = await api.post('/users', newUser);
      return res.data.data || [];
    } catch (error) {
      console.error('Error adding user via API:', error);
      throw error;
    }
  },

  toggleUserAccess: async (ntid) => {
    try {
      const res = await api.patch(`/users/toggle-access/${ntid}`);
      return res.data.data || [];
    } catch (error) {
      console.error('Error toggling user access via API:', error);
      throw error;
    }
  },

  // Blueprint Template Management APIs
  getTemplates: async (search = '', status = 'All') => {
    try {
      const res = await api.get('/templates', { params: { search, status, limit: 100 } });
      return res.data.data || [];
    } catch (error) {
      console.error('Error fetching templates from API:', error);
      return [];
    }
  },

  saveTemplate: async (newTemplate) => {
    try {
      const res = await api.post('/templates', newTemplate);
      return res.data.data || [];
    } catch (error) {
      console.error('Error saving template via API:', error);
      throw error;
    }
  },

  uploadOriginalExcelFile: async (templateId, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/templates/${templateId}/original-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.data;
    } catch (error) {
      console.error('Error uploading original Excel file:', error);
      throw error;
    }
  },

  updateTemplateGridData: async (templateId, gridData) => {
    try {
      const res = await api.patch(`/templates/${templateId}/grid-data`, { gridData });
      return res.data.data;
    } catch (error) {
      console.error('Error updating template grid data:', error);
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    try {
      const res = await api.delete(`/templates/${id}`);
      return res.data.data || [];
    } catch (error) {
      console.error('Error deleting template via API:', error);
      throw error;
    }
  },

  // Submissions & Approvals APIs
  getSubmissions: async (filters = {}) => {
    try {
      const res = await api.get('/submissions', { params: { ...filters, limit: 100 } });
      return res.data.data || [];
    } catch (error) {
      console.error('Error fetching submissions from API:', error);
      return [];
    }
  },

  saveSubmission: async (submission) => {
    try {
      const res = await api.post('/submissions', submission);
      return res.data.data || [];
    } catch (error) {
      console.error('Error saving submission via API:', error);
      throw error;
    }
  },

  updateSubmissionStatus: async (id, status, rejectionRemark = '') => {
    try {
      const res = await api.patch(`/submissions/${id}/status`, { status, rejectionRemark });
      return res.data.data || [];
    } catch (error) {
      console.error('Error updating submission status via API:', error);
      throw error;
    }
  },

  // Shift Leader edits & resends an Admin-rejected submission back to Admin.
  resubmitSubmissionToAdmin: async (id) => {
    try {
      const res = await api.patch(`/submissions/${id}/resubmit-to-admin`);
      return res.data.data || [];
    } catch (error) {
      console.error('Error resubmitting submission to admin via API:', error);
      throw error;
    }
  },

  // Shift Leader edits row check marks (V/X per station) and proof photos
  // while reviewing, through the same full checklist edit form the
  // Operator uses.
  updateSubmissionChecks: async (id, checks, proofPhotos = {}) => {
    try {
      const res = await api.patch(`/submissions/${id}/checks`, { checks, proofPhotos });
      return res.data.data;
    } catch (error) {
      console.error('Error updating submission checks via API:', error);
      throw error;
    }
  },

  // Assignment & Grouping APIs
  getShiftLeaders: async (search = '') => {
    try {
      const res = await api.get('/assignments/shift-leaders', { params: { search } });
      return res.data.data || [];
    } catch (error) {
      console.error('Error fetching shift leaders:', error);
      return [];
    }
  },

  getSubAdmins: async (search = '') => {
    try {
      const res = await api.get('/assignments/sub-admins', { params: { search } });
      return res.data.data || [];
    } catch (error) {
      console.error('Error fetching sub admins:', error);
      return [];
    }
  },

  getOperators: async (search = '', shiftLeaderId = '') => {
    try {
      const res = await api.get('/assignments/operators', { params: { search, shiftLeaderId } });
      return res.data.data || [];
    } catch (error) {
      console.error('Error fetching operators:', error);
      return [];
    }
  },

  getGroupingTree: async () => {
    try {
      const res = await api.get('/assignments/tree');
      return res.data.data || null;
    } catch (error) {
      console.error('Error fetching grouping tree:', error);
      return null;
    }
  },

  assignOperator: async (operatorId, shiftLeaderId, subAdminId) => {
    try {
      const res = await api.post('/assignments/assign-operator', { operatorId, shiftLeaderId, subAdminId });
      return res.data.data || null;
    } catch (error) {
      console.error('Error assigning operator:', error);
      throw error;
    }
  },

  assignShiftLeader: async (shiftLeaderId, subAdminId) => {
    try {
      const res = await api.post('/assignments/assign-shift-leader', { shiftLeaderId, subAdminId });
      return res.data.data || null;
    } catch (error) {
      console.error('Error assigning shift leader:', error);
      throw error;
    }
  },

  getCapacity: async () => {
    try {
      const res = await api.get('/assignments/capacity');
      return res.data.data || { maxOperatorsPerShiftLeader: 30 };
    } catch (error) {
      console.error('Error fetching capacity:', error);
      return { maxOperatorsPerShiftLeader: 30 };
    }
  },

  updateCapacity: async (maxOperators) => {
    try {
      const res = await api.put('/assignments/capacity', { maxOperators });
      return res.data.data || null;
    } catch (error) {
      console.error('Error updating capacity:', error);
      throw error;
    }
  },

  // Real-Time Dashboard Stats API
  getDashboardStats: async () => {
    try {
      const res = await api.get('/dashboard');
      return res.data.data;
    } catch (error) {
      console.error('Error fetching dashboard stats from API:', error);
      return null;
    }
  },

  // Trigger Excel Export Download
  exportExcel: (status = 'All', search = '') => {
    const token = localStorage.getItem('jabil_digicheck_jwt_token');
    const url = `http://localhost:5000/api/submissions/export/excel?status=${status}&search=${search}`;
    
    // Create hidden anchor to trigger binary download with JWT
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Jabil_DigiCheck_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => console.error('Excel download error:', err));
  }
};
