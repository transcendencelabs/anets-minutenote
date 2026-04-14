import React, { useState, useEffect } from 'react';

type AppScreen = 'activation' | 'meetings' | 'settings';

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
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    const result = (window as any).electron?.getSettings();
    if (result) setSettings(result);
  }, []);

  const handleTokenActivation = async () => {
    setTokenStatus('loading');
    const result = await (window as any).electron.activateToken(token);
    if (result?.valid) {
      setTokenStatus('valid');
      setScreen('meetings');
    } else {
      setTokenStatus('invalid');
    }
  };

  const handlePickFolder = async () => {
    const folder = await (window as any).electron.pickFolder();
    if (folder && settings) {
      const updated = await (window as any).electron.updateSettings({ ...settings, defaultTranscriptFolder: folder });
      setSettings(updated);
    }
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
        <button onClick={() => setScreen('settings')}>Settings</button>
      </div>
      {meetings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>
          <p>No upcoming meetings found.</p>
          <p>Connect your Google Calendar to see meetings with meeting links.</p>
        </div>
      ) : (
        meetings.map((m: any) => (
          <div key={m.eventId} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>{m.title}</h3>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{new Date(m.startTime).toLocaleString()} - {new Date(m.endTime).toLocaleString()}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>{m.platform}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <label style={{ fontSize: 14 }}><input type="checkbox" checked={m.transcriptionEnabled ?? false} style={{ marginRight: 4 }} />Transcribe</label>
              <span style={{ fontSize: 12, color: '#999' }}>{m.status}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default App;