# OBS Studio Integration

Christ in Song Worship App integrates with OBS Studio via the OBS WebSocket 5.x protocol. OBS is optional — projector output, hymn presentation, and worship builder continue to work when OBS is closed or disconnected.

## Architecture

```
Renderer (app/obs/*.js)          Main process (src/obs/*.js)
─────────────────────────          ───────────────────────────
obs-settings-store.js    ──IPC──► obs-manager.js
obs-connection-service.js          obs-credential-store.js
obs-event-service.js               obs-websocket-js (npm)
obs-settings-ui.js
obs-scene-service.js (Phase 2+)
```

### Security

- WebSocket connection runs in the **Electron main process** when using the desktop app.
- Passwords are stored with `safeStorage` when available; otherwise a documented base64 fallback in `userData/obs-credentials.json`.
- PWA/browser mode uses encrypted `localStorage` (Web Crypto AES-GCM) for passwords.
- CSP allows `ws://127.0.0.1:*` and `ws://localhost:*` only for browser fallback.
- OBS logic lives outside UI components in dedicated service modules.

### Connection states

| State | Meaning |
|-------|---------|
| `disabled` | OBS integration turned off |
| `connecting` | Opening WebSocket |
| `connected` | Authenticated and ready |
| `disconnecting` | Closing connection |
| `disconnected` | Enabled but not connected |
| `reconnecting` | Auto-reconnect scheduled |
| `error` | Last connection attempt failed |

Default endpoint: `ws://127.0.0.1:4455`

## Phase 1 (implemented)

- Main-process OBS WebSocket manager with IPC bridge
- Encrypted credential storage
- Settings panel in **Settings → OBS Studio**
- Topbar connection status badge (click opens Settings)
- Manual connect / disconnect / test connection
- Auto-reconnect with configurable interval
- Event forwarding (`StreamStateChanged`, `SceneListChanged`, etc.)
- Browser fallback client for PWA testing on localhost

## Phases 2–6 (remaining)

### Phase 2 — Scene & source mapping
- Worship scene presets (Live Camera, Scripture, Hymn, Lower Third, etc.)
- Source mapping for Browser Sources
- Scene list UI (skeleton started in Settings)

### Phase 3 — Browser Source routes
- Local HTTP server in Electron main (`/obs/scripture`, `/obs/hymn`, `/obs/lower-third`)
- Transparent 1920×1080 overlay pages

### Phase 4 — Preview / Live output
- Output target: Projector only, OBS only, Both, Stage only
- OBS updates only on Send Live (not Preview edits)

### Phase 5 — OBS control panel
- Studio Mode, streaming, recording, virtual camera
- Clear / logo / blackout coordination

### Phase 6 — Polish
- Help setup guide
- Settings export in backup system
- Automated tests and manual checklist

## Breaking changes

None in Phase 1. OBS is opt-in (`enabled: false` by default).

## Manual test checklist (Phase 1)

1. Open Settings → OBS Studio; confirm panel renders.
2. Enter host `127.0.0.1`, port `4455`, optional password.
3. Click **Test Connection** with OBS running and WebSocket enabled.
4. Save settings with **Enable OBS integration** checked.
5. Confirm topbar badge shows **OBS Connected**.
6. Close OBS; confirm badge shows disconnected/error and app remains usable.
7. Re-open OBS; confirm auto-reconnect if enabled.
8. Click **Disconnect**; confirm manual disconnect works.

## IPC API (Electron)

| Channel | Purpose |
|---------|---------|
| `obs:get-status` | Current connection status |
| `obs:get-settings` | Non-secret settings + `hasPassword` |
| `obs:save-settings` | Persist settings and optional password |
| `obs:connect` | Connect using saved settings |
| `obs:disconnect` | Disconnect |
| `obs:test-connection` | One-shot probe |
| `obs:call` | Authenticated OBS request |
| `obs:event` (push) | OBS events to renderer |
