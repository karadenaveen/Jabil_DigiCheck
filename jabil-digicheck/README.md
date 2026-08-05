# Jabil DigiCheck - Industrial Digital Checksheet Execution Platform

> **Full-Stack Production System**  
> Built with **React 19 + Vite** (Frontend) and **Node.js + Express + MySQL** (Backend).

---

## 🌟 Overview & Architecture

**Jabil DigiCheck** is an industrial-grade digital checklist execution and plant quality management system. It digitizes physical paper checksheets for plant line operations, CNC machines, lubrication routines, and safety interlock inspections.

### Key Production Features Included
- **Zero UI Redesign**: Preserves 100% of existing React UI layout, Tailwind styling, and workflow components.
- **Node.js + Express Backend**: Clean modular backend divided into `config`, `controllers`, `routes`, `middleware`, `models`, and `uploads`.
- **MySQL Normalized Database**: 12 normalized tables (`roles`, `users`, `machines`, `templates`, `template_fields`, `submissions`, `submission_answers`, `attachments`, `approval_history`, `notifications`, `settings`, `audit_logs`).
- **Audit Metadata Columns**: All database tables include `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- **Soft Delete Support**: Database records use `deleted_at` timestamps instead of destructive hard deletes.
- **Security Audit Logs**: Comprehensive security audit trail recording all user events (`LOGIN`, `SUBMIT_CHECKLIST`, `APPROVE_SUBMISSION`, `REJECT_SUBMISSION`, `CREATE_TEMPLATE`, `DELETE_TEMPLATE`, `TOGGLE_USER_ACCESS`, `CREATE_USER`).
- **JWT & Bcrypt Security**: JSON Web Token authentication with bcrypt password hashing (`admin123`, `operator123`, `password123`).
- **MySQL Transactions**: Isolated multi-table transactions (`withTransaction`) for checklist submissions and QA status approvals.
- **Request Validation**: `express-validator` middleware enforcing strict payload rules on all incoming REST API requests.
- **Winston & Morgan Logging**: Structured application logging writing to console and persistent log files (`backend/logs/combined.log` & `backend/logs/error.log`).
- **Interactive Swagger Documentation**: OpenAPI 3.0 specs rendered at `http://localhost:5000/api-docs`.
- **Excel Report Exports**: Built-in Excel generation (`ExcelJS`) for exporting master checklist archives.
- **AI & Agentic Module Placeholder**: Modular backend structure (`/api/ai`) ready for agentic visual inspection and automated quality auditing.

---

## 🚀 Port & Environment Setup

The application is configured to run on standard development ports:
- **Frontend (Vite UI)**: `http://localhost:5173`
- **Backend (Express API)**: `http://localhost:5000`
- **Swagger API Specs**: `http://localhost:5000/api-docs`

---

## 🛠️ Step-by-Step Installation & Launch Guide

### 1. Database Setup (MySQL)
Ensure your local MySQL service is running on port `3306`.
```bash
# Optional: Manually import schema if desired (The backend automatically auto-creates database & tables on startup)
mysql -u root -p < schema.sql
```

### 2. Configure Environment Variables
Verify `.env` configuration in `backend/.env`:
```env
PORT=5000
NODE_ENV=development

JWT_SECRET=jabil_digicheck_production_jwt_secret_key_2026_super_secure
JWT_EXPIRES_IN=24h

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=jabil_digicheck

FRONTEND_URL=http://localhost:5173
```

### 3. Install Node.js Dependencies
```bash
npm install
```

### 4. Start the Express Backend Server
```bash
npm run server
```
*The server will connect to MySQL, create the `jabil_digicheck` database if missing, construct normalized tables, and pre-seed initial users with bcrypt hashed passwords.*

### 5. Start the Vite Frontend Client
In a separate terminal window:
```bash
npm run dev
```

---

## 🔑 Pre-seeded Login Credentials

| Role | Username | NTID | Password | Access Status |
|---|---|---|---|---|
| **Admin Supervisor** | `admin` | `1000001` | `admin123` | ALLOWED |
| **Operator** | `operator` | `1234567` | `operator123` | ALLOWED |
| **Operator (Rahul M)** | `rahul.m` | `9876543` | `password123` | ALLOWED |
| **Restricted NTID** | `sunil.p` | `5551234` | `password123` | DENIED (Demo Access Control) |

---

## 📡 REST API Endpoint Reference

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/health` | Backend health check | Public |
| `POST` | `/api/auth/login` | Authenticate user & return JWT token | Public |
| `GET` | `/api/auth/me` | Validate active JWT user session | Authenticated |
| `GET` | `/api/users` | List system users (Pagination & Search) | Authenticated |
| `POST` | `/api/users` | Create new operator (bcrypt password hash) | Admin |
| `PATCH` | `/api/users/toggle-access/:ntid` | Grant or Deny NTID login permission | Admin |
| `DELETE` | `/api/users/:id` | Soft delete user account | Admin |
| `GET` | `/api/templates` | List blueprint templates & sheets | Authenticated |
| `POST` | `/api/templates` | Save newly parsed Excel blueprint | Admin |
| `DELETE` | `/api/templates/:id` | Soft delete template blueprint | Admin |
| `GET` | `/api/submissions` | List checklist submissions (Filters & Search) | Authenticated |
| `POST` | `/api/submissions` | Submit operator checklist (MySQL Transaction) | Authenticated |
| `PATCH` | `/api/submissions/:id/status` | Approve or Reject submission (With Remark) | Admin |
| `GET` | `/api/submissions/export/excel` | Export master checklist archive to Excel | Authenticated |
| `DELETE` | `/api/submissions/:id` | Soft delete submission | Admin |
| `GET` | `/api/dashboard` | Compile real-time metrics & activity feed | Authenticated |
| `GET` | `/api/audit-logs` | Retrieve security audit trail logs | Admin |
| `POST` | `/api/ai/analyze-proof` | Agentic AI visual inspection audit | Authenticated |

---

## 📂 Project Directory Structure

```
jabil-digicheck/
├── backend/
│   ├── config/
│   │   ├── db.js             # MySQL pool, transactions & auto-seeder
│   │   ├── env.js            # Environment variables loader
│   │   └── swagger.js        # Swagger OpenAPI 3.0 specification
│   ├── controllers/
│   │   ├── aiController.js         # Agentic AI quality audit module
│   │   ├── auditController.js      # Audit logs controller
│   │   ├── authController.js       # Login & JWT auth controller
│   │   ├── dashboardController.js  # Dashboard metrics controller
│   │   ├── submissionController.js # Submissions & Excel export
│   │   ├── templateController.js   # Blueprints controller
│   │   └── userController.js       # User access controller
│   ├── middleware/
│   │   ├── authMiddleware.js       # JWT token verification
│   │   ├── errorHandler.js         # Centralized error handler
│   │   ├── roleMiddleware.js         # Role-based access control
│   │   ├── uploadMiddleware.js       # Multer file uploader
│   │   └── validationMiddleware.js   # Express-validator rules
│   ├── models/
│   │   ├── auditModel.js
│   │   ├── machineModel.js
│   │   ├── notificationModel.js
│   │   ├── submissionModel.js
│   │   ├── templateModel.js
│   │   └── userModel.js
│   ├── routes/
│   │   ├── aiRoutes.js
│   │   ├── auditRoutes.js
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── submissionRoutes.js
│   │   ├── templateRoutes.js
│   │   └── userRoutes.js
│   ├── uploads/               # Uploaded images & documents
│   ├── logs/                  # Winston application log files
│   ├── .env                   # Environment credentials
│   └── server.js              # Main Express application entrypoint
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── ApprovalsPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── RecordsPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   └── TemplatesPage.jsx
│   │   ├── operator/
│   │   │   ├── ChecklistFillView.jsx
│   │   │   └── MyChecklistsPage.jsx
│   │   ├── shared/
│   │   │   └── CoverPageModal.jsx
│   │   ├── Header.jsx
│   │   └── LoginPage.jsx
│   ├── services/
│   │   ├── api.js             # Axios client with JWT interceptor
│   │   └── storageService.js  # Bridge service connecting React UI to REST APIs
│   ├── App.jsx
│   └── main.jsx
├── schema.sql                 # Standalone MySQL Database Schema
├── README.md                  # System Documentation
└── package.json
```

---
*Developed for Naveen-Jabil Inc. 2026 • DigiCheck Plant Execution Platform*
