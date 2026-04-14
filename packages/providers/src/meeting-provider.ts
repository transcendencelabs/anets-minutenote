// ============================================================================
// MeetScribe Meeting Provider Interface
// ============================================================================

import type { MeetingPlatform } from '@meetscribe/shared';

export interface MeetingParticipant {
  id?: string;
  name?: string;
  email?: string;
  isOrganizer?: boolean;
}

export interface MeetingProviderConfig {
  provider: MeetingPlatform;
  credentials?: Record<string, string>;
}

export interface AudioStreamInfo {
  /** Whether the audio stream is currently active */
  isActive: boolean;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Number of channels */
  channels?: number;
}

export interface MeetingProvider {
  /** The meeting platform identifier */
  readonly platform: MeetingPlatform;

  /** Check if this provider can handle the given meeting URL */
  canHandle(url: string): boolean;

  /** Join the meeting at the given URL */
  joinMeeting(url: string): Promise<void>;

  /** Get the list of current participants in the meeting */
  getParticipants(): Promise<MeetingParticipant[]>;

  /** Get information about the audio stream */
  getAudioStreamInfo(): Promise<AudioStreamInfo>;

  /** Check if the meeting has ended */
  hasEnded(): Promise<boolean>;

  /** Leave the meeting gracefully */
  leaveMeeting(): Promise<void>;

  /** Get the current meeting URL being handled */
  getMeetingUrl(): string | undefined;
}