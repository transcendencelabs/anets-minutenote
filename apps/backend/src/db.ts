// ============================================================================
// MeetScribe Backend Database Connection
// ============================================================================

import { Pool, PoolConfig } from 'pg';
import { logger } from '@meetscribe/logging';

export function createPool(): Pool {
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL ?? 'postgresql://meetscribe:meetscribe@localhost:5432/meetscribe',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  const pool = new Pool(config);

  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err.message });
  });

  return pool;
}

/**
 * Run database migrations for the backend PostgreSQL database.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        token_status TEXT NOT NULL DEFAULT 'invalid',
        access_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash TEXT NOT NULL UNIQUE,
        user_id UUID REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_token_hash ON tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
    `);

    logger.info('Database migrations completed');
  } finally {
    client.release();
  }
}