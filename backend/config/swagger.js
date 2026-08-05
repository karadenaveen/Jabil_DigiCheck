/**
 * Swagger / OpenAPI Documentation Configuration
 * --------------------------------------------------------------------
 * Configures OpenAPI 3.0 specification for interactive API documentation
 * hosted at `/api-docs` endpoint.
 */

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Jabil DigiCheck Plant Execution API',
    version: '2.4.0',
    description: 'Production-ready RESTful APIs for Jabil DigiCheck digital checksheet execution, user management, audit logging, template blueprints, and approvals.',
    contact: {
      name: 'Naveen-Jabil Inc.',
      email: 'support@jabil.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Local Express Development Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token in `Authorization: Bearer <token>` header.'
      }
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              totalPages: { type: 'integer' }
            }
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['usernameOrNTID', 'password'],
        properties: {
          usernameOrNTID: { type: 'string', example: 'admin' },
          password: { type: 'string', example: 'admin123' }
        }
      },
      SubmissionStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['Approved', 'Rejected'] },
          rejectionRemark: { type: 'string' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          200: { description: 'Service is up' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user and issue JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
        responses: {
          200: { description: 'Current user profile' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (pagination, search, sort)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string' } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } }
        ],
        responses: { 200: { description: 'Users list' } }
      },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        responses: { 201: { description: 'User created' } }
      }
    },
    '/users/toggle-access/{ntid}': {
      patch: {
        tags: ['Users'],
        summary: 'Toggle ALLOWED/DENIED access by NTID',
        parameters: [
          { name: 'ntid', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Access toggled' } }
      }
    },
    '/templates': {
      get: {
        tags: ['Templates'],
        summary: 'List checklist templates',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Templates list' } }
      },
      post: {
        tags: ['Templates'],
        summary: 'Create template blueprint',
        responses: { 201: { description: 'Template created' } }
      }
    },
    '/templates/{id}': {
      delete: {
        tags: ['Templates'],
        summary: 'Soft-delete template',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Template soft-deleted' } }
      }
    },
    '/submissions': {
      get: {
        tags: ['Submissions'],
        summary: 'List submissions with filters',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'shift', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Submissions list' } }
      },
      post: {
        tags: ['Submissions'],
        summary: 'Submit checklist',
        responses: { 201: { description: 'Submission created' } }
      }
    },
    '/submissions/{id}/status': {
      patch: {
        tags: ['Submissions'],
        summary: 'Approve or reject submission',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SubmissionStatusRequest' }
            }
          }
        },
        responses: { 200: { description: 'Status updated' } }
      }
    },
    '/submissions/export/excel': {
      get: {
        tags: ['Submissions'],
        summary: 'Export submissions as Excel (.xlsx)',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'Excel file download',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      }
    },
    '/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get plant metrics and recent activity',
        responses: { 200: { description: 'Dashboard payload' } }
      }
    },
    '/audit-logs': {
      get: {
        tags: ['Audit'],
        summary: 'List security audit logs',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Audit logs' } }
      }
    },
    '/ai/analyze-proof': {
      post: {
        tags: ['AI'],
        summary: 'AI proof-photo analysis placeholder (agentic-ready)',
        responses: { 200: { description: 'Mock AI analysis result' } }
      }
    }
  }
};
