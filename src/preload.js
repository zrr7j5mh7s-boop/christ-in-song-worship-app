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
,

  obs: {
    getStatus: () => ipcRenderer.invoke('obs:get-status'),

    getSettings: () => ipcRenderer.invoke('obs:get-settings'),

    saveSettings: (payload) => ipcRenderer.invoke('obs:save-settings', payload),

    connect: () => ipcRenderer.invoke('obs:connect'),

    disconnect: () => ipcRenderer.invoke('obs:disconnect'),

    testConnection: (payload) => ipcRenderer.invoke('obs:test-connection', payload),

    call: (requestType, requestData) => ipcRenderer.invoke('obs:call', requestType, requestData),

    onEvent: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('obs:event', listener);
      return () => ipcRenderer.removeListener('obs:event', listener);
    },
  },
});
