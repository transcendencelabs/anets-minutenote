// ============================================================================
// MeetScribe Desktop - Electron Preload Script
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Token activation
  activateToken: (token: string) => ipcRenderer.invoke('activate-token', token),

  // Folder picker
  pickFolder: () => ipcRenderer.invoke('pick-folder'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),

  // Meetings
  getMeetings: () => ipcRenderer.invoke('get-meetings'),
  enableMeeting: (eventId: string) => ipcRenderer.invoke('enable-meeting', eventId),
  disableMeeting: (eventId: string) => ipcRenderer.invoke('disable-meeting', eventId),
});