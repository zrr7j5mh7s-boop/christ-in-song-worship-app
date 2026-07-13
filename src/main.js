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

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, Menu, screen, session } = require('electron');
const log = require('electron-log/main');

log.initialize();

const { buildMenu } = require('./menu');
const { setupAutoUpdater } = require('./updater');
const obsManager = require('./obs/obs-manager');

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
let projectorWindow = null;
let obsMonitorWindow = null;
let cameraPreviewWindow = null;
let obsMonitorWorshipContext = {
  worshipPreview: "—",
  worshipLive: "—",
  worshipLiveActive: false,
};
let obsMonitorStartPrefs = { deviceId: "", deviceLabel: "" };
let updater = null;

const isDev = process.argv.includes('--dev') || !app.isPackaged;

function resolveIndexHtml() {
  const prodIndex = path.join(__dirname, '..', 'app', 'index.prod.html');
  if (app.isPackaged && fs.existsSync(prodIndex)) return 'index.prod.html';
  return 'index.html';
}

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

  win.loadFile(path.join(__dirname, '..', 'app', resolveIndexHtml()));

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

function getProjectorDisplay() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return displays.find((display) => display.id !== primary.id) || primary;
}

function createProjectorWindow() {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.focus();
    return projectorWindow;
  }

  const targetDisplay = getProjectorDisplay();
  const { x, y, width, height } = targetDisplay.bounds;
  const hasExternalDisplay = screen.getAllDisplays().length > 1;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: hasExternalDisplay,
    frame: !hasExternalDisplay,
    backgroundColor: '#0A1020',
    title: 'Christ in Song · Projector',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'app', 'presenter-screen.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (hasExternalDisplay) {
      win.setFullScreen(true);
    }
  });
  win.on('closed', () => {
    projectorWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('presenter-closed');
    }
  });
  projectorWindow = win;
  return win;
}

ipcMain.handle('presenter:open', () => {
  createProjectorWindow();
  return { opened: true, dualDisplay: screen.getAllDisplays().length > 1 };
});

ipcMain.handle('presenter:close', () => {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.close();
  }
  projectorWindow = null;
  return { closed: true };
});

ipcMain.handle('presenter:publish', (_event, payload) => {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send('presenter-state', payload);
  }
  return { delivered: true };
});

function createObsMonitorWindow() {
  if (obsMonitorWindow && !obsMonitorWindow.isDestroyed()) {
    obsMonitorWindow.focus();
    return obsMonitorWindow;
  }

  const win = new BrowserWindow({
    width: 960,
    height: 620,
    minWidth: 640,
    minHeight: 420,
    title: 'Christ in Song · OBS Program Monitor',
    backgroundColor: '#0A1020',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'app', 'obs', 'obs-program-monitor-window.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    obsMonitorWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('obs-monitor-closed');
    }
  });
  obsMonitorWindow = win;
  return win;
}

ipcMain.handle('obs-monitor:open', (_event, payload) => {
  obsMonitorStartPrefs = {
    deviceId: payload?.deviceId || '',
    deviceLabel: payload?.deviceLabel || '',
  };
  if (payload?.worshipContext) {
    obsMonitorWorshipContext = { ...obsMonitorWorshipContext, ...payload.worshipContext };
  }
  createObsMonitorWindow();
  return { opened: true };
});

ipcMain.handle('obs-monitor:close', () => {
  if (obsMonitorWindow && !obsMonitorWindow.isDestroyed()) {
    obsMonitorWindow.close();
  }
  obsMonitorWindow = null;
  return { closed: true };
});

ipcMain.handle('obs-monitor:get-start-prefs', () => ({ ...obsMonitorStartPrefs }));

ipcMain.handle('obs-monitor:get-worship-context', () => ({ ...obsMonitorWorshipContext }));

ipcMain.handle('obs-monitor:set-worship-context', (_event, payload) => {
  if (payload && typeof payload === 'object') {
    obsMonitorWorshipContext = { ...obsMonitorWorshipContext, ...payload };
  }
  return { ok: true };
});

ipcMain.handle('obs-monitor:stopped', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('obs-monitor-stopped');
  }
  return { ok: true };
});

function createCameraPreviewWindow() {
  if (cameraPreviewWindow && !cameraPreviewWindow.isDestroyed()) {
    cameraPreviewWindow.focus();
    return cameraPreviewWindow;
  }

  const win = new BrowserWindow({
    width: 720,
    height: 480,
    minWidth: 480,
    minHeight: 320,
    title: 'Christ in Song · Camera Preview',
    backgroundColor: '#131F38',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'app', 'camera', 'camera-preview-window.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    cameraPreviewWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('camera-preview-closed');
    }
  });
  cameraPreviewWindow = win;
  return win;
}

ipcMain.handle('camera-preview:open', () => {
  createCameraPreviewWindow();
  return { opened: true };
});

ipcMain.handle('camera-preview:close', () => {
  if (cameraPreviewWindow && !cameraPreviewWindow.isDestroyed()) {
    cameraPreviewWindow.close();
  }
  cameraPreviewWindow = null;
  return { closed: true };
});

obsManager.registerIpc(ipcMain);

const obsHttpServer = require('./obs/obs-http-server');
obsHttpServer.registerIpc(ipcMain);

// ---------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media' || permission === 'camera' || permission === 'videoCapture') {
      callback(true);
      return;
    }
    callback(false);
  });

  splashWindow = createSplashWindow();
  mainWindow = createMainWindow();
  obsManager.setMainWindow(mainWindow);
  obsHttpServer.start({ port: 47823 }).catch((err) => {
    log.warn('[obs-http] Could not start browser source server:', err.message);
  });

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
