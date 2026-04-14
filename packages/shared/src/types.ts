// ============================================================================
// MeetScribe Shared Types
// ============================================================================

// --- Meeting Lifecycle ---

export type MeetingLifecycleState =
  | 'scheduled'
  | 'pending'
  | 'joining'
  | 'active'
  | 'ending'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const MEETING_LIFECYCLE_STATES: MeetingLifecycleState[] = [
  'scheduled',
  'pending',
  'joining',
  'active',
  'ending',
  'completed',
  'failed',
  'cancelled',
];

// --- Calendar ---

export type CalendarProviderType = 'google';

export interface CalendarEvent {
  eventId: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  organizer?: string;
  attendees?: CalendarAttendee[];
  meetingUrl?: string;
  platform?: MeetingPlatform;
  calendarSource: CalendarProviderType;
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
}

// --- Meeting Platform ---

export type MeetingPlatform = 'google_meet' | 'zoom' | 'microsoft_teams' | 'unknown';

export function inferMeetingPlatform(url: string): MeetingPlatform {
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('teams.microsoft.com')) return 'microsoft_teams';
  return 'unknown';
}

// --- Meeting Run ---

export interface MeetingRun {
  id: string;
  userId: string;
  calendarEventId: string;
  startedAt?: string;
  endedAt?: string;
  provider: MeetingPlatform;
  status: MeetingLifecycleState;
  failureReason?: string;
  transcriptPathTxt?: string;
  transcriptPathJson?: string;
}

// --- Transcript ---

export type SpeakerConfidence = 'known' | 'probable' | 'unknown';

export interface TranscriptSegment {
  id: string;
  meetingRunId: string;
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel: string;
  speakerConfidence: SpeakerConfidence;
  text: string;
}

export interface TranscriptOutput {
  meetingId: string;
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  calendarSource: CalendarProviderType;
  platform: MeetingPlatform;
  participantsDetected: string[];
  transcriptSegments: TranscriptSegmentRow[];
  outputPath: string;
  sessionStatus: MeetingLifecycleState;
}

export interface TranscriptSegmentRow {
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel: string;
  speakerConfidence: SpeakerConfidence;
  text: string;
}

// --- User & Auth ---

export interface User {
  id: string;
  email: string;
  tokenStatus: TokenStatus;
  createdAt: string;
  updatedAt: string;
}

export type TokenStatus = 'active' | 'revoked' | 'expired' | 'invalid';

// --- Calendar Connection ---

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProviderType;
  oauthStatus: OAuthStatus;
  refreshTokenRef?: string;
  scopes?: string[];
}

export type OAuthStatus = 'connected' | 'disconnected' | 'expired' | 'error';

// --- Meeting Preference ---

export interface MeetingPreference {
  id: string;
  userId: string;
  calendarEventId: string;
  enabled: boolean;
  overrideFolderPath?: string;
  lastStatus?: MeetingLifecycleState;
  updatedAt: string;
}

// --- Settings ---

export interface AppSettings {
  defaultTranscriptFolder: string;
  autoStartOnLogin: boolean;
  defaultEnablementBehavior: boolean; // true = enable by default, false = disable by default
  transcriptFormat: TranscriptFormat;
  speakerConfidenceDisplay: boolean;
  timezone: string;
  debugLogging: boolean;
}

export type TranscriptFormat = 'txt+json';

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTranscriptFolder: '',
  autoStartOnLogin: false,
  defaultEnablementBehavior: false,
  transcriptFormat: 'txt+json',
  speakerConfidenceDisplay: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  debugLogging: false,
};

// --- Meeting List Display ---

export type MeetingDisplayStatus =
  | 'scheduled'
  | 'waiting'
  | 'joining'
  | 'recording'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface MeetingDisplayItem {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  platform: MeetingPlatform;
  transcriptionEnabled: boolean;
  folderDestination?: string;
  status: MeetingDisplayStatus;
}