/**
 * Environment Variables Configuration Module
 * --------------------------------------------------------------------
 * Centralized loader for environment variables with sensible defaults.
 * Provides configuration parameters for server port, JWT authentication,
 * CORS origins, and MySQL database connection credentials.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env regardless of process CWD (supports `npm run server` from repo root)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config(); // fallback to CWD .env if present

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'jabil_digicheck_production_jwt_secret_key_2026_super_secure',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // Database Configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'jabil_digicheck',

  // CORS Allowed Origins
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};
