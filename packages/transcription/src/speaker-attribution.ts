// ============================================================================
// MeetScribe Speaker Attribution Service
// ============================================================================

import type { SpeakerConfidence } from '@meetscribe/shared';
import { logger } from '@meetscribe/logging';

export interface SpeakerAttributionInput {
  speakerLabel: string;
  text: string;
  timestamp: number;
}

export interface SpeakerAttributionResult {
  speakerLabel: string;
  speakerConfidence: SpeakerConfidence;
  /** If we have high confidence, we might assign a real name */
  attributedName?: string;
}

export interface KnownSpeaker {
  name: string;
  email?: string;
  /** Voice fingerprint hash if available */
  voicePrintHash?: string;
}

/**
 * Speaker attribution service using a layered strategy:
 * 1. Known participant identity from meeting metadata
 * 2. Audio diarization (delegated to transcription provider)
 * 3. Stable speaker label mapping within a session
 * 4. Fallback to generic labels (Speaker 1, Speaker 2, etc.)
 */
export class SpeakerAttributionService {
  private knownSpeakers: Map<string, KnownSpeaker> = new Map();
  private labelMapping: Map<string, string> = new Map();
  private speakerCounter = 0;

  /** Register known speakers from meeting metadata */
  public registerKnownSpeakers(speakers: KnownSpeaker[]): void {
    for (const speaker of speakers) {
      const key = speaker.email ?? speaker.name;
      this.knownSpeakers.set(key, speaker);
    }
    logger.info('SpeakerAttribution: Registered known speakers', {
      count: speakers.length,
    });
  }

  /** Assign speaker attribution to a transcript segment */
  public assignSpeaker(input: SpeakerAttributionInput): SpeakerAttributionResult {
    // Strategy 1: Check if the speaker label matches a known participant
    const knownSpeaker = this.tryMatchKnownSpeaker(input.speakerLabel);
    if (knownSpeaker) {
      return {
        speakerLabel: knownSpeaker.name,
        speakerConfidence: 'known',
        attributedName: knownSpeaker.name,
      };
    }

    // Strategy 2: Check if we've seen this label before and have a stable mapping
    const existingMapping = this.labelMapping.get(input.speakerLabel);
    if (existingMapping) {
      return {
        speakerLabel: existingMapping,
        speakerConfidence: 'probable',
      };
    }

    // Strategy 3: Assign a generic label and create a stable mapping
    this.speakerCounter++;
    const genericLabel = `Speaker ${this.speakerCounter}`;
    this.labelMapping.set(input.speakerLabel, genericLabel);

    return {
      speakerLabel: genericLabel,
      speakerConfidence: 'unknown',
    };
  }

  /** Try to match a diarization label to a known speaker */
  private tryMatchKnownSpeaker(label: string): KnownSpeaker | undefined {
    // Check if the label directly matches a known speaker name or email
    for (const [, speaker] of this.knownSpeakers) {
      if (
        label.toLowerCase().includes(speaker.name.toLowerCase()) ||
        (speaker.email && label.toLowerCase().includes(speaker.email.toLowerCase()))
      ) {
        return speaker;
      }
    }
    return undefined;
  }

  /** Reset session state for a new meeting */
  public resetSession(): void {
    this.knownSpeakers.clear();
    this.labelMapping.clear();
    this.speakerCounter = 0;
    logger.info('SpeakerAttribution: Session reset');
  }
}