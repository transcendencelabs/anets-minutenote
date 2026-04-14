// ============================================================================
// MeetScribe Database Migrations
// ============================================================================

import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          token_status TEXT NOT NULL DEFAULT 'invalid',
          access_token TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS calendar_connections (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          provider TEXT NOT NULL DEFAULT 'google',
          oauth_status TEXT NOT NULL DEFAULT 'disconnected',
          refresh_token_ref TEXT,
          scopes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS meeting_preferences (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          calendar_event_id TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          override_folder_path TEXT,
          last_status TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(user_id, calendar_event_id)
        );

        CREATE TABLE IF NOT EXISTS meeting_runs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          calendar_event_id TEXT NOT NULL,
          started_at TEXT,
          ended_at TEXT,
          provider TEXT NOT NULL DEFAULT 'unknown',
          status TEXT NOT NULL DEFAULT 'scheduled',
          failure_reason TEXT,
          transcript_path_txt TEXT,
          transcript_path_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transcript_segments (
          id TEXT PRIMARY KEY,
          meeting_run_id TEXT NOT NULL REFERENCES meeting_runs(id),
          started_at_ms INTEGER NOT NULL,
          ended_at_ms INTEGER NOT NULL,
          speaker_label TEXT NOT NULL,
          speaker_confidence TEXT NOT NULL DEFAULT 'unknown',
          text TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          default_transcript_folder TEXT NOT NULL DEFAULT '',
          auto_start_on_login INTEGER NOT NULL DEFAULT 0,
          default_enablement_behavior INTEGER NOT NULL DEFAULT 0,
          transcript_format TEXT NOT NULL DEFAULT 'txt+json',
          speaker_confidence_display INTEGER NOT NULL DEFAULT 1,
          timezone TEXT NOT NULL DEFAULT 'UTC',
          debug_logging INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_meeting_preferences_user_id ON meeting_preferences(user_id);
        CREATE INDEX IF NOT EXISTS idx_meeting_runs_user_id ON meeting_runs(user_id);
        CREATE INDEX IF NOT EXISTS idx_meeting_runs_status ON meeting_runs(status);
        CREATE INDEX IF NOT EXISTS idx_transcript_segments_run_id ON transcript_segments(meeting_run_id);
      `);
    },
  },
];