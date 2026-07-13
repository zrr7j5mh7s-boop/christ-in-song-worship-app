# VaChinoda Worship App Icon

## Purpose

Production app icon showing an open Bible foundation, a transparent glass church, and the existing VaChinoda gold note-and-cross emblem centered inside the church.

## Selected concept

**Concept A — Minimal Glass Sanctuary**

Chosen because it keeps the strongest silhouette at 16–64px while still communicating all three required elements: Bible, glass church, and the current emblem.

### Legibility review

| Criterion | A | B | C |
|-----------|---|---|---|
| Bible recognizable | Yes | Yes | Moderate |
| Church recognizable | Yes | Yes | Moderate |
| Emblem visible | Yes | Yes | Yes |
| 32px clarity | Best | Good | Best silhouette, weaker church |
| Brand navy/gold fit | Yes | Yes | Yes |
| Professional tone | Yes | Yes | Yes |

Concept B adds architectural detail that begins to crowd 32px previews. Concept C is strongest as a pure silhouette but loses church transparency readability.

## Source files

| Asset | Path |
|-------|------|
| Master SVG | `design/app-icon/master/vachinoda-app-icon-master.svg` |
| Small optical SVG | `design/app-icon/optical-sizes/vachinoda-app-icon-small.svg` |
| Concepts | `design/app-icon/concepts/vachinoda-icon-concept-{a,b,c}.svg` |
| Previews | `design/app-icon/previews/` |
| Original backup | `design/icon-backup/` |

## Emblem incorporation

The inner emblem is the **vector gold note-and-cross** from the previous desktop icon (`build/icon.svg`). It is embedded as grouped SVG paths inside the master artwork, not redrawn or replaced.

## Regenerate assets

```bash
npm run generate:icon-previews   # optional review renders
npm run build:icons              # PNG, ICNS, ICO + legacy build/icon.* sync
npm run test:icons               # lightweight validation
```

### macOS requirements

`build:icons` uses:

- `qlmanage` to rasterize SVG
- `sips` to resize PNGs
- `iconutil` to assemble `build/icons/vachinoda-app-icon.icns`

Run on macOS for full ICNS generation.

### Windows ICO

`scripts/build-icons.js` assembles a multi-size ICO (16–256) without ImageMagick.

## Electron configuration

| Platform | Path |
|----------|------|
| macOS | `build/icons/vachinoda-app-icon.icns` |
| Windows | `build/icons/vachinoda-app-icon.ico` |
| Linux | `build/icon.png` (synced legacy path) |
| Dev window icon | `build/icon.png` |

Configured in `package.json` → `build.mac.icon` and `build.win.icon`.

## Testing

### macOS

1. `npm run build:icons`
2. `npm run build:web-assets`
3. `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir --arm64 --publish=never`
4. Inspect `dist/mac-arm64/VaChinoda Worship App.app/Contents/Resources/*.icns`
5. Launch the unpacked app and DMG-installed copy

### Windows

Build on Windows or CI:

```bash
npm run dist:win
```

Inspect installer and installed EXE icons on a Windows machine.

## Icon cache notes

macOS and Windows may cache old icons after reinstall. Safe options:

- Relaunch Finder / sign out and back in
- Remove the old app from `/Applications` before installing the new DMG
- Rename the app bundle only as a last resort for cache busting during QA

## Edit guidance

- **Edit:** `design/app-icon/master/vachinoda-app-icon-master.svg` and `design/app-icon/optical-sizes/vachinoda-app-icon-small.svg`
- **Regenerate:** `npm run build:icons`
- **Do not hand-edit:** `build/icons/*.icns`, `build/icons/*.ico`, generated PNG sizes
