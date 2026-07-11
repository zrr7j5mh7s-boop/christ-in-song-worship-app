// src/main.js
//
// Main process for Christ in Song Worship App.
//
// Security posture (see BUILD_GUIDE.md for the reasoning):
//   - contextIsolation: true, nodeIntegration: false, sandbox: true
//   - preload.js is the only bridge into the renderer (contextBridge)
//   - new-window / navigation attempts are intercepted and constrained
//   - CSP is set in app/index.html and src/splash.html via <meta>
//
// Window lifecycle:
//   splash (frameless, transparent) shows immediately -> main window loads
//   hidden in the background -> once its content is actually ready to
//   paint ('ready-to-show'), we swap: show main window, destroy splash.

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const log = require('electron-log/main');

log.initialize();

const { buildMenu } = require('./menu');
const { setupAutoUpdater } = require('./updater');

// ---------------------------------------------------------------------
// Single instance lock - only one copy of the app should ever run.
// A second launch (e.g. double-clicking the app again, or opening a
// file with it) just focuses the existing window instead of spawning
// a second process.
// ---------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let splashWindow = null;
let updater = null;

const isDev = process.argv.includes('--dev') || !app.isPackaged;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ---------------------------------------------------------------------
// Splash screen
// ---------------------------------------------------------------------
function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

// ---------------------------------------------------------------------
// Main application window
// ---------------------------------------------------------------------
function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false, // wait for ready-to-show so there's no white flash
    backgroundColor: '#F5EFE0',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    title: 'Christ in Song Worship App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }

    // Give the UI a moment to settle before checking for updates so it
    // never competes with initial render.
    setTimeout(() => {
      if (updater) updater.checkForUpdatesSilently();
    }, 4000);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ---------------------------------------------------------------------
// Security: constrain what any renderer is allowed to do with windows
// and navigation, regardless of how the request originates. Applied
// globally so it also covers the splash window (harmless there, since
// it never asks for either).
// ---------------------------------------------------------------------
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Never let the renderer spawn new BrowserWindows. Genuine http(s)
    // links are handed to the user's normal browser instead.
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    // The app is a single local file; it never needs to navigate
    // anywhere else. Block it if something ever tries.
    const targetIsLocalFile = url.startsWith('file://');
    if (!targetIsLocalFile) {
      event.preventDefault();
      if (url.startsWith('https://') || url.startsWith('http://')) {
        shell.openExternal(url);
      }
    }
  });
});

// ---------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------
ipcMain.handle('app:get-version', () => app.getVersion());

ipcMain.handle('app:info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
  packaged: app.isPackaged,
}));

ipcMain.handle('updates:check', () => {
  if (updater) updater.checkForUpdates();
  return { started: true };
});

// ---------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------
app.whenReady().then(() => {
  splashWindow = createSplashWindow();
  mainWindow = createMainWindow();

  updater = setupAutoUpdater(mainWindow);

  Menu.setApplicationMenu(
    buildMenu(mainWindow, {
      onCheckForUpdates: () => updater.checkForUpdates(),
    })
  );

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (err) => {
  log.error('[main] Uncaught exception:', err);
});
