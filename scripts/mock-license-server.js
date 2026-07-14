#!/usr/bin/env node
'use strict';

// Development-only mock licence server. Never enable in packaged production builds.

const http = require('node:http');
const crypto = require('node:crypto');
const path = require('node:path');
const {
  ensureDevKeyPair,
  sha256Hex,
  signTokenForMock,
  buildCanonicalDeviceProofPayload,
  verifyDeviceProofSignature,
  isValidEd25519PublicKeyPem,
} = require('../src/license/license-crypto');

const PORT = Number(process.env.PILOT_LICENSE_MOCK_PORT || 47824);
const HOST = process.env.PILOT_LICENSE_MOCK_HOST || '127.0.0.1';

const keys = ensureDevKeyPair();
const licenses = new Map();
const devices = new Map();
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function seedLicense() {
  const code = process.env.PILOT_MOCK_ACTIVATION_CODE || 'PILOT-DEV-0001';
  const email = process.env.PILOT_MOCK_EMAIL || 'pilot@example.org';
  const id = crypto.randomUUID();
  licenses.set(sha256Hex(code), {
    id,
    approved_email: email,
    organisation_name: 'Development Pilot Church',
    status: 'active',
    expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    max_devices: 1,
    offline_grace_days: 7,
  });
  return { code, email, id };
}

const seeded = seedLicense();

function resetState() {
  licenses.clear();
  devices.clear();
  challenges.clear();
  return seedLicense();
}

function generateChallengeValue() {
  return crypto.randomBytes(32).toString('hex');
}

function issueChallenge(licenceId, deviceId) {
  const challenge = generateChallengeValue();
  const challengeId = crypto.randomUUID();
  challenges.set(challengeId, {
    id: challengeId,
    licence_id: licenceId,
    device_id: deviceId,
    challenge_hash: sha256Hex(challenge),
    challenge,
    expires_at: Date.now() + CHALLENGE_TTL_MS,
    used_at: null,
  });
  return { challengeId, challenge, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() };
}

function consumeChallenge(input) {
  const row = challenges.get(input.challengeId);
  if (!row) return { ok: false, reason: 'challenge_not_found' };
  if (row.licence_id !== input.licenceId || row.device_id !== input.deviceId) {
    return { ok: false, reason: 'challenge_binding_mismatch' };
  }
  if (row.used_at) return { ok: false, reason: 'challenge_reused' };
  if (row.expires_at <= Date.now()) return { ok: false, reason: 'challenge_expired' };
  if (row.challenge_hash !== sha256Hex(input.challenge)) {
    return { ok: false, reason: 'challenge_invalid' };
  }
  row.used_at = Date.now();
  challenges.set(row.id, row);
  return { ok: true, reason: 'ok' };
}

function verifyProof(device, input) {
  if (!device.device_public_key) return { ok: false, reason: 'missing_device_public_key' };
  if (!isValidEd25519PublicKeyPem(device.device_public_key)) {
    return { ok: false, reason: 'malformed_device_public_key' };
  }
  const challengeCheck = consumeChallenge({
    challengeId: input.challengeId,
    challenge: input.challenge,
    licenceId: input.licenceId,
    deviceId: input.deviceId,
  });
  if (!challengeCheck.ok) return challengeCheck;
  const canonicalPayload = buildCanonicalDeviceProofPayload({
    challenge: input.challenge,
    licenceId: input.licenceId,
    deviceId: input.deviceId,
    installationIdHash: input.installationIdHash,
    appVersion: input.appVersion,
  });
  return verifyDeviceProofSignature(
    device.device_public_key,
    canonicalPayload,
    input.deviceSignature,
  );
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function respond(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-pilot-client',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function buildToken(license, device, installationHash) {
  const serverTime = Date.now();
  return signTokenForMock({
    licenceId: license.id,
    deviceId: device.id,
    organisationName: license.organisation_name,
    approvedEmail: license.approved_email,
    installationIdHash: installationHash,
    issuedAt: serverTime,
    expiresAt: new Date(license.expires_at).getTime(),
    offlineGraceDeadline: serverTime + license.offline_grace_days * 24 * 60 * 60 * 1000,
    serverTime,
    status: license.status,
  }, keys.privateKeyPem);
}

async function handleActivate(body) {
  const codeHash = sha256Hex(String(body.activationCode || body.code || ''));
  const license = licenses.get(codeHash);
  const email = String(body.email || '').trim().toLowerCase();
  if (!license || license.approved_email !== email) {
    return { ok: false, error: 'Authentication failed.' };
  }
  if (license.status === 'revoked') return { ok: false, error: 'Licence revoked.' };

  const installationHash = sha256Hex(String(body.installationId || ''));
  const devicePublicKey = String(body.devicePublicKey || '').trim();
  if (!isValidEd25519PublicKeyPem(devicePublicKey)) {
    return { ok: false, error: 'Authentication failed.' };
  }
  const active = [...devices.values()].filter((d) => d.licence_id === license.id && !d.revoked_at);
  const existing = active.find((d) => d.installation_id_hash === installationHash);
  if (!existing && active.length >= license.max_devices) {
    return { ok: false, error: 'Device limit reached.' };
  }

  const device = existing || {
    id: crypto.randomUUID(),
    licence_id: license.id,
    installation_id_hash: installationHash,
    device_public_key: devicePublicKey,
    revoked_at: null,
  };
  if (existing) device.device_public_key = devicePublicKey;
  devices.set(device.id, device);

  const serverTime = Date.now();
  const signedToken = buildToken(license, device, installationHash);
  return {
    ok: true,
    licenceId: license.id,
    deviceId: device.id,
    organisationName: license.organisation_name,
    expiresAt: license.expires_at,
    offlineGraceDays: license.offline_grace_days,
    serverTime,
    signedToken,
    status: license.status,
  };
}

async function handleValidate(body) {
  const license = [...licenses.values()].find((entry) => entry.id === body.licenceId);
  const device = devices.get(body.deviceId);
  const installationHash = sha256Hex(String(body.installationId || ''));
  if (!license || !device) return { ok: false, error: 'Authentication failed.' };
  if (device.installation_id_hash !== installationHash) {
    return { ok: false, error: 'Authentication failed.' };
  }
  if (license.status === 'revoked' || device.revoked_at) {
    return { ok: false, error: 'Authentication failed.', status: 'revoked' };
  }

  const action = String(body.action || 'validate').toLowerCase();
  if (action === 'challenge') {
    if (body.challenge || body.deviceSignature || body.challengeId) {
      return { ok: false, error: 'Authentication failed.' };
    }
    const issued = issueChallenge(license.id, device.id);
    return {
      ok: true,
      action: 'challenge',
      challengeId: issued.challengeId,
      challenge: issued.challenge,
      expiresAt: issued.expiresAt,
    };
  }

  const proof = verifyProof(device, {
    challengeId: String(body.challengeId || ''),
    challenge: String(body.challenge || ''),
    licenceId: license.id,
    deviceId: device.id,
    installationIdHash: installationHash,
    appVersion: String(body.appVersion || ''),
    deviceSignature: String(body.deviceSignature || ''),
  });
  if (!proof.ok) return { ok: false, error: 'Authentication failed.' };

  const serverTime = Date.now();
  return {
    ok: true,
    action: 'validate',
    licenceId: license.id,
    deviceId: device.id,
    organisationName: license.organisation_name,
    expiresAt: license.expires_at,
    offlineGraceDays: license.offline_grace_days,
    serverTime,
    signedToken: buildToken(license, device, device.installation_id_hash),
    status: license.status,
  };
}

async function handleDeactivate(body) {
  const device = devices.get(body.deviceId);
  const installationHash = sha256Hex(String(body.installationId || ''));
  if (!device || device.installation_id_hash !== installationHash) {
    return { ok: false, error: 'Authentication failed.' };
  }

  if (body.selfDeactivate) {
    const proof = verifyProof(device, {
      challengeId: String(body.challengeId || ''),
      challenge: String(body.challenge || ''),
      licenceId: String(body.licenceId || ''),
      deviceId: device.id,
      installationIdHash: installationHash,
      appVersion: String(body.appVersion || ''),
      deviceSignature: String(body.deviceSignature || ''),
    });
    if (!proof.ok) return { ok: false, error: 'Authentication failed.' };
  } else {
    const adminToken = process.env.PILOT_ADMIN_TOKEN || '';
    const provided = String(body.adminToken || '');
    if (!adminToken || adminToken !== provided) return { ok: false, error: 'Authentication failed.' };
  }

  device.revoked_at = new Date().toISOString();
  devices.set(device.id, device);
  return { ok: true };
}

function expireChallengeForTest(challengeId) {
  const row = challenges.get(challengeId);
  if (!row) return false;
  row.expires_at = Date.now() - 1000;
  challenges.set(challengeId, row);
  return true;
}

function getChallengeForTest(challengeId) {
  return challenges.get(challengeId) || null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return respond(res, 200, { ok: true });
  if (req.method !== 'POST') return respond(res, 405, { ok: false });

  try {
    const body = await readJson(req);
    const route = req.url || '';
    if (route.endsWith('/activate-license')) return respond(res, 200, await handleActivate(body));
    if (route.endsWith('/validate-license')) return respond(res, 200, await handleValidate(body));
    if (route.endsWith('/deactivate-device')) return respond(res, 200, await handleDeactivate(body));
    return respond(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    return respond(res, 500, { ok: false, error: error.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[mock-license] listening on http://${HOST}:${PORT}`);
    console.log(`[mock-license] seeded code=${seeded.code} email=${seeded.email}`);
  });
}

module.exports = {
  server,
  seedLicense,
  resetState,
  issueChallenge,
  consumeChallenge,
  verifyProof,
  expireChallengeForTest,
  getChallengeForTest,
  PORT,
  HOST,
};
