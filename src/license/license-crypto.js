// src/license/license-crypto.js
// Cryptographic helpers for pilot licensing (main process only).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEVICE_PROOF_TYPE = 'pilot-device-proof-v1';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function randomInstallationId() {
  return crypto.randomUUID();
}

function generateDeviceKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function exportPublicKeySpki(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  return key.export({ type: 'spki', format: 'pem' });
}

function verifySignedToken(token, publicKeyPem) {
  if (!token || !publicKeyPem) return { ok: false, reason: 'missing_token_or_key' };
  const parts = String(token).split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed_token' };

  const payloadJson = Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const signature = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  try {
    const key = crypto.createPublicKey(publicKeyPem);
    const valid = crypto.verify(null, Buffer.from(payloadJson, 'utf8'), key, signature);
    if (!valid) return { ok: false, reason: 'invalid_signature' };
    const payload = JSON.parse(payloadJson);
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, reason: error.message || 'verify_failed' };
  }
}

function buildCanonicalDeviceProofPayload(input) {
  return JSON.stringify({
    type: DEVICE_PROOF_TYPE,
    challenge: String(input.challenge || ''),
    licenceId: String(input.licenceId || ''),
    deviceId: String(input.deviceId || ''),
    installationIdHash: String(input.installationIdHash || ''),
    appVersion: String(input.appVersion || ''),
  });
}

function signDeviceProof(privateKeyPem, canonicalPayload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), key);
  return signature
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function verifyDeviceProofSignature(publicKeyPem, canonicalPayload, signatureBase64Url) {
  if (!publicKeyPem || !canonicalPayload || !signatureBase64Url) {
    return { ok: false, reason: 'missing_proof_material' };
  }
  try {
    const signature = Buffer.from(
      String(signatureBase64Url).replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    );
    const key = crypto.createPublicKey(publicKeyPem);
    const valid = crypto.verify(null, Buffer.from(canonicalPayload, 'utf8'), key, signature);
    return { ok: valid, reason: valid ? 'ok' : 'invalid_signature' };
  } catch (error) {
    return { ok: false, reason: error.message || 'verify_failed' };
  }
}

function isValidEd25519PublicKeyPem(publicKeyPem) {
  const normalized = String(publicKeyPem || '').trim();
  if (!normalized.includes('BEGIN PUBLIC KEY')) return false;
  try {
    crypto.createPublicKey(normalized);
    return true;
  } catch {
    return false;
  }
}

function signTokenForMock(payload, privateKeyPem) {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payloadJson, 'utf8'), key);
  const sigB64 = signature
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${payloadB64}.${sigB64}`;
}

function ensureDevKeyPair() {
  const keyDir = path.join(__dirname, '.dev-keys');
  const privatePath = path.join(keyDir, 'license-signing-private.pem');
  const publicPath = path.join(keyDir, 'license-signing-public.pem');
  if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
    const pair = generateDeviceKeyPair();
    fs.mkdirSync(keyDir, { recursive: true });
    fs.writeFileSync(privatePath, pair.privateKeyPem, { mode: 0o600 });
    fs.writeFileSync(publicPath, pair.publicKeyPem, 'utf8');
  }
  return {
    privateKeyPem: fs.readFileSync(privatePath, 'utf8'),
    publicKeyPem: fs.readFileSync(publicPath, 'utf8'),
  };
}

module.exports = {
  DEVICE_PROOF_TYPE,
  sha256Hex,
  randomInstallationId,
  generateDeviceKeyPair,
  exportPublicKeySpki,
  verifySignedToken,
  buildCanonicalDeviceProofPayload,
  signDeviceProof,
  verifyDeviceProofSignature,
  isValidEd25519PublicKeyPem,
  signTokenForMock,
  ensureDevKeyPair,
};
