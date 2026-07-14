# VaChinoda Worship App Packaging

This project includes an Electron desktop shell around the offline web app.

## Controlled pilot builds

Pilot installers include licence activation and output gating. Before packaging:

```bash
npm run test:pilot-license
npm run scan:secrets
```

Embed the verification public key at `src/license/license-public-key.pem` (or set `PILOT_LICENSE_PUBLIC_KEY` at build time). Never package signing private keys or Supabase service-role credentials.

See [`docs/pilot/PILOT_DEPLOYMENT.md`](docs/pilot/PILOT_DEPLOYMENT.md).

## Desktop App Features

- Native Electron window with splash screen
- Single-instance behavior
- Native menus for Search, Hymn Index, Worship Builder, Presenter, emergency screens, import, backup, restore, print, and update checks
- Safe preload bridge from Electron to the web app
- Auto-update wiring through `electron-updater`
- Build targets for macOS, Windows, and Linux
- Desktop icon assets in `desktop/build`

## Web/PWA Features

- Web app manifest with install metadata
- 192px and 512px PNG icons plus SVG icon
- PWA shortcuts for Search, Worship Builder, and Presenter
- Service worker offline cache
- Browser install flow from Settings

## Local Development

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run desktop
```

Open developer tools during desktop development:

```bash
CIS_OPEN_DEVTOOLS=1 npm run desktop
```

## Build Installers

Build for the current platform:

```bash
npm run dist
```

Build a macOS app:

```bash
npm run dist:mac
```

Build Windows installers:

```bash
npm run dist:win
```

Build Linux packages:

```bash
npm run dist:linux
```

## Auto-Updates

The Electron shell is wired for `electron-updater` using a generic provider. Before public release, replace the placeholder URL in `package.json`:

```json
"url": "https://updates.christinsong.app/releases/"
```

Publish signed release files to that location. macOS distribution also needs Apple Developer signing and notarization credentials. Windows distribution should use a code-signing certificate for SmartScreen trust.

## Icon Notes

The project includes:

- `icons/app-icon.svg`
- `icons/app-icon-192.png`
- `icons/app-icon-512.png`
- `desktop/build/icon.svg`
- `desktop/build/icon.png`
- `desktop/build/icon.ico`

Electron Builder is configured to use `desktop/build/icon.png` for macOS/Linux and `desktop/build/icon.ico` for Windows.
