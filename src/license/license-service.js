// src/license/license-service.js
// Controlled pilot licensing — main process only.

const { app } = require('electron');
const log = require('electron-log/main');
const { getConfig } = require('./license-config');
const {
  sha256Hex,
  randomInstallationId,
  generateDeviceKeyPair,
  verifySignedToken,
  buildCanonicalDeviceProofPayload,
  signDeviceProof,
} = require('./license-crypto');
const licenseStore = require('./license-store');

const BLOCKED_OUTPUT_COMMANDS = new Set([
  'open-presenter',
  'present-current',
  'presenter-open-output',
  'open-obs-monitor',
  'open-stage-display',
  'open-camera-preview',
  'service-mode-enter',
  'quiet-service-mode-enter',
  'hymn-go-live',
  'hymn-take-next-live',
  'bible-send-live',
  'emergency-black',
  'emergency-white',
  'emergency-logo',
  'obs-start-stream',
  'obs-start-record',
  'obs-start-vcam',
]);

const ALLOWED_WHEN_BLOCKED = new Set([
  'open-settings',
  'export-backup',
  'restore-backup',
  'license-activate',
  'license-deactivate',
]);

let state = {
  status: 'not_activated',
  message: 'Activation required for controlled pilot use.',
  canPresent: false,
  canUseLiveOutputs: false,
  watermark: null,
  lastCheckedAt: 0,
};

let validationTimer = null;

function now() {
  return Date.now();
}

function formatExpiry(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildWatermark(cache) {
  if (!cache) return null;
  return {
    organisationName: cache.organisationName,
    licenceId: cache.licenceId,
    expiresAt: formatExpiry(cache.expiresAt),
    lines: [
      `Controlled Pilot — Licensed to ${cache.organisationName}`,
      `Pilot ID: ${cache.licenceId}`,
      `Expires: ${formatExpiry(cache.expiresAt)}`,
      'Redistribution prohibited',
    ],
  };
}

function setState(patch) {
  state = {
    ...state,
    ...patch,
    lastCheckedAt: now(),
    watermark: patch.watermark !== undefined ? patch.watermark : buildWatermark(patch.cache || state.cache),
  };
}

function getPublicStatus() {
  const { cache, ...rest } = state;
  return {
    ...rest,
    licenceId: cache?.licenceId || null,
    organisationName: cache?.organisationName || null,
    expiresAt: cache?.expiresAt || null,
    offlineGraceDeadline: cache?.offlineGraceDeadline || null,
    lastServerTime: cache?.lastServerTime || null,
    deviceId: cache?.deviceId || null,
  };
}

function ensureDeviceIdentity() {
  const existing = licenseStore.loadDeviceIdentity();
  if (existing.installationId && existing.privateKeyPem && existing.publicKeyPem) {
    return existing;
  }
  const pair = generateDeviceKeyPair();
  const identity = {
    installationId: randomInstallationId(),
    privateKeyPem: pair.privateKeyPem,
    publicKeyPem: pair.publicKeyPem,
  };
  licenseStore.saveDeviceIdentity(identity);
  return identity;
}

function evaluateCache(cache, config) {
  if (!cache) {
    return {
      status: 'not_activated',
      message: 'Enter your approved email and activation code to begin the controlled pilot.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  const tokenCheck = verifySignedToken(cache.signedToken, config.publicKeyPem);
  if (!tokenCheck.ok) {
    return {
      status: 'device_mismatch',
      message: 'Licence validation failed. Contact your administrator.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  const payload = tokenCheck.payload;
  if (payload.installationIdHash !== sha256Hex(cache.installationId)) {
    return {
      status: 'device_mismatch',
      message: 'This licence is bound to a different installation.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  if (payload.status === 'revoked' || cache.status === 'revoked') {
    return {
      status: 'revoked',
      message: 'This pilot licence has been revoked. Contact your administrator.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  const current = now();
  if (current > cache.expiresAt) {
    return {
      status: 'expired',
      message: 'This pilot licence has expired. Contact your administrator to renew.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  if (cache.lastServerTime && current + 5 * 60 * 1000 < cache.lastServerTime) {
    return {
      status: 'device_mismatch',
      message: 'System clock appears unreliable. Adjust the clock or contact your administrator.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  const graceExceeded = current > cache.offlineGraceDeadline;
  const needsValidation = current - (cache.lastValidatedAt || 0) > config.validationIntervalMs;
  const offline = graceExceeded || needsValidation;

  if (offline && current > cache.offlineGraceDeadline) {
    return {
      status: 'expired',
      message: 'Offline grace period exceeded. Reconnect to validate your pilot licence.',
      canPresent: false,
      canUseLiveOutputs: false,
    };
  }

  const graceRemaining = cache.offlineGraceDeadline - current;
  if (offline) {
    const warning = graceRemaining < 48 * 60 * 60 * 1000;
    return {
      status: warning ? 'grace_warning' : 'active_offline',
      message: warning
        ? 'Pilot licence is offline. Reconnect soon to avoid service interruption.'
        : 'Pilot licence is active offline within the grace period.',
      canPresent: true,
      canUseLiveOutputs: true,
    };
  }

  return {
    status: 'active_online',
    message: 'Pilot licence active.',
    canPresent: true,
    canUseLiveOutputs: true,
  };
}

async function requestDeviceChallenge(config, cache, identity) {
  const result = await postJson(config, config.validatePath, {
    action: 'challenge',
    licenceId: cache.licenceId,
    deviceId: cache.deviceId,
    installationId: identity.installationId,
  });
  if (!result.ok || !result.data?.ok || !result.data?.challenge) {
    return { ok: false, error: result.data?.error || 'challenge_request_failed' };
  }
  return {
    ok: true,
    challengeId: result.data.challengeId,
    challenge: result.data.challenge,
    expiresAt: result.data.expiresAt,
  };
}

function buildSignedDeviceProof(identity, cache, challenge, appVersion) {
  const canonicalPayload = buildCanonicalDeviceProofPayload({
    challenge,
    licenceId: cache.licenceId,
    deviceId: cache.deviceId,
    installationIdHash: sha256Hex(identity.installationId),
    appVersion,
  });
  const deviceSignature = signDeviceProof(identity.privateKeyPem, canonicalPayload);
  return { canonicalPayload, deviceSignature };
}

async function validateWithDeviceProof(config, cache, identity, appVersion) {
  const challengeResult = await requestDeviceChallenge(config, cache, identity);
  if (!challengeResult.ok) {
    return { ok: false, data: { error: challengeResult.error } };
  }

  const proof = buildSignedDeviceProof(
    identity,
    cache,
    challengeResult.challenge,
    appVersion,
  );

  return postJson(config, config.validatePath, {
    action: 'validate',
    licenceId: cache.licenceId,
    deviceId: cache.deviceId,
    installationId: identity.installationId,
    appVersion,
    challengeId: challengeResult.challengeId,
    challenge: challengeResult.challenge,
    deviceSignature: proof.deviceSignature,
  });
}

async function deactivateWithDeviceProof(config, cache, identity, appVersion) {
  const challengeResult = await requestDeviceChallenge(config, cache, identity);
  if (!challengeResult.ok) {
    return { ok: false, data: { error: challengeResult.error } };
  }

  const proof = buildSignedDeviceProof(
    identity,
    cache,
    challengeResult.challenge,
    appVersion,
  );

  return postJson(config, config.deactivatePath, {
    licenceId: cache.licenceId,
    deviceId: cache.deviceId,
    installationId: identity.installationId,
    appVersion,
    selfDeactivate: true,
    challengeId: challengeResult.challengeId,
    challenge: challengeResult.challenge,
    deviceSignature: proof.deviceSignature,
  });
}

async function postJson(config, route, body, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(`${config.apiBase}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pilot-client': 'vachinoda-desktop',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message || 'network_error' } };
  } finally {
    clearTimeout(timeout);
  }
}

function applyServerResponse(responseData, identity, config) {
  const serverTime = Number(responseData.serverTime || now());
  const expiresAt = new Date(responseData.expiresAt).getTime();
  const offlineGraceDays = Number(responseData.offlineGraceDays || config.offlineGraceDays);
  const cache = {
    licenceId: responseData.licenceId,
    deviceId: responseData.deviceId,
    organisationName: responseData.organisationName,
    installationId: identity.installationId,
    issuedAt: serverTime,
    expiresAt,
    offlineGraceDeadline: serverTime + offlineGraceDays * 24 * 60 * 60 * 1000,
    signedToken: responseData.signedToken,
    lastServerTime: serverTime,
    lastValidatedAt: serverTime,
    status: responseData.status || 'active',
  };
  licenseStore.saveLicenseCache(cache);
  const evaluated = evaluateCache(cache, config);
  setState({ ...evaluated, cache });
  return getPublicStatus();
}

async function activateLicence(email, code, deviceName) {
  const config = getConfig(app);
  if (!config.configured) {
    setState({
      status: 'server_configuration_error',
      message: 'Pilot licensing is not configured. Contact support.',
      canPresent: false,
      canUseLiveOutputs: false,
      cache: null,
    });
    return { ok: false, status: getPublicStatus() };
  }

  setState({
    status: 'activating',
    message: 'Activating pilot licence…',
    canPresent: false,
    canUseLiveOutputs: false,
  });

  const identity = ensureDeviceIdentity();
  const result = await postJson(config, config.activatePath, {
    email: String(email || '').trim().toLowerCase(),
    activationCode: String(code || '').trim(),
    installationId: identity.installationId,
    devicePublicKey: identity.publicKeyPem,
    deviceName: String(deviceName || 'Pilot Device').trim().slice(0, 120),
    platform: process.platform,
    architecture: process.arch,
    appVersion: app.getVersion(),
  });

  if (!result.ok || !result.data?.ok) {
    const message = result.data?.error || 'Activation failed. Check your email and activation code.';
    setState({
      status: 'not_activated',
      message,
      canPresent: false,
      canUseLiveOutputs: false,
      cache: null,
    });
    return { ok: false, status: getPublicStatus() };
  }

  const status = applyServerResponse(result.data, identity, config);
  scheduleValidation();
  return { ok: true, status };
}

async function validateLicence({ force = false } = {}) {
  const config = getConfig(app);
  const cache = licenseStore.loadLicenseCache();
  const identity = ensureDeviceIdentity();

  if (!config.configured) {
    setState({
      status: 'server_configuration_error',
      message: 'Pilot licensing is not configured.',
      canPresent: false,
      canUseLiveOutputs: false,
      cache: null,
    });
    return getPublicStatus();
  }

  if (!cache) {
    const evaluated = evaluateCache(null, config);
    setState({ ...evaluated, cache: null });
    return getPublicStatus();
  }

  const localEval = evaluateCache(cache, config);
  const shouldCallServer = force
    || localEval.canPresent
    || now() - (cache.lastValidatedAt || 0) > config.validationIntervalMs;

  if (!shouldCallServer) {
    setState({ ...localEval, cache });
    return getPublicStatus();
  }

  const result = await validateWithDeviceProof(
    config,
    cache,
    identity,
    app.getVersion(),
  );

  if (!result.ok || !result.data?.ok) {
    if (result.status === 403 && result.data?.status) {
      cache.status = result.data.status;
      licenseStore.saveLicenseCache(cache);
      const evaluated = evaluateCache(cache, config);
      setState({ ...evaluated, cache });
      return getPublicStatus();
    }

    const evaluated = evaluateCache(cache, config);
    if (evaluated.canPresent) {
      setState({
        ...evaluated,
        status: evaluated.status === 'active_online' ? 'active_offline' : evaluated.status,
        message: 'Validation server unavailable. Operating within offline grace if permitted.',
        cache,
      });
      return getPublicStatus();
    }

    setState({
      status: 'validation_unavailable',
      message: 'Unable to validate pilot licence. Settings and backup remain available.',
      canPresent: false,
      canUseLiveOutputs: false,
      cache,
    });
    return getPublicStatus();
  }

  return applyServerResponse(result.data, identity, config);
}

async function deactivateLicence() {
  const config = getConfig(app);
  const cache = licenseStore.loadLicenseCache();
  const identity = ensureDeviceIdentity();

  if (cache && config.configured) {
    await deactivateWithDeviceProof(config, cache, identity, app.getVersion());
  }

  licenseStore.clearLicenseCache();
  const evaluated = evaluateCache(null, config);
  setState({ ...evaluated, cache: null });
  return getPublicStatus();
}

function isCommandAllowed(command) {
  if (!command) return true;
  if (ALLOWED_WHEN_BLOCKED.has(command)) return true;
  if (!state.canUseLiveOutputs && BLOCKED_OUTPUT_COMMANDS.has(command)) return false;
  if (!state.canPresent && (command.startsWith('hymn-') || command.startsWith('bible-'))) {
    if (command.includes('live') || command.includes('preview-to-live')) return false;
  }
  return true;
}

function scheduleValidation() {
  if (validationTimer) clearInterval(validationTimer);
  const config = getConfig(app);
  validationTimer = setInterval(() => {
    validateLicence().catch((error) => {
      log.warn('[license] periodic validation failed:', error.message);
    });
  }, Math.min(config.validationIntervalMs, 60 * 60 * 1000));
}

function initialize() {
  const config = getConfig(app);
  ensureDeviceIdentity();
  const cache = licenseStore.loadLicenseCache();
  const evaluated = evaluateCache(cache, config);
  setState({ ...evaluated, cache });
  scheduleValidation();
  return getPublicStatus();
}

function shutdown() {
  if (validationTimer) clearInterval(validationTimer);
  validationTimer = null;
}

module.exports = {
  initialize,
  shutdown,
  getLicenceStatus: () => getPublicStatus(),
  activateLicence,
  validateLicence,
  deactivateLicence,
  isCommandAllowed,
  BLOCKED_OUTPUT_COMMANDS,
  __test__: {
    evaluateCache,
    applyServerResponse,
    requestDeviceChallenge,
    buildSignedDeviceProof,
    validateWithDeviceProof,
    deactivateWithDeviceProof,
    setStateForTest: setState,
    resetStateForTest: () => {
      state = {
        status: 'not_activated',
        message: 'Activation required for controlled pilot use.',
        canPresent: false,
        canUseLiveOutputs: false,
        watermark: null,
        lastCheckedAt: 0,
      };
      if (validationTimer) clearInterval(validationTimer);
      validationTimer = null;
    },
  },
};
