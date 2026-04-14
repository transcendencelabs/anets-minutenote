// ============================================================================
// MeetScribe Shared Constants
// ============================================================================

/** Timeouts in milliseconds */
export const TIMEOUTS = {
  /** How long to wait for a meeting to start before marking as skipped */
  MEETING_START_GRACE_PERIOD_MS: 5 * 60 * 1000, // 5 minutes

  /** How long to wait after last participant leaves before ending session */
  PARTICIPANT_LEAVE_TIMEOUT_MS: 2 * 60 * 1000, // 2 minutes

  /** How long to wait for audio silence before ending session */
  AUDIO_SILENCE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes

  /** How often to refresh calendar events */
  CALENDAR_REFRESH_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes

  /** How far ahead to look for upcoming meetings */
  CALENDAR_LOOKAHEAD_DAYS: 14,

  /** How far back to look for recent meetings */
  CALENDAR_LOOKBACK_DAYS: 1,

  /** Maximum retry attempts for calendar fetch */
  CALENDAR_FETCH_MAX_RETRIES: 3,

  /** Maximum retry attempts for token validation */
  TOKEN_VALIDATION_MAX_RETRIES: 2,

  /** Maximum retry attempts for meeting join */
  MEETING_JOIN_MAX_RETRIES: 2,

  /** Delay between retries */
  RETRY_DELAY_MS: 5000, // 5 seconds
} as const;

/** Transcript file naming constants */
export const TRANSCRIPT_CONSTANTS = {
  /** Date format prefix for transcript filenames */
  FILE_DATE_FORMAT: 'YYYY-MM-DD_HHmm',

  /** Maximum length for sanitized meeting title in filename */
  MAX_TITLE_LENGTH_IN_FILENAME: 50,

  /** File extension for text transcript */
  TXT_EXTENSION: '.txt',

  /** File extension for JSON transcript */
  JSON_EXTENSION: '.json',

  /** Temp file prefix for atomic writes */
  TEMP_FILE_PREFIX: '.tmp_',
} as const;

/** Meeting provider constants */
export const PROVIDER_CONSTANTS = {
  /** Supported calendar providers */
  CALENDAR_PROVIDERS: ['google'] as const,

  /** Supported meeting platforms */
  MEETING_PLATFORMS: ['google_meet', 'zoom', 'microsoft_teams'] as const,
} as const;

/** Default app constants */
export const APP_CONSTANTS = {
  APP_NAME: 'MeetScribe',
  APP_VERSION: '0.1.0',

  /** Default port for local backend communication */
  DEFAULT_BACKEND_PORT: 3456,

  /** Electron window default dimensions */
  WINDOW_DEFAULT_WIDTH: 1024,
  WINDOW_DEFAULT_HEIGHT: 768,
  WINDOW_MIN_WIDTH: 640,
  WINDOW_MIN_HEIGHT: 480,
} as const;