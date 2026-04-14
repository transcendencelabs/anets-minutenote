// ============================================================================
// Transcript Writer Tests
// ============================================================================

import { TranscriptWriter } from '../transcript-writer';

describe('TranscriptWriter.sanitizeTitle', () => {
  it('should lowercase and replace non-alphanumeric chars', () => {
    expect(TranscriptWriter.sanitizeTitle('Team Standup!')).toBe('team_standup');
  });

  it('should handle special characters', () => {
    expect(TranscriptWriter.sanitizeTitle('Sprint Review @ 3pm')).toBe('sprint_review_3pm');
  });

  it('should trim leading/trailing underscores', () => {
    expect(TranscriptWriter.sanitizeTitle('  Hello World  ')).toBe('hello_world');
  });

  it('should truncate to max length', () => {
    const longTitle = 'a'.repeat(100);
    const result = TranscriptWriter.sanitizeTitle(longTitle);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('should handle empty string', () => {
    expect(TranscriptWriter.sanitizeTitle('')).toBe('');
  });
});

describe('TranscriptWriter.generateFilename', () => {
  it('should generate deterministic filename with date prefix', () => {
    const result = TranscriptWriter.generateFilename(
      '2024-06-15T09:00:00Z',
      'Team Standup',
      '.txt'
    );
    expect(result).toBe('2024-06-15_0900_team_standup.txt');
  });

  it('should handle JSON extension', () => {
    const result = TranscriptWriter.generateFilename(
      '2024-06-15T14:30:00Z',
      'Sprint Planning',
      '.json'
    );
    expect(result).toContain('.json');
    expect(result).toContain('sprint_planning');
  });
});

describe('SpeakerAttributionService fallback logic', () => {
  const { SpeakerAttributionService } = require('../speaker-attribution');

  it('should assign generic labels when no known speakers', () => {
    const service = new SpeakerAttributionService();
    const result = service.assignSpeaker({
      speakerLabel: 'diarized_0',
      text: 'Hello',
      timestamp: 0,
    });
    expect(result.speakerLabel).toBe('Speaker 1');
    expect(result.speakerConfidence).toBe('unknown');
  });

  it('should assign known speaker when label matches', () => {
    const service = new SpeakerAttributionService();
    service.registerKnownSpeakers([{ name: 'Alice', email: 'alice@example.com' }]);
    const result = service.assignSpeaker({
      speakerLabel: 'Alice',
      text: 'Hello',
      timestamp: 0,
    });
    expect(result.speakerLabel).toBe('Alice');
    expect(result.speakerConfidence).toBe('known');
  });

  it('should use stable mapping for repeated labels', () => {
    const service = new SpeakerAttributionService();
    const r1 = service.assignSpeaker({ speakerLabel: 'spk_0', text: 'Hi', timestamp: 0 });
    const r2 = service.assignSpeaker({ speakerLabel: 'spk_0', text: 'Bye', timestamp: 1000 });
    expect(r1.speakerLabel).toBe(r2.speakerLabel);
    expect(r2.speakerConfidence).toBe('probable');
  });

  it('should reset session state', () => {
    const service = new SpeakerAttributionService();
    service.assignSpeaker({ speakerLabel: 'spk_0', text: 'Hi', timestamp: 0 });
    service.resetSession();
    const result = service.assignSpeaker({ speakerLabel: 'spk_0', text: 'Hi', timestamp: 0 });
    expect(result.speakerLabel).toBe('Speaker 1');
  });
});