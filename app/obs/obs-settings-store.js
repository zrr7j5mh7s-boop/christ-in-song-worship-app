(function () {
  "use strict";

  const STORAGE_PREFIX = "cis-va-chinoda:";
  const SETTINGS_KEY = "obsSettings";
  const PASSWORD_KEY = "obsPasswordEnc";
  const DEFAULTS = window.CISObsConstants
    ? window.CISObsConstants.DEFAULT_SETTINGS
    : { enabled: false, host: "127.0.0.1", port: 4455, autoReconnect: true, reconnectIntervalMs: 5000 };

  function storageKey(key) {
    return `${STORAGE_PREFIX}${key}`;
  }

  function normalizeSettings(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    return {
      enabled: Boolean(input.enabled),
      host: String(input.host || DEFAULTS.host).trim() || DEFAULTS.host,
      port: Math.max(1, Math.min(65535, Number(input.port) || DEFAULTS.port)),
      autoReconnect: input.autoReconnect !== false,
      reconnectIntervalMs: Math.max(2000, Number(input.reconnectIntervalMs) || DEFAULTS.reconnectIntervalMs || 5000),
      outputTarget: ["projector", "obs", "both", "stage"].includes(input.outputTarget)
        ? input.outputTarget
        : (DEFAULTS.outputTarget || "projector"),
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(storageKey(SETTINGS_KEY));
      return normalizeSettings(raw ? JSON.parse(raw) : DEFAULTS);
    } catch (error) {
      return normalizeSettings(DEFAULTS);
    }
  }

  function saveSettings(settings) {
    const next = normalizeSettings(settings);
    try {
      localStorage.setItem(storageKey(SETTINGS_KEY), JSON.stringify(next));
      return next;
    } catch (error) {
      return next;
    }
  }

  function hasLocalPasswordMarker() {
    try {
      return Boolean(localStorage.getItem(storageKey(PASSWORD_KEY)));
    } catch (error) {
      return false;
    }
  }

  async function deriveKey() {
    if (!window.crypto || !window.crypto.subtle) return null;
    const seed = `${STORAGE_PREFIX}obs-local`;
    const material = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
    return window.crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  async function saveLocalPassword(password) {
    const plain = String(password || "");
    if (!plain) {
      localStorage.removeItem(storageKey(PASSWORD_KEY));
      return false;
    }
    if (!window.crypto || !window.crypto.subtle) {
      localStorage.setItem(storageKey(PASSWORD_KEY), btoa(plain));
      return true;
    }
    const key = await deriveKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    );
    const payload = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };
    localStorage.setItem(storageKey(PASSWORD_KEY), JSON.stringify(payload));
    return true;
  }

  async function loadLocalPassword() {
    try {
      const raw = localStorage.getItem(storageKey(PASSWORD_KEY));
      if (!raw) return "";
      if (!window.crypto || !window.crypto.subtle) {
        try {
          return atob(raw);
        } catch (error) {
          return "";
        }
      }
      const payload = JSON.parse(raw);
      const key = await deriveKey();
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
        key,
        new Uint8Array(payload.data),
      );
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      return "";
    }
  }

  async function clearLocalPassword() {
    localStorage.removeItem(storageKey(PASSWORD_KEY));
  }

  function exportForBackup(settings) {
    const next = normalizeSettings(settings || loadSettings());
    return {
      obsSettings: {
        ...next,
        passwordStored: hasLocalPasswordMarker(),
      },
    };
  }

  window.CISObsSettingsStore = {
    loadSettings,
    saveSettings,
    normalizeSettings,
    hasLocalPasswordMarker,
    saveLocalPassword,
    loadLocalPassword,
    clearLocalPassword,
    exportForBackup,
  };
})();
