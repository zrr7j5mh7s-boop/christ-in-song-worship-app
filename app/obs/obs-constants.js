(function () {
  "use strict";

  const CONNECTION_STATES = {
    DISABLED: "disabled",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    DISCONNECTING: "disconnecting",
    DISCONNECTED: "disconnected",
    RECONNECTING: "reconnecting",
    ERROR: "error",
  };

  const DEFAULT_SETTINGS = {
    enabled: false,
    host: "127.0.0.1",
    port: 4455,
    autoReconnect: true,
    reconnectIntervalMs: 5000,
    outputTarget: "projector",
  };

  const STATE_LABELS = {
    disabled: "OBS Off",
    connecting: "OBS Connecting…",
    connected: "OBS Connected",
    disconnecting: "OBS Disconnecting…",
    disconnected: "OBS Disconnected",
    reconnecting: "OBS Reconnecting…",
    error: "OBS Error",
  };

  window.CISObsConstants = {
    CONNECTION_STATES,
    DEFAULT_SETTINGS,
    STATE_LABELS,
  };
})();
