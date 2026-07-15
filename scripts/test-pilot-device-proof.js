#!/usr/bin/env node
'use strict';

/**
 * Device proof-of-possession tests for pilot licensing.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function log(msg) {
  console.log(`[test:pilot-device-proof] ${msg}`);
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function installElectronMock(userDataDir) {
  const electronPath = require.resolve('electron');
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      app: {
        getVersion: () => '1.0.0-rc.1',
        getPath: (name) => (name === 'userData' ? userDataDir : path.join(userDataDir, name)),
        isPackaged: false,
      },
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: (value) => Buffer.from(String(value), 'utf8'),
        decryptString: (buffer) => Buffer.from(buffer).toString('utf8'),
      },
    },
  };
  require.cache[require.resolve('electron-log/main')] = {
    id: 'electron-log/main',
    filename: 'electron-log/main',
    loaded: true,
    exports: { warn: () => {}, error: () => {}, info: () => {} },
  };
}

function freshModules(userDataDir) {
  process.env.PILOT_LICENSE_MOCK_SERVER = 'true';
  installElectronMock(userDataDir);
  [
    '../src/license/license-crypto',
    '../src/license/license-store',
    '../src/license/license-config',
    '../src/license/license-service',
    './mock-license-server',
  ].forEach((rel) => delete require.cache[require.resolve(path.join(__dirname, rel))]);

  return {
    crypto: require('../src/license/license-crypto'),
    store: require('../src/license/license-store'),
    config: require('../src/license/license-config'),
    service: require('../src/license/license-service'),
    mock: require('./mock-license-server'),
  };
}

function startMock(mock) {
  return new Promise((resolve, reject) => {
    mock.server.listen(0, mock.HOST, () => {
      const port = mock.server.address().port;
      process.env.PILOT_LICENSE_MOCK_BASE = `http://${mock.HOST}:${port}`;
      resolve(port);
    }).once('error', reject);
  });
}

function stopMock(mock) {
  return new Promise((resolve) => {
    if (!mock.server.listening) return resolve();
    mock.server.close(() => resolve());
  });
}

async function postValidate(mods, cache, identity, appVersion, overrides = {}) {
  const config = mods.config.getConfig({ isPackaged: false });
  const challenge = await mods.service.__test__.requestDeviceChallenge(config, cache, identity);
  assert.equal(challenge.ok, true);
  const proof = mods.service.__test__.buildSignedDeviceProof(identity, cache, challenge.challenge, appVersion);
  const response = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'validate',
      licenceId: overrides.licenceId || cache.licenceId,
      deviceId: overrides.deviceId || cache.deviceId,
      installationId: overrides.installationId || identity.installationId,
      appVersion: overrides.appVersion || appVersion,
      challengeId: challenge.challengeId,
      challenge: challenge.challenge,
      deviceSignature: overrides.deviceSignature || proof.deviceSignature,
      ...overrides.extra,
    }),
  });
  return response.json();
}

async function activateFresh(mods, email = 'pilot@example.org', code = 'PILOT-DEV-0001') {
  mods.mock.resetState();
  mods.store.clearLicenseCache();
  mods.store.clearDeviceIdentity();
  mods.service.__test__.resetStateForTest();
  const activation = await mods.service.activateLicence(email, code, 'Proof Test Device');
  assert.equal(activation.ok, true, 'activation baseline');
  return {
    identity: mods.store.loadDeviceIdentity(),
    cache: mods.store.loadLicenseCache(),
  };
}

async function run() {
  assert.equal(constantTimeEqual('secret-token', 'secret-token'), true);
  assert.equal(constantTimeEqual('secret-token', 'secret-xoken'), false);
  assert.equal(constantTimeEqual('short', 'longer'), false);
  log('constant-time administrator-token comparison');

  const devKeys = require('../src/license/license-crypto').ensureDevKeyPair();
  process.env.PILOT_LICENSE_PUBLIC_KEY = devKeys.publicKeyPem;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-proof-'));
  const mods = freshModules(tmp);
  await startMock(mods.mock);
  const appVersion = '1.0.0-rc.1';

  try {
    const { identity, cache } = await activateFresh(mods);

    const validated = await mods.service.validateLicence({ force: true });
    assert.equal(validated.canPresent, true);
    log('valid challenge and signature');

    const badSig = await postValidate(mods, cache, identity, appVersion, {
      deviceSignature: 'AAAA',
    });
    assert.equal(badSig.ok, false);
    log('invalid signature');

    const otherPair = mods.crypto.generateDeviceKeyPair();
    const config = mods.config.getConfig({ isPackaged: false });
    const challenge = await mods.service.__test__.requestDeviceChallenge(config, cache, identity);
    const canonical = mods.crypto.buildCanonicalDeviceProofPayload({
      challenge: challenge.challenge,
      licenceId: cache.licenceId,
      deviceId: cache.deviceId,
      installationIdHash: mods.crypto.sha256Hex(identity.installationId),
      appVersion,
    });
    const otherSig = mods.crypto.signDeviceProof(otherPair.privateKeyPem, canonical);
    const otherDevice = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationId: identity.installationId,
        appVersion,
        challengeId: challenge.challengeId,
        challenge: challenge.challenge,
        deviceSignature: otherSig,
      }),
    }).then((r) => r.json());
    assert.equal(otherDevice.ok, false);
    log('signature from another device');

    const expired = mods.mock.issueChallenge(cache.licenceId, cache.deviceId);
    mods.mock.expireChallengeForTest(expired.challengeId);
    const expiredProof = mods.service.__test__.buildSignedDeviceProof(identity, cache, expired.challenge, appVersion);
    const expiredResp = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationId: identity.installationId,
        appVersion,
        challengeId: expired.challengeId,
        challenge: expired.challenge,
        deviceSignature: expiredProof.deviceSignature,
      }),
    }).then((r) => r.json());
    assert.equal(expiredResp.ok, false);
    log('expired challenge');

    const reuse = mods.mock.issueChallenge(cache.licenceId, cache.deviceId);
    const reuseProof = mods.service.__test__.buildSignedDeviceProof(identity, cache, reuse.challenge, appVersion);
    const firstReuse = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationId: identity.installationId,
        appVersion,
        challengeId: reuse.challengeId,
        challenge: reuse.challenge,
        deviceSignature: reuseProof.deviceSignature,
      }),
    }).then((r) => r.json());
    assert.equal(firstReuse.ok, true);
    const secondReuse = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationId: identity.installationId,
        appVersion,
        challengeId: reuse.challengeId,
        challenge: reuse.challenge,
        deviceSignature: reuseProof.deviceSignature,
      }),
    }).then((r) => r.json());
    assert.equal(secondReuse.ok, false);
    log('reused challenge');

    const alteredLicence = await postValidate(mods, cache, identity, appVersion, {
      licenceId: crypto.randomUUID(),
    });
    assert.equal(alteredLicence.ok, false);
    log('altered licenceId');

    const alteredDevice = await postValidate(mods, cache, identity, appVersion, {
      deviceId: crypto.randomUUID(),
    });
    assert.equal(alteredDevice.ok, false);
    log('altered deviceId');

    const alteredInstall = await postValidate(mods, cache, identity, appVersion, {
      installationId: mods.crypto.randomInstallationId(),
    });
    assert.equal(alteredInstall.ok, false);
    log('altered installationId');

    const alteredVersionChallenge = await mods.service.__test__.requestDeviceChallenge(config, cache, identity);
    const versionCanonical = mods.crypto.buildCanonicalDeviceProofPayload({
      challenge: alteredVersionChallenge.challenge,
      licenceId: cache.licenceId,
      deviceId: cache.deviceId,
      installationIdHash: mods.crypto.sha256Hex(identity.installationId),
      appVersion: '9.9.9-tampered',
    });
    const versionSig = mods.crypto.signDeviceProof(identity.privateKeyPem, versionCanonical);
    const alteredVersion = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationId: identity.installationId,
        appVersion,
        challengeId: alteredVersionChallenge.challengeId,
        challenge: alteredVersionChallenge.challenge,
        deviceSignature: versionSig,
      }),
    }).then((r) => r.json());
    assert.equal(alteredVersion.ok, false);
    log('altered app version');

    const copiedDir = path.join(tmp, 'copied-cache');
    fs.mkdirSync(copiedDir, { recursive: true });
    const copiedMods = freshModules(copiedDir);
    copiedMods.store.saveLicenseCache({ ...cache });
    copiedMods.service.__test__.resetStateForTest();
    const copiedConfig = copiedMods.config.getConfig({ isPackaged: false });
    const copiedIdentity = copiedMods.store.loadDeviceIdentity();
    const copiedCache = copiedMods.store.loadLicenseCache();
    const copiedProof = await copiedMods.service.__test__.validateWithDeviceProof(
      copiedConfig,
      copiedCache,
      copiedIdentity,
      appVersion,
    );
    assert.equal(copiedProof.ok, false, 'copied cache cannot produce valid device proof');
    copiedMods.service.shutdown();
    log('copied licence cache without the device private key');

    mods.store.clearLicenseCache();
    mods.store.clearDeviceIdentity();
    mods.service.__test__.resetStateForTest();
    mods.mock.resetState();
    await mods.service.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Deactivate test');
    const freshIdentity = mods.store.loadDeviceIdentity();
    const freshCache = mods.store.loadLicenseCache();

    const noProofDeactivate = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/deactivate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenceId: freshCache.licenceId,
        deviceId: freshCache.deviceId,
        installationId: freshIdentity.installationId,
        selfDeactivate: true,
      }),
    }).then((r) => r.json());
    assert.equal(noProofDeactivate.ok, false);
    log('self-deactivation without valid proof rejected');

    const selfDeactivate = await mods.service.deactivateLicence();
    assert.equal(selfDeactivate.status, 'not_activated');
    log('self-deactivation with valid proof');

    mods.mock.resetState();
    mods.store.clearLicenseCache();
    mods.store.clearDeviceIdentity();
    await mods.service.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Admin test');
    const adminCache = mods.store.loadLicenseCache();
    const adminIdentity = mods.store.loadDeviceIdentity();
    process.env.PILOT_ADMIN_TOKEN = 'admin-test-token-123456';
    const adminFail = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/deactivate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenceId: adminCache.licenceId,
        deviceId: adminCache.deviceId,
        installationId: adminIdentity.installationId,
        selfDeactivate: false,
        adminToken: 'wrong-token',
      }),
    }).then((r) => r.json());
    assert.equal(adminFail.ok, false);
    const adminOk = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/deactivate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenceId: adminCache.licenceId,
        deviceId: adminCache.deviceId,
        installationId: adminIdentity.installationId,
        selfDeactivate: false,
        adminToken: 'admin-test-token-123456',
      }),
    }).then((r) => r.json());
    assert.equal(adminOk.ok, true);
    log('administrator token success and failure');

    mods.mock.resetState();
    mods.store.clearLicenseCache();
    mods.store.clearDeviceIdentity();
    await mods.service.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Device one');
    const secondDir = path.join(tmp, 'second-device');
    fs.mkdirSync(secondDir, { recursive: true });
    const second = freshModules(secondDir);
    const secondActivation = await second.service.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Device two');
    assert.equal(secondActivation.ok, false);
    second.service.shutdown();
    log('second-device activation rejection');

    const malformedKeyResp = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/activate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pilot@example.org',
        activationCode: 'PILOT-DEV-0001',
        installationId: mods.crypto.randomInstallationId(),
        devicePublicKey: 'not-a-key',
      }),
    }).then((r) => r.json());
    assert.equal(malformedKeyResp.ok, false);
    log('malformed public key');

    const clientChallenge = await fetch(`${process.env.PILOT_LICENSE_MOCK_BASE}/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'challenge',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationId: identity.installationId,
        challenge: 'client-generated',
      }),
    }).then((r) => r.json());
    assert.equal(clientChallenge.ok, false);
    log('client-generated challenge rejected');

    const missingKeyVerify = mods.mock.verifyProof(
      {
        id: cache.deviceId,
        device_public_key: '',
      },
      {
        challengeId: 'x',
        challenge: 'y',
        licenceId: cache.licenceId,
        deviceId: cache.deviceId,
        installationIdHash: mods.crypto.sha256Hex(identity.installationId),
        appVersion,
        deviceSignature: 'abc',
      },
    );
    assert.equal(missingKeyVerify.ok, false);
    log('missing device public key');
  } finally {
    mods.service.shutdown();
    await stopMock(mods.mock);
  }

  console.log('[test:pilot-device-proof] all scenarios passed');
}

run().catch((error) => {
  console.error('[test:pilot-device-proof] FAIL:', error);
  process.exit(1);
});
