// src/menu.js
//
// Native menu bar. Sends command strings to the renderer over IPC;
// app/app.js maps these to navigation, worship controls, and backup flows.

const { Menu, shell, app, dialog } = require('electron');
const brand = require('./brand-config');

function send(mainWindow, command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-command', command);
  }
}

function buildMenu(mainWindow, { onCheckForUpdates } = {}) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Check for Updates\u2026',
                click: () => (onCheckForUpdates ? onCheckForUpdates() : undefined),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),

    {
      label: 'File',
      submenu: [
        { label: 'Home Dashboard', accelerator: 'CmdOrCtrl+1', click: () => send(mainWindow, 'view:home') },
        { label: 'Hymn Index', accelerator: 'CmdOrCtrl+2', click: () => send(mainWindow, 'view:index') },
        { label: 'Search Hymns', accelerator: 'CmdOrCtrl+F', click: () => send(mainWindow, 'view:search') },
        { label: 'Worship Builder', accelerator: 'CmdOrCtrl+3', click: () => send(mainWindow, 'view:builder') },
        { label: 'Presenter Dashboard', accelerator: 'CmdOrCtrl+4', click: () => send(mainWindow, 'view:presenter') },
        { type: 'separator' },
        { label: 'Import Language Pack\u2026', click: () => send(mainWindow, 'import-language-pack') },
        { label: 'Export Backup\u2026', accelerator: 'CmdOrCtrl+Shift+S', click: () => send(mainWindow, 'export-backup') },
        { label: 'Restore Backup\u2026', click: () => send(mainWindow, 'restore-backup') },
        { type: 'separator' },
        { label: 'Export Worship Builder\u2026', accelerator: 'CmdOrCtrl+S', click: () => send(mainWindow, 'export-plan') },
        { label: 'Import Worship Builder\u2026', accelerator: 'CmdOrCtrl+O', click: () => send(mainWindow, 'import-plan') },
        { label: 'Print Worship Builder', accelerator: 'CmdOrCtrl+P', click: () => send(mainWindow, 'print-set') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },

    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    {
      label: 'Worship',
      submenu: [
        { label: 'Present Current Hymn', accelerator: 'CmdOrCtrl+Enter', click: () => send(mainWindow, 'present-current') },
        { label: 'Present Song Service', click: () => send(mainWindow, 'present-song-service') },
        { label: 'Open Presenter Mode', accelerator: 'CmdOrCtrl+Shift+P', click: () => send(mainWindow, 'open-presenter') },
        { type: 'separator' },
        { label: 'Black Screen', accelerator: 'CmdOrCtrl+B', click: () => send(mainWindow, 'emergency-black') },
        { label: 'White Screen', accelerator: 'CmdOrCtrl+W', click: () => send(mainWindow, 'emergency-white') },
        { label: 'Logo Screen', accelerator: 'CmdOrCtrl+L', click: () => send(mainWindow, 'emergency-logo') },
        { label: 'Clear Emergency Screen', accelerator: 'Escape', click: () => send(mainWindow, 'emergency-clear') },
        { type: 'separator' },
        { label: 'Next Slide', accelerator: 'Right', click: () => send(mainWindow, 'presenter-next') },
        { label: 'Previous Slide', accelerator: 'Left', click: () => send(mainWindow, 'presenter-prev') },
      ],
    },

    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    {
      label: 'Service',
      submenu: [
        { label: 'Home', click: () => send(mainWindow, 'view:home') },
        { label: 'Hymn Index', click: () => send(mainWindow, 'view:index') },
        { label: 'Search', click: () => send(mainWindow, 'view:search') },
        { label: 'Worship Builder', click: () => send(mainWindow, 'view:builder') },
        { label: 'Favorites', click: () => send(mainWindow, 'view:favorites') },
        { label: 'Settings', click: () => send(mainWindow, 'view:settings') },
        { type: 'separator' },
        {
          label: 'Emergency Control',
          submenu: [
            { label: 'Black Screen', accelerator: 'CmdOrCtrl+Shift+B', click: () => send(mainWindow, 'emergency-black') },
            { label: 'White Screen', accelerator: 'CmdOrCtrl+Shift+W', click: () => send(mainWindow, 'emergency-white') },
            { label: 'Logo Screen', accelerator: 'CmdOrCtrl+Shift+L', click: () => send(mainWindow, 'emergency-logo') },
            { label: 'Return Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => send(mainWindow, 'emergency-clear') },
          ],
        },
      ],
    },

    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates\u2026',
          click: () => (onCheckForUpdates ? onCheckForUpdates() : undefined),
        },
        { type: 'separator' },
        {
          label: `About ${brand.shortName}`,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: brand.appName,
              message: brand.appName,
              detail: `Version ${app.getVersion()}\n${brand.description}`,
              buttons: ['OK'],
            });
          },
        },
        ...(!isMac
          ? [
              { type: 'separator' },
              {
                label: `About ${brand.appName}`,
                click: () => send(mainWindow, 'show-about'),
              },
            ]
          : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
