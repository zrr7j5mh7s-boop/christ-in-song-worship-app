# Build & Distribution Guide

## 1. Prerequisites

- **Node.js 18 or 20 LTS** (Electron 31 targets these).
- **npm 9+** (ships with Node).
- Platform-specific tooling for *building* installers:
  - **macOS builds** (`.dmg`/`.zip`): must be built on a real Mac with
    Xcode Command Line Tools installed (`xcode-select --install`). Apple's
    tooling for signing/notarizing isn't available on Linux or Windows.
  - **Windows builds** (`.exe`/NSIS): best built on Windows. electron-builder
    *can* cross-build Windows installers from macOS/Linux using Wine, but
    for a production release, building natively on Windows (or in CI with
    a `windows-latest` runner) is more reliable.
  - **Linux builds** (`.AppImage`/`.deb`/`.rpm`): build on Linux. `.rpm`
    packaging needs `rpm` available on the build machine (electron-builder
    prints a clear error with install instructions if it's missing).

A **GitHub Actions matrix build** (mac + windows + linux runners) is the
easiest way to produce all three reliably without owning all three OSes.

## 2. Install dependencies

```bash
npm install
```

`postinstall` runs `electron-builder install-app-deps` automatically — this
project has no native Node modules, so on most systems this is a no-op, but
it's there for safety if you add one later (e.g. a native SQLite module).

## 3. Run in development

```bash
npm start       # normal launch
npm run dev     # launch with DevTools open + verbose Electron logging
```

The dev flag (`--dev`) is read in `src/main.js` — it's what decides whether
`update:check` no-ops (never check for updates against a real dev build)
and whether DevTools auto-open.

## 4. Icons

Already built and sitting in `build/`:
`icon.svg` (source) → `icon.png` (512×512, Linux) / `icon.ico` (Windows,
multi-resolution) / `icon.icns` (macOS, multi-resolution) /
`icon.iconset/` (the individual PNGs the `.icns` was assembled from).

To redesign the icon, edit `build/icon.svg` and regenerate:

```bash
# 1. Rasterize the SVG at whatever sizes you need (sharp, or any tool)
# 2. Rebuild the Windows ICO (needs ImageMagick's `convert`):
convert icon_1024.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico

# 3. Rebuild the macOS iconset + icns (on a Mac, simplest path):
mkdir icon.iconset
sips -z 16 16     icon_1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon_1024.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon_1024.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon_1024.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon_1024.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon_1024.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon_1024.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon_1024.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon_1024.png --out icon.iconset/icon_512x512.png
cp icon_1024.png    icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
```

(This project's `build/icon.icns` was generated without a Mac, by writing
the ICNS container format directly — the `icon.iconset/` folder is kept
in the project specifically so you can rebuild it the normal Apple way
with `iconutil` any time.)

## 5. Local test package (no installer, just an unpacked app)

```bash
npm run pack
```

Output goes to `dist/<platform>-unpacked/`. Good for a quick sanity check
before producing real installers.

## 6. Building installers

```bash
npm run dist:mac      # .dmg + .zip  (run on macOS)
npm run dist:win      # NSIS installer + portable .exe
npm run dist:linux    # .AppImage + .deb + .rpm
npm run dist:all      # all three (only meaningful on macOS/CI with Wine for win)
```

Unsigned builds work fine for local testing. For anything you hand to
real users, see **CODE_SIGNING.md** first — an unsigned macOS app will be
blocked by Gatekeeper on another machine, and an unsigned Windows installer
will trigger a SmartScreen warning.

Installers land in `dist/`, named
`Christ in Song Worship App-<version>-<os>-<arch>.<ext>`.

## 7. Setting up auto-updates

This project uses `electron-updater`, configured in `src/updater.js` and
checked ~4 seconds after the main window is ready (see `src/main.js`), plus
on-demand from **Help → Check for Updates…**.

`electron-updater` needs somewhere to check *against*. The `publish` block
in `package.json` defaults to GitHub Releases:

```json
"publish": [
  { "provider": "github", "owner": "YOUR_GITHUB_ORG", "repo": "christ-in-song-worship-app" }
]
```

Replace `YOUR_GITHUB_ORG` with your real GitHub org/user, then:

```bash
export GH_TOKEN=ghp_your_personal_access_token   # needs "repo" scope
npm run release      # builds AND uploads to a new GitHub Release + update metadata
```

This uploads the installers plus `latest.yml` / `latest-mac.yml` /
`latest-linux.yml` — the small metadata files `electron-updater` reads to
know a new version exists. **Do not** hand-edit or omit these; they're what
makes update checks work.

Alternatives to GitHub: a **generic** provider (any static file host/S3
bucket you control — set `"provider": "generic", "url": "https://..."`), or
an **S3** provider directly. Both work the same way from the app's side.

### A note on Linux and auto-update

- **AppImage**: `electron-updater` can update these in place.
- **`.deb` / `.rpm`**: these are installed via the system package manager,
  so in-app auto-update doesn't apply the same way — users update through
  their OS's normal update mechanism (or you re-run your package repo's
  update process). This is normal and matches how most Linux desktop apps
  behave; it isn't a bug in this setup.

## 8. Testing the update flow end-to-end

1. Bump `"version"` in `package.json` (e.g. `1.0.0` → `1.0.1`).
2. `npm run release` to publish the new version.
3. Install the **older** build on a test machine, launch it, and either
   wait ~4 seconds or use **Help → Check for Updates…**.
4. You should see a toast in-app ("Update 1.0.1 is downloading…"), then a
   native dialog once it's downloaded, offering to restart now or later.

## 9. Common pitfalls

- **macOS**: an unsigned/un-notarized app downloaded from the internet
  will refuse to open ("is damaged and can't be opened"/Gatekeeper block).
  For your own local testing this can be bypassed with
  `xattr -cr "Christ in Song Worship App.app"`, but that's a dev-only
  workaround, not something to tell real users to do — sign and notarize
  before distributing (CODE_SIGNING.md).
- **Windows SmartScreen**: an unsigned installer shows "Windows protected
  your PC". Signing (ideally with an EV cert) avoids this from day one;
  an OV cert builds up reputation over time as more people run it.
- **electron-updater during development**: it deliberately no-ops when
  `app.isPackaged` is false, so you won't see update checks while running
  `npm start` — that's intentional, not a bug.
