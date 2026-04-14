// ============================================================================
// MeetScribe Transcription Provider Interface
// ============================================================================

import type { SpeakerConfidence } from '@meetscribe/shared';

export interface TranscriptionResult {
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  speakerLabel?: string;
  speakerConfidence?: SpeakerConfidence;
  confidence?: number;
}

export interface TranscriptionSessionConfig {
  language?: string;
  sampleRate?: number;
  channels?: number;
  enableDiarization?: boolean;
  maxSpeakers?: number;
}

export interface TranscriptionProvider {
  /** Provider name for logging and identification */
  readonly name: string;

  /** Start a transcription session */
  startSession(config?: TranscriptionSessionConfig): Promise<string>;

  /** Transcribe an audio chunk. Returns session ID for correlation. */
  transcribeChunk(sessionId: string, audioChunk: Buffer): Promise<TranscriptionResult[]>;

  /** End a transcription session and clean up resources */
  endSession(sessionId: string): Promise<void>;

  /** Check if the provider is currently available */
  isAvailable(): Promise<boolean>;
}