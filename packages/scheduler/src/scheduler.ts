// ============================================================================
// MeetScribe Meeting Scheduler
// ============================================================================

import type {
  CalendarEvent,
  MeetingLifecycleState,
  MeetingPlatform,
  MeetingPreference,
  MeetingRun,
} from '@meetscribe/shared';
import { inferMeetingPlatform, TIMEOUTS } from '@meetscribe/shared';
import { logger } from '@meetscribe/logging';
import { MeetingLifecycle } from './meeting-lifecycle';

// ---------------------------------------------------------------------------
// Interfaces for dependency injection
// ---------------------------------------------------------------------------

export interface SchedulerStorage {
  getMeetingPreference(userId: string, calendarEventId: string): MeetingPreference | undefined;
  setMeetingPreference(userId: string, calendarEventId: string, enabled: boolean, overrideFolderPath?: string): MeetingPreference;
  createMeetingRun(userId: string, calendarEventId: string, provider: MeetingPlatform): MeetingRun;
  updateMeetingRunStatus(id: string, status: MeetingLifecycleState, failureReason?: string): void;
  updateMeetingRunStart(id: string): void;
  updateMeetingRunEnd(id: string, transcriptPathTxt?: string, transcriptPathJson?: string): void;
  getMeetingRunById(id: string): MeetingRun | undefined;
}

export interface SchedulerMeetingProvider {
  canHandle(url: string): boolean;
  joinMeeting(url: string): Promise<void>;
  hasEnded(): Promise<boolean>;
  leaveMeeting(): Promise<void>;
  getParticipants(): Promise<Array<{ id?: string; name?: string; email?: string; isOrganizer?: boolean }>>;
}

export interface SchedulerCalendarProvider {
  listUpcomingMeetings(): Promise<CalendarEvent[]>;
  isConnected(): boolean;
}

// ---------------------------------------------------------------------------
// Meeting run context - tracks an in-progress meeting
// ---------------------------------------------------------------------------

interface MeetingRunContext {
  runId: string;
  lifecycle: MeetingLifecycle;
  event: CalendarEvent;
  provider: SchedulerMeetingProvider;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  endCheckInterval: ReturnType<typeof setInterval> | null;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export class Scheduler {
  private activeRuns: Map<string, MeetingRunContext> = new Map();
  private calendarRefreshHandle: ReturnType<typeof setInterval> | null = null;
  private upcomingMeetings: CalendarEvent[] = [];
  private userId: string;

  constructor(
    userId: string,
    private storage: SchedulerStorage,
    private calendarProvider: SchedulerCalendarProvider,
    private meetingProviderFactory: (platform: MeetingPlatform) => SchedulerMeetingProvider,
  ) {
    this.userId = userId;
  }

  /** Start the scheduler - begins periodic calendar refresh */
  public async start(): Promise<void> {
    logger.info('Scheduler: Starting', { userId: this.userId });

    // Initial calendar fetch
    await this.refreshCalendar();

    // Set up periodic refresh
    this.calendarRefreshHandle = setInterval(
      () => this.refreshCalendar(),
      TIMEOUTS.CALENDAR_REFRESH_INTERVAL_MS
    );

    logger.info('Scheduler: Started successfully');
  }

  /** Stop the scheduler and all active meeting runs */
  public async stop(): Promise<void> {
    logger.info('Scheduler: Stopping', { userId: this.userId });

    if (this.calendarRefreshHandle) {
      clearInterval(this.calendarRefreshHandle);
      this.calendarRefreshHandle = null;
    }

    // Cancel all active runs
    for (const [runId, context] of this.activeRuns) {
      try {
        await this.cancelRun(runId, 'Scheduler shutting down');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Scheduler: Error cancelling run during shutdown', { runId, error: message });
      }
    }

    logger.info('Scheduler: Stopped');
  }

  /** Refresh upcoming meetings from calendar */
  public async refreshCalendar(): Promise<void> {
    try {
      if (!this.calendarProvider.isConnected()) {
        logger.warn('Scheduler: Calendar provider not connected, skipping refresh');
        return;
      }

      this.upcomingMeetings = await this.calendarProvider.listUpcomingMeetings();
      logger.info('Scheduler: Calendar refreshed', { meetingCount: this.upcomingMeetings.length });

      // Schedule enabled meetings
      await this.scheduleEnabledMeetings();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Scheduler: Calendar refresh failed', { error: message });
    }
  }

  /** Get upcoming meetings with their preferences */
  public getUpcomingMeetings(): Array<{ event: CalendarEvent; preference?: MeetingPreference }> {
    return this.upcomingMeetings.map((event) => ({
      event,
      preference: this.storage.getMeetingPreference(this.userId, event.eventId),
    }));
  }

  /** Enable transcription for a specific meeting */
  public enableMeeting(calendarEventId: string): MeetingPreference {
    return this.storage.setMeetingPreference(this.userId, calendarEventId, true);
  }

  /** Disable transcription for a specific meeting */
  public disableMeeting(calendarEventId: string): MeetingPreference {
    return this.storage.setMeetingPreference(this.userId, calendarEventId, false);
  }

  /** Enable all meetings for today */
  public enableAllToday(): MeetingPreference[] {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const preferences: MeetingPreference[] = [];

    for (const meeting of this.upcomingMeetings) {
      const meetingStart = new Date(meeting.startTime);
      if (meetingStart >= startOfDay && meetingStart < endOfDay) {
        preferences.push(this.storage.setMeetingPreference(this.userId, meeting.eventId, true));
      }
    }

    return preferences;
  }

  /** Disable all meetings for today */
  public disableAllToday(): MeetingPreference[] {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const preferences: MeetingPreference[] = [];

    for (const meeting of this.upcomingMeetings) {
      const meetingStart = new Date(meeting.startTime);
      if (meetingStart >= startOfDay && meetingStart < endOfDay) {
        preferences.push(this.storage.setMeetingPreference(this.userId, meeting.eventId, false));
      }
    }

    return preferences;
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /** Schedule all enabled meetings that haven't started yet */
  private async scheduleEnabledMeetings(): Promise<void> {
    for (const event of this.upcomingMeetings) {
      const preference = this.storage.getMeetingPreference(this.userId, event.eventId);

      if (!preference?.enabled) {
        continue;
      }

      // Check if we already have an active or completed run for this event
      const existingRun = this.findActiveRun(event.eventId);
      if (existingRun) {
        continue; // Already running or scheduled
      }

      const meetingTime = new Date(event.startTime);
      const now = new Date();
      const timeUntilMeeting = meetingTime.getTime() - now.getTime();

      // Only schedule if the meeting is within the grace period
      if (timeUntilMeeting > TIMEOUTS.MEETING_START_GRACE_PERIOD_MS) {
        continue; // Too far in the future
      }

      // Start the meeting run
      await this.startMeetingRun(event);
    }
  }

  /** Find an active run for a given event */
  private findActiveRun(calendarEventId: string): MeetingRunContext | undefined {
    for (const [, context] of this.activeRuns) {
      if (context.event.eventId === calendarEventId) {
        return context;
      }
    }
    return undefined;
  }

  /** Start a meeting run for a given calendar event */
  private async startMeetingRun(event: CalendarEvent): Promise<void> {
    const meetingUrl = event.meetingUrl;
    if (!meetingUrl) {
      logger.warn('Scheduler: Cannot start meeting run - no meeting URL', { eventId: event.eventId });
      return;
    }

    const platform = event.platform ?? inferMeetingPlatform(meetingUrl);
    const provider = this.meetingProviderFactory(platform);

    // Create meeting run in storage
    const run = this.storage.createMeetingRun(this.userId, event.eventId, platform);
    const lifecycle = new MeetingLifecycle(run.id);

    const context: MeetingRunContext = {
      runId: run.id,
      lifecycle,
      event,
      provider,
      timeoutHandle: null,
      endCheckInterval: null,
    };

    this.activeRuns.set(run.id, context);

    try {
      // Transition: scheduled -> pending
      lifecycle.transition('pending', 'Meeting is about to start');
      this.storage.updateMeetingRunStatus(run.id, 'pending');

      // Transition: pending -> joining
      lifecycle.transition('joining', 'Attempting to join meeting');
      this.storage.updateMeetingRunStatus(run.id, 'joining');

      // Join the meeting
      await provider.joinMeeting(meetingUrl);

      // Transition: joining -> active
      lifecycle.transition('active', 'Successfully joined meeting');
      this.storage.updateMeetingRunStart(run.id);

      // Set up end-of-meeting detection
      context.endCheckInterval = setInterval(
        () => this.checkMeetingEnd(context),
        10_000 // Check every 10 seconds
      );

      // Set a maximum meeting duration timeout (4 hours)
      context.timeoutHandle = setTimeout(
        () => this.handleMeetingTimeout(context),
        4 * 60 * 60 * 1000
      );

      logger.info('Scheduler: Meeting run started', { runId: run.id, eventId: event.eventId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Transition to failed
      try {
        lifecycle.transition('failed', `Failed to start meeting: ${message}`);
      } catch {
        // If we can't transition, just force the state
        lifecycle.reset('failed');
      }

      this.storage.updateMeetingRunStatus(run.id, 'failed', message);
      this.cleanupRun(context);

      logger.error('Scheduler: Failed to start meeting run', {
        runId: run.id,
        eventId: event.eventId,
        error: message,
      });
    }
  }

  /** Check if the meeting has ended */
  private async checkMeetingEnd(context: MeetingRunContext): Promise<void> {
    try {
      const hasEnded = await context.provider.hasEnded();
      if (hasEnded) {
        await this.completeRun(context, 'ending', 'Meeting ended naturally');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Scheduler: Error checking meeting end', { runId: context.runId, error: message });
    }
  }

  /** Handle meeting timeout */
  private async handleMeetingTimeout(context: MeetingRunContext): Promise<void> {
    logger.warn('Scheduler: Meeting timeout reached', { runId: context.runId });
    await this.completeRun(context, 'ending', 'Maximum meeting duration reached');
  }

  /** Manually stop a meeting run */
  public async stopRun(runId: string, reason: string = 'User stopped transcription'): Promise<void> {
    const context = this.activeRuns.get(runId);
    if (!context) {
      logger.warn('Scheduler: Cannot stop run - not found', { runId });
      return;
    }

    await this.completeRun(context, 'ending', reason);
  }

  /** Cancel a run before it becomes active */
  private async cancelRun(runId: string, reason: string): Promise<void> {
    const context = this.activeRuns.get(runId);
    if (!context) return;

    try {
      context.lifecycle.transition('cancelled', reason);
    } catch {
      context.lifecycle.reset('cancelled');
    }

    this.storage.updateMeetingRunStatus(runId, 'cancelled', reason);
    this.cleanupRun(context);
  }

  /** Complete a meeting run */
  private async completeRun(
    context: MeetingRunContext,
    targetState: MeetingLifecycleState = 'ending',
    reason: string = 'Meeting completed'
  ): Promise<void> {
    try {
      // Transition to ending state
      if (context.lifecycle.canTransition('ending')) {
        context.lifecycle.transition('ending', reason);
        this.storage.updateMeetingRunStatus(context.runId, 'ending');
      }

      // Leave the meeting
      await context.provider.leaveMeeting();

      // Transition to completed
      if (context.lifecycle.canTransition('completed')) {
        context.lifecycle.transition('completed', reason);
      }

      this.storage.updateMeetingRunEnd(context.runId);
      logger.info('Scheduler: Meeting run completed', { runId: context.runId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Scheduler: Error completing meeting run', { runId: context.runId, error: message });

      try {
        context.lifecycle.transition('failed', `Error during completion: ${message}`);
      } catch {
        context.lifecycle.reset('failed');
      }

      this.storage.updateMeetingRunStatus(context.runId, 'failed', message);
    } finally {
      this.cleanupRun(context);
    }
  }

  /** Clean up timers and remove from active runs */
  private cleanupRun(context: MeetingRunContext): void {
    if (context.endCheckInterval) {
      clearInterval(context.endCheckInterval);
    }
    if (context.timeoutHandle) {
      clearTimeout(context.timeoutHandle);
    }
    this.activeRuns.delete(context.runId);
  }
}