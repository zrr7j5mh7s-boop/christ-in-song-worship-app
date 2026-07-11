(function () {
  "use strict";

  const STATES = window.CISObsConstants
    ? window.CISObsConstants.CONNECTION_STATES
    : {
      DISABLED: "disabled",
      DISCONNECTED: "disconnected",
      CONNECTING: "connecting",
      AUTHENTICATING: "authenticating",
      CONNECTED: "connected",
      DISCONNECTING: "disconnecting",
      RECONNECTING: "reconnecting",
      AUTHENTICATION_FAILED: "authentication_failed",
      CONNECTION_FAILED: "connection_failed",
      OBS_UNAVAILABLE: "obs_unavailable",
      VERSION_UNSUPPORTED: "version_unsupported",
      ERROR: "error",
    };

  const electronBridge = window.electronAPI && window.electronAPI.obs
    ? window.electronAPI.obs
    : null;

  let status = {
    state: STATES.DISABLED,
    enabled: false,
    host: "127.0.0.1",
    port: 4455,
    autoConnectOnStart: false,
    autoReconnect: true,
    reconnectIntervalMs: 5000,
    connectionTimeoutMs: 10000,
    hasPassword: false,
    lastError: "",
    obsInfo: null,
    obsRuntime: null,
    connected: false,
    runtime: electronBridge ? "electron" : "browser",
  };

  let browserClient = null;
  let reconnectTimer = null;
  let manualDisconnect = false;
  let initialized = false;

  function createDefaultRuntime() {
    return {
      streaming: false,
      recording: false,
      virtualCamera: false,
      studioMode: false,
      programScene: "",
      previewScene: "",
      currentProfile: "",
      currentSceneCollection: "",
    };
  }

  function classifyBrowserError(error) {
    const message = error && error.message ? error.message : "OBS connection failed";
    const lower = message.toLowerCase();
    if (lower.includes("authentication") || lower.includes("auth failed") || lower.includes("identify")) {
      return { state: STATES.AUTHENTICATION_FAILED, message };
    }
    if (lower.includes("version") || lower.includes("rpc")) {
      return { state: STATES.VERSION_UNSUPPORTED, message };
    }
    if (lower.includes("websocket connection failed") || lower.includes("failed to connect")) {
      return { state: STATES.OBS_UNAVAILABLE, message };
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return { state: STATES.CONNECTION_FAILED, message };
    }
    return { state: STATES.CONNECTION_FAILED, message };
  }

  function applyStatus(next) {
    status = { ...status, ...next };
    if (window.CISObsEventService) {
      window.CISObsEventService.setLastStatus(status);
    }
    return status;
  }

  function buildUrl(settings) {
    const host = String(settings.host || "127.0.0.1").trim() || "127.0.0.1";
    const port = Number(settings.port) || 4455;
    return `ws://${host}:${port}`;
  }

  function normalizeFromRemote(remote) {
    const store = window.CISObsSettingsStore;
    if (!store) return remote || {};
    return store.normalizeSettings(remote);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleBrowserReconnect() {
    clearReconnectTimer();
    const settings = window.CISObsSettingsStore
      ? window.CISObsSettingsStore.loadSettings()
      : { enabled: false };
    if (!settings.enabled || manualDisconnect || !settings.autoReconnect) return;
    applyStatus({ state: STATES.RECONNECTING });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect().catch(() => {});
    }, settings.reconnectIntervalMs || 5000);
  }

  async function syncBrowserRuntime() {
    if (!browserClient || !browserClient.isConnected()) return createDefaultRuntime();
    const safeCall = async (requestType) => {
      try {
        return await browserClient.call(requestType);
      } catch (error) {
        return null;
      }
    };
    const stream = await safeCall("GetStreamStatus");
    const record = await safeCall("GetRecordStatus");
    const vcam = await safeCall("GetVirtualCamStatus");
    const studio = await safeCall("GetStudioModeEnabled");
    const program = await safeCall("GetCurrentProgramScene");
    const preview = await safeCall("GetCurrentPreviewScene");
    const profile = await safeCall("GetCurrentProfile");
    const collection = await safeCall("GetCurrentSceneCollection");
    const runtime = {
      streaming: Boolean(stream?.outputActive),
      recording: Boolean(record?.outputActive),
      virtualCamera: Boolean(vcam?.outputActive),
      studioMode: Boolean(studio?.studioModeEnabled),
      programScene: program?.currentProgramSceneName || "",
      previewScene: preview?.currentPreviewSceneName || "",
      currentProfile: profile?.currentProfileName || "",
      currentSceneCollection: collection?.currentSceneCollectionName || "",
    };
    applyStatus({ obsRuntime: runtime });
    if (window.CISObsEventService) {
      window.CISObsEventService.emit("runtimeSynced", runtime, status);
    }
    return runtime;
  }

  async function refreshElectronStatus() {
    if (!electronBridge || !electronBridge.getStatus) return status;
    const next = await electronBridge.getStatus();
    return applyStatus(next || status);
  }

  async function saveSettings(settings, options) {
    const store = window.CISObsSettingsStore;
    if (!store) return status;
    const normalized = store.saveSettings(settings);
    const password = options && Object.prototype.hasOwnProperty.call(options, "password")
      ? String(options.password || "")
      : undefined;

    if (electronBridge && electronBridge.saveSettings) {
      store.saveSettings(normalized);
      const result = await electronBridge.saveSettings({
        ...normalized,
        password,
        connect: options?.connect !== false,
      });
      if (result && result.status) applyStatus(result.status);
      if (result && !result.ok && result.message) {
        applyStatus({
          state: result.state || STATES.ERROR,
          lastError: result.message,
          connected: false,
        });
      }
      return status;
    }

    if (password !== undefined) {
      if (!password) await store.clearLocalPassword();
      else await store.saveLocalPassword(password);
    }
    applyStatus({
      ...normalized,
      hasPassword: store.hasLocalPasswordMarker(),
    });

    if (options?.connect !== false) {
      if (normalized.enabled) await connect();
      else await disconnect();
    }
    return status;
  }

  async function connect() {
    manualDisconnect = false;
    clearReconnectTimer();

    if (electronBridge && electronBridge.connect) {
      applyStatus({ state: STATES.CONNECTING });
      const result = await electronBridge.connect();
      if (result && result.status) applyStatus(result.status);
      if (result && !result.ok) {
        applyStatus({
          state: result.state || STATES.ERROR,
          lastError: result.message || "OBS connection failed",
          connected: false,
        });
      }
      return status;
    }

    const store = window.CISObsSettingsStore;
    if (!store || !window.CISObsWsClient) {
      applyStatus({ state: STATES.ERROR, lastError: "OBS browser client unavailable", connected: false });
      return status;
    }

    const settings = store.loadSettings();
    if (!settings.enabled) {
      applyStatus({ state: STATES.DISABLED, connected: false });
      return status;
    }

    applyStatus({
      state: STATES.CONNECTING,
      ...settings,
      hasPassword: store.hasLocalPasswordMarker(),
    });

    if (!browserClient) browserClient = window.CISObsWsClient.createClient();

    try {
      const password = await store.loadLocalPassword();
      applyStatus({ state: STATES.AUTHENTICATING });
      const identified = await browserClient.connect(
        buildUrl(settings),
        password,
        settings.connectionTimeoutMs,
      );
      const version = await browserClient.call("GetVersion");
      const obsInfo = {
        negotiatedRpcVersion: identified?.negotiatedRpcVersion,
        obsWebSocketVersion: version?.obsWebSocketVersion || identified?.obsWebSocketVersion,
        obsVersion: version?.obsVersion,
        platform: version?.platform,
      };
      applyStatus({
        state: STATES.CONNECTED,
        connected: true,
        lastError: "",
        obsInfo,
        obsRuntime: createDefaultRuntime(),
      });
      await syncBrowserRuntime();
      if (window.CISObsEventService) {
        window.CISObsEventService.emit("connectionOpened", null, status);
        window.CISObsEventService.emit("version", obsInfo, status);
      }
    } catch (error) {
      const classified = classifyBrowserError(error);
      applyStatus({
        state: classified.state,
        connected: false,
        lastError: classified.message,
      });
      scheduleBrowserReconnect();
    }

    return status;
  }

  async function disconnect() {
    manualDisconnect = true;
    clearReconnectTimer();

    if (electronBridge && electronBridge.disconnect) {
      const result = await electronBridge.disconnect();
      if (result && result.status) applyStatus(result.status);
      return status;
    }

    if (browserClient) await browserClient.disconnect();
    const settings = window.CISObsSettingsStore
      ? window.CISObsSettingsStore.loadSettings()
      : { enabled: false };
    applyStatus({
      state: settings.enabled ? STATES.DISCONNECTED : STATES.DISABLED,
      connected: false,
      obsRuntime: createDefaultRuntime(),
    });
    return status;
  }

  async function testConnection(overrides) {
    const store = window.CISObsSettingsStore;
    const base = store ? store.loadSettings() : {};
    const payload = {
      host: overrides?.host || base.host,
      port: overrides?.port || base.port,
      connectionTimeoutMs: overrides?.connectionTimeoutMs || base.connectionTimeoutMs,
    };

    if (electronBridge && electronBridge.testConnection) {
      if (overrides && Object.prototype.hasOwnProperty.call(overrides, "password")) {
        payload.password = overrides.password;
      }
      return electronBridge.testConnection(payload);
    }

    if (!window.CISObsWsClient) {
      return { ok: false, message: "OBS browser client unavailable" };
    }

    const probe = window.CISObsWsClient.createClient();
    try {
      const password = overrides && Object.prototype.hasOwnProperty.call(overrides, "password")
        ? String(overrides.password || "")
        : (store ? await store.loadLocalPassword() : "");
      await probe.connect(buildUrl(payload), password, payload.connectionTimeoutMs);
      const version = await probe.call("GetVersion");
      await probe.disconnect();
      return {
        ok: true,
        obsVersion: version?.obsVersion,
        obsWebSocketVersion: version?.obsWebSocketVersion,
        platform: version?.platform,
      };
    } catch (error) {
      await probe.disconnect();
      const classified = classifyBrowserError(error);
      return {
        ok: false,
        message: classified.message,
        state: classified.state,
      };
    }
  }

  async function call(requestType, requestData) {
    if (electronBridge && electronBridge.call) {
      const result = await electronBridge.call(requestType, requestData);
      if (!result || !result.ok) {
        throw new Error(result?.message || "OBS request failed");
      }
      return result.data;
    }
    if (!browserClient || !browserClient.isConnected()) {
      throw new Error("OBS is not connected");
    }
    return browserClient.call(requestType, requestData);
  }

  function getStatus() {
    return { ...status };
  }

  function bindElectronEvents() {
    if (!electronBridge || !electronBridge.onEvent || initialized) return;
    initialized = true;
    electronBridge.onEvent((payload) => {
      if (!payload) return;
      if (payload.status) applyStatus(payload.status);
      if (window.CISObsEventService && payload.event) {
        window.CISObsEventService.emit(payload.event, payload.data, status);
      }
    });
  }

  async function init() {
    bindElectronEvents();
    const store = window.CISObsSettingsStore;
    if (!store) return status;

    const settings = store.loadSettings();
    applyStatus({
      ...settings,
      state: settings.enabled ? STATES.DISCONNECTED : STATES.DISABLED,
      hasPassword: store.hasLocalPasswordMarker(),
      connected: false,
      obsRuntime: createDefaultRuntime(),
    });

    if (electronBridge) {
      if (electronBridge.getSettings) {
        const remote = await electronBridge.getSettings();
        if (remote) {
          applyStatus({
            ...normalizeFromRemote(remote),
            hasPassword: Boolean(remote.hasPassword),
          });
        }
      }
      await refreshElectronStatus();
      const shouldConnect = settings.enabled && settings.autoConnectOnStart;
      await saveSettings(settings, { connect: shouldConnect });
      return status;
    }

    if (settings.enabled && settings.autoConnectOnStart) {
      await connect();
    }
    return status;
  }

  window.CISObsConnectionService = {
    init,
    getStatus,
    saveSettings,
    connect,
    disconnect,
    testConnection,
    call,
    refreshElectronStatus,
    syncBrowserRuntime,
  };
})();
