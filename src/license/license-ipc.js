// src/license/license-ipc.js
// IPC boundary for pilot licensing.

const log = require('electron-log/main');
const licenseService = require('./license-service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{5,63}$/;

function validateActivationPayload(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  const code = String(payload.code || payload.activationCode || '').trim();
  const deviceName = String(payload.deviceName || 'Pilot Device').trim().slice(0, 120);
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!CODE_RE.test(code)) return { ok: false, error: 'Enter a valid activation code.' };
  return { ok: true, email, code, deviceName };
}

function registerLicenseIpc(ipcMain, mainWindow) {
  const pushStatus = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('license-status', licenseService.getLicenceStatus());
    }
  };

  ipcMain.handle('license:get-status', async () => licenseService.getLicenceStatus());

  ipcMain.handle('license:activate', async (_event, payload) => {
    const validated = validateActivationPayload(payload);
    if (!validated.ok) {
      return { ok: false, error: validated.error, status: licenseService.getLicenceStatus() };
    }
    try {
      const result = await licenseService.activateLicence(
        validated.email,
        validated.code,
        validated.deviceName,
      );
      pushStatus();
      return result;
    } catch (error) {
      log.error('[license] activate failed:', error);
      return {
        ok: false,
        error: 'Activation failed unexpectedly.',
        status: licenseService.getLicenceStatus(),
      };
    }
  });

  ipcMain.handle('license:validate', async () => {
    try {
      const status = await licenseService.validateLicence({ force: true });
      pushStatus();
      return { ok: true, status };
    } catch (error) {
      log.error('[license] validate failed:', error);
      return { ok: false, status: licenseService.getLicenceStatus() };
    }
  });

  ipcMain.handle('license:deactivate', async () => {
    try {
      const status = await licenseService.deactivateLicence();
      pushStatus();
      return { ok: true, status };
    } catch (error) {
      log.error('[license] deactivate failed:', error);
      return { ok: false, status: licenseService.getLicenceStatus() };
    }
  });

  ipcMain.handle('license:is-command-allowed', async (_event, payload) => {
    const command = String(payload?.command || '');
    return { allowed: licenseService.isCommandAllowed(command) };
  });

  return { pushStatus };
}

module.exports = {
  registerLicenseIpc,
};
