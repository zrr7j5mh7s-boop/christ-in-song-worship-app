# Installation Guide — VaChinoda Worship App RC1

## Requirements

- **macOS** 11+ (Apple Silicon or Intel) — primary build target for RC1
- **Windows** 10+ and **Linux** x64 — supported by electron-builder configuration (build on respective OS)
- **Disk space:** ~500 MB installed
- **Display:** projector or external monitor recommended
- **OBS Studio** 28+ with WebSocket 5.x — optional for streaming/advanced outputs

## macOS installation (unsigned RC build)

1. Download `VaChinoda Worship App-1.0.0-rc.1-mac-arm64.dmg` (or `.zip`) from the release assets.
2. Open the DMG and drag **VaChinoda Worship App** to Applications.
3. First launch: if macOS Gatekeeper blocks the app, open **System Settings → Privacy & Security** and allow the application, or right-click → Open.
4. Grant **Camera** and **Microphone** permissions when prompted (optional — only needed for camera features).

## Windows installation

1. Download `VaChinoda Worship App-1.0.0-rc.1-win-x64.exe` (NSIS installer).
2. Run the installer; choose installation directory if prompted.
3. Desktop and Start Menu shortcuts are created automatically.

## Linux installation

1. Download `VaChinoda Worship App-1.0.0-rc.1-linux-x64.AppImage` or `.deb`.
2. AppImage: `chmod +x` then run directly.
3. Debian: `sudo dpkg -i VaChinoda_Worship_App_*.deb`

## First launch

1. App opens with splash screen, then main operator shell.
2. Complete **Settings → Church branding** (name and logo).
3. Open **Help Centre → Pre-Service Checklist** before first live service.
4. See [FIRST_RUN_GUIDE.md](./FIRST_RUN_GUIDE.md).

## Offline use

After first successful launch, hymn packs, Bible databases, and Help Centre articles work fully offline. No internet required during worship.

## Clean machine verification

The packaged app does **not** require Node.js, npm, source folders, or development servers. All hymn and Bible content ships inside the application bundle.
