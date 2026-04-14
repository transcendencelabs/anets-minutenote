// ============================================================================
// MeetScribe Backend Health Routes
// ============================================================================

import { Router } from 'express';

export const healthRoutes = Router();

healthRoutes.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'meetscribe-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/ready', (_req, res) => {
  // TODO: Add database connectivity check
  res.json({ ready: true });
});