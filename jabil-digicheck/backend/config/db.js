/**
 * MySQL Database Connection & Auto-Initialization Module
 * --------------------------------------------------------------------
 * Configures `mysql2/promise` pool connection for non-blocking async queries.
 * Provides transactional helpers and automatically initializes normalized database 
 * tables and pre-seeded default users with bcrypt hashed passwords upon startup.
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

// Initial pool configuration (connecting without database first to ensure DB exists)
const rootPool = mysql.createPool({
  host: ENV.DB_HOST,
  port: ENV.DB_PORT,
  user: ENV.DB_USER,
  password: ENV.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Primary connection pool with target database
export const pool = mysql.createPool({
  host: ENV.DB_HOST,
  port: ENV.DB_PORT,
  user: ENV.DB_USER,
  password: ENV.DB_PASSWORD,
  database: ENV.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Execute a callback function within an isolated MySQL Transaction.
 */
export const withTransaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('MySQL Transaction Rolled Back:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Automatically initializes database schema and seeds initial data.
 */
export const initDB = async () => {
  try {
    // 1. Ensure Target Database Exists
    await rootPool.query(`CREATE DATABASE IF NOT EXISTS \`${ENV.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    logger.info(`MySQL Database verified: ${ENV.DB_NAME}`);

    // 2. Ensure Roles Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`roles\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(50) NOT NULL UNIQUE,
        \`description\` VARCHAR(255) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Ensure Users Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`role_id\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`ntid\` VARCHAR(50) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('ADMIN', 'OPERATOR') NOT NULL DEFAULT 'OPERATOR',
        \`status\` ENUM('ALLOWED', 'DENIED') NOT NULL DEFAULT 'ALLOWED',
        \`avatar\` VARCHAR(10) DEFAULT 'OP',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Ensure Machines Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`machines\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`code\` VARCHAR(100) NOT NULL UNIQUE,
        \`line_name\` VARCHAR(100) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Active',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Ensure Templates Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`templates\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`short_title\` VARCHAR(255) DEFAULT NULL,
        \`doc_number\` VARCHAR(100) NOT NULL,
        \`revision\` VARCHAR(20) DEFAULT 'A',
        \`category\` VARCHAR(50) DEFAULT 'Form',
        \`uploaded_by\` VARCHAR(255) DEFAULT NULL,
        \`uploaded_date\` DATE DEFAULT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Active',
        \`sheets_count\` INT DEFAULT 1,
        \`cover_page\` JSON DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Ensure Template Fields Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`template_fields\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`template_id\` VARCHAR(50) NOT NULL,
        \`sheet_index\` INT NOT NULL DEFAULT 0,
        \`sheet_title\` VARCHAR(255) NOT NULL,
        \`row_no\` INT NOT NULL,
        \`nature\` TEXT NOT NULL,
        \`marathi\` VARCHAR(255) DEFAULT NULL,
        \`type\` VARCHAR(100) NOT NULL,
        \`type_marathi\` VARCHAR(100) DEFAULT NULL,
        \`photo_ref\` VARCHAR(100) DEFAULT 'cleaning',
        \`method\` TEXT DEFAULT NULL,
        \`method_marathi\` VARCHAR(255) DEFAULT NULL,
        \`when_to_do\` VARCHAR(100) DEFAULT 'Every Shift',
        \`proof_required\` TINYINT(1) DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Ensure Submissions Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`submissions\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`template_id\` VARCHAR(50) NOT NULL,
        \`machine_id\` VARCHAR(50) DEFAULT NULL,
        \`template_title\` VARCHAR(255) NOT NULL,
        \`doc_number\` VARCHAR(100) NOT NULL,
        \`revision\` VARCHAR(20) DEFAULT 'A',
        \`shift\` VARCHAR(50) NOT NULL,
        \`user_id\` VARCHAR(50) NOT NULL,
        \`operator_name\` VARCHAR(255) NOT NULL,
        \`operator_ntid\` VARCHAR(50) NOT NULL,
        \`submitted_at\` VARCHAR(100) NOT NULL,
        \`date\` DATE NOT NULL,
        \`status\` ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
        \`rejection_remark\` TEXT DEFAULT NULL,
        \`reviewed_at\` VARCHAR(100) DEFAULT NULL,
        \`reviewed_by\` VARCHAR(50) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Ensure Submission Answers Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`submission_answers\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`submission_id\` VARCHAR(50) NOT NULL,
        \`field_id\` VARCHAR(50) DEFAULT NULL,
        \`row_no\` INT NOT NULL,
        \`station_1\` VARCHAR(10) DEFAULT 'V',
        \`station_2\` VARCHAR(10) DEFAULT 'V',
        \`station_3\` VARCHAR(10) DEFAULT 'V',
        \`station_4\` VARCHAR(10) DEFAULT 'V',
        \`proof_photo_url\` LONGTEXT DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Ensure Attachments Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`attachments\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`submission_id\` VARCHAR(50) DEFAULT NULL,
        \`template_id\` VARCHAR(50) DEFAULT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_path\` VARCHAR(500) NOT NULL,
        \`file_type\` VARCHAR(100) NOT NULL,
        \`file_size\` INT NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Ensure Approval History Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`approval_history\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`submission_id\` VARCHAR(50) NOT NULL,
        \`reviewer_id\` VARCHAR(50) NOT NULL,
        \`action\` ENUM('APPROVED', 'REJECTED') NOT NULL,
        \`remark\` TEXT DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Ensure Notifications Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`user_id\` VARCHAR(50) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`type\` VARCHAR(50) DEFAULT 'INFO',
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Ensure Settings Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`setting_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`setting_value\` TEXT NOT NULL,
        \`description\` VARCHAR(255) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. Ensure Audit Logs Table Exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`user_id\` VARCHAR(50) DEFAULT NULL,
        \`user_name\` VARCHAR(255) DEFAULT NULL,
        \`user_role\` VARCHAR(50) DEFAULT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`resource\` VARCHAR(100) DEFAULT NULL,
        \`details\` JSON DEFAULT NULL,
        \`ip_address\` VARCHAR(50) DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`updated_by\` VARCHAR(50) DEFAULT 'SYSTEM',
        \`deleted_at\` DATETIME DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. Seed Roles if empty
    const [roles] = await pool.query('SELECT COUNT(*) as count FROM roles');
    if (roles[0].count === 0) {
      await pool.query(`
        INSERT INTO roles (id, name, description) VALUES 
        ('role-admin', 'ADMIN', 'System Administrator'),
        ('role-operator', 'OPERATOR', 'Plant Line Operator');
      `);
    }

    // 15. Seed Users if empty
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
      const adminPassHash = await bcrypt.hash('admin123', 10);
      const opPassHash = await bcrypt.hash('operator123', 10);
      const defaultPassHash = await bcrypt.hash('password123', 10);

      await pool.query(`
        INSERT INTO users (id, role_id, name, username, ntid, password, role, status, avatar, created_at) VALUES 
        ('usr-admin', 'role-admin', 'Admin Supervisor', 'admin', '1000001', ?, 'ADMIN', 'ALLOWED', 'AD', '2026-01-10'),
        ('usr-op1', 'role-operator', 'Dummy Operator', 'operator', '1234567', ?, 'OPERATOR', 'ALLOWED', 'DU', '2026-02-15'),
        ('usr-op2', 'role-operator', 'Rahul More', 'rahul.m', '9876543', ?, 'OPERATOR', 'ALLOWED', 'RM', '2026-03-01'),
        ('usr-op3', 'role-operator', 'Sunil Pawar', 'sunil.p', '5551234', ?, 'OPERATOR', 'DENIED', 'SP', '2026-04-12');
      `, [adminPassHash, opPassHash, defaultPassHash, defaultPassHash]);

      logger.info('Database pre-seeded with initial users and hashed passwords.');
    }

    // 16. Seed Machines if empty
    const [machineCount] = await pool.query('SELECT COUNT(*) as count FROM machines');
    if (machineCount[0].count === 0) {
      await pool.query(`
        INSERT INTO machines (id, name, code, line_name, status) VALUES
        ('mch-f28-cnc-01', 'F28 CAP CNC Station 1', 'F28-CNC-01', 'Line F28', 'Active'),
        ('mch-f28-cnc-02', 'F28 CAP CNC Station 2', 'F28-CNC-02', 'Line F28', 'Active'),
        ('mch-f28-cnc-03', 'F28 CAP CNC Station 3', 'F28-CNC-03', 'Line F28', 'Active'),
        ('mch-f28-cnc-04', 'F28 CAP CNC Station 4', 'F28-CNC-04', 'Line F28', 'Active');
      `);
      logger.info('Database pre-seeded with plant machines.');
    }

    // 17. Seed Settings if empty
    const [settingsCount] = await pool.query('SELECT COUNT(*) as count FROM settings');
    if (settingsCount[0].count === 0) {
      await pool.query(`
        INSERT INTO settings (id, setting_key, setting_value, description) VALUES
        ('set-plant-name', 'plant_name', 'Jabil Pune - F28 Assembly', 'Plant display name'),
        ('set-shift-a', 'shift_a_hours', '06:00-14:00', 'Shift A working hours'),
        ('set-shift-b', 'shift_b_hours', '14:00-22:00', 'Shift B working hours'),
        ('set-shift-c', 'shift_c_hours', '22:00-06:00', 'Shift C working hours'),
        ('set-proof-req', 'proof_photo_required', 'true', 'Require proof photos on checklist items marked proof_required');
      `);
      logger.info('Database pre-seeded with system settings.');
    }

    // 18. Seed Templates if empty
    const [tmplCount] = await pool.query('SELECT COUNT(*) as count FROM templates');
    if (tmplCount[0].count === 0) {
      const coverPage = JSON.stringify({
        docTitle: 'Checklist',
        docNumber: '43-ME80-F28-ASLY-00002',
        revision: 'B',
        category: 'Form',
        originator: 'Dummy Operator',
        date: '2026-05-19',
        revisionHistory: [
          { rev: 'B', changeDetails: 'New Document', originator: 'Dummy Operator', date: '2026-05-19' },
          { rev: 'A', changeDetails: 'Initial Release', originator: 'Process Engg', date: '2025-11-10' }
        ],
        purpose: 'Required Document for Daily Production Record for Checklist.',
        scope: 'This document is used for Maintaining Daily Production Record for lines/operations of Checklist.',
        references: [{ docNumber: '43-ME80-F28-ASLY-00002', docTitle: 'Checklist' }]
      });

      await pool.query(`
        INSERT INTO templates (id, title, short_title, doc_number, revision, category, uploaded_by, uploaded_date, status, sheets_count, cover_page)
        VALUES ('tmpl-clirt-f28', 'CLIRT Checksheet F28 CAP CNC', 'C,L,I,RT( Cleaning ,Lubrication ,Inspection & Re-Tightening ) Check...', '43-ME80-F28-ASLY-00002', 'B', 'Form', 'Admin Supervisor', '2026-05-19', 'Active', 1, ?);
      `, [coverPage]);

      // Seed Template Fields for F28 Blueprint
      const fields = [
        ['fld-1', 'tmpl-clirt-f28', 0, 'CLIRT Checksheet F28 CAP CNC', 1, 'Clean Machine inside burr & outer surface of machine.', '(YOUR ROW (SHIFT EVERY DAY (हर दिन)))', 'Cleaning', 'सफाई', 'cleaning', 'Inspect visually to verify compliance.', '(देखकर सत्यापित करें)', 'Every Day (हर दिन)', 1],
        ['fld-2', 'tmpl-clirt-f28', 0, 'CLIRT Checksheet F28 CAP CNC', 2, 'Check mist air pipe properly set on cutter flute.', '(YOUR ROW (SHIFT EVERY SHIFT (हर शिफ्ट)))', 'Inspection', 'निरीक्षण', 'pipe', 'Inspect visually to verify compliance.', '(देखकर सत्यापित करें)', 'Every Shift (हर शिफ्ट)', 1],
        ['fld-3', 'tmpl-clirt-f28', 0, 'CLIRT Checksheet F28 CAP CNC', 3, 'Check abnormal noise in machine in running condition', '(YOUR ROW (SHIFT EVERY SHIFT (हर शिफ्ट)))', 'Inspection', 'निरीक्षण', 'ear', 'NA', 'NA', 'Every Shift (हर शिफ्ट)', 0],
        ['fld-4', 'tmpl-clirt-f28', 0, 'CLIRT Checksheet F28 CAP CNC', 4, 'Check working of safety front door interlock', '(YOUR ROW (SHIFT EVERY SHIFT (हर शिफ्ट)))', 'Inspection', 'निरीक्षण', 'door', 'Inspect visually to verify compliance.', '(देखकर सत्यापित करें)', 'Every Shift (हर शिफ्ट)', 1],
        ['fld-5', 'tmpl-clirt-f28', 0, 'CLIRT Checksheet F28 CAP CNC', 5, 'Check hydraulic oil pressure gauge and top up oil if below minimum mark', '(YOUR ROW (SHIFT EVERY DAY (हर दिन)))', 'Lubrication', 'स्नेहन', 'oil', 'Verify pressure reads between 40-50 PSI', '(प्रेशर गेज चेक करें)', 'Every Day (हर दिन)', 1],
        ['fld-6', 'tmpl-clirt-f28', 0, 'CLIRT Checksheet F28 CAP CNC', 6, 'Re-tighten fixture mounting bolts and clamp air fittings', '(YOUR ROW (SHIFT EVERY WEEK (हर सप्ताह)))', 'Re-Tightening', 'पुनः कसना', 'wrench', 'Torque wrench check at specified 35 Nm', '(टॉर्क रिंच से कसें)', 'Weekly (हर सप्ताह)', 0]
      ];

      for (const f of fields) {
        await pool.query(`
          INSERT INTO template_fields (id, template_id, sheet_index, sheet_title, row_no, nature, marathi, type, type_marathi, photo_ref, method, method_marathi, when_to_do, proof_required)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, f);
      }

      logger.info('Database pre-seeded with initial blueprint templates & fields.');
    }

    // 19. Seed Submissions if empty
    const [subCount] = await pool.query('SELECT COUNT(*) as count FROM submissions');
    if (subCount[0].count === 0) {
      const seedSubmissions = [
        {
          id: 'sub-1001',
          templateId: 'tmpl-clirt-f28',
          title: 'CLIRT Checksheet F28 CAP CNC',
          docNumber: '43-ME80-F28-ASLY-00002',
          revision: 'B',
          shift: 'Shift A',
          userId: 'usr-op1',
          operatorName: 'Dummy Operator',
          operatorNTID: '1234567',
          submittedAt: '2026-05-19 08:30 AM',
          date: '2026-05-19',
          status: 'Pending',
          remark: '',
          answers: [
            { row: 1, s1: 'V', s2: 'V', s3: 'V', s4: 'V', photo: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&auto=format&fit=crop&q=80' },
            { row: 2, s1: 'V', s2: 'V', s3: 'V', s4: 'V', photo: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=200&auto=format&fit=crop&q=80' },
            { row: 3, s1: 'V', s2: 'V', s3: 'V', s4: 'V', photo: null },
            { row: 4, s1: 'V', s2: 'V', s3: 'V', s4: 'X', photo: null }
          ]
        },
        {
          id: 'sub-1000',
          templateId: 'tmpl-clirt-f28',
          title: 'CLIRT Checksheet F28 CAP CNC',
          docNumber: '43-ME80-F28-ASLY-00002',
          revision: 'B',
          shift: 'Shift B',
          userId: 'usr-op2',
          operatorName: 'Rahul More',
          operatorNTID: '9876543',
          submittedAt: '2026-05-18 04:15 PM',
          date: '2026-05-18',
          status: 'Approved',
          remark: '',
          answers: [
            { row: 1, s1: 'V', s2: 'V', s3: 'V', s4: 'V', photo: null },
            { row: 2, s1: 'V', s2: 'V', s3: 'V', s4: 'V', photo: null }
          ]
        },
        {
          id: 'sub-0999',
          templateId: 'tmpl-clirt-f28',
          title: 'CLIRT Checksheet F28 CAP CNC',
          docNumber: '43-ME80-F28-ASLY-00002',
          revision: 'B',
          shift: 'Shift C',
          userId: 'usr-op1',
          operatorName: 'Dummy Operator',
          operatorNTID: '1234567',
          submittedAt: '2026-05-17 11:45 PM',
          date: '2026-05-17',
          status: 'Rejected',
          remark: 'Missing required proof photo for Item 2 (mist air pipe verification). Please upload clear photo and resubmit.',
          answers: [
            { row: 1, s1: 'V', s2: 'X', s3: 'V', s4: 'V', photo: null }
          ]
        }
      ];

      for (const s of seedSubmissions) {
        await pool.query(`
          INSERT INTO submissions (id, template_id, template_title, doc_number, revision, shift, user_id, operator_name, operator_ntid, submitted_at, date, status, rejection_remark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [s.id, s.templateId, s.title, s.docNumber, s.revision, s.shift, s.userId, s.operatorName, s.operatorNTID, s.submittedAt, s.date, s.status, s.remark]);

        for (const a of s.answers) {
          await pool.query(`
            INSERT INTO submission_answers (id, submission_id, row_no, station_1, station_2, station_3, station_4, proof_photo_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
          `, [`ans-${s.id}-${a.row}`, s.id, a.row, a.s1, a.s2, a.s3, a.s4, a.photo]);
        }
      }

      logger.info('Database pre-seeded with initial checklist submissions.');
    }

    logger.info('MySQL schema initialization complete (12 normalized tables).');
  } catch (error) {
    const detail = error.code || error.errno || error.message;
    logger.error(`Failed to initialize MySQL Database schema (${detail}). Ensure MySQL is running and backend/.env credentials are correct.`, error);
    throw error;
  }
};
