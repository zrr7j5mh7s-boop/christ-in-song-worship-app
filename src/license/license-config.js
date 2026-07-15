// src/license/license-config.js
// Pilot licensing configuration. Secrets belong in environment variables only.

const path = require('node:path');
const fs = require('node:fs');
const runtimeConfig = require('./license-runtime-config');

const DEFAULTS = {
  validationIntervalMs: 24 * 60 * 60 * 1000,
  offlineGraceDays: 7,
  maxDevices: 1,
  pilotPeriodDays: 45,
  requestTimeoutMs: 15_000,
};

function readPublicKeyPem() {
  const fromEnv = process.env.PILOT_LICENSE_PUBLIC_KEY;
  if (fromEnv) {
    return fromEnv.replace(/\\n/g, '\n');
  }
  const pemPath = path.join(__dirname, 'license-public-key.pem');
  if (fs.existsSync(pemPath)) {
    return fs.readFileSync(pemPath, 'utf8');
  }
  return '';
}

function resolveApiBase(app) {
  if (process.env.PILOT_LICENSE_API_BASE) {
    return process.env.PILOT_LICENSE_API_BASE.replace(/\/$/, '');
  }
  const projectUrl = process.env.SUPABASE_URL || process.env.PILOT_SUPABASE_URL || '';
  if (projectUrl) {
    return `${projectUrl.replace(/\/$/, '')}/functions/v1`;
  }
  if (app?.isPackaged) {
    const embeddedBase = String(runtimeConfig.apiBase || '').trim();
    if (embeddedBase) return embeddedBase.replace(/\/$/, '');
    const embeddedProject = String(runtimeConfig.supabaseUrl || '').trim();
    if (embeddedProject) {
      return `${embeddedProject.replace(/\/$/, '')}/functions/v1`;
    }
  }
  return '';
}

function isMockServerEnabled(app) {
  if (app?.isPackaged) return false;
  return process.env.PILOT_LICENSE_MOCK_SERVER === 'true'
    || process.env.LICENSE_MOCK_SERVER === 'true';
}

function getConfig(app) {
  const apiBase = resolveApiBase(app);
  const publicKeyPem = readPublicKeyPem();
  const mockEnabled = isMockServerEnabled(app);
  const mockBase = mockEnabled
    ? (process.env.PILOT_LICENSE_MOCK_BASE || 'http://127.0.0.1:47824')
    : '';

  return {
    ...DEFAULTS,
    apiBase: mockEnabled ? mockBase : apiBase,
    publicKeyPem,
    mockEnabled,
    configured: Boolean((mockEnabled && mockBase) || (apiBase && publicKeyPem)),
    activatePath: '/activate-license',
    validatePath: '/validate-license',
    deactivatePath: '/deactivate-device',
  };
}

module.exports = {
  DEFAULTS,
  getConfig,
  isMockServerEnabled,
};
