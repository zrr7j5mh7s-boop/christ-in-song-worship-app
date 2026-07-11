// src/preload.js
//
// Secure bridge between Electron main process and the renderer (app/).
// contextIsolation is on; nodeIntegration is off in main.js.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  getAppInfo: () => ipcRenderer.invoke('app:info'),

  checkForUpdates: () => ipcRenderer.invoke('updates:check'),

  onMenuCommand: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('menu-command', listener);
    return () => ipcRenderer.removeListener('menu-command', listener);
  },

  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },

  openProjector: () => ipcRenderer.invoke('presenter:open'),

  closeProjector: () => ipcRenderer.invoke('presenter:close'),

  publishPresenterState: (payload) => ipcRenderer.invoke('presenter:publish', payload),

  onPresenterState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('presenter-state', listener);
    return () => ipcRenderer.removeListener('presenter-state', listener);
  },

  onPresenterClosed: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('presenter-closed', listener);
    return () => ipcRenderer.removeListener('presenter-closed', listener);
  },
});
