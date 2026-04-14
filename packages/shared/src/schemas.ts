// ============================================================================
// MeetScribe Zod Schemas for Runtime Validation
// ============================================================================

import { z } from 'zod';

// --- Token Activation ---

export const activateTokenRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const activateTokenResponseSchema = z.object({
  valid: z.boolean(),
  userId: z.string().optional(),
  email: z.string().email().optional(),
  error: z.string().optional(),
});

// --- Settings ---

export const appSettingsSchema = z.object({
  defaultTranscriptFolder: z.string().min(1, 'Transcript folder is required'),
  autoStartOnLogin: z.boolean(),
  defaultEnablementBehavior: z.boolean(),
  transcriptFormat: z.literal('txt+json'),
  speakerConfidenceDisplay: z.boolean(),
  timezone: z.string().min(1, 'Timezone is required'),
  debugLogging: z.boolean(),
});

// --- Meeting Preference ---

export const meetingPreferenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  calendarEventId: z.string(),
  enabled: z.boolean(),
  overrideFolderPath: z.string().optional(),
  lastStatus: z.enum([
    'scheduled', 'pending', 'joining', 'active',
    'ending', 'completed', 'failed', 'cancelled',
  ]).optional(),
  updatedAt: z.string(),
});

// --- Calendar Event ---

export const calendarEventSchema = z.object({
  eventId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  organizer: z.string().optional(),
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    responseStatus: z.string().optional(),
  })).optional(),
  meetingUrl: z.string().optional(),
  platform: z.enum(['google_meet', 'zoom', 'microsoft_teams', 'unknown']).optional(),
  calendarSource: z.enum(['google']),
});

// --- Transcript Segment ---

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  meetingRunId: z.string(),
  startedAtMs: z.number(),
  endedAtMs: z.number(),
  speakerLabel: z.string(),
  speakerConfidence: z.enum(['known', 'probable', 'unknown']),
  text: z.string(),
});

// --- Transcript Output ---

export const transcriptOutputSchema = z.object({
  meetingId: z.string(),
  eventId: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  calendarSource: z.enum(['google']),
  platform: z.enum(['google_meet', 'zoom', 'microsoft_teams', 'unknown']),
  participantsDetected: z.array(z.string()),
  transcriptSegments: z.array(z.object({
    startedAtMs: z.number(),
    endedAtMs: z.number(),
    speakerLabel: z.string(),
    speakerConfidence: z.enum(['known', 'probable', 'unknown']),
    text: z.string(),
  })),
  outputPath: z.string(),
  sessionStatus: z.enum([
    'scheduled', 'pending', 'joining', 'active',
    'ending', 'completed', 'failed', 'cancelled',
  ]),
});

// --- Meeting Run ---

export const meetingRunSchema = z.object({
  id: z.string(),
  userId: z.string(),
  calendarEventId: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  provider: z.enum(['google_meet', 'zoom', 'microsoft_teams', 'unknown']),
  status: z.enum([
    'scheduled', 'pending', 'joining', 'active',
    'ending', 'completed', 'failed', 'cancelled',
  ]),
  failureReason: z.string().optional(),
  transcriptPathTxt: z.string().optional(),
  transcriptPathJson: z.string().optional(),
});

// --- Type exports from schemas ---

export type ActivateTokenRequest = z.infer<typeof activateTokenRequestSchema>;
export type ActivateTokenResponse = z.infer<typeof activateTokenResponseSchema>;
export type AppSettingsInput = z.input<typeof appSettingsSchema>;
export type MeetingPreferenceInput = z.input<typeof meetingPreferenceSchema>;
export type CalendarEventInput = z.input<typeof calendarEventSchema>;