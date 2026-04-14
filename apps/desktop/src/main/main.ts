// ============================================================================
// MeetScribe Desktop - Electron Main Process
// ============================================================================

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { logger } from '@meetscribe/logging';
import { APP_CONSTANTS } from '@meetscribe/shared';
import { DatabaseManager } from '@meetscribe/storage';
import { Scheduler } from '@meetscribe/scheduler';
import { GoogleCalendarProvider, MockMeetingProvider } from '@meetscribe/providers';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseManager | null = null;

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

  // In development, load from Vite dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  // Token activation
  ipcMain.handle('activate-token', async (_event, token: string) => {
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
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  logger.info('MeetScribe Desktop starting...');

  // Initialize local database
  const dbPath = path.join(app.getPath('userData'), 'meetscribe.db');
  db = new DatabaseManager(dbPath);
  db.initialize();
  logger.info('Local database initialized', { path: dbPath });

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