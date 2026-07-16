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

  openLogsFolder: () => ipcRenderer.invoke('app:open-logs'),

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

  quietMode: {
    setActive: (enabled) => ipcRenderer.invoke('quiet-mode:set-active', { enabled: Boolean(enabled) }),
    setPowerBlocker: (enabled) => ipcRenderer.invoke('quiet-mode:set-power-blocker', { enabled: Boolean(enabled) }),
  },

  openProjector: () => ipcRenderer.invoke('presenter:open'),

  closeProjector: () => ipcRenderer.invoke('presenter:close'),

  publishPresenterState: (payload) => ipcRenderer.invoke('presenter:publish', payload),

  sendPresenterCommand: (command) => ipcRenderer.send('presenter:command', command),

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

  obsHttp: {
    start: (options) => ipcRenderer.invoke('obs-http:start', options),

    stop: () => ipcRenderer.invoke('obs-http:stop'),

    getInfo: () => ipcRenderer.invoke('obs-http:get-info'),

    publish: (payload) => ipcRenderer.invoke('obs-http:publish', payload),

    getLive: () => ipcRenderer.invoke('obs-http:get-live'),
  },

  obsMonitor: {
    open: (payload) => ipcRenderer.invoke('obs-monitor:open', payload),

    close: () => ipcRenderer.invoke('obs-monitor:close'),

    getStartPrefs: () => ipcRenderer.invoke('obs-monitor:get-start-prefs'),

    getWorshipContext: () => ipcRenderer.invoke('obs-monitor:get-worship-context'),

    setWorshipContext: (payload) => ipcRenderer.invoke('obs-monitor:set-worship-context', payload),

    notifyStopped: () => ipcRenderer.invoke('obs-monitor:stopped'),

    onClosed: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = () => callback();
      ipcRenderer.on('obs-monitor-closed', listener);
      return () => ipcRenderer.removeListener('obs-monitor-closed', listener);
    },

    onStopped: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = () => callback();
      ipcRenderer.on('obs-monitor-stopped', listener);
      return () => ipcRenderer.removeListener('obs-monitor-stopped', listener);
    },
  },

  cameraPreview: {
    open: () => ipcRenderer.invoke('camera-preview:open'),

    close: () => ipcRenderer.invoke('camera-preview:close'),

    onClosed: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = () => callback();
      ipcRenderer.on('camera-preview-closed', listener);
      return () => ipcRenderer.removeListener('camera-preview-closed', listener);
    },
  },

  license: {
    getLicenceStatus: () => ipcRenderer.invoke('license:get-status'),

    activateLicence: (email, code, deviceName) => ipcRenderer.invoke('license:activate', {
      email,
      code,
      deviceName,
    }),

    validateLicence: () => ipcRenderer.invoke('license:validate'),

    deactivateLicence: () => ipcRenderer.invoke('license:deactivate'),

    isCommandAllowed: (command) => ipcRenderer.invoke('license:is-command-allowed', { command }),

    onLicenseStatus: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('license-status', listener);
      return () => ipcRenderer.removeListener('license-status', listener);
    },
  },

  stageDisplay: {
    listDisplays: () => ipcRenderer.invoke('stage-display:list-displays'),

    savePrefs: (payload) => ipcRenderer.invoke('stage-display:save-prefs', payload),

    getStartPrefs: () => ipcRenderer.invoke('stage-display:get-start-prefs'),

    open: (payload) => ipcRenderer.invoke('stage-display:open', payload),

    close: () => ipcRenderer.invoke('stage-display:close'),

    restart: (payload) => ipcRenderer.invoke('stage-display:restart', payload),

    publish: (payload) => ipcRenderer.invoke('stage-display:publish', payload),

    notifyClosed: () => ipcRenderer.invoke('stage-display:closed'),

    onState: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('stage-display-state', listener);
      return () => ipcRenderer.removeListener('stage-display-state', listener);
    },

    onClosed: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = () => callback();
      ipcRenderer.on('stage-display-closed', listener);
      return () => ipcRenderer.removeListener('stage-display-closed', listener);
    },

    onDisplaysChanged: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('stage-display-displays-changed', listener);
      return () => ipcRenderer.removeListener('stage-display-displays-changed', listener);
    },
  },
});
