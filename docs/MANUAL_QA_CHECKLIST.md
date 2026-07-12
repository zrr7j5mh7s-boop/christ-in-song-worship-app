# VaChinoda Worship App — Manual QA Checklist

Reusable pre-release checklist for live worship validation. Mark each item **Pass**, **Fail**, or **N/A** (with notes). Run on both development (`npm run dev`) and packaged desktop builds (`npm run pack`).

---

## Startup

- [ ] App launches without console errors (dev and packaged)
- [ ] Offline mode works after first load (airplane mode test)
- [ ] Session recovery prompt appears only after unclean exit
- [ ] Recovery defaults to state-only restore (no auto stream/record)
- [ ] What's New / first-run prompts dismiss cleanly
- [ ] Operator status strip shows Local Outputs, Stage, OBS state

## Settings

- [ ] Church name, logo, and branding persist across restart
- [ ] Output destinations save correctly
- [ ] OBS host, port, password, auto-reconnect settings persist
- [ ] Stage Display layout and countdown settings persist
- [ ] Session recovery autosave toggle works
- [ ] Quiet Service Mode settings accessible to admin role

## Hymnal Library

- [ ] Built-in hymnals load (Christ in Song, SDA, etc.)
- [ ] Language / edition switch updates hymn list
- [ ] Imported hymnal appears in library and search
- [ ] Missing imported hymnal shows operator message (not congregation error)
- [ ] Edition deletion requires confirmation and preserves live output

## Bible

- [ ] Reference search finds books, chapters, verses
- [ ] Preview loads passage before Send Live
- [ ] Version change in Preview does not affect Live until sent
- [ ] Send Live updates projector and preserves previous scripture for restore
- [ ] Dual-version layout renders legibly at congregation scale
- [ ] Failed reference shows operator message only

## Hymns

- [ ] Hymn search returns results across hymnals and languages
- [ ] Preview hymn while another hymn is Live
- [ ] Send Live / Take Next transitions without blanking congregation
- [ ] Stanza advance (keyboard and touch) works in presenter and Service Mode
- [ ] Chorus jump works when configured
- [ ] Restore Previous returns last hymn safely
- [ ] Missing hymn blocks switch with "unchanged" message

## Media

- [ ] Video and audio play from library
- [ ] Missing media file shows operator notice (congregation stays on last valid output)
- [ ] Unsupported format fails gracefully
- [ ] Clear / Logo / Blackout do not leak technical errors to outputs

## Cameras

- [ ] Camera enumeration lists available devices
- [ ] Live camera preview starts and stops without freezing UI
- [ ] Camera disconnect preserves lyric Live content
- [ ] Backup camera fallback behaves as configured
- [ ] Congregation outputs never show device error overlays

## Virtual Cameras

- [ ] Virtual camera sources listed when OBS connected
- [ ] Virtual camera unavailable shows operator message only
- [ ] Disconnect does not stop unrelated outputs

## Service Builder

- [ ] Create full service plan (slides, hymns, Bible, media)
- [ ] Drag/reorder queue items
- [ ] Save service plan to disk
- [ ] Import previously saved plan
- [ ] Advance plan slots during live service

## Service Mode

- [ ] Enter Service Mode from presenter
- [ ] Live / Preview / Next panels accurate
- [ ] Emergency Clear, Blackout, Restart Output respond within 1s
- [ ] Hymn and Bible quick search from Service Mode
- [ ] Exit blocked while presentation active (with confirm path)
- [ ] Admin-only actions blocked for operator role

## Local Outputs

- [ ] Open local projector window on correct display
- [ ] Projector disconnect detected in status strip
- [ ] Reconnect restores output without changing Live content
- [ ] Embedded projector works in Electron build

## Stage Display

- [ ] Open Stage Display on secondary monitor
- [ ] Layout switch (Worship Team, Preacher, Countdown, etc.)
- [ ] Stage content independent from congregation outputs
- [ ] Disconnect shows operator notice; congregation unaffected
- [ ] Countdown and next-item labels update with queue

## OBS

- [ ] Connect with valid WebSocket password
- [ ] Authentication failure shows clear Settings message
- [ ] Disconnect triggers reconnect without altering stream/record state
- [ ] Browser Source overlay updates for lyrics/Bible/logo
- [ ] Program monitor reflects Live switches
- [ ] OBS disconnect preserves local projector Live content

## Emergency Help

- [ ] Emergency Help opens from Service Mode and keyboard shortcut
- [ ] Diagnostics export includes outputs and OBS status
- [ ] Pre-service checklist tracks progress and date
- [ ] Training mode does not affect Live outputs

## Backup

- [ ] Manual backup creates downloadable archive
- [ ] Backup includes worship plans, settings, hymnal imports metadata
- [ ] Backup failure shows operator message; service plan unchanged
- [ ] Autosave entries listed in settings

## Restore

- [ ] Restore from backup repopulates plans and settings
- [ ] Session recovery restore reopens plan at correct slot
- [ ] Corrupt recovery snapshot falls back to previous snapshot or discard
- [ ] Restore does not auto-start streaming or recording

## Accessibility

- [ ] Tab order reaches all primary operator controls
- [ ] Focus visible on buttons and search fields
- [ ] Keyboard shortcuts: Send Live, Clear, Blackout, search
- [ ] Service Mode touch targets usable on tablet
- [ ] `aria-live` regions announce Live/Preview changes
- [ ] Screen reader labels on emergency controls

## Shutdown

- [ ] Clean exit marks session and saves recovery snapshot
- [ ] Unsaved builder changes prompt before quit
- [ ] OBS disconnects cleanly on quit
- [ ] Camera streams released (no lingering OS camera indicator)

## Restart

- [ ] Restart after clean exit does not show recovery prompt
- [ ] Restart after forced quit offers recovery with accurate labels
- [ ] Live outputs remain closed until operator confirms reopen

## Packaged Build

- [ ] `npm run pack` produces installable bundle
- [ ] Packaged app includes session-recovery, stage-display, worship-search modules
- [ ] Minified assets load (check Network/cache version in prod HTML)
- [ ] Auto-update channel configured (GitHub releases)
- [ ] Code signing / notarization N/A noted for unsigned test builds

---

## Sign-off

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Build version | |
| Environment | Dev / Packaged / Both |
| Hardware | Projector / Stage monitor / OBS / Cameras |
| Result | Pass / Pass with limitations / Fail |
| Notes | |
