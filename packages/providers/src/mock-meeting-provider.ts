// ============================================================================
// MeetScribe Mock Meeting Provider (for development and testing)
// ============================================================================

import type { MeetingPlatform } from '@meetscribe/shared';
import { logger } from '@meetscribe/logging';
import type { MeetingProvider, MeetingParticipant, AudioStreamInfo } from './meeting-provider';

/**
 * Mock meeting provider for development and testing.
 * Simulates meeting join/leave lifecycle without requiring real credentials.
 */
export class MockMeetingProvider implements MeetingProvider {
  public readonly platform: MeetingPlatform = 'unknown';
  private currentUrl: string | undefined;
  private joined = false;
  private ended = false;
  private participants: MeetingParticipant[] = [];

  async canHandle(url: string): boolean {
    // Mock provider handles all URLs for testing
    return true;
  }

  async joinMeeting(url: string): Promise<void> {
    this.currentUrl = url;
    this.joined = true;
    this.ended = false;
    logger.info('MockMeeting: Joined meeting', { url });

    // Simulate some participants
    this.participants = [
      { id: '1', name: 'Speaker 1', email: 'speaker1@example.com', isOrganizer: true },
      { id: '2', name: 'Speaker 2', email: 'speaker2@example.com', isOrganizer: false },
    ];
  }

  async getParticipants(): Promise<MeetingParticipant[]> {
    return this.participants;
  }

  async getAudioStreamInfo(): Promise<AudioStreamInfo> {
    return {
      isActive: this.joined && !this.ended,
      sampleRate: 48000,
      channels: 1,
    };
  }

  async hasEnded(): Promise<boolean> {
    return this.ended;
  }

  async leaveMeeting(): Promise<void> {
    this.joined = false;
    this.ended = true;
    this.participants = [];
    logger.info('MockMeeting: Left meeting');
  }

  getMeetingUrl(): string | undefined {
    return this.currentUrl;
  }

  // --- Test helpers ---

  /** Simulate a participant joining */
  public addParticipant(participant: MeetingParticipant): void {
    this.participants.push(participant);
  }

  /** Simulate a participant leaving */
  public removeParticipant(id: string): void {
    this.participants = this.participants.filter((p) => p.id !== id);
  }

  /** Simulate meeting end */
  public simulateMeetingEnd(): void {
    this.ended = true;
    this.joined = false;
  }
}