/**
 * Axios HTTP API Client Instance
 * --------------------------------------------------------------------
 * Configures base URL (`http://localhost:5000/api`), headers, and request 
 * interceptors to automatically attach JWT authorization token from `localStorage`.
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT Bearer Token to outgoing headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jabil_digicheck_jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized errors automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on authentication failure
      localStorage.removeItem('jabil_digicheck_jwt_token');
      localStorage.removeItem('jabil_digicheck_current_user');
    }
    return Promise.reject(error);
  }
);
