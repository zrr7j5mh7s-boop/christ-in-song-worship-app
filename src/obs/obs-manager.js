// src/obs/obs-manager.js
//
// Main-process OBS WebSocket 5.x connection manager.
// Keeps credentials and the socket in the main process; renderer talks via IPC.

const { OBSWebSocket, OBSWebSocketError } = require('obs-websocket-js');
const log = require('electron-log/main');
const credentialStore = require('./obs-credential-store');

const STATES = {
  DISABLED: 'disabled',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTING: 'disconnecting',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};

const DEFAULT_SETTINGS = {
  enabled: false,
  host: '127.0.0.1',
  port: 4455,
  autoReconnect: true,
  reconnectIntervalMs: 5000,
};

let obs = null;
let mainWindow = null;
let connectionState = STATES.DISABLED;
let lastError = '';
let obsInfo = null;
let settings = { ...DEFAULT_SETTINGS };
let reconnectTimer = null;
let manualDisconnect = false;
let connectingPromise = null;

function getObsClient() {
  if (!obs) {
    obs = new OBSWebSocket();
    bindObsEvents(obs);
  }
  return obs;
}

function bindObsEvents(client) {
  client.on('ConnectionOpened', () => {
    connectionState = STATES.CONNECTED;
    lastError = '';
    broadcast('connectionOpened');
  });

  client.on('ConnectionClosed', () => {
    const wasConnected = connectionState === STATES.CONNECTED;
    connectionState = manualDisconnect ? STATES.DISABLED : STATES.DISCONNECTED;
    obsInfo = null;
    broadcast('connectionClosed', { wasConnected });
    if (!manualDisconnect && settings.enabled && settings.autoReconnect) {
      scheduleReconnect();
    }
  });

  client.on('ConnectionError', (error) => {
    lastError = formatError(error);
    connectionState = STATES.ERROR;
    broadcast('connectionError', { message: lastError });
    if (!manualDisconnect && settings.enabled && settings.autoReconnect) {
      scheduleReconnect();
    }
  });

  client.on('Identified', (payload) => {
    obsInfo = {
      negotiatedRpcVersion: payload?.negotiatedRpcVersion,
      obsWebSocketVersion: payload?.obsWebSocketVersion,
    };
    broadcast('identified', obsInfo);
  });

  const forwardEvents = [
    'CurrentProgramSceneChanged',
    'CurrentPreviewSceneChanged',
    'SceneListChanged',
    'StreamStateChanged',
    'RecordStateChanged',
    'VirtualcamStateChanged',
    'StudioModeStateChanged',
  ];

  forwardEvents.forEach((eventName) => {
    client.on(eventName, (data) => broadcast(eventName, data));
  });
}

function formatError(error) {
  if (!error) return 'Unknown OBS connection error';
  if (error instanceof OBSWebSocketError) {
    return error.message || `OBS error (code ${error.code})`;
  }
  return error.message || String(error);
}

function buildWsUrl(host, port) {
  const safeHost = String(host || DEFAULT_SETTINGS.host).trim() || DEFAULT_SETTINGS.host;
  const safePort = Number(port) || DEFAULT_SETTINGS.port;
  return `ws://${safeHost}:${safePort}`;
}

function getStatus() {
  return {
    state: connectionState,
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    autoReconnect: settings.autoReconnect,
    reconnectIntervalMs: settings.reconnectIntervalMs,
    hasPassword: credentialStore.hasPassword(),
    lastError,
    obsInfo,
    connected: connectionState === STATES.CONNECTED,
  };
}

function broadcast(eventName, data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('obs:event', {
    event: eventName,
    data: data || null,
    status: getStatus(),
    sentAt: Date.now(),
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  if (!settings.enabled || manualDisconnect) return;
  connectionState = STATES.RECONNECTING;
  broadcast('reconnectScheduled', { delayMs: settings.reconnectIntervalMs });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((error) => {
      log.warn('[obs] Reconnect failed:', error.message);
    });
  }, settings.reconnectIntervalMs);
}

function applySettings(nextSettings, options = {}) {
  settings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    ...nextSettings,
    host: String(nextSettings.host || settings.host || DEFAULT_SETTINGS.host).trim() || DEFAULT_SETTINGS.host,
    port: Number(nextSettings.port) || settings.port || DEFAULT_SETTINGS.port,
    reconnectIntervalMs: Math.max(2000, Number(nextSettings.reconnectIntervalMs) || settings.reconnectIntervalMs || 5000),
  };

  if (options.password !== undefined) {
    if (options.password === '') credentialStore.clearPassword();
    else credentialStore.savePassword(options.password);
  }

  if (!settings.enabled) {
    manualDisconnect = true;
    return disconnect();
  }

  manualDisconnect = false;
  if (options.connect !== false) {
    return connect();
  }
  return Promise.resolve(getStatus());
}

async function connect() {
  if (!settings.enabled) {
    connectionState = STATES.DISABLED;
    return getStatus();
  }

  if (connectingPromise) return connectingPromise;

  const client = getObsClient();
  if (client.identified) {
    connectionState = STATES.CONNECTED;
    return getStatus();
  }

  manualDisconnect = false;
  clearReconnectTimer();
  connectionState = STATES.CONNECTING;
  broadcast('connecting');

  const url = buildWsUrl(settings.host, settings.port);
  const password = credentialStore.getPassword();

  connectingPromise = client.connect(url, password || undefined)
    .then(async () => {
      try {
        const version = await client.call('GetVersion');
        obsInfo = {
          ...obsInfo,
          obsVersion: version?.obsVersion,
          obsWebSocketVersion: version?.obsWebSocketVersion || obsInfo?.obsWebSocketVersion,
          platform: version?.platform,
          platformDescription: version?.platformDescription,
        };
        broadcast('version', obsInfo);
      } catch (error) {
        log.warn('[obs] GetVersion failed after connect:', error.message);
      }
      connectionState = STATES.CONNECTED;
      return getStatus();
    })
    .catch((error) => {
      lastError = formatError(error);
      connectionState = STATES.ERROR;
      broadcast('connectionError', { message: lastError });
      if (settings.autoReconnect) scheduleReconnect();
      throw error;
    })
    .finally(() => {
      connectingPromise = null;
    });

  return connectingPromise;
}

async function disconnect() {
  clearReconnectTimer();
  manualDisconnect = true;
  const client = getObsClient();

  if (!client.identified && connectionState !== STATES.CONNECTING) {
    connectionState = settings.enabled ? STATES.DISCONNECTED : STATES.DISABLED;
    broadcast('disconnected');
    return getStatus();
  }

  connectionState = STATES.DISCONNECTING;
  broadcast('disconnecting');

  try {
    await client.disconnect();
  } catch (error) {
    log.warn('[obs] Disconnect error:', error.message);
  }

  connectionState = settings.enabled ? STATES.DISCONNECTED : STATES.DISABLED;
  obsInfo = null;
  broadcast('disconnected');
  return getStatus();
}

async function testConnection(testSettings) {
  const host = String(testSettings?.host || settings.host || DEFAULT_SETTINGS.host).trim();
  const port = Number(testSettings?.port) || settings.port || DEFAULT_SETTINGS.port;
  const password = testSettings?.password !== undefined
    ? String(testSettings.password || '')
    : credentialStore.getPassword();
  const url = buildWsUrl(host, port);
  const probe = new OBSWebSocket();

  try {
    await probe.connect(url, password || undefined);
    const version = await probe.call('GetVersion');
    await probe.disconnect();
    return {
      ok: true,
      obsVersion: version?.obsVersion,
      obsWebSocketVersion: version?.obsWebSocketVersion,
      platform: version?.platform,
    };
  } catch (error) {
    try {
      await probe.disconnect();
    } catch (_ignored) {}
    return {
      ok: false,
      message: formatError(error),
    };
  }
}

async function call(requestType, requestData) {
  const client = getObsClient();
  if (!client.identified) {
    throw new Error('OBS is not connected');
  }
  return client.call(requestType, requestData);
}

function setMainWindow(win) {
  mainWindow = win;
}

function registerIpc(ipcMain) {
  ipcMain.handle('obs:get-status', () => getStatus());

  ipcMain.handle('obs:get-settings', () => ({
    ...settings,
    hasPassword: credentialStore.hasPassword(),
  }));

  ipcMain.handle('obs:save-settings', (_event, payload) => {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, message: 'Invalid OBS settings payload' };
    }
    const { password, connect, ...rest } = payload;
    return applySettings(rest, { password, connect: connect !== false })
      .then(() => ({ ok: true, status: getStatus() }))
      .catch((error) => ({ ok: false, message: formatError(error), status: getStatus() }));
  });

  ipcMain.handle('obs:connect', () => {
    settings.enabled = true;
    manualDisconnect = false;
    return connect()
      .then(() => ({ ok: true, status: getStatus() }))
      .catch((error) => ({ ok: false, message: formatError(error), status: getStatus() }));
  });

  ipcMain.handle('obs:disconnect', () => disconnect().then(() => ({ ok: true, status: getStatus() })));

  ipcMain.handle('obs:test-connection', (_event, payload) => testConnection(payload || {}));

  ipcMain.handle('obs:call', async (_event, requestType, requestData) => {
    try {
      const data = await call(requestType, requestData);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, message: formatError(error) };
    }
  });
}

module.exports = {
  STATES,
  DEFAULT_SETTINGS,
  setMainWindow,
  registerIpc,
  getStatus,
  applySettings,
  connect,
  disconnect,
  testConnection,
  call,
};
