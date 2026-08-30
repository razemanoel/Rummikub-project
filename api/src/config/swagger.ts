import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

/**
 * OpenAPI (Swagger) definition for the Rummikub Node/Express API gateway.
 *
 * This gateway sits in front of two other services:
 *   - MongoDB (users, solutions, vision feedback)
 *   - the Python/FastAPI Vision & Solver service (documented separately,
 *     on its own port, via FastAPI's built-in Swagger UI at /docs)
 *
 * Route-level documentation lives next to each route/controller as
 * `@swagger` JSDoc blocks — see src/routes/*.ts. This file only defines
 * the shared OpenAPI skeleton: info, servers, security scheme and the
 * reusable component schemas referenced from those blocks.
 */

const PORT = process.env.PORT || 3000;

const swaggerDefinition: swaggerJSDoc.SwaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Rummikub API Gateway',
    version: '1.0.0',
    description:
      'REST API gateway for the Rummikub Solver app. Handles authentication, ' +
      'forwards board/rack photos to the Python vision service, requests ' +
      'solutions from the ILP solver, and stores solution history.\n\n' +
      'The Python vision/solver service has its own interactive docs at ' +
      '`/docs` on its own port (default `:8000`).',
    contact: {
      name: 'Rummikub Solver',
    },
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Local (docker-compose)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT returned from /api/auth/login or /api/auth/signup. ' +
          'Send it as `Authorization: Bearer <token>`.',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Request completed successfully' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Something went wrong' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65f1c2a4e6b3f2a1d8c9b123' },
          email: { type: 'string', format: 'email', example: 'player@example.com' },
          username: { type: 'string', nullable: true, example: 'player1' },
        },
      },
      SignupRequest: {
        type: 'object',
        required: ['email', 'password', 'confirmPassword'],
        properties: {
          email: { type: 'string', format: 'email', example: 'player@example.com' },
          password: { type: 'string', format: 'password', minLength: 6, example: 'sup3rSecret' },
          confirmPassword: { type: 'string', format: 'password', example: 'sup3rSecret' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'player@example.com' },
          password: { type: 'string', format: 'password', example: 'sup3rSecret' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Login successful' },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
              user: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
      Tile: {
        type: 'object',
        description: 'A single Rummikub tile. A joker has value/color null.',
        properties: {
          value: { type: 'integer', nullable: true, minimum: 1, maximum: 13, example: 7 },
          color: {
            type: 'string',
            nullable: true,
            enum: ['red', 'blue', 'black', 'yellow', null],
            example: 'blue',
          },
          is_joker: { type: 'boolean', example: false },
        },
      },
      BoundingBox: {
        type: 'object',
        properties: {
          x: { type: 'number', example: 120.5 },
          y: { type: 'number', example: 45.2 },
          width: { type: 'number', example: 38.0 },
          height: { type: 'number', example: 52.0 },
        },
      },
      Detection: {
        type: 'object',
        properties: {
          index: { type: 'integer', example: 0 },
          source: { type: 'string', enum: ['rack', 'board'], example: 'rack' },
          tile: { $ref: '#/components/schemas/Tile' },
          originalPrediction: { $ref: '#/components/schemas/Tile' },
          confidence: { type: 'number', format: 'float', example: 0.97 },
          bbox: { $ref: '#/components/schemas/BoundingBox' },
        },
      },
      VisionAnalyzeResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Images analyzed successfully' },
          rackDetections: {
            type: 'array',
            items: { $ref: '#/components/schemas/Detection' },
          },
          boardDetections: {
            type: 'array',
            items: { $ref: '#/components/schemas/Detection' },
          },
          gameState: {
            type: 'object',
            description: 'Reconstructed rack + board sets, ready for /api/solver/solve.',
          },
          validation: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success', 'error'] },
              invalid_sets: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      GameState: {
        type: 'object',
        description:
          'Full game state: the current rack plus the board sets, as produced ' +
          'by /api/vision/analyze and consumed by /api/solver/solve and /api/solver/validate.',
        properties: {
          rack: {
            type: 'array',
            items: { $ref: '#/components/schemas/Tile' },
          },
          board: {
            type: 'array',
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/Tile' },
              description: 'One board set (a run or a group).',
            },
          },
        },
      },
      SolveResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Solution calculated successfully' },
          data: {
            type: 'object',
            description:
              'ILP solver output: the rearranged board, which rack tiles were ' +
              'played, and how many tiles were used.',
          },
        },
      },
      SolutionRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65f1c2a4e6b3f2a1d8c9b456' },
          userId: { type: 'string', example: '65f1c2a4e6b3f2a1d8c9b123' },
          originalGameState: { $ref: '#/components/schemas/GameState' },
          solution: { type: 'object' },
          tilesUsedCount: { type: 'integer', example: 4 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  // Pick up @swagger blocks from every route file, wherever the app runs
  // from (ts-node in dev against src/, compiled JS in dist/ in prod).
  apis: [
    path.join(__dirname, '..', 'routes', '*.ts'),
    path.join(__dirname, '..', 'routes', '*.js'),
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
