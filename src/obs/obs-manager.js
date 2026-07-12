// src/obs/obs-manager.js
//
// Main-process OBS WebSocket 5.x connection manager.
// Keeps credentials and the socket in the main process; renderer talks via IPC.

const { OBSWebSocket, OBSWebSocketError } = require('obs-websocket-js');
const log = require('electron-log/main');
const credentialStore = require('./obs-credential-store');
const {
  formatObsAuthenticationError,
  isAuthenticationError,
  resolveStoredPassword,
} = require('./obs-auth-errors');

const STATES = {
  DISABLED: 'disabled',
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  AUTHENTICATING: 'authenticating',
  CONNECTED: 'connected',
  DISCONNECTING: 'disconnecting',
  RECONNECTING: 'reconnecting',
  AUTHENTICATION_FAILED: 'authentication_failed',
  CONNECTION_FAILED: 'connection_failed',
  OBS_UNAVAILABLE: 'obs_unavailable',
  VERSION_UNSUPPORTED: 'version_unsupported',
  ERROR: 'error',
};

const DEFAULT_SETTINGS = {
  enabled: false,
  host: '127.0.0.1',
  port: 4455,
  autoConnectOnStart: false,
  autoReconnect: true,
  reconnectIntervalMs: 5000,
  connectionTimeoutMs: 10000,
};

let obs = null;
let mainWindow = null;
let connectionState = STATES.DISABLED;
let lastError = '';
let obsInfo = null;
let obsRuntime = createDefaultRuntime();
let settings = { ...DEFAULT_SETTINGS };
let reconnectTimer = null;
let manualDisconnect = false;
let connectingPromise = null;

function createDefaultRuntime() {
  return {
    streaming: false,
    recording: false,
    virtualCamera: false,
    studioMode: false,
    programScene: '',
    previewScene: '',
    currentProfile: '',
    currentSceneCollection: '',
  };
}

function getObsClient() {
  if (!obs) {
    obs = new OBSWebSocket();
    bindObsEvents(obs);
  }
  return obs;
}

function bindObsEvents(client) {
  client.on('ConnectionOpened', () => {
    connectionState = STATES.AUTHENTICATING;
    broadcast('authenticating');
  });

  client.on('ConnectionClosed', () => {
    const wasConnected = connectionState === STATES.CONNECTED;
    connectionState = manualDisconnect ? STATES.DISABLED : STATES.DISCONNECTED;
    obsInfo = null;
    obsRuntime = createDefaultRuntime();
    broadcast('connectionClosed', { wasConnected });
    if (!manualDisconnect && settings.enabled && settings.autoReconnect) {
      scheduleReconnect();
    }
  });

  client.on('ConnectionError', (error) => {
    const classified = classifyConnectionError(error);
    lastError = classified.message;
    connectionState = classified.state;
    log.warn('[obs] Connection error:', lastError);
    broadcast('connectionError', { message: lastError, state: connectionState });
    if (!manualDisconnect && settings.enabled && settings.autoReconnect) {
      scheduleReconnect();
    }
  });

  client.on('Identified', (payload) => {
    connectionState = STATES.CONNECTED;
    lastError = '';
    obsInfo = {
      negotiatedRpcVersion: payload?.negotiatedRpcVersion,
      obsWebSocketVersion: payload?.obsWebSocketVersion,
    };
    broadcast('identified', obsInfo);
    syncRuntimeState().catch((error) => {
      log.warn('[obs] Runtime sync after identify failed:', error.message);
    });
  });

  client.on('CurrentProgramSceneChanged', (data) => {
    obsRuntime.programScene = data?.sceneName || '';
    broadcast('CurrentProgramSceneChanged', data);
  });

  client.on('CurrentPreviewSceneChanged', (data) => {
    obsRuntime.previewScene = data?.sceneName || '';
    broadcast('CurrentPreviewSceneChanged', data);
  });

  client.on('SceneListChanged', (data) => broadcast('SceneListChanged', data));

  client.on('StreamStateChanged', (data) => {
    obsRuntime.streaming = Boolean(data?.outputActive);
    broadcast('StreamStateChanged', data);
  });

  client.on('RecordStateChanged', (data) => {
    obsRuntime.recording = Boolean(data?.outputActive);
    broadcast('RecordStateChanged', data);
  });

  client.on('VirtualcamStateChanged', (data) => {
    obsRuntime.virtualCamera = Boolean(data?.outputActive);
    broadcast('VirtualcamStateChanged', data);
  });

  client.on('StudioModeStateChanged', (data) => {
    obsRuntime.studioMode = Boolean(data?.studioModeEnabled);
    broadcast('StudioModeStateChanged', data);
  });
}

function formatError(error) {
  if (!error) return 'Unknown OBS connection error';
  if (error instanceof OBSWebSocketError) {
    return error.message || `OBS error (code ${error.code})`;
  }
  return error.message || String(error);
}

function resolveConnectionPassword(explicitPassword) {
  if (explicitPassword !== undefined) {
    return String(explicitPassword || '');
  }
  return resolveStoredPassword(credentialStore.hasPassword(), credentialStore.getPassword());
}

function classifyConnectionError(error) {
  const rawMessage = formatError(error);
  const message = formatObsAuthenticationError(rawMessage, credentialStore.hasPassword());
  const code = error instanceof OBSWebSocketError ? error.code : error?.code ?? null;
  const lower = rawMessage.toLowerCase();

  if (isAuthenticationError(rawMessage, code)) {
    return { state: STATES.AUTHENTICATION_FAILED, message };
  }
  if (code === 4004 || lower.includes('rpc version') || lower.includes('version')) {
    return { state: STATES.VERSION_UNSUPPORTED, message };
  }
  if (
    lower.includes('econnrefused')
    || lower.includes('enotfound')
    || lower.includes('econnreset')
    || lower.includes('not reachable')
    || lower.includes('could not connect')
    || lower.includes('websocket connection failed')
  ) {
    return { state: STATES.OBS_UNAVAILABLE, message };
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { state: STATES.CONNECTION_FAILED, message };
  }
  return { state: STATES.CONNECTION_FAILED, message };
}

function buildWsUrl(host, port) {
  const safeHost = String(host || DEFAULT_SETTINGS.host).trim() || DEFAULT_SETTINGS.host;
  const safePort = Number(port) || DEFAULT_SETTINGS.port;
  return `ws://${safeHost}:${safePort}`;
}

function withTimeout(promise, timeoutMs) {
  const ms = Math.max(3000, Number(timeoutMs) || DEFAULT_SETTINGS.connectionTimeoutMs);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`OBS connection timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function getStatus() {
  return {
    state: connectionState,
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    autoConnectOnStart: settings.autoConnectOnStart,
    autoReconnect: settings.autoReconnect,
    reconnectIntervalMs: settings.reconnectIntervalMs,
    connectionTimeoutMs: settings.connectionTimeoutMs,
    hasPassword: credentialStore.hasPassword(),
    lastError,
    obsInfo,
    obsRuntime: { ...obsRuntime },
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

async function syncRuntimeState() {
  const client = getObsClient();
  if (!client.identified) return obsRuntime;

  try {
    const version = await client.call('GetVersion');
    obsInfo = {
      ...obsInfo,
      obsVersion: version?.obsVersion,
      obsWebSocketVersion: version?.obsWebSocketVersion || obsInfo?.obsWebSocketVersion,
      platform: version?.platform,
      platformDescription: version?.platformDescription,
    };
  } catch (error) {
    log.warn('[obs] GetVersion failed:', error.message);
  }

  const safeCall = async (requestType) => {
    try {
      return await client.call(requestType);
    } catch (error) {
      log.debug(`[obs] ${requestType} skipped:`, error.message);
      return null;
    }
  };

  const stream = await safeCall('GetStreamStatus');
  const record = await safeCall('GetRecordStatus');
  const vcam = await safeCall('GetVirtualCamStatus');
  const studio = await safeCall('GetStudioModeEnabled');
  const program = await safeCall('GetCurrentProgramScene');
  const preview = await safeCall('GetCurrentPreviewScene');
  const profile = await safeCall('GetCurrentProfile');
  const collection = await safeCall('GetCurrentSceneCollection');

  obsRuntime = {
    streaming: Boolean(stream?.outputActive),
    recording: Boolean(record?.outputActive),
    virtualCamera: Boolean(vcam?.outputActive),
    studioMode: Boolean(studio?.studioModeEnabled),
    programScene: program?.currentProgramSceneName || '',
    previewScene: preview?.currentPreviewSceneName || '',
    currentProfile: profile?.currentProfileName || '',
    currentSceneCollection: collection?.currentSceneCollectionName || '',
  };

  broadcast('runtimeSynced', obsRuntime);
  return obsRuntime;
}

function applySettings(nextSettings, options = {}) {
  settings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    ...nextSettings,
    host: String(nextSettings.host || settings.host || DEFAULT_SETTINGS.host).trim() || DEFAULT_SETTINGS.host,
    port: Number(nextSettings.port) || settings.port || DEFAULT_SETTINGS.port,
    reconnectIntervalMs: Math.max(2000, Number(nextSettings.reconnectIntervalMs) || settings.reconnectIntervalMs || 5000),
    connectionTimeoutMs: Math.max(3000, Math.min(60000, Number(nextSettings.connectionTimeoutMs) || settings.connectionTimeoutMs || 10000)),
    autoConnectOnStart: Boolean(nextSettings.autoConnectOnStart),
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
  let password;
  try {
    password = resolveConnectionPassword();
  } catch (error) {
    const classified = classifyConnectionError(error);
    lastError = classified.message;
    connectionState = classified.state;
    broadcast('connectionError', { message: lastError, state: connectionState });
    if (settings.autoReconnect) scheduleReconnect();
    return getStatus();
  }

  connectingPromise = withTimeout(
    client.connect(url, password || undefined),
    settings.connectionTimeoutMs,
  )
    .then(async () => {
      connectionState = STATES.CONNECTED;
      lastError = '';
      await syncRuntimeState();
      return getStatus();
    })
    .catch((error) => {
      const classified = classifyConnectionError(error);
      lastError = classified.message;
      connectionState = classified.state;
      log.warn('[obs] Connect failed:', lastError);
      broadcast('connectionError', { message: lastError, state: connectionState });
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

  if (!client.identified && connectionState !== STATES.CONNECTING && connectionState !== STATES.AUTHENTICATING) {
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
  obsRuntime = createDefaultRuntime();
  broadcast('disconnected');
  return getStatus();
}

async function testConnection(testSettings) {
  const host = String(testSettings?.host || settings.host || DEFAULT_SETTINGS.host).trim();
  const port = Number(testSettings?.port) || settings.port || DEFAULT_SETTINGS.port;
  let password;
  try {
    password = resolveConnectionPassword(
      testSettings?.password !== undefined ? testSettings.password : undefined,
    );
  } catch (error) {
    const classified = classifyConnectionError(error);
    return {
      ok: false,
      message: classified.message,
      state: classified.state,
    };
  }
  const url = buildWsUrl(host, port);
  const probe = new OBSWebSocket();
  const timeoutMs = Number(testSettings?.connectionTimeoutMs) || settings.connectionTimeoutMs || DEFAULT_SETTINGS.connectionTimeoutMs;

  try {
    await withTimeout(probe.connect(url, password || undefined), timeoutMs);
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
    const classified = classifyConnectionError(error);
    return {
      ok: false,
      message: classified.message,
      state: classified.state,
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
      .catch((error) => {
        const classified = classifyConnectionError(error);
        return { ok: false, message: classified.message, state: classified.state, status: getStatus() };
      });
  });

  ipcMain.handle('obs:connect', () => {
    settings.enabled = true;
    manualDisconnect = false;
    return connect()
      .then(() => ({ ok: true, status: getStatus() }))
      .catch((error) => {
        const classified = classifyConnectionError(error);
        return { ok: false, message: classified.message, state: classified.state, status: getStatus() };
      });
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
  syncRuntimeState,
};
