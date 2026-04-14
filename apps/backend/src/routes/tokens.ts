// ============================================================================
// MeetScribe Backend Token Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '@meetscribe/logging';
import { createHash, randomBytes } from 'crypto';

export function tokenRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/tokens/activate
   * Validate an issued access token and activate the user.
   */
  router.post('/activate', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, error: 'Token is required' });
      }

      const tokenHash = hashToken(token);

      const result = await pool.query(
        'SELECT id, user_id, status, expires_at FROM tokens WHERE token_hash = $1',
        [tokenHash]
      );

      if (result.rows.length === 0) {
        logger.info('Token activation failed: token not found', { tokenHash: tokenHash.substring(0, 8) + '...' });
        return res.status(401).json({ valid: false, error: 'Invalid token' });
      }

      const tokenRecord = result.rows[0];

      if (tokenRecord.status === 'revoked') {
        logger.info('Token activation failed: token revoked', { tokenId: tokenRecord.id });
        return res.status(401).json({ valid: false, error: 'Token has been revoked' });
      }

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        logger.info('Token activation failed: token expired', { tokenId: tokenRecord.id });
        return res.status(401).json({ valid: false, error: 'Token has expired' });
      }

      // Get user info
      const userResult = await pool.query(
        'SELECT id, email, token_status FROM users WHERE id = $1',
        [tokenRecord.user_id]
      );

      if (userResult.rows.length === 0) {
        logger.error('Token activation failed: user not found', { userId: tokenRecord.user_id });
        return res.status(401).json({ valid: false, error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Update user token status
      await pool.query(
        "UPDATE users SET token_status = 'active', updated_at = NOW() WHERE id = $1",
        [user.id]
      );

      // Mark token as used
      await pool.query(
        "UPDATE tokens SET status = 'used' WHERE id = $1",
        [tokenRecord.id]
      );

      logger.info('Token activated successfully', { userId: user.id });

      return res.json({
        valid: true,
        userId: user.id,
        email: user.email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Token activation error', { error: message });
      return res.status(500).json({ valid: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/tokens/validate
   * Check if a token is valid without activating it.
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, error: 'Token is required' });
      }

      const tokenHash = hashToken(token);

      const result = await pool.query(
        'SELECT status, expires_at FROM tokens WHERE token_hash = $1',
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return res.json({ valid: false });
      }

      const tokenRecord = result.rows[0];

      if (tokenRecord.status === 'revoked') {
        return res.json({ valid: false, reason: 'revoked' });
      }

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        return res.json({ valid: false, reason: 'expired' });
      }

      return res.json({ valid: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Token validation error', { error: message });
      return res.status(500).json({ valid: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/tokens/issue
   * Issue a new token for a user (admin endpoint, should be protected in production).
   * TODO: Add proper authentication/authorization for this endpoint.
   */
  router.post('/issue', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Create or get user
      let userId: string;
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
      } else {
        const insertResult = await pool.query(
          "INSERT INTO users (email, token_status) VALUES ($1, 'pending') RETURNING id",
          [email]
        );
        userId = insertResult.rows[0].id;
      }

      // Generate token
      const token = generateToken();
      const tokenHash = hashToken(token);

      // Store token hash
      await pool.query(
        "INSERT INTO tokens (token_hash, user_id, status) VALUES ($1, $2, 'active')",
        [tokenHash, userId]
      );

      logger.info('Token issued', { userId });

      return res.json({ token, userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Token issue error', { error: message });
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}