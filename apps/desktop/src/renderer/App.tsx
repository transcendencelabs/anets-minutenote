import React, { useState, useEffect } from 'react';

type AppScreen = 'activation' | 'meetings' | 'settings';

interface CalendarEvent {
  eventId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string;
  platform?: string;
  transcriptionEnabled?: boolean;
}

interface AppSettings {
  defaultTranscriptFolder: string;
  autoStartOnLogin: boolean;
  defaultEnablementBehavior: boolean;
  transcriptFormat: string;
  speakerConfidenceDisplay: boolean;
  timezone: string;
  debugLogging: boolean;
}

export const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>('activation');
  const [token, setToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [meetings, setMeetings] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [calendarStep, setCalendarStep] = useState<'idle' | 'browser-opened' | 'waiting-for-code'>('idle');
  const [authCode, setAuthCode] = useState('');
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    const result = (window as any).electronAPI?.getSettings();
    if (result) setSettings(result);
  }, []);

  useEffect(() => {
    if (screen === 'meetings' && calendarConnected) {
      loadCalendarEvents();
    }
  }, [screen, calendarConnected]);

  const handleTokenActivation = async () => {
    setTokenStatus('loading');
    try {
      const result = await (window as any).electronAPI.activateToken(token);
      if (result?.valid) {
        setTokenStatus('valid');
        setScreen('meetings');
      } else {
        setTokenStatus('invalid');
      }
    } catch {
      setTokenStatus('invalid');
    }
  };

  const handleConnectGoogleCalendar = async () => {
    setConnectingCalendar(true);
    setCalendarError(null);
    setCalendarStep('browser-opened');
    try {
      const result = await (window as any).electronAPI.getGoogleCalendarAuthUrl();
      if (result.error) {
        setCalendarError(result.error);
        setConnectingCalendar(false);
        setCalendarStep('idle');
        return;
      }
      // Auth URL was opened in browser, stop connecting state so input is active
      setConnectingCalendar(false);
      setCalendarStep('waiting-for-code');
    } catch (err) {
      setCalendarError('Failed to start Google Calendar connection');
      setConnectingCalendar(false);
      setCalendarStep('idle');
    }
  };

  const handleAuthCodeSubmit = async () => {
    if (!authCode.trim()) return;
    setConnectingCalendar(true);
    try {
      const result = await (window as any).electronAPI.handleGoogleCalendarCallback(authCode.trim());
      if (result.success) {
        setCalendarConnected(true);
        setCalendarStep('idle');
        setAuthCode('');
        await loadCalendarEvents();
      } else {
        setCalendarError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setCalendarError('Failed to complete authentication');
    }
    setConnectingCalendar(false);
  };

  const loadCalendarEvents = async () => {
    try {
      const result = await (window as any).electronAPI.getCalendarEvents();
      if (result.events) {
        setMeetings(result.events);
      }
    } catch {
      // ignore
    }
  };

  const handlePickFolder = async () => {
    try {
      const folder = await (window as any).electronAPI.pickFolder();
      if (folder && settings) {
        const updated = await (window as any).electronAPI.updateSettings({ ...settings, defaultTranscriptFolder: folder });
        setSettings(updated);
      }
    } catch {
      // ignore
    }
  };

  const toggleMeetingTranscription = (eventId: string) => {
    if (calendarConnected) {
      (window as any).electronAPI.enableMeeting(eventId);
    }
    setMeetings(meetings.map(m =>
      m.eventId === eventId ? { ...m, transcriptionEnabled: !m.transcriptionEnabled } : m
    ));
  };

  if (screen === 'activation') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1>MeetScribe</h1>
        <p>Meeting transcription client</p>
        <div style={{ marginTop: 24 }}>
          <label htmlFor="token" style={{ display: 'block', marginBottom: 8 }}>Enter your access token:</label>
          <input id="token" type="text" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your token here" disabled={tokenStatus === 'loading'}
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }} />
          <button onClick={handleTokenActivation} disabled={tokenStatus === 'loading' || !token.trim()}
            style={{ padding: '8px 24px' }}>
            {tokenStatus === 'loading' ? 'Validating...' : 'Activate'}
          </button>
          {tokenStatus === 'invalid' && <p style={{ color: 'red', marginTop: 8 }}>Invalid token. Please check and try again.</p>}
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setScreen('meetings')} style={{ padding: '8px 24px', background: '#e0e0e0', border: 'none', borderRadius: 4 }}>Skip (Dev Mode)</button>
        </div>
      </div>
    );
  }

  if (screen === 'settings') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Settings</h1>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Transcript Save Folder:</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ flex: 1, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>{settings?.defaultTranscriptFolder || 'No folder selected'}</span>
            <button onClick={handlePickFolder} style={{ padding: '8px 16px' }}>Browse</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label><input type="checkbox" checked={settings?.autoStartOnLogin ?? false} style={{ marginRight: 8 }} />Auto-start on login</label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label><input type="checkbox" checked={settings?.speakerConfidenceDisplay ?? true} style={{ marginRight: 8 }} />Show speaker confidence</label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label><input type="checkbox" checked={settings?.debugLogging ?? false} style={{ marginRight: 8 }} />Debug logging</label>
        </div>
        <button onClick={() => setScreen('meetings')} style={{ marginTop: 16, padding: '8px 24px' }}>Back to Meetings</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>MeetScribe</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!calendarConnected && (
            <button onClick={handleConnectGoogleCalendar} disabled={connectingCalendar && calendarStep === 'browser-opened'} style={{ padding: '8px 16px' }}>
              {connectingCalendar ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          )}
          {calendarConnected && <span style={{ padding: '8px 16px', color: '#4caf50' }}>✓ Calendar Connected</span>}
          <button onClick={() => setScreen('settings')}>Settings</button>
        </div>
      </div>
      {calendarError && <p style={{ color: 'red', padding: 8, background: '#ffebee', borderRadius: 4 }}>{calendarError}</p>}
      {!calendarConnected ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          {calendarStep === 'idle' && (
            <>
              <p style={{ color: '#666', marginBottom: 24 }}>Connect your Google Calendar to see meetings with meeting links.</p>
              <button onClick={handleConnectGoogleCalendar} disabled={connectingCalendar} style={{ padding: '12px 24px', fontSize: 16 }}>
                {connectingCalendar ? 'Connecting...' : 'Connect Google Calendar'}
              </button>
            </>
          )}
          {calendarStep === 'browser-opened' && (
            <p style={{ color: '#666' }}>Opening Google authorization page in your browser...</p>
          )}
          {calendarStep === 'waiting-for-code' && (
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <p style={{ color: '#666', marginBottom: 16 }}>Open your browser and authorize MeetScribe with Google. After authorization, you'll be redirected to a URL (e.g. http://localhost:3456/api/auth/google/callback?code=...). <strong>Paste the entire URL below</strong> and the app will extract the authorization code automatically.</p>
              <input
                id="authCodeInput"
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAuthCodeSubmit(); }}
                placeholder="Paste the full redirect URL here"
                disabled={connectingCalendar}
                autoFocus
                style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 4 }}
              />
              <button onClick={handleAuthCodeSubmit} disabled={connectingCalendar || !authCode.trim()} style={{ padding: '8px 24px', cursor: 'pointer' }}>
                {connectingCalendar ? 'Authenticating...' : 'Submit Code'}
              </button>
            </div>
          )}
        </div>
      ) : meetings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>
          <p>No upcoming meetings found.</p>
        </div>
      ) : (
        meetings.map((m) => (
          <div key={m.eventId} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>{m.title}</h3>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{new Date(m.startTime).toLocaleString()} - {new Date(m.endTime).toLocaleString()}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>{m.platform}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <label style={{ fontSize: 14 }}>
                <input type="checkbox" checked={m.transcriptionEnabled ?? false} onChange={() => toggleMeetingTranscription(m.eventId)} style={{ marginRight: 4 }} />
                Transcribe
              </label>
              <span style={{ fontSize: 12, color: '#999' }}>
                <a href={m.meetingUrl} target="_blank" rel="noreferrer">Join Meeting</a>
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default App;