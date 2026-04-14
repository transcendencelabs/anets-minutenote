// ============================================================================
// MeetScribe Google Calendar Provider
// ============================================================================

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CalendarEvent, CalendarProviderType } from '@meetscribe/shared';
import { inferMeetingPlatform, TIMEOUTS } from '@meetscribe/shared';
import { logger } from '@meetscribe/logging';
import type { CalendarProvider } from './calendar-provider';

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export class GoogleCalendarProvider implements CalendarProvider {
  public readonly providerType: CalendarProviderType = 'google';
  private oauth2Client: OAuth2Client;
  private calendar: ReturnType<typeof google.calendar> | null = null;
  private connected = false;

  constructor(config: GoogleCalendarConfig) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    if (config.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.refreshToken,
      });
    }
  }

  public getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  public async handleAuthCallback(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    logger.info('Google OAuth callback handled successfully');
  }

  public async connect(): Promise<void> {
    try {
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Verify connection by fetching calendar list
      await this.calendar.calendarList.list({ maxResults: 1 });
      this.connected = true;
      logger.info('Google Calendar connected successfully');
    } catch (error) {
      this.connected = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to connect to Google Calendar', { error: message });
      throw new Error(`Google Calendar connection failed: ${message}`);
    }
  }

  public async disconnect(): Promise<void> {
    this.oauth2Client.revokeCredentials();
    this.calendar = null;
    this.connected = false;
    logger.info('Google Calendar disconnected');
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async listUpcomingMeetings(): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error('Google Calendar not connected. Call connect() first.');
    }

    const now = new Date();
    const lookahead = new Date(now.getTime() + TIMEOUTS.CALENDAR_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const lookback = new Date(now.getTime() - TIMEOUTS.CALENDAR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: lookback.toISOString(),
        timeMax: lookahead.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });

      const events = response.data.items ?? [];
      return events
        .filter((event) => this.hasMeetingLink(event))
        .map((event) => this.mapEventToCalendarEvent(event));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch calendar events', { error: message });
      throw new Error(`Failed to fetch calendar events: ${message}`);
    }
  }

  public async refresh(): Promise<CalendarEvent[]> {
    return this.listUpcomingMeetings();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private hasMeetingLink(event: any): boolean {
    const location = event.location ?? '';
    const description = event.description ?? '';
    const hangoutLink = event.hangoutLink ?? '';

    return !!(
      hangoutLink ||
      location.includes('meet.google.com') ||
      location.includes('zoom.us') ||
      location.includes('teams.microsoft.com') ||
      description.includes('meet.google.com') ||
      description.includes('zoom.us') ||
      description.includes('teams.microsoft.com')
    );
  }

  private extractMeetingUrl(event: any): string | undefined {
    if (event.hangoutLink) return event.hangoutLink;

    const location = event.location ?? '';
    const description = event.description ?? '';

    const urlPatterns = [
      /https?:\/\/meet\.google\.com\/[a-z-]+/i,
      /https?:\/\/[a-z0-9.-]+zoom\.us\/[a-z]/i,
      /https?:\/\/teams\.microsoft\.com\/[a-z]/i,
    ];

    const sources = [location, description];
    for (const source of sources) {
      for (const pattern of urlPatterns) {
        const match = source.match(pattern);
        if (match) return match[0];
      }
    }

    return undefined;
  }

  private mapEventToCalendarEvent(event: any): CalendarEvent {
    const meetingUrl = this.extractMeetingUrl(event);
    const attendees = event.attendees?.map((a: any) => ({
      email: a.email ?? '',
      displayName: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    })) ?? [];

    return {
      eventId: event.id,
      title: event.summary ?? 'Untitled Meeting',
      description: event.description ?? undefined,
      startTime: event.start?.dateTime ?? event.start?.date ?? '',
      endTime: event.end?.dateTime ?? event.end?.date ?? '',
      organizer: event.organizer?.email ?? undefined,
      attendees,
      meetingUrl,
      platform: meetingUrl ? inferMeetingPlatform(meetingUrl) : 'unknown',
      calendarSource: 'google',
    };
  }
}