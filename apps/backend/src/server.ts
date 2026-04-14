// ============================================================================
// MeetScribe Backend Server
// ============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from '@meetscribe/logging';
import { APP_CONSTANTS } from '@meetscribe/shared';
import { tokenRoutes } from './routes/tokens';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { createPool } from './db';

dotenv.config();

const PORT = parseInt(process.env.PORT ?? String(APP_CONSTANTS.DEFAULT_BACKEND_PORT), 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',');

async function main(): Promise<void> {
  logger.info('MeetScribe Backend starting...', { port: PORT });

  // Initialize database pool
  const pool = createPool();

  // Test database connection
  try {
    const client = await pool.connect();
    logger.info('Database connection established');
    client.release();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to connect to database', { error: message });
    logger.warn('Continuing without database - some features will not work');
  }

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json());

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/tokens', tokenRoutes(pool));
  app.use('/api/auth', authRoutes(pool));

  // Error handling middleware
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start server
  app.listen(PORT, () => {
    logger.info(`MeetScribe Backend listening on port ${PORT}`);
  });
}

main().catch((error) => {
  logger.error('Fatal error starting server', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});