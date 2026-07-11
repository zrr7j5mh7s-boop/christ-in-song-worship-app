// src/updater.js
//
// Wraps electron-updater. Update checks only make sense in a packaged
// (installed) build, never in `npm start` during development, and never
// on Linux AppImage-less targets that don't support it well (deb/rpm
// users update via their package manager instead).

const { autoUpdater } = require('electron-updater');
const { dialog, app } = require('electron');
const log = require('electron-log/main');

autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendStatus(mainWindow, status, extra) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...extra });
  }
}

function setupAutoUpdater(mainWindow) {
  autoUpdater.on('checking-for-update', () => {
    sendStatus(mainWindow, 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus(mainWindow, 'available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus(mainWindow, 'not-available');
  });

  autoUpdater.on('error', (err) => {
    log.error('[updater]', err);
    sendStatus(mainWindow, 'error', { message: err == null ? 'unknown error' : err.message });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus(mainWindow, 'downloading', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus(mainWindow, 'downloaded', { version: info.version });

    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Ready',
        message: `Christ in Song Worship App ${info.version} has been downloaded.`,
        detail: 'Restart the app now to finish installing the update, or install it the next time you quit.',
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  return {
    checkForUpdates() {
      if (!app.isPackaged) {
        log.info('[updater] Skipping update check in development.');
        sendStatus(mainWindow, 'dev-skip');
        return;
      }
      autoUpdater.checkForUpdatesAndNotify().catch((err) => log.error('[updater]', err));
    },
    checkForUpdatesSilently() {
      if (!app.isPackaged) return;
      autoUpdater.checkForUpdates().catch((err) => log.error('[updater]', err));
    },
  };
}

module.exports = { setupAutoUpdater };
