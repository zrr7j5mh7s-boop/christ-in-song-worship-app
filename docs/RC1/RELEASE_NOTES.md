# VaChinoda Worship App — Release Notes

## Version 1.0.0-rc.1 (Release Candidate 1)

**Build:** 1  
**Channel:** Release Candidate  
**Date:** July 2026

### Summary

First release candidate of the VaChinoda Worship App — a complete offline worship operating system for Sabbath services with hymn presentation, Bible projection, media, cameras, Stage Display, OBS integration, and session recovery.

### Included in RC1

- **Christ in Song** multilingual editions (Zulu, English, Shona, Venda, Sepedi)
- **SDA Hymnal** (English, lazy-loaded)
- **Bible projection** — KJV, ASV, WEB with Preview/Live separation
- **Service Builder** and **Service Mode** operator workspace
- **Quiet Service Mode** — suppresses non-critical interruptions during live worship
- **Live Hymn Queue** — Preview, Next, and atomic Live switching
- **Unified Worship Search** — hymns, Scripture, media, and service items
- **Stage Display** — private worship-team monitor (independent from congregation outputs)
- **Session recovery** — restore last-known-good state after unclean exit
- **OBS WebSocket 5.x** — Browser Sources, scene mapping, program monitor
- **Camera sources** — local presentation with virtual camera support
- **Backup & Restore** — `.csbackup` archives with versioned manifest
- **Help Centre** — offline articles, diagnostics, pre-service checklist

### Fixes since development builds

- Presenter live Bible/hymn transitions now use exported `patchState` API
- Camera-sources regression test updated for keyboard shortcut service
- Production rehearsal gate added (`npm run test:production-rehearsal`)

### Known limitations

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

### Upgrade

See [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md).

### Support

juliuschinoda@gmail.com
