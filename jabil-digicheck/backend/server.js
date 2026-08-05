/**
 * Main Express Application Server Entrypoint
 * --------------------------------------------------------------------
 * Configures Node.js Express web server, CORS settings, body parsers, Morgan HTTP 
 * request logging, Swagger API documentation UI, REST API route mounts, static file 
 * serving for uploads, global error handling, and MySQL database connection initialization.
 *
 * Runs on: http://localhost:5000
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';

import { ENV } from './config/env.js';
import { initDB } from './config/db.js';
import { swaggerSpec } from './config/swagger.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import Route Handlers
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. CORS Configuration (Requirement #14)
app.use(cors({
  origin: [ENV.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Request Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 3. HTTP Request Logging using Morgan + Winston (Requirement #8)
const morganStream = {
  write: (message) => logger.info(message.trim())
};
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

// 4. Static Uploads Folder Serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. Interactive Swagger API Documentation (Requirement #7)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    system: 'Jabil DigiCheck Backend Platform',
    timestamp: new Date().toISOString()
  });
});

// 6. Mount REST API Routes (Requirement #20)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/audit-logs', auditRoutes);

// 7. 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route [${req.method} ${req.originalUrl}] not found.`
  });
});

// 8. Centralized Global Error Handler (Requirement #11)
app.use(errorHandler);

// 9. Initialize MySQL Database & Start Express Server (Requirements #26 & #27)
const PORT = ENV.PORT || 5000;

const startServer = async () => {
  try {
    await initDB();
    app.listen(PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`JABIL DIGICHECK BACKEND SERVER STARTED SUCCESSFULLY`);
      logger.info(`Server URL: http://localhost:${PORT}`);
      logger.info(`Swagger API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`Health Endpoint: http://localhost:${PORT}/api/health`);
      logger.info(`=======================================================`);
    });
  } catch (error) {
    logger.error('Fatal: Unable to start server due to database initialization failure.', error);
    process.exit(1);
  }
};

startServer();

export default app;
