// ============================================================================
// MeetScribe Database Manager
// ============================================================================

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { MIGRATIONS } from './migrations';
import { logger } from '@meetscribe/logging';
import type {
  User,
  TokenStatus,
  CalendarConnection,
  OAuthStatus,
  MeetingPreference,
  MeetingRun,
  MeetingLifecycleState,
  MeetingPlatform,
  TranscriptSegment,
  SpeakerConfidence,
  AppSettings,
} from '@meetscribe/shared';
import { DEFAULT_SETTINGS } from '@meetscribe/shared';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /** Initialize database schema by running migrations */
  public initialize(): void {
    // Create schema_version table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        description TEXT,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const currentVersion = this.getCurrentVersion();
    logger.info('Database current version', { version: currentVersion });

    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        logger.info('Running migration', { version: migration.version, description: migration.description });
        const transaction = this.db.transaction(() => {
          migration.up(this.db);
          this.db.prepare(
            'INSERT INTO schema_version (version, description) VALUES (?, ?)'
          ).run(migration.version, migration.description);
        });
        transaction();
      }
    }
  }

  private getCurrentVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number | null } | undefined;
    return row?.version ?? 0;
  }

  // ---------------------------------------------------------------------------
  // User operations
  // ---------------------------------------------------------------------------

  public createUser(email: string, tokenStatus: TokenStatus = 'invalid'): User {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO users (id, email, token_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, email, tokenStatus, now, now);

    return { id, email, tokenStatus, createdAt: now, updatedAt: now };
  }

  public getUserById(id: string): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? this.mapUserRow(row) : undefined;
  }

  public updateUserTokenStatus(id: string, tokenStatus: TokenStatus): void {
    this.db.prepare(
      `UPDATE users SET token_status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(tokenStatus, id);
  }

  // ---------------------------------------------------------------------------
  // Calendar connection operations
  // ---------------------------------------------------------------------------

  public createCalendarConnection(
    userId: string,
    provider: string = 'google',
    oauthStatus: OAuthStatus = 'disconnected',
    refreshTokenRef?: string,
    scopes?: string[]
  ): CalendarConnection {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO calendar_connections (id, user_id, provider, oauth_status, refresh_token_ref, scopes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, provider, oauthStatus, refreshTokenRef ?? null, JSON.stringify(scopes ?? []), now, now);

    return {
      id,
      userId,
      provider: provider as any,
      oauthStatus,
      refreshTokenRef,
      scopes,
    };
  }

  public getCalendarConnectionsByUserId(userId: string): CalendarConnection[] {
    const rows = this.db.prepare(
      'SELECT * FROM calendar_connections WHERE user_id = ?'
    ).all(userId) as CalendarConnectionRow[];
    return rows.map(this.mapCalendarConnectionRow.bind(this));
  }

  public updateCalendarConnectionOAuth(
    id: string,
    oauthStatus: OAuthStatus,
    refreshTokenRef?: string,
    scopes?: string[]
  ): void {
    this.db.prepare(
      `UPDATE calendar_connections
       SET oauth_status = ?, refresh_token_ref = ?, scopes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(oauthStatus, refreshTokenRef ?? null, JSON.stringify(scopes ?? []), id);
  }

  // ---------------------------------------------------------------------------
  // Meeting preference operations
  // ---------------------------------------------------------------------------

  public setMeetingPreference(
    userId: string,
    calendarEventId: string,
    enabled: boolean,
    overrideFolderPath?: string
  ): MeetingPreference {
    const existing = this.db.prepare(
      'SELECT * FROM meeting_preferences WHERE user_id = ? AND calendar_event_id = ?'
    ).get(userId, calendarEventId) as MeetingPreferenceRow | undefined;

    if (existing) {
      this.db.prepare(
        `UPDATE meeting_preferences
         SET enabled = ?, override_folder_path = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(enabled ? 1 : 0, overrideFolderPath ?? null, existing.id);

      return this.mapMeetingPreferenceRow({ ...existing, enabled: enabled ? 1 : 0, override_folder_path: overrideFolderPath ?? null });
    }

    const id = uuidv4();
    this.db.prepare(
      `INSERT INTO meeting_preferences (id, user_id, calendar_event_id, enabled, override_folder_path, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, userId, calendarEventId, enabled ? 1 : 0, overrideFolderPath ?? null);

    return {
      id,
      userId,
      calendarEventId,
      enabled,
      overrideFolderPath,
      updatedAt: new Date().toISOString(),
    };
  }

  public getMeetingPreferencesByUserId(userId: string): MeetingPreference[] {
    const rows = this.db.prepare(
      'SELECT * FROM meeting_preferences WHERE user_id = ?'
    ).all(userId) as MeetingPreferenceRow[];
    return rows.map(this.mapMeetingPreferenceRow.bind(this));
  }

  public getMeetingPreference(userId: string, calendarEventId: string): MeetingPreference | undefined {
    const row = this.db.prepare(
      'SELECT * FROM meeting_preferences WHERE user_id = ? AND calendar_event_id = ?'
    ).get(userId, calendarEventId) as MeetingPreferenceRow | undefined;
    return row ? this.mapMeetingPreferenceRow(row) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Meeting run operations
  // ---------------------------------------------------------------------------

  public createMeetingRun(
    userId: string,
    calendarEventId: string,
    provider: MeetingPlatform
  ): MeetingRun {
    const id = uuidv4();
    this.db.prepare(
      `INSERT INTO meeting_runs (id, user_id, calendar_event_id, provider, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'scheduled', datetime('now'), datetime('now'))`
    ).run(id, userId, calendarEventId, provider);

    return {
      id,
      userId,
      calendarEventId,
      provider,
      status: 'scheduled',
    };
  }

  public updateMeetingRunStatus(
    id: string,
    status: MeetingLifecycleState,
    failureReason?: string
  ): void {
    this.db.prepare(
      `UPDATE meeting_runs SET status = ?, failure_reason = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, failureReason ?? null, id);
  }

  public updateMeetingRunStart(id: string): void {
    this.db.prepare(
      `UPDATE meeting_runs SET started_at = datetime('now'), status = 'active', updated_at = datetime('now') WHERE id = ?`
    ).run(id);
  }

  public updateMeetingRunEnd(id: string, transcriptPathTxt?: string, transcriptPathJson?: string): void {
    this.db.prepare(
      `UPDATE meeting_runs SET ended_at = datetime('now'), status = 'completed',
       transcript_path_txt = ?, transcript_path_json = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(transcriptPathTxt ?? null, transcriptPathJson ?? null, id);
  }

  public getMeetingRunsByUserId(userId: string): MeetingRun[] {
    const rows = this.db.prepare(
      'SELECT * FROM meeting_runs WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as MeetingRunRow[];
    return rows.map(this.mapMeetingRunRow.bind(this));
  }

  public getMeetingRunById(id: string): MeetingRun | undefined {
    const row = this.db.prepare('SELECT * FROM meeting_runs WHERE id = ?').get(id) as MeetingRunRow | undefined;
    return row ? this.mapMeetingRunRow(row) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Transcript segment operations
  // ---------------------------------------------------------------------------

  public createTranscriptSegment(
    meetingRunId: string,
    startedAtMs: number,
    endedAtMs: number,
    speakerLabel: string,
    speakerConfidence: SpeakerConfidence,
    text: string
  ): TranscriptSegment {
    const id = uuidv4();
    this.db.prepare(
      `INSERT INTO transcript_segments (id, meeting_run_id, started_at_ms, ended_at_ms, speaker_label, speaker_confidence, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, meetingRunId, startedAtMs, endedAtMs, speakerLabel, speakerConfidence, text);

    return {
      id,
      meetingRunId,
      startedAtMs,
      endedAtMs,
      speakerLabel,
      speakerConfidence,
      text,
    };
  }

  public getTranscriptSegmentsByRunId(meetingRunId: string): TranscriptSegment[] {
    const rows = this.db.prepare(
      'SELECT * FROM transcript_segments WHERE meeting_run_id = ? ORDER BY started_at_ms ASC'
    ).all(meetingRunId) as TranscriptSegmentRow[];
    return rows.map(this.mapTranscriptSegmentRow.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Settings operations
  // ---------------------------------------------------------------------------

  public getSettings(): AppSettings {
    const row = this.db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as SettingsRow | undefined;
    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }
    return this.mapSettingsRow(row);
  }

  public updateSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const merged = { ...current, ...settings };

    this.db.prepare(`
      INSERT INTO app_settings (id, default_transcript_folder, auto_start_on_login, default_enablement_behavior,
        transcript_format, speaker_confidence_display, timezone, debug_logging, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        default_transcript_folder = excluded.default_transcript_folder,
        auto_start_on_login = excluded.auto_start_on_login,
        default_enablement_behavior = excluded.default_enablement_behavior,
        transcript_format = excluded.transcript_format,
        speaker_confidence_display = excluded.speaker_confidence_display,
        timezone = excluded.timezone,
        debug_logging = excluded.debug_logging,
        updated_at = excluded.updated_at
    `).run(
      merged.defaultTranscriptFolder,
      merged.autoStartOnLogin ? 1 : 0,
      merged.defaultEnablementBehavior ? 1 : 0,
      merged.transcriptFormat,
      merged.speakerConfidenceDisplay ? 1 : 0,
      merged.timezone,
      merged.debugLogging ? 1 : 0
    );

    return merged;
  }

  // ---------------------------------------------------------------------------
  // Row mapping helpers
  // ---------------------------------------------------------------------------

  private mapUserRow(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      tokenStatus: row.token_status as TokenStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCalendarConnectionRow(row: CalendarConnectionRow): CalendarConnection {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider as any,
      oauthStatus: row.oauth_status as OAuthStatus,
      refreshTokenRef: row.refresh_token_ref ?? undefined,
      scopes: row.scopes ? JSON.parse(row.scopes) : undefined,
    };
  }

  private mapMeetingPreferenceRow(row: MeetingPreferenceRow): MeetingPreference {
    return {
      id: row.id,
      userId: row.user_id,
      calendarEventId: row.calendar_event_id,
      enabled: row.enabled === 1,
      overrideFolderPath: row.override_folder_path ?? undefined,
      lastStatus: (row.last_status as MeetingLifecycleState) ?? undefined,
      updatedAt: row.updated_at,
    };
  }

  private mapMeetingRunRow(row: MeetingRunRow): MeetingRun {
    return {
      id: row.id,
      userId: row.user_id,
      calendarEventId: row.calendar_event_id,
      startedAt: row.started_at ?? undefined,
      endedAt: row.ended_at ?? undefined,
      provider: row.provider as MeetingPlatform,
      status: row.status as MeetingLifecycleState,
      failureReason: row.failure_reason ?? undefined,
      transcriptPathTxt: row.transcript_path_txt ?? undefined,
      transcriptPathJson: row.transcript_path_json ?? undefined,
    };
  }

  private mapTranscriptSegmentRow(row: TranscriptSegmentRow): TranscriptSegment {
    return {
      id: row.id,
      meetingRunId: row.meeting_run_id,
      startedAtMs: row.started_at_ms,
      endedAtMs: row.ended_at_ms,
      speakerLabel: row.speaker_label,
      speakerConfidence: row.speaker_confidence as SpeakerConfidence,
      text: row.text,
    };
  }

  private mapSettingsRow(row: SettingsRow): AppSettings {
    return {
      defaultTranscriptFolder: row.default_transcript_folder,
      autoStartOnLogin: row.auto_start_on_login === 1,
      defaultEnablementBehavior: row.default_enablement_behavior === 1,
      transcriptFormat: row.transcript_format as any,
      speakerConfidenceDisplay: row.speaker_confidence_display === 1,
      timezone: row.timezone,
      debugLogging: row.debug_logging === 1,
    };
  }

  /** Close the database connection */
  public close(): void {
    this.db.close();
  }

  /** Get the raw database instance (for advanced usage) */
  public getRawDb(): Database.Database {
    return this.db;
  }
}

// ---------------------------------------------------------------------------
// Internal row types matching SQLite column names
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  token_status: string;
  access_token: string | null;
  created_at: string;
  updated_at: string;
}

interface CalendarConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  oauth_status: string;
  refresh_token_ref: string | null;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

interface MeetingPreferenceRow {
  id: string;
  user_id: string;
  calendar_event_id: string;
  enabled: number;
  override_folder_path: string | null;
  last_status: string | null;
  updated_at: string;
}

interface MeetingRunRow {
  id: string;
  user_id: string;
  calendar_event_id: string;
  started_at: string | null;
  ended_at: string | null;
  provider: string;
  status: string;
  failure_reason: string | null;
  transcript_path_txt: string | null;
  transcript_path_json: string | null;
  created_at: string;
  updated_at: string;
}

interface TranscriptSegmentRow {
  id: string;
  meeting_run_id: string;
  started_at_ms: number;
  ended_at_ms: number;
  speaker_label: string;
  speaker_confidence: string;
  text: string;
  created_at: string;
}

interface SettingsRow {
  id: number;
  default_transcript_folder: string;
  auto_start_on_login: number;
  default_enablement_behavior: number;
  transcript_format: string;
  speaker_confidence_display: number;
  timezone: string;
  debug_logging: number;
  updated_at: string;
}