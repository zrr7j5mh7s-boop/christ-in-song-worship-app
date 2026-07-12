#!/usr/bin/env node
// scripts/test-obs-integration.js
//
// Unit tests for OBS mapping, sanitization, and output logic (no OBS instance required).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadSanitizeLogic() {
  const source = fs.readFileSync(path.join(ROOT, 'app/obs/obs-sanitize.js'), 'utf8');
  const window = {};
  const fn = new Function('window', `${source}; return window.CISObsSanitize;`);
  return fn(window);
}

function normalizeSettings(raw) {
  const DEFAULTS = {
    enabled: false,
    host: '127.0.0.1',
    port: 4455,
    browserSourcePort: 47823,
    autoConnectOnStart: false,
    autoReconnect: true,
    reconnectIntervalMs: 5000,
    connectionTimeoutMs: 10000,
    outputTarget: 'projector',
    outputDefaults: { bible: 'both', hymn: 'both' },
    sceneMappings: {},
    sourceMappings: {},
    overlayLayouts: {},
    autoSceneOnLive: {},
    confirmations: { streamStart: true, streamStop: true, recordStop: true, blackout: false },
    sceneChangePerContent: true,
  };

  const input = raw && typeof raw === 'object' ? raw : {};
  const normalizeObjectMap = (value) => {
    if (!value || typeof value !== 'object') return {};
    const next = {};
    Object.keys(value).forEach((key) => {
      if (value[key] != null && value[key] !== '') next[key] = value[key];
    });
    return next;
  };

  return {
    enabled: Boolean(input.enabled),
    host: String(input.host || DEFAULTS.host).trim() || DEFAULTS.host,
    port: Math.max(1, Math.min(65535, Number(input.port) || DEFAULTS.port)),
    browserSourcePort: Math.max(1024, Math.min(65535, Number(input.browserSourcePort) || DEFAULTS.browserSourcePort)),
    autoConnectOnStart: Boolean(input.autoConnectOnStart),
    autoReconnect: input.autoReconnect !== false,
    reconnectIntervalMs: Math.max(2000, Number(input.reconnectIntervalMs) || DEFAULTS.reconnectIntervalMs),
    connectionTimeoutMs: Math.max(3000, Math.min(60000, Number(input.connectionTimeoutMs) || DEFAULTS.connectionTimeoutMs)),
    outputTarget: ['projector', 'obs', 'both', 'stage', 'all'].includes(input.outputTarget)
      ? input.outputTarget
      : DEFAULTS.outputTarget,
    outputDefaults: { ...DEFAULTS.outputDefaults, ...(input.outputDefaults || {}) },
    sceneMappings: normalizeObjectMap(input.sceneMappings),
    sourceMappings: normalizeObjectMap(input.sourceMappings),
    overlayLayouts: { ...(input.overlayLayouts || {}) },
    autoSceneOnLive: normalizeObjectMap(input.autoSceneOnLive),
    confirmations: { ...DEFAULTS.confirmations, ...(input.confirmations || {}) },
    sceneChangePerContent: input.sceneChangePerContent !== false,
  };
}

function shouldSendToObs(contentType, settings, override) {
  const target = override || settings.outputDefaults[contentType] || settings.outputTarget || 'projector';
  return target === 'obs' || target === 'both' || target === 'all';
}

function validateSceneMappings(sceneMappings, sceneList) {
  const names = new Set(sceneList.map((scene) => scene.name));
  return Object.entries(sceneMappings)
    .filter(([, sceneName]) => sceneName && !names.has(sceneName))
    .map(([key, sceneName]) => ({ key, sceneName }));
}

function shouldSyncFromPresenter(snapshot, engineState) {
  if (!snapshot || !engineState?.active || engineState.paused) return false;
  if (engineState.displayMode && engineState.displayMode !== 'lyrics') return false;
  return true;
}

function run() {
  const sanitize = loadSanitizeLogic();

  assert.equal(sanitize.escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(sanitize.stripHtml('<b>John 3:16</b>'), 'John 3:16');
  assert.deepEqual(sanitize.sanitizePayload({ text: '<img onerror=1>', nested: { a: 1 } }), {
    text: '',
    nested: { a: 1 },
  });

  const settings = normalizeSettings({
    enabled: true,
    browserSourcePort: 80,
    outputTarget: 'both',
    sceneMappings: { live_camera: 'Cam 1', blank_screen: '' },
    sourceMappings: { scripture_browser: { sourceName: 'Scripture', sceneName: 'Cam + Scripture' } },
    confirmations: { streamStart: false },
  });

  assert.equal(settings.browserSourcePort, 1024);
  assert.equal(settings.outputTarget, 'both');
  assert.deepEqual(settings.sceneMappings, { live_camera: 'Cam 1' });
  assert.equal(settings.confirmations.streamStart, false);
  assert.equal(shouldSendToObs('hymn', settings), true);
  assert.equal(shouldSendToObs('lower_third', { ...settings, outputDefaults: { lower_third: 'projector' } }), false);

  const missing = validateSceneMappings(
    { live_camera: 'Cam 1', hymn: 'Missing Scene' },
    [{ name: 'Cam 1' }, { name: 'Full Hymn' }],
  );
  assert.equal(missing.length, 1);
  assert.equal(missing[0].sceneName, 'Missing Scene');

  assert.equal(shouldSyncFromPresenter({ slide: { body: 'text' } }, { active: false }), false);
  assert.equal(shouldSyncFromPresenter({ slide: { body: 'text' } }, { active: true, paused: true }), false);
  assert.equal(shouldSyncFromPresenter({ slide: { body: 'text' } }, { active: true, paused: false, displayMode: 'black' }), false);
  assert.equal(shouldSyncFromPresenter({ slide: { body: 'text' } }, { active: true, paused: false, displayMode: 'lyrics' }), true);

  const outputSource = fs.readFileSync(path.join(ROOT, 'app/obs/obs-output-service.js'), 'utf8');
  assert.ok(outputSource.includes('if (!snapshot || !engineState?.active || engineState.paused) return null'));
  assert.ok(outputSource.includes('stagePreview'));
  assert.ok(outputSource.includes('commitPreview'));

  const overlayFiles = [
    'app/obs/overlays/obs-overlay.html',
    'app/obs/overlays/obs-overlay.css',
    'app/obs/overlays/obs-overlay-client.js',
    'src/obs/obs-http-server.js',
    'app/obs/obs-output-service.js',
    'app/obs/obs-source-service.js',
    'app/obs/obs-control-service.js',
  ];
  overlayFiles.forEach((file) => {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `missing file: ${file}`);
  });

  const docFiles = ['docs/OBS_SETUP.md', 'docs/OBS_MANUAL_QA.md', 'docs/OBS_INTEGRATION.md'];
  docFiles.forEach((file) => {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `missing doc: ${file}`);
  });

  const httpSource = fs.readFileSync(path.join(ROOT, 'src/obs/obs-http-server.js'), 'utf8');
  assert.ok(httpSource.includes('/obs/scripture'));
  assert.ok(httpSource.includes('127.0.0.1'));
  assert.ok(httpSource.includes('/obs/live-sse'));

  const {
    AUTH_MESSAGES,
    formatObsAuthenticationError,
    isAuthenticationError,
    resolveStoredPassword,
  } = require(path.join(ROOT, 'src/obs/obs-auth-errors'));

  assert.equal(
    formatObsAuthenticationError(
      "Your payload's data is missing an 'authentication' string, however authentication is required.",
      false,
    ),
    AUTH_MESSAGES.PASSWORD_REQUIRED,
  );
  assert.equal(
    formatObsAuthenticationError('Authentication failed.', true),
    AUTH_MESSAGES.PASSWORD_REJECTED,
  );
  assert.equal(
    formatObsAuthenticationError('Authentication failed.', false),
    AUTH_MESSAGES.PASSWORD_REQUIRED,
  );
  assert.throws(
    () => resolveStoredPassword(true, ''),
    (error) => error.code === 'OBS_PASSWORD_UNREADABLE',
  );
  assert.equal(isAuthenticationError("missing an 'authentication'", null), true);
  assert.equal(isAuthenticationError('Connection refused', null), false);

  console.log('test-obs-integration: all checks passed');
}

run();
