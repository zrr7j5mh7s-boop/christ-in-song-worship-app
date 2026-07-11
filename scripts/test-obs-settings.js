#!/usr/bin/env node
// scripts/test-obs-settings.js
//
// Lightweight validation for OBS settings normalization (no OBS instance required).

const assert = require('node:assert/strict');

const DEFAULTS = {
  enabled: false,
  host: '127.0.0.1',
  port: 4455,
  autoReconnect: true,
  reconnectIntervalMs: 5000,
  outputTarget: 'projector',
};

function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: Boolean(input.enabled),
    host: String(input.host || DEFAULTS.host).trim() || DEFAULTS.host,
    port: Math.max(1, Math.min(65535, Number(input.port) || DEFAULTS.port)),
    autoReconnect: input.autoReconnect !== false,
    reconnectIntervalMs: Math.max(2000, Number(input.reconnectIntervalMs) || DEFAULTS.reconnectIntervalMs || 5000),
    outputTarget: ['projector', 'obs', 'both', 'stage'].includes(input.outputTarget)
      ? input.outputTarget
      : DEFAULTS.outputTarget,
  };
}

function run() {
  assert.deepEqual(normalizeSettings({}), DEFAULTS);

  assert.deepEqual(
    normalizeSettings({ enabled: true, host: ' 127.0.0.1 ', port: '4455', reconnectIntervalMs: 1000 }),
    {
      enabled: true,
      host: '127.0.0.1',
      port: 4455,
      autoReconnect: true,
      reconnectIntervalMs: 2000,
      outputTarget: 'projector',
    },
  );

  assert.deepEqual(
    normalizeSettings({ port: 0, host: '', outputTarget: 'both' }),
    {
      enabled: false,
      host: '127.0.0.1',
      port: 4455,
      autoReconnect: true,
      reconnectIntervalMs: 5000,
      outputTarget: 'both',
    },
  );

  assert.deepEqual(
    normalizeSettings({ port: 70000, autoReconnect: false }),
    {
      enabled: false,
      host: '127.0.0.1',
      port: 65535,
      autoReconnect: false,
      reconnectIntervalMs: 5000,
      outputTarget: 'projector',
    },
  );

  const states = ['disabled', 'connecting', 'connected', 'disconnecting', 'disconnected', 'reconnecting', 'error'];
  states.forEach((state) => assert.equal(typeof state, 'string'));

  console.log('test-obs-settings: all checks passed');
}

run();
