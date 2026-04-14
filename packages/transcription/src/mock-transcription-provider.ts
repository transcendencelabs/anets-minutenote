// ============================================================================
// MeetScribe Mock Transcription Provider (for development and testing)
// ============================================================================

import { logger } from '@meetscribe/logging';
import type { TranscriptionProvider, TranscriptionResult, TranscriptionSessionConfig } from './transcription-provider';

/**
 * Mock transcription provider that generates placeholder transcript segments.
 * Useful for development and testing without a real transcription service.
 */
export class MockTranscriptionProvider implements TranscriptionProvider {
  public readonly name = 'mock';
  private activeSessions: Map<string, { config: TranscriptionSessionConfig; startTime: number }> = new Map();
  private segmentCounter = 0;

  async startSession(config?: TranscriptionSessionConfig): Promise<string> {
    const sessionId = `mock-session-${Date.now()}`;
    this.activeSessions.set(sessionId, {
      config: config ?? {},
      startTime: Date.now(),
    });
    logger.info('MockTranscription: Session started', { sessionId });
    return sessionId;
  }

  async transcribeChunk(sessionId: string, _audioChunk: Buffer): Promise<TranscriptionResult[]> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`No active session with ID: ${sessionId}`);
    }

    // Generate a mock transcript segment
    this.segmentCounter++;
    const elapsed = Date.now() - session.startTime;

    const speakers = ['Speaker 1', 'Speaker 2'];
    const speakerIndex = this.segmentCounter % speakers.length;
    const speaker = speakers[speakerIndex];

    const mockTexts = [
      'This is a simulated transcript segment.',
      'The quick brown fox jumps over the lazy dog.',
      'Testing one two three, is this working?',
      'Let me share my screen for a moment.',
      'I think we should move this to the next sprint.',
    ];

    const result: TranscriptionResult = {
      text: mockTexts[this.segmentCounter % mockTexts.length],
      startedAtMs: elapsed,
      endedAtMs: elapsed + 3000,
      speakerLabel: speaker,
      speakerConfidence: 'unknown',
      confidence: 0.85,
    };

    logger.debug('MockTranscription: Generated mock segment', {
      sessionId,
      segmentNumber: this.segmentCounter,
    });

    return [result];
  }

  async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    logger.info('MockTranscription: Session ended', { sessionId });
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}