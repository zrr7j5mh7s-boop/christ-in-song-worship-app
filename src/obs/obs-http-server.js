// src/obs/obs-http-server.js
//
// Localhost-only HTTP + SSE server for OBS Browser Source overlays.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const log = require('electron-log/main');

const DEFAULT_PORT = 47823;
const OVERLAY_DIR = path.join(__dirname, '..', '..', 'app', 'obs', 'overlays');

const ROUTE_MAP = {
  '/obs/scripture': 'scripture',
  '/obs/hymn': 'hymn',
  '/obs/lower-third': 'lower-third',
  '/obs/sermon-title': 'sermon-title',
  '/obs/announcement': 'announcement',
  '/obs/fullscreen': 'fullscreen',
  '/obs/clean-feed': 'clean-feed',
};

let server = null;
let port = DEFAULT_PORT;
let livePayload = createEmptyPayload();
const sseClients = new Set();
const heartbeat = {
  scripture: 0,
  hymn: 0,
  'lower-third': 0,
  'sermon-title': 0,
  announcement: 0,
  fullscreen: 0,
  'clean-feed': 0,
};

function createEmptyPayload() {
  return {
    scripture: null,
    hymn: null,
    lowerThird: null,
    sermonTitle: null,
    announcement: null,
    fullscreen: null,
    cleanFeed: null,
    theme: { fontScale: 1, reducedMotion: false },
    sentAt: Date.now(),
  };
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

function isLocalAddress(address) {
  if (!address) return false;
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1'
    || address.endsWith('127.0.0.1');
}

function broadcast(payload) {
  const message = JSON.stringify({ type: 'live', payload });
  sseClients.forEach((res) => {
    try {
      res.write(`data: ${message}\n\n`);
    } catch (error) {
      sseClients.delete(res);
    }
  });
}

function publishLive(nextPayload) {
  livePayload = {
    ...livePayload,
    ...nextPayload,
    sentAt: Date.now(),
  };
  broadcast(livePayload);
  return livePayload;
}

function getLivePayload() {
  return { ...livePayload, sentAt: livePayload.sentAt };
}

function getHeartbeat() {
  return { ...heartbeat, serverAt: Date.now(), port };
}

function getBaseUrl() {
  return `http://127.0.0.1:${port}`;
}

function getRouteUrls() {
  return Object.keys(ROUTE_MAP).reduce((acc, routePath) => {
    acc[ROUTE_MAP[routePath]] = `${getBaseUrl()}${routePath}`;
    return acc;
  }, {});
}

function serveStatic(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeFor(filePath),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

function handleSse(req, res, route) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`data: ${JSON.stringify({ type: 'live', payload: getLivePayload() })}\n\n`);
  sseClients.add(res);
  if (route && Object.prototype.hasOwnProperty.call(heartbeat, route)) {
    heartbeat[route] = Date.now();
  }
  req.on('close', () => sseClients.delete(res));
}

function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  if (pathname === '/obs/heartbeat' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(getHeartbeat()));
    return;
  }

  if (pathname === '/obs/live' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ type: 'live', payload: getLivePayload() }));
    return;
  }

  if (pathname === '/obs/live-sse' && req.method === 'GET') {
    const route = String(url.searchParams.get('route') || '').trim();
    handleSse(req, res, route);
    return;
  }

  if (pathname === '/obs/ping' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const route = String(parsed.route || '').trim();
        if (route && Object.prototype.hasOwnProperty.call(heartbeat, route)) {
          heartbeat[route] = Date.now();
        }
      } catch (error) {}
      res.writeHead(204);
      res.end();
    });
    return;
  }

  const overlayRoute = ROUTE_MAP[pathname];
  if (overlayRoute) {
    const overlayHtml = path.join(OVERLAY_DIR, 'obs-overlay.html');
    fs.readFile(overlayHtml, 'utf8', (error, html) => {
      if (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Overlay unavailable');
        return;
      }
      const injected = html
        .replace('__OBS_ROUTE__', overlayRoute)
        .replace('__OBS_PORT__', String(port));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(injected);
    });
    return;
  }

  if (pathname.startsWith('/obs/assets/')) {
    const assetPath = path.join(OVERLAY_DIR, pathname.replace('/obs/assets/', ''));
    if (!assetPath.startsWith(OVERLAY_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    serveStatic(assetPath, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function start(options = {}) {
  if (server) return Promise.resolve({ port, baseUrl: getBaseUrl(), routes: getRouteUrls() });

  port = Math.max(1024, Math.min(65535, Number(options.port) || DEFAULT_PORT));

  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const remote = req.socket.remoteAddress;
      if (!isLocalAddress(remote)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Localhost only');
        return;
      }
      handleRequest(req, res);
    });

    server.on('error', (error) => {
      log.error('[obs-http] Server error:', error.message);
      reject(error);
    });

    server.listen(port, '127.0.0.1', () => {
      log.info(`[obs-http] Browser source server listening on ${getBaseUrl()}`);
      resolve({ port, baseUrl: getBaseUrl(), routes: getRouteUrls() });
    });
  });
}

function stop() {
  return new Promise((resolve) => {
    sseClients.forEach((res) => {
      try { res.end(); } catch (error) {}
    });
    sseClients.clear();
    if (!server) {
      resolve({ stopped: true });
      return;
    }
    server.close(() => {
      server = null;
      resolve({ stopped: true });
    });
  });
}

function registerIpc(ipcMain) {
  ipcMain.handle('obs-http:start', (_event, options) => start(options));
  ipcMain.handle('obs-http:stop', () => stop());
  ipcMain.handle('obs-http:get-info', () => ({
    running: Boolean(server),
    port,
    baseUrl: getBaseUrl(),
    routes: getRouteUrls(),
    heartbeat: getHeartbeat(),
  }));
  ipcMain.handle('obs-http:publish', (_event, payload) => publishLive(payload || {}));
  ipcMain.handle('obs-http:get-live', () => getLivePayload());
}

module.exports = {
  start,
  stop,
  publishLive,
  getLivePayload,
  getHeartbeat,
  getBaseUrl,
  getRouteUrls,
  registerIpc,
};
