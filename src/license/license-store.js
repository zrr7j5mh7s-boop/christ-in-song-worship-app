// src/license/license-store.js
// Secure local storage for pilot licence cache and device identity.

const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');
const log = require('electron-log/main');

const CACHE_FILE = 'pilot-license-cache.json';
const IDENTITY_FILE = 'pilot-device-identity.json';

function userDataPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

function encryptString(value) {
  const plain = String(value || '');
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

function decryptString(record) {
  if (!record || !record.value) return '';
  try {
    if (record.method === 'safeStorage' && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(record.value, 'base64'));
    }
    if (record.method === 'base64') {
      return Buffer.from(record.value, 'base64').toString('utf8');
    }
  } catch (error) {
    log.warn('[license-store] decrypt failed:', error.message);
  }
  return '';
}

function readJsonFile(filename) {
  try {
    const filePath = userDataPath(filename);
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log.warn(`[license-store] read ${filename} failed:`, error.message);
    return {};
  }
}

function writeJsonFile(filename, data) {
  try {
    fs.writeFileSync(userDataPath(filename), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    log.error(`[license-store] write ${filename} failed:`, error.message);
    return false;
  }
}

function loadDeviceIdentity() {
  const store = readJsonFile(IDENTITY_FILE);
  return {
    installationId: decryptString(store.installationId),
    privateKeyPem: decryptString(store.privateKeyPem),
    publicKeyPem: decryptString(store.publicKeyPem),
  };
}

function saveDeviceIdentity(identity) {
  const store = {
    installationId: encryptString(identity.installationId),
    privateKeyPem: encryptString(identity.privateKeyPem),
    publicKeyPem: encryptString(identity.publicKeyPem),
    updatedAt: Date.now(),
  };
  return writeJsonFile(IDENTITY_FILE, store);
}

function clearDeviceIdentity() {
  try {
    const filePath = userDataPath(IDENTITY_FILE);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    log.warn('[license-store] clear identity failed:', error.message);
    return false;
  }
}

function loadLicenseCache() {
  const store = readJsonFile(CACHE_FILE);
  const encrypted = store.payload;
  if (!encrypted) return null;
  const json = decryptString(encrypted);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (error) {
    log.warn('[license-store] cache parse failed:', error.message);
    return null;
  }
}

function saveLicenseCache(cache) {
  const payload = encryptString(JSON.stringify(cache));
  return writeJsonFile(CACHE_FILE, {
    payload,
    updatedAt: Date.now(),
  });
}

function clearLicenseCache() {
  try {
    const filePath = userDataPath(CACHE_FILE);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    log.warn('[license-store] clear cache failed:', error.message);
    return false;
  }
}

module.exports = {
  loadDeviceIdentity,
  saveDeviceIdentity,
  clearDeviceIdentity,
  loadLicenseCache,
  saveLicenseCache,
  clearLicenseCache,
};
