// ============================================================================
// MeetScribe Transcript Writer
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import type { TranscriptOutput } from '@meetscribe/shared';
import { TRANSCRIPT_CONSTANTS } from '@meetscribe/shared';
import { logger } from '@meetscribe/logging';

/**
 * TranscriptWriter handles atomic file writing for transcript output.
 * Files are written as temp files first, then renamed to their final location
 * to prevent partial writes from corrupting output.
 */
export class TranscriptWriter {
  /**
   * Generate a deterministic, human-readable filename for a transcript.
   * Format: YYYY-MM-DD_HHmm_<sanitized_title>
   */
  public static generateFilename(
    startTime: string,
    title: string,
    extension: string
  ): string {
    const date = new Date(startTime);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const datePrefix = `${year}-${month}-${day}_${hours}${minutes}`;
    const sanitizedTitle = TranscriptWriter.sanitizeTitle(title);
    const truncatedTitle = sanitizedTitle.substring(0, TRANSCRIPT_CONSTANTS.MAX_TITLE_LENGTH_IN_FILENAME);

    return `${datePrefix}_${truncatedTitle}${extension}`;
  }

  /**
   * Sanitize a meeting title for use in a filename.
   * Removes or replaces characters that are not filesystem-safe.
   */
  public static sanitizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
      .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
      .substring(0, TRANSCRIPT_CONSTANTS.MAX_TITLE_LENGTH_IN_FILENAME);
  }

  /**
   * Write transcript as plain text format.
   */
  public static writeTxt(outputPath: string, output: TranscriptOutput): void {
    const lines: string[] = [];

    lines.push(`Meeting: ${output.title}`);
    lines.push(`Date: ${output.startTime}`);
    lines.push(`Platform: ${output.platform}`);
    lines.push(`Participants: ${output.participantsDetected.join(', ') || 'Unknown'}`);
    lines.push(`Status: ${output.sessionStatus}`);
    lines.push('');
    lines.push('--- Transcript ---');
    lines.push('');

    for (const segment of output.transcriptSegments) {
      const startTime = TranscriptWriter.formatTimestamp(segment.startedAtMs);
      const endTime = TranscriptWriter.formatTimestamp(segment.endedAtMs);
      const confidence = segment.speakerConfidence !== 'known'
        ? ` [${segment.speakerConfidence}]`
        : '';

      lines.push(`[${startTime} - ${endTime}] ${segment.speakerLabel}${confidence}: ${segment.text}`);
    }

    TranscriptWriter.atomicWrite(outputPath, lines.join('\n'));
  }

  /**
   * Write transcript as structured JSON format.
   */
  public static writeJson(outputPath: string, output: TranscriptOutput): void {
    const jsonContent = JSON.stringify(output, null, 2);
    TranscriptWriter.atomicWrite(outputPath, jsonContent);
  }

  /**
   * Finalize transcript: write both TXT and JSON files.
   * Returns the paths of both files.
   */
  public static finalize(
    folderPath: string,
    output: TranscriptOutput
  ): { txtPath: string; jsonPath: string } {
    const baseFilename = TranscriptWriter.generateFilename(
      output.startTime,
      output.title,
      '' // No extension for base name
    );

    const txtFilename = baseFilename + TRANSCRIPT_CONSTANTS.TXT_EXTENSION;
    const jsonFilename = baseFilename + TRANSCRIPT_CONSTANTS.JSON_EXTENSION;

    const txtPath = path.join(folderPath, txtFilename);
    const jsonPath = path.join(folderPath, jsonFilename);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    TranscriptWriter.writeTxt(txtPath, output);
    TranscriptWriter.writeJson(jsonPath, output);

    logger.info('TranscriptWriter: Transcript finalized', {
      txtPath,
      jsonPath,
    });

    return { txtPath, jsonPath };
  }

  /**
   * Write a partial transcript (for mid-session failures).
   * Saves what we have with a "_partial" suffix.
   */
  public static writePartial(
    folderPath: string,
    output: TranscriptOutput
  ): { txtPath: string; jsonPath: string } {
    const partialOutput: TranscriptOutput = {
      ...output,
      sessionStatus: 'failed',
    };

    const baseFilename = TranscriptWriter.generateFilename(
      output.startTime,
      output.title + '_partial',
      ''
    );

    const txtFilename = baseFilename + TRANSCRIPT_CONSTANTS.TXT_EXTENSION;
    const jsonFilename = baseFilename + TRANSCRIPT_CONSTANTS.JSON_EXTENSION;

    const txtPath = path.join(folderPath, txtFilename);
    const jsonPath = path.join(folderPath, jsonFilename);

    // Ensure folder exists
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    TranscriptWriter.writeTxt(txtPath, partialOutput);
    TranscriptWriter.writeJson(jsonPath, partialOutput);

    logger.info('TranscriptWriter: Partial transcript saved', {
      txtPath,
      jsonPath,
    });

    return { txtPath, jsonPath };
  }

  /**
   * Atomic write: write to temp file, sync, then rename.
   * This prevents partial writes from corrupting the output file.
   */
  private static atomicWrite(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = path.join(dir, TRANSCRIPT_CONSTANTS.TEMP_FILE_PREFIX + path.basename(filePath));

    try {
      // Write to temp file
      fs.writeFileSync(tempPath, content, 'utf-8');

      // Sync to disk if supported
      try {
        const fd = fs.openSync(tempPath, 'r');
        fs.fsyncSync(fd);
        fs.closeSync(fd);
      } catch {
        // fsync may not be available on all platforms; continue without it
        logger.warn('TranscriptWriter: fsync not available, skipping');
      }

      // Rename to final path (atomic on most filesystems)
      fs.renameSync(tempPath, filePath);

      logger.debug('TranscriptWriter: File written atomically', { path: filePath });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('TranscriptWriter: Failed to write file', { path: filePath, error: message });

      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Best effort cleanup
      }

      throw error;
    }
  }

  /**
   * Format milliseconds into HH:MM:SS timestamp.
   */
  private static formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}