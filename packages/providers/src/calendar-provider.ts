// ============================================================================
// MeetScribe Calendar Provider Interface
// ============================================================================

import type { CalendarEvent, CalendarProviderType } from '@meetscribe/shared';

export interface CalendarProviderConfig {
  provider: CalendarProviderType;
  credentials: Record<string, string>;
}

export interface CalendarProvider {
  /** The provider type identifier */
  readonly providerType: CalendarProviderType;

  /** Connect/authenticate with the calendar provider */
  connect(): Promise<void>;

  /** Disconnect and clean up credentials */
  disconnect(): Promise<void>;

  /** Check if the provider is currently connected */
  isConnected(): boolean;

  /** List upcoming meetings within the lookahead window */
  listUpcomingMeetings(): Promise<CalendarEvent[]>;

  /** Refresh data from the calendar provider */
  refresh(): Promise<CalendarEvent[]>;

  /** Get the OAuth authorization URL for initial consent */
  getAuthUrl(): string;

  /** Handle the OAuth callback with the authorization code */
  handleAuthCallback(code: string): Promise<void>;
}