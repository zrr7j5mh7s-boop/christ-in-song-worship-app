# Christ in Song Worship App

Offline hymn library, worship builder, and full-screen presenter for Christ in Song (Zulu, English, Shona, Venda, Sepedi). Merged web PWA + Electron desktop build.

## Project structure

```
christ-in-song-worship-app/
├── package.json
├── index.html              # browser redirect → app/
├── BUILD_GUIDE.md
├── CODE_SIGNING.md
├── ARCHITECTURE.txt
│
├── src/                    # Electron main process
│   ├── main.js
│   ├── preload.js
│   ├── menu.js
│   ├── updater.js
│   └── splash.html
│
├── app/                    # Renderer (PWA + Electron UI)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── data/
│   └── icons/
│
├── build/                  # Desktop icons + macOS entitlements
└── scripts/
    └── notarize.js
```

## Quick start

### Browser / PWA

Open `app/index.html` in a browser, or serve the `app/` folder with any static server for installable/offline PWA use.

### Desktop (Electron)

```bash
npm install
npm start          # launch desktop app
npm run dev        # launch with DevTools
npm run build      # unpackaged desktop build (quick smoke test)
npm run dist:mac   # build macOS installer (see BUILD_GUIDE.md)
```

Open `app/index.html` directly in a browser for PWA/offline testing without Electron.

## Features

- Navy/gold/cream worship theme with hymn board tiles and stanza reader
- Hero dashboard, presenter stage, emergency black/white/logo screens
- Worship builder with templates and custom service items (scripture, prayer, announcement, etc.)
- Multi-language packs, backup/restore, printable bulletin export
- Presenter keyboard shortcuts and countdown timer
- Native menus, splash screen, auto-update, and signed desktop packaging

See **ARCHITECTURE.txt** for module details and **BUILD_GUIDE.md** for release steps.
