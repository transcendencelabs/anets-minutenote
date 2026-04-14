// ============================================================================
// MeetScribe Backend Auth Routes (Google OAuth)
// ============================================================================

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '@meetscribe/logging';

export function authRoutes(pool: Pool): Router {
  const router = Router();

  /** GET /api/auth/google/url - Returns Google OAuth authorization URL */
  router.get('/google/url', (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      logger.error('Google OAuth not configured');
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return res.json({ url: authUrl.toString() });
  });

  /** GET /api/auth/google/callback - Handles OAuth callback */
  router.get('/google/callback', async (req: Request, res: Response) => {
    const { code, error } = req.query;

    if (error) {
      logger.error('Google OAuth error', { error: String(error) });
      return res.status(401).json({ error: 'OAuth authorization failed' });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    try {
      // TODO: Exchange code for tokens using Google OAuth API
      logger.info('Google OAuth callback received', { code: code.substring(0, 8) + '...' });
      return res.json({ success: true, message: 'OAuth callback received. Token exchange not yet implemented.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Google OAuth callback error', { error: message });
      return res.status(500).json({ error: 'OAuth callback failed' });
    }
  });

  return router;
}