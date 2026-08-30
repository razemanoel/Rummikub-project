import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { initializeDatabase, closeDatabase } from './config/database';
import { errorHandler } from './middleware/auth';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/auth';
import visionRoutes from './routes/visionRoutes';
import solverRoutes from './routes/solverRoutes';
import solutionHistoryRoutes from './routes/solutionHistoryRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
const corsOptions = corsOrigin === '*' 
  ? { origin: true, credentials: true }
  : { 
      origin: corsOrigin.split(',').map(o => o.trim()),
      credentials: true,
    };
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API documentation (Swagger UI + raw OpenAPI JSON)
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Rummikub API Gateway Docs',
  })
);
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/solver', solverRoutes);
app.use('/api/solutions', solutionHistoryRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT);
  } catch (error) {
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

startServer();

export default app;
