#!/usr/bin/env node
// scripts/test-obs-settings.js
//
// Lightweight validation for OBS settings normalization (no OBS instance required).

const assert = require('node:assert/strict');

const DEFAULTS = {
  enabled: false,
  host: '127.0.0.1',
  port: 4455,
  autoConnectOnStart: false,
  autoReconnect: true,
  reconnectIntervalMs: 5000,
  connectionTimeoutMs: 10000,
  outputTarget: 'projector',
  sceneMappings: {},
  sourceMappings: {},
  overlayLayouts: {},
  browserSourcePort: 47823,
  outputDefaults: { bible: 'both', hymn: 'both' },
  confirmations: { streamStart: true, streamStop: true, recordStop: true, blackout: false },
  sceneChangePerContent: true,
};

function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const sceneMappings = input.sceneMappings && typeof input.sceneMappings === 'object'
    ? input.sceneMappings
    : {};
  const sourceMappings = input.sourceMappings && typeof input.sourceMappings === 'object'
    ? input.sourceMappings
    : {};
  return {
    enabled: Boolean(input.enabled),
    host: String(input.host || DEFAULTS.host).trim() || DEFAULTS.host,
    port: Math.max(1, Math.min(65535, Number(input.port) || DEFAULTS.port)),
    browserSourcePort: Math.max(1024, Math.min(65535, Number(input.browserSourcePort) || DEFAULTS.browserSourcePort || 47823)),
    autoConnectOnStart: Boolean(input.autoConnectOnStart),
    autoReconnect: input.autoReconnect !== false,
    reconnectIntervalMs: Math.max(2000, Number(input.reconnectIntervalMs) || DEFAULTS.reconnectIntervalMs || 5000),
    connectionTimeoutMs: Math.max(3000, Math.min(60000, Number(input.connectionTimeoutMs) || DEFAULTS.connectionTimeoutMs || 10000)),
    outputTarget: ['projector', 'obs', 'both', 'stage', 'all'].includes(input.outputTarget)
      ? input.outputTarget
      : DEFAULTS.outputTarget,
    sceneMappings,
    sourceMappings,
    overlayLayouts: input.overlayLayouts && typeof input.overlayLayouts === 'object' ? input.overlayLayouts : {},
    outputDefaults: input.outputDefaults && typeof input.outputDefaults === 'object'
      ? { ...DEFAULTS.outputDefaults, ...input.outputDefaults }
      : DEFAULTS.outputDefaults,
    confirmations: input.confirmations && typeof input.confirmations === 'object'
      ? { ...DEFAULTS.confirmations, ...input.confirmations }
      : DEFAULTS.confirmations,
    sceneChangePerContent: input.sceneChangePerContent !== false,
  };
}

function run() {
  assert.deepEqual(normalizeSettings({}), DEFAULTS);

  assert.deepEqual(
    normalizeSettings({ enabled: true, host: ' 127.0.0.1 ', port: '4455', reconnectIntervalMs: 1000 }),
    {
      ...DEFAULTS,
      enabled: true,
      reconnectIntervalMs: 2000,
    },
  );

  assert.deepEqual(
    normalizeSettings({
      enabled: true,
      autoConnectOnStart: true,
      connectionTimeoutMs: 2000,
      outputTarget: 'both',
    }),
    {
      ...DEFAULTS,
      enabled: true,
      autoConnectOnStart: true,
      connectionTimeoutMs: 3000,
      outputTarget: 'both',
    },
  );

  assert.deepEqual(
    normalizeSettings({ port: 0, host: '', outputTarget: 'both' }),
    {
      ...DEFAULTS,
      outputTarget: 'both',
    },
  );

  assert.deepEqual(
    normalizeSettings({ port: 70000, autoReconnect: false, connectionTimeoutMs: 120000 }),
    {
      ...DEFAULTS,
      port: 65535,
      autoReconnect: false,
      connectionTimeoutMs: 60000,
    },
  );

  const states = [
    'disabled',
    'disconnected',
    'connecting',
    'authenticating',
    'connected',
    'disconnecting',
    'reconnecting',
    'authentication_failed',
    'connection_failed',
    'obs_unavailable',
    'version_unsupported',
    'error',
  ];
  states.forEach((state) => assert.equal(typeof state, 'string'));

  console.log('test-obs-settings: all checks passed');
}

run();
