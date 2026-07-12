# Worship Pilot Checklist — RC1

Use this checklist on **real worship hardware** before approving RC1 for live Sabbath use.  
Automated tests pass; this checklist confirms site-specific reliability.

Based on [../MANUAL_QA_CHECKLIST.md](../MANUAL_QA_CHECKLIST.md) — complete all **Critical** items.

## Critical (must pass)

- [ ] Packaged app launches on clean profile without Node/dev folders
- [ ] Local projector shows hymns without technical errors
- [ ] Send Live / Take Next preserves output on failure
- [ ] Bible Send Live works during active presenter session
- [ ] Full backup creates `.csbackup` with `appVersion: 1.0.0-rc.1`
- [ ] Restore backup into clean profile restores plans and favourites
- [ ] Upgrade from previous build preserves hymnals and plans (same app ID)
- [ ] Session recovery after force-quit shows correct Live labels
- [ ] Recovery does not auto-start stream/record or reopen outputs
- [ ] Clear / Logo / Blackout never show technical errors to congregation

## High (should pass)

- [ ] Stage Display independent from projector
- [ ] OBS connect with correct password
- [ ] OBS auth failure shows operator message only
- [ ] Camera preview and Send Live
- [ ] Camera disconnect preserves lyric Live content
- [ ] Video playback from media library
- [ ] Missing media file fails gracefully

## Sign-off

| Field | Value |
|-------|-------|
| Church | |
| Date | |
| Hardware tested | Projector / Stage / OBS / Cameras |
| Tester | |
| Result | Approved / Approved with limitations / Not approved |
| Notes | |

**Recommendation:** Do not approve for live Sabbath until all Critical items pass on site hardware.
