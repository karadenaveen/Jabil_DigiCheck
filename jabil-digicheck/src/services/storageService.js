/**
 * API Service Layer for Jabil DigiCheck Application
 * --------------------------------------------------------------------
 * Replaces client-side localStorage mock storage with real Express + MySQL REST APIs.
 * Connects all React components using async/await, handling JWT authentication,
 * blueprint templates, checklist submissions, status approvals, and user access.
 */

import { api } from './api';

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
