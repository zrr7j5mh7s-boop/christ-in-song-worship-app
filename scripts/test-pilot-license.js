#!/usr/bin/env node
'use strict';

/**
 * Controlled pilot licensing tests.
 * Covers activation, validation, offline grace, revocation, tampering, and secret exposure.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

function log(msg) {
  console.log(`[test:pilot-license] ${msg}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walkFiles(dir, visitor) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkFiles(full, visitor);
      continue;
    }
    visitor(full);
  }
}

function installElectronMock(userDataDir) {
  const electronPath = require.resolve('electron');
  const logPath = path.join(userDataDir, 'electron.log');
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
    exports: {
      warn: () => {},
      error: () => {},
      info: () => {},
    },
  };
  return logPath;
}

function freshLicenseModules(userDataDir, env = {}) {
  Object.assign(process.env, env);
  installElectronMock(userDataDir);

  const modulePaths = [
    '../src/license/license-crypto',
    '../src/license/license-store',
    '../src/license/license-config',
    '../src/license/license-service',
  ].map((rel) => path.join(__dirname, rel));

  for (const modPath of modulePaths) {
    delete require.cache[require.resolve(modPath)];
  }

  const licenseCrypto = require('../src/license/license-crypto');
  const licenseStore = require('../src/license/license-store');
  const licenseConfig = require('../src/license/license-config');
  const licenseService = require('../src/license/license-service');

  return { licenseCrypto, licenseStore, licenseConfig, licenseService };
}

function startMockServer() {
  delete require.cache[require.resolve('./mock-license-server')];
  const mock = require('./mock-license-server');
  return new Promise((resolve, reject) => {
    const listener = (error) => reject(error);
    mock.server.once('error', listener);
    mock.server.listen(0, mock.HOST, () => {
      mock.server.removeListener('error', listener);
      const address = mock.server.address();
      const port = typeof address === 'object' && address ? address.port : mock.PORT;
      process.env.PILOT_LICENSE_MOCK_SERVER = 'true';
      process.env.PILOT_LICENSE_MOCK_BASE = `http://${mock.HOST}:${port}`;
      resolve({ ...mock, port });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (!server || !server.listening) return resolve();
    server.close(() => resolve());
  });
}

function buildSignedCache(licenseCrypto, overrides = {}) {
  const keys = licenseCrypto.ensureDevKeyPair();
  const installationId = licenseCrypto.randomInstallationId();
  const installationHash = licenseCrypto.sha256Hex(installationId);
  const serverTime = Date.now();
  const expiresAt = serverTime + 45 * 24 * 60 * 60 * 1000;
  const payload = {
    licenceId: overrides.licenceId || crypto.randomUUID(),
    deviceId: overrides.deviceId || crypto.randomUUID(),
    organisationName: overrides.organisationName || 'Test Pilot Church',
    approvedEmail: overrides.approvedEmail || 'pilot@example.org',
    installationIdHash: installationHash,
    issuedAt: serverTime,
    expiresAt,
    offlineGraceDeadline: serverTime + 7 * 24 * 60 * 60 * 1000,
    serverTime,
    status: overrides.status || 'active',
  };
  const signedToken = licenseCrypto.signTokenForMock(payload, keys.privateKeyPem);
  return {
    cache: {
      licenceId: payload.licenceId,
      deviceId: payload.deviceId,
      organisationName: payload.organisationName,
      installationId,
      issuedAt: serverTime,
      expiresAt,
      offlineGraceDeadline: payload.offlineGraceDeadline,
      signedToken,
      lastServerTime: serverTime,
      lastValidatedAt: serverTime,
      status: payload.status,
      ...overrides.cache,
    },
    keys,
    installationId,
    installationHash,
  };
}

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-lic-test-'));
  const userDataDir = path.join(tmpRoot, 'user-data');
  fs.mkdirSync(userDataDir, { recursive: true });

  const keys = require('../src/license/license-crypto').ensureDevKeyPair();
  assert.ok(keys.publicKeyPem.includes('BEGIN PUBLIC KEY'), 'dev public key generated');
  assert.ok(fs.existsSync(path.join(ROOT, 'src/license/license-public-key.pem')), 'public verification key present');

  const mock = await startMockServer();
  const { licenseCrypto, licenseStore, licenseConfig, licenseService } = freshLicenseModules(userDataDir);

  const config = licenseConfig.getConfig({ isPackaged: false });
  assert.equal(config.mockEnabled, true, 'mock server enabled in dev');
  assert.equal(licenseConfig.isMockServerEnabled({ isPackaged: true }), false);

  licenseService.__test__.resetStateForTest();
  licenseStore.clearLicenseCache();
  licenseStore.clearDeviceIdentity();

  let status = licenseService.initialize();
  assert.equal(status.status, 'not_activated');
  log('first activation state');

  try {
    const activation = await licenseService.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Test Mac');
    assert.equal(activation.ok, true, 'valid activation succeeds');
    assert.equal(activation.status.canPresent, true);
    assert.match(activation.status.organisationName, /Development Pilot Church/);
    log('valid activation');

    const badCode = await licenseService.activateLicence('pilot@example.org', 'PILOT-WRONG', 'Test Mac');
    assert.equal(badCode.ok, false, 'invalid code rejected');
    log('invalid code');

    const badEmail = await licenseService.activateLicence('wrong@example.org', 'PILOT-DEV-0001', 'Test Mac');
    assert.equal(badEmail.ok, false, 'unapproved email rejected');
    log('unapproved email');

    const secondDeviceDir = path.join(tmpRoot, 'user-data-2');
    fs.mkdirSync(secondDeviceDir, { recursive: true });
    const second = freshLicenseModules(secondDeviceDir);
    second.licenseService.__test__.resetStateForTest();
    const secondActivation = await second.licenseService.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Other Mac');
    assert.equal(secondActivation.ok, false, 'second device rejected');
    log('second-device rejection');

    const signed = buildSignedCache(licenseCrypto, { status: 'active' });
    licenseStore.saveDeviceIdentity({
      installationId: signed.installationId,
      privateKeyPem: 'PRIVATE',
      publicKeyPem: 'PUBLIC',
    });
    licenseStore.saveLicenseCache(signed.cache);
    let evaluated = licenseService.__test__.evaluateCache(licenseStore.loadLicenseCache(), config);
    assert.equal(evaluated.canPresent, true);
    log('offline cache accepted with valid signature');

    const expired = buildSignedCache(licenseCrypto, {
      cache: {
        expiresAt: Date.now() - 60_000,
        offlineGraceDeadline: Date.now() - 30_000,
      },
    });
    evaluated = licenseService.__test__.evaluateCache(expired.cache, config);
    assert.equal(evaluated.status, 'expired');
    log('expired licence');

    const revoked = buildSignedCache(licenseCrypto, { status: 'revoked', cache: { status: 'revoked' } });
    evaluated = licenseService.__test__.evaluateCache(revoked.cache, config);
    assert.equal(evaluated.status, 'revoked');
    log('revoked licence');

    const grace = buildSignedCache(licenseCrypto, {
      cache: {
        lastValidatedAt: Date.now() - (25 * 60 * 60 * 1000),
        offlineGraceDeadline: Date.now() + (3 * 24 * 60 * 60 * 1000),
      },
    });
    evaluated = licenseService.__test__.evaluateCache(grace.cache, config);
    assert.equal(evaluated.status, 'active_offline');
    log('offline grace period');

    const graceExceeded = buildSignedCache(licenseCrypto, {
      cache: {
        lastValidatedAt: Date.now() - (10 * 24 * 60 * 60 * 1000),
        offlineGraceDeadline: Date.now() - 60_000,
      },
    });
    evaluated = licenseService.__test__.evaluateCache(graceExceeded.cache, config);
    assert.equal(evaluated.status, 'expired');
    log('offline grace exceeded');

    const copied = buildSignedCache(licenseCrypto);
    copied.cache.installationId = licenseCrypto.randomInstallationId();
    evaluated = licenseService.__test__.evaluateCache(copied.cache, config);
    assert.equal(evaluated.status, 'device_mismatch');
    log('copied local licence cache');

    const tampered = buildSignedCache(licenseCrypto);
    tampered.cache.signedToken = `${tampered.cache.signedToken}x`;
    evaluated = licenseService.__test__.evaluateCache(tampered.cache, config);
    assert.equal(evaluated.status, 'device_mismatch');
    log('invalid signature');

    licenseStore.clearDeviceIdentity();
    licenseStore.saveDeviceIdentity({ installationId: '', privateKeyPem: '', publicKeyPem: '' });
    const identity = licenseStore.loadDeviceIdentity();
    assert.equal(identity.installationId, '');
    log('corrupted secure storage tolerated');

    mock.resetState();
    licenseStore.clearLicenseCache();
    licenseStore.clearDeviceIdentity();
    licenseService.__test__.resetStateForTest();
    const beforeReset = await licenseService.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Reset Mac');
    assert.equal(beforeReset.ok, true, 'reactivation baseline before device reset');
    const deactivated = await licenseService.deactivateLicence();
    assert.equal(deactivated.status, 'not_activated');
    const reactivated = await licenseService.activateLicence('pilot@example.org', 'PILOT-DEV-0001', 'Reset Mac');
    assert.equal(reactivated.ok, true, 'device reset and reactivation');
    log('device reset and reactivation');

    const rollback = buildSignedCache(licenseCrypto, {
      cache: {
        lastServerTime: Date.now() + (2 * 60 * 60 * 1000),
      },
    });
    evaluated = licenseService.__test__.evaluateCache(rollback.cache, config);
    assert.equal(evaluated.status, 'device_mismatch');
    log('clock rollback');
  } finally {
    await stopServer(mock.server);
    licenseService.shutdown();
  }

  const unavailableDir = path.join(tmpRoot, 'user-data-offline');
  fs.mkdirSync(unavailableDir, { recursive: true });
  const offlineOnly = freshLicenseModules(unavailableDir, {
    PILOT_LICENSE_MOCK_SERVER: 'true',
    PILOT_LICENSE_MOCK_BASE: 'http://127.0.0.1:59999',
  });
  const offlineSigned = buildSignedCache(require('../src/license/license-crypto'));
  offlineOnly.licenseStore.saveDeviceIdentity({
    installationId: offlineSigned.installationId,
    privateKeyPem: 'PRIVATE',
    publicKeyPem: 'PUBLIC',
  });
  offlineOnly.licenseStore.saveLicenseCache(offlineSigned.cache);
  offlineOnly.licenseService.initialize();
  const unavailable = await offlineOnly.licenseService.validateLicence({ force: true });
  assert.equal(unavailable.canPresent, true, 'server unavailable but grace still permits when cache valid');
  offlineOnly.licenseService.shutdown();
  log('server unavailable within grace');

  const preload = read('src/preload.js');
  const renderer = read('app/app.js');
  const forbiddenPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/,
    /PILOT_LICENSE_SIGNING_PRIVATE_KEY/,
    /license-signing-private\.pem/,
    /BEGIN PRIVATE KEY/,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(preload), false, `preload must not expose ${pattern}`);
    assert.equal(pattern.test(renderer), false, `renderer must not expose ${pattern}`);
  }
  log('no private secrets in renderer or preload');

  const scan = spawnSync(process.execPath, [path.join(__dirname, 'scan-packaged-secrets.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(scan.status, 0, `secret scan failed:\n${scan.stdout}\n${scan.stderr}`);
  log('secret scan passed');

  console.log('[test:pilot-license] all scenarios passed');
}

run().catch((error) => {
  console.error('[test:pilot-license] FAIL:', error);
  process.exit(1);
});
