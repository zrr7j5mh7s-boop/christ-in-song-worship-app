# OBS Setup

Step-by-step guide for connecting Christ in Song Worship App to OBS Studio (WebSocket 5.x). OBS is optional — worship, projector, and hymns work normally when OBS is off.

See also: [OBS_INTEGRATION.md](./OBS_INTEGRATION.md) (architecture), [OBS_MANUAL_QA.md](./OBS_MANUAL_QA.md) (acceptance testing).

## Prerequisites

- OBS Studio 28+ with **OBS WebSocket** enabled (Settings → WebSocket Server Settings)
- Default WebSocket port: **4455**
- Set a WebSocket password (recommended)
- Desktop app (Electron) for localhost Browser Source URLs

## 1. Enable OBS WebSocket

1. Open OBS Studio.
2. Go to **Tools → WebSocket Server Settings** (or OBS Settings → WebSocket).
3. Enable the WebSocket server.
4. Confirm port **4455** (or note your custom port).
5. Set a password and click **Apply**.

## 2. Connect the worship app

1. Open Christ in Song → **Settings → OBS Studio**.
2. Enable **OBS integration**.
3. Enter host `127.0.0.1` and port `4455`.
4. Enter your WebSocket password (stored encrypted; never shown again after save).
5. Click **Test Connection**.
6. Click **Save Settings** and **Connect**.

Connection states (top bar and Settings): disabled, connecting, connected, reconnecting, authentication failed, OBS unavailable.

## 3. Add Browser Sources

In OBS, add a **Browser** source for each overlay you need:

| Overlay | URL route | Typical use |
|---------|-----------|-------------|
| Scripture | `/obs/scripture` | Camera + verse lower third |
| Hymn | `/obs/hymn` | Lyric overlay on camera |
| Lower third | `/obs/lower-third` | Speaker name / title |
| Sermon title | `/obs/sermon-title` | Full-screen title |
| Announcement | `/obs/announcement` | Welcome slide |
| Clean feed | `/obs/clean-feed` | Transparent passthrough |

For each Browser Source:

1. Width: **1920**, Height: **1080**
2. Enable **Shutdown source when not visible** (optional)
3. Enable **Refresh browser when scene becomes active** (optional)
4. Check **Custom frame rate** only if needed (30 fps is fine)
5. Enable transparency where supported

Copy URLs from **Settings → OBS Studio → OBS Browser Source URLs** (each has a **Copy** button). Default server port: **47823** (localhost only).

## 4. Map scenes and sources

1. **Scene Mapping** — assign worship functions (Camera + Scripture, Full-Screen Hymn, etc.) to your existing OBS scenes.
2. **Source Mapping** — pick the Browser Source and the scene that contains it.
3. Click **Save Mappings**.

Validation warnings appear when mapped scene or source names are missing from OBS. The app never overwrites your OBS scene collection automatically.

## 5. Worship Preview vs Live

- **Worship Preview** — operator UI review before going live (builder, song view).
- **Worship Live** — presenter session active; output goes to projector and OBS per output targets.
- **OBS Preview / Program** — OBS Studio Mode only; separate from worship Preview/Live.

Hymn and scripture overlays update OBS only when presenter is **Live** (active session, not paused). Operator preview edits do not push to OBS.

## 6. Output targets

Set default output per content type in OBS settings:

- **Projector only** — congregation screen
- **OBS only** — livestream overlay
- **Projector + OBS** — both (can use different layouts via `obsLayout` vs `projectorLayout`)
- **Stage only** — stage display path when configured
- **All outputs** — every configured destination

## 7. Virtual Camera (Zoom / Teams)

1. In OBS: **Start Virtual Camera**.
2. Or use worship app **OBS Controls → Start Virtual Cam** when connected.
3. In Zoom or Teams: select **OBS Virtual Camera** as your camera.

## 8. Recommended scene collection

See the collapsible list in Settings for a 15-scene template (Live Camera, Camera + Scripture, Full-Screen Hymn, etc.). Create these manually in OBS to match your church workflow.

### Example: Camera + Scripture layers

1. Background
2. Camera
3. Church logo
4. Scripture Browser Source (URL from app)
5. Optional lower-third decoration

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Connection refused | OBS not running or WebSocket disabled |
| Auth failed | Wrong password; re-enter in Settings |
| Browser Source blank | Confirm URL, 1920×1080, transparency; check desktop app is running |
| Overlays don't update | Presenter must be Live; check output target includes OBS |
| Port in use | Change Browser Source port in OBS settings (default 47823) |
| Scene list empty | Connect first; click Refresh in Settings |
| PWA only (no Electron) | Browser Source server unavailable; use desktop app for overlays |

Technical errors are logged in the desktop app log, not on projector or OBS output.

## Automated checks

```bash
node scripts/test-obs-settings.js
node scripts/test-obs-integration.js
# or
npm run test:obs
```
