Christ in Song Worship App

Open app/index.html in a browser, or run the desktop app with npm start.

Merged project layout:
- app/ — renderer (index.html, app.js, styles.css, PWA manifest + service worker, hymn data)
- src/ — Electron shell (main.js, preload.js, menu.js, updater.js, splash.html)
- build/ — desktop icons and macOS entitlements
- scripts/notarize.js — macOS notarization hook

Included:
- Zulu, English, Shona, Sepedi, and Venda language packs
- Navy/gold/cream worship theme with hymn board tiles and stanza reader
- Worship builder, service templates, custom scripture/prayer/announcement items
- Presenter dashboard with emergency screens and keyboard shortcuts
- Backup/restore, language-pack import, printable bulletin export
- PWA offline shell + Electron desktop packaging

Desktop packaging:
- npm install
- npm start (desktop)
- npm run build (unpackaged desktop smoke test)
- npm run dist:mac / dist:win / dist:linux
- See BUILD_GUIDE.md and CODE_SIGNING.md
