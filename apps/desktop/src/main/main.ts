// ============================================================================
// MeetScribe Desktop - Electron Main Process
// ============================================================================

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { logger } from '@meetscribe/logging';
import { APP_CONSTANTS } from '@meetscribe/shared';

// Load env from backend config
import dotenv from 'dotenv';
// Compiled output is at dist/main/main.js, so __dirname resolves to apps/desktop/dist/main
// We need to go up 3 directories to reach the project root, then into apps/backend
const envFilePath = path.join(__dirname, '../../../../apps/backend/.env');
logger.info('Loading .env from', { path: envFilePath });
dotenv.config({ path: envFilePath });
// better-sqlite3 is a native module that must be rebuilt for Electron.
// If the rebuild hasn't been run, the import will fail at runtime.
let DatabaseManager: any;
try {
  ({ DatabaseManager } = require('@meetscribe/storage'));
} catch (err) {
  console.warn('Failed to load @meetscribe/storage (native module). Run: npx @electron/rebuild -w better-sqlite3', err);
  DatabaseManager = null;
}

let mainWindow: BrowserWindow | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: APP_CONSTANTS.WINDOW_DEFAULT_WIDTH,
    height: APP_CONSTANTS.WINDOW_DEFAULT_HEIGHT,
    minWidth: APP_CONSTANTS.WINDOW_MIN_WIDTH,
    minHeight: APP_CONSTANTS.WINDOW_MIN_HEIGHT,
    title: APP_CONSTANTS.APP_NAME,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load built renderer files
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  // Token activation
  ipcMain.handle('activate-token', async (_event, _token: string) => {
    logger.info('Token activation requested');
    // TODO: Call backend API to validate token
    return { valid: false, error: 'Not yet connected to backend' };
  });

  // Folder picker
  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Transcript Save Folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Get settings
  ipcMain.handle('get-settings', async () => {
    if (!db) return null;
    return db.getSettings();
  });

  // Update settings
  ipcMain.handle('update-settings', async (_event, settings) => {
    if (!db) return null;
    return db.updateSettings(settings);
  });

  // Get meetings
  ipcMain.handle('get-meetings', async () => {
    if (!db) return [];
    // TODO: Integrate with calendar provider
    return [];
  });

  // Enable meeting transcription
  ipcMain.handle('enable-meeting', async (_event, eventId: string) => {
    if (!db) return null;
    const user = db.getUserById('default');
    if (!user) return null;
    return db.setMeetingPreference(user.id, eventId, true);
  });

  // Disable meeting transcription
  ipcMain.handle('disable-meeting', async (_event, eventId: string) => {
    if (!db) return null;
    const user = db.getUserById('default');
    if (!user) return null;
    return db.setMeetingPreference(user.id, eventId, false);
  });

  // Google Calendar OAuth (opens browser window for authorization)
  ipcMain.handle('google-calendar-get-auth-url', async () => {
    logger.info('Google Calendar auth URL requested');
    try {
      const { GoogleCalendarProvider } = require('@meetscribe/providers');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3456/api/auth/google/callback';
      if (!clientId || !clientSecret) {
        return { error: 'Google OAuth credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)' };
      }
      const provider = new GoogleCalendarProvider({ clientId, clientSecret, redirectUri });
      const authUrl = provider.getAuthUrl();
      
      // Open OAuth window in Electron's shell (opens in default browser)
      const { shell } = require('electron');
      shell.openExternal(authUrl);
      
      return { success: true, message: 'Please complete authorization in your browser. For development, paste the authorization code from the browser URL after login.' };
    } catch (err) {
      return { error: String(err) };
    }
  });

  ipcMain.handle('google-calendar-callback', async (_event, codeOrUrl: string) => {
    logger.info('Google Calendar OAuth callback received');
    try {
      const { GoogleCalendarProvider } = require('@meetscribe/providers');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3456/api/auth/google/callback';
      const provider = new GoogleCalendarProvider({ clientId, clientSecret, redirectUri });

      // Extract code from URL if a full URL was pasted
      let code = codeOrUrl;
      try {
        const url = new URL(codeOrUrl);
        const urlCode = url.searchParams.get('code');
        if (urlCode) {
          code = urlCode;
          logger.info('Extracted authorization code from URL');
        }
        // Also check for error parameters
        const authError = url.searchParams.get('authError');
        if (authError) {
          const errorMsg = decodeURIComponent(authError);
          return { error: `Google OAuth error: ${errorMsg}` };
        }
      } catch {
        // Not a valid URL, treat as raw code
      }

      await provider.handleAuthCallback(code);
      await provider.connect();
      // Store connection in DB
      let user = db.getUserById('default');
      if (!user) {
        user = db.createUser('default@example.com');
      }
      const connections = db.getCalendarConnectionsByUserId(user.id);
      if (connections.length > 0) {
        db.updateCalendarConnectionOAuth(connections[0].id, 'connected', 'stored', ['https://www.googleapis.com/auth/calendar.readonly']);
      } else {
        db.createCalendarConnection(user.id, 'google', 'connected', 'stored', ['https://www.googleapis.com/auth/calendar.readonly']);
      }
      return { success: true };
    } catch (err) {
      return { error: String(err) };
    }
  });

  ipcMain.handle('get-calendar-events', async () => {
    try {
      const { GoogleCalendarProvider } = require('@meetscribe/providers');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3456/api/auth/google/callback';
      const provider = new GoogleCalendarProvider({ clientId, clientSecret, redirectUri });
      // TODO: Load stored refresh token and use it
      await provider.connect();
      return { events: await provider.listUpcomingMeetings() };
    } catch (err) {
      return { error: String(err), events: [] };
    }
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  logger.info('MeetScribe Desktop starting...');

  // Initialize local database (gracefully handle native module failure)
  if (DatabaseManager) {
    try {
      const dbPath = path.join(app.getPath('userData'), 'meetscribe.db');
      db = new DatabaseManager(dbPath);
      db.initialize();
      logger.info('Local database initialized', { path: dbPath });
    } catch (err) {
      logger.error('Failed to initialize database', { error: String(err) });
    }
  } else {
    logger.warn('Database module not available. Run: npx @electron/rebuild -w better-sqlite3');
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create main window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
    db = null;
  }
  logger.info('MeetScribe Desktop shutting down');
});