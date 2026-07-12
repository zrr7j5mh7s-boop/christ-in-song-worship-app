# VaChinoda Worship App — RC1 Final Release Report

**Version:** 1.0.0-rc.1  
**Build:** 1  
**Date:** 2026-07-12  
**Classification:** Approved with documented limitations

---

## Framework & packaging

| Item | Value |
|------|-------|
| Framework | Electron 31.7.7 |
| Packager | electron-builder 24.13.3 |
| App ID | `com.vachinoda.christinsong` (unchanged — same user-data profile) |
| Product name | VaChinoda Worship App |
| ASAR | Enabled |
| Auto-update | GitHub releases (existing; requires signed publish for production) |

## Installers produced (macOS build host)

| Artifact | Status |
|----------|--------|
| `VaChinoda Worship App-1.0.0-rc.1-mac-arm64.dmg` | **Built** |
| `VaChinoda Worship App-1.0.0-rc.1-mac-arm64.zip` | **Built** |
| `VaChinoda Worship App-1.0.0-rc.1-mac-x64.zip` | **Built** |
| `VaChinoda Worship App-1.0.0-rc.1-mac-x64.dmg` | Failed (`hdiutil resize` resource error) |
| Windows NSIS / Linux AppImage | Configured; not built on this host |

## Version updates applied

- `package.json` → `1.0.0-rc.1`, `buildVersion: 1`
- `src/release-metadata.js` + `app/release/release-metadata.js`
- Settings / Help About / diagnostics build fields
- Backup manifest: `appVersion`, `buildNumber`, `releaseChannel`
- Service worker cache → `christ-in-song-worship-v46`

## Clean build audit

| Check | Result |
|-------|--------|
| Dead dev routes | None added; `--dev` gated in `main.js` |
| Hard-coded user paths | None in app/src production code |
| Test credentials in source | None (OBS password storage encrypted at runtime) |
| Diagnostics sanitization | Password, token, secret redacted; paths `[redacted]` |
| Recovery snapshot OBS sanitization | Password/token stripped |
| Duplicate dependencies | None identified |
| Production assets | 135 files minified to `app/dist/` |

## Data migration

| Migration | Idempotent | Tested |
|-----------|------------|--------|
| Brand (`brandMigrationV1`) | Yes | Yes |
| Legacy song keys (`zu:051` → edition IDs) | Yes | Yes |
| Pack/template/tag IndexedDB legacy | Yes | Via integration tests |
| Hymnal library hierarchy | Yes | Via hymnal-integration |
| Session recovery v1 | Yes | Via session-recovery tests |

**App ID unchanged** — upgrade does not create empty user profile.

## Test results

### Automated gates (all pass)

- `npm run test:rc1` — version, secrets, migration, sanitization, upgrade simulation
- `npm run test:production-rehearsal` — 21 unit suites + workflow + failure injection + long-run
- `npm run verify:release` — icons, appId, help centre

### Simulated / mocked

| Area | Result |
|------|--------|
| Clean machine | Packaged `.app` contains all modules; no Node/dev dependency |
| Upgrade | Legacy favourites/plan keys migrate correctly |
| Backup/restore | Manifest RC fields present; format v1 compatible |
| Projection | Live-switch preserves output on failure (automated) |
| Media / camera / OBS | Failure paths verified by code + unit tests (mocked hardware) |
| Long-run | 400 iterations; heap delta ~3–4 MB |
| Crash recovery | Corrupt latest → no bad offer; previous snapshot fallback |
| Accessibility | Keyboard service, focus manager, touch targets, aria-live mounts |

### Manual worship-pilot (required on site hardware)

See [WORSHIP_PILOT_CHECKLIST.md](./WORSHIP_PILOT_CHECKLIST.md) — **not yet signed off on physical projector/OBS/cameras**.

## Defect classification

### Critical

**None unresolved** in automated RC1 gate.

### High

**None unresolved** in automated RC1 gate.

### Medium

- Unsigned macOS build (Gatekeeper)
- x64 DMG build failure on build host (zip available)
- Hardware validation pending manual checklist

### Low

- OBS password excluded from backups (by design)
- SDA hymnal lazy-load first-open delay

## Release recommendation

**Approved with documented limitations**

RC1 is suitable for a **controlled worship pilot** after completing the on-site [WORSHIP_PILOT_CHECKLIST.md](./WORSHIP_PILOT_CHECKLIST.md) on real projector, Stage Display, OBS, and camera hardware.

**Not approved** for unrestricted public distribution until:
1. Worship-pilot checklist signed off
2. Apple Developer ID signing / notarization (macOS)
3. x64 DMG rebuild on reliable CI host

## Deliverables index

| # | Deliverable | Location |
|---|-------------|----------|
| 1 | Release Candidate version | `1.0.0-rc.1` build `1` |
| 2 | Clean production build | `npm run build:web-assets` |
| 3 | Packaged desktop build | `dist/mac-arm64/`, DMG/ZIP |
| 4 | Installer packages | `dist/*.dmg`, `dist/*.zip` |
| 5 | Upgrade test report | This document § Data migration |
| 6 | Backup/restore report | [BACKUP_RESTORE_GUIDE.md](./BACKUP_RESTORE_GUIDE.md) |
| 7 | Clean-machine report | This document § Test results |
| 8 | Long-run report | `docs/PRODUCTION_REHEARSAL_REPORT.json` |
| 9 | Accessibility report | RC1 gate + MANUAL_QA_CHECKLIST |
| 10 | Known issues | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| 11 | Release notes | [RELEASE_NOTES.md](./RELEASE_NOTES.md) |
| 12 | Installation guide | [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) |
| 13 | Rollback guide | [ROLLBACK_PROCEDURE.md](./ROLLBACK_PROCEDURE.md) |
| 14 | Worship-pilot checklist | [WORSHIP_PILOT_CHECKLIST.md](./WORSHIP_PILOT_CHECKLIST.md) |
| 15 | Machine-readable report | `docs/RC1_RELEASE_REPORT.json` |

## Build commands

```bash
npm run test:rc1          # RC gate tests
npm run dist:rc1          # macOS installers (DMG + ZIP, arm64 + x64)
npm run pack              # Unpacked .app for quick local test
```
