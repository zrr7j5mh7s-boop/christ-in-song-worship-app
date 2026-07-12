# OBS Studio Integration

VaChinoda Worship App integrates with OBS Studio via OBS WebSocket 5.x. OBS is optional — projector output, hymns, and worship builder continue when OBS is closed or disconnected.

## Architecture

```
Renderer (app/obs/*.js)              Main process (src/obs/*.js)
─────────────────────────              ───────────────────────────
obs-settings-store.js        ──IPC──►  obs-manager.js
obs-connection-service.js              obs-credential-store.js
obs-scene-service.js                   obs-http-server.js (Browser Sources)
obs-source-service.js                  obs-websocket-js
obs-output-service.js
obs-control-service.js
obs-mapping-ui.js / obs-control-ui.js
app/obs/overlays/ (Browser Source pages)
```

### Data flow (Worship Live → OBS)

```
Operator → Presenter Live → obs-output-service
                              ├─► obs-http-server (SSE → Browser Sources)
                              ├─► obs-source-service (show/hide mapped sources)
                              └─► obs-scene-service (optional scene change)
```

Worship **Preview** does not push to OBS until presenter is **Live** (active, not paused).

### Security

- WebSocket in Electron **main process**; Browser Source HTTP bound to **127.0.0.1** only.
- Passwords: `safeStorage` (desktop) or AES-GCM `localStorage` (PWA).
- Password never logged or sent to overlay pages.
- HTML stripped from overlay payloads (`obs-sanitize.js`).

## Phases

| Phase | Status |
|-------|--------|
| 1 Connection foundation | Done |
| 2 Scene & source mapping | Done |
| 3 Browser Source overlays | Done |
| 4 Preview/Live output | Done (presenter Live gate) |
| 5 OBS controls | Done |
| 6 Tests & documentation | Done (automated + manual checklist) |

## Settings (Settings → OBS Studio)

- Connection: host, port, password, auto-connect, auto-reconnect
- Browser Source port (default **47823**)
- Default worship output target
- Scene mapping (16 worship functions)
- Source mapping (browser sources + media)
- Copyable Browser Source URLs
- OBS control panel (scenes, stream, record, virtual cam, overlays)

## Browser Source routes

| Route | Purpose |
|-------|---------|
| `/obs/scripture` | Verse overlay |
| `/obs/hymn` | Hymn lyrics |
| `/obs/lower-third` | Speaker lower third |
| `/obs/sermon-title` | Sermon title |
| `/obs/announcement` | Announcements |
| `/obs/fullscreen` | Full-screen content |
| `/obs/clean-feed` | Transparent clean feed |
| `/obs/live-sse?route=…` | Real-time SSE updates |

## IPC API

| Channel | Purpose |
|---------|---------|
| `obs:*` | WebSocket connection (existing) |
| `obs-http:start` | Start localhost overlay server |
| `obs-http:publish` | Push live overlay payload |
| `obs-http:get-info` | URLs, heartbeat, port |

## Backup export

`obsSettings` (mappings, layouts, confirmations) included in settings backup. Password is **not** exported in plain text; `passwordStored` flag only.

## Known limitations

- Browser Source server requires **desktop (Electron)** app; PWA shows URLs but cannot serve overlays without Electron.
- Separate projector vs OBS layouts share content state but use different overlay presets (`obsLayout` vs `projectorLayout` in settings).
- Bible reader UI modules exist; scripture-to-OBS is wired via `obs-output-service.publishLive('scripture', …)` and worship builder scripture slots when extended.
- OBS scene template is documentation only; never auto-created in OBS.
- Media source mapping UI lists inputs; full media transport depends on OBS input names matching mappings.

## Automated tests

```bash
npm run test:obs
```

## Manual testing

See [OBS_MANUAL_QA.md](./OBS_MANUAL_QA.md) and [OBS_SETUP.md](./OBS_SETUP.md).

## Modified / added files (summary)

**New:** `app/obs/obs-sanitize.js`, `obs-source-service.js`, `obs-output-service.js`, `obs-control-service.js`, `obs-mapping-ui.js`, `obs-control-ui.js`, `app/obs/overlays/*`, `src/obs/obs-http-server.js`, `scripts/test-obs-integration.js`, `docs/OBS_SETUP_GUIDE.md`, `docs/OBS_MANUAL_CHECKLIST.md`

**Updated:** `obs-constants.js`, `obs-settings-store.js`, `obs-scene-service.js`, `obs-settings-ui.js`, `app.js`, `index.html`, `styles.css`, `sw.js`, `src/main.js`, `src/preload.js`, `package.json`, `scripts/test-obs-settings.js`
