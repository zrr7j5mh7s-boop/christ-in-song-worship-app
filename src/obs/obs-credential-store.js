// src/obs/obs-credential-store.js
//
// Stores OBS WebSocket passwords in the Electron userData directory.
// Uses safeStorage when available; otherwise stores a base64-encoded blob
// (weaker fallback — documented in docs/OBS_INTEGRATION.md).

const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');
const log = require('electron-log/main');

const CREDENTIAL_FILE = 'obs-credentials.json';

function credentialPath() {
  return path.join(app.getPath('userData'), CREDENTIAL_FILE);
}

function readStore() {
  try {
    const filePath = credentialPath();
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log.warn('[obs-credentials] Failed to read credential store:', error.message);
    return {};
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(credentialPath(), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    log.error('[obs-credentials] Failed to write credential store:', error.message);
    return false;
  }
}

function encryptPassword(password) {
  const plain = String(password || '');
  if (!plain) return null;
  if (safeStorage.isEncryptionAvailable()) {
    return {
      method: 'safeStorage',
      value: safeStorage.encryptString(plain).toString('base64'),
    };
  }
  return {
    method: 'base64',
    value: Buffer.from(plain, 'utf8').toString('base64'),
  };
}

function decryptPassword(record) {
  if (!record || !record.value) return '';
  try {
    if (record.method === 'safeStorage' && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(record.value, 'base64'));
    }
    if (record.method === 'base64') {
      return Buffer.from(record.value, 'base64').toString('utf8');
    }
  } catch (error) {
    log.warn('[obs-credentials] Failed to decrypt password:', error.message);
  }
  return '';
}

function savePassword(password) {
  const encrypted = encryptPassword(password);
  const store = readStore();
  if (!encrypted) {
    delete store.password;
  } else {
    store.password = encrypted;
  }
  store.updatedAt = Date.now();
  writeStore(store);
  return Boolean(encrypted);
}

function getPassword() {
  const store = readStore();
  return decryptPassword(store.password);
}

function hasPassword() {
  const store = readStore();
  return Boolean(store.password && store.password.value);
}

function clearPassword() {
  const store = readStore();
  delete store.password;
  store.updatedAt = Date.now();
  writeStore(store);
}

module.exports = {
  savePassword,
  getPassword,
  hasPassword,
  clearPassword,
};
