import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase } from './config/database';
import { initializeEmailService } from './services/emailService';
import { errorHandler } from './middleware/auth';
import authRoutes from './routes/auth';
import visionRoutes from './routes/visionRoutes';

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vision', visionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized');

    // Initialize email service
    await initializeEmailService();

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

startServer();

export default app;
