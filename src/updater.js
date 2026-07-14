// src/updater.js
//
// Wraps electron-updater. Update checks only make sense in a packaged
// (installed) build, never in `npm start` during development, and never
// on Linux AppImage-less targets that don't support it well (deb/rpm
// users update via their package manager instead).

const { dialog, app } = require('electron');
const brand = require('./brand-config');
const log = require('electron-log/main');

let autoUpdater = null;
let quietModeActive = false;
let pendingUpdateInfo = null;

function getAutoUpdater() {
  if (!app.isPackaged) return null;
  if (!autoUpdater) {
    ({ autoUpdater } = require('electron-updater'));
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  }
  return autoUpdater;
}

function setQuietMode(enabled) {
  quietModeActive = Boolean(enabled);
  const updater = getAutoUpdater();
  if (!updater) return null;
  updater.autoDownload = !quietModeActive;
  if (!quietModeActive && pendingUpdateInfo) {
    const info = pendingUpdateInfo;
    pendingUpdateInfo = null;
    return info;
  }
  return null;
}

function isQuietMode() {
  return quietModeActive;
}

function sendStatus(mainWindow, status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...extra });
  }
}

function createDevUpdater(mainWindow) {
  return {
    checkForUpdates() {
      log.info('[updater] Skipping update check in development.');
      sendStatus(mainWindow, 'dev-skip');
    },
    checkForUpdatesSilently() {},
  };
}

function setupAutoUpdater(mainWindow) {
  const updater = getAutoUpdater();
  if (!updater) return createDevUpdater(mainWindow);

  updater.on('checking-for-update', () => {
    sendStatus(mainWindow, 'checking');
  });

  updater.on('update-available', (info) => {
    if (quietModeActive) {
      sendStatus(mainWindow, 'available-deferred', { version: info.version });
      return;
    }
    sendStatus(mainWindow, 'available', { version: info.version });
  });

  updater.on('update-not-available', () => {
    sendStatus(mainWindow, 'not-available');
  });

  updater.on('error', (err) => {
    log.error('[updater]', err);
    sendStatus(mainWindow, 'error', { message: err == null ? 'unknown error' : err.message });
  });

  updater.on('download-progress', (progress) => {
    sendStatus(mainWindow, 'downloading', { percent: Math.round(progress.percent) });
  });

  updater.on('update-downloaded', (info) => {
    if (quietModeActive) {
      pendingUpdateInfo = info;
      sendStatus(mainWindow, 'downloaded-deferred', { version: info.version });
      return;
    }
    sendStatus(mainWindow, 'downloaded', { version: info.version });

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Ready',
        message: `${brand.appName} ${info.version} has been downloaded.`,
        detail: 'Restart the app now to finish installing the update, or install it the next time you quit.',
      })
      .then(({ response }) => {
        if (response === 0) {
          updater.quitAndInstall();
        }
      });
  });

  return {
    checkForUpdates() {
      updater.checkForUpdatesAndNotify().catch((err) => log.error('[updater]', err));
    },
    checkForUpdatesSilently() {
      updater.checkForUpdates().catch((err) => log.error('[updater]', err));
    },
  };
}

module.exports = { setupAutoUpdater, setQuietMode, isQuietMode };
