# OBS Manual QA

Manual acceptance checklist for OBS WebSocket integration. Use a real OBS Studio installation. Mark each item **Pass** / **Fail** / **N/A**.

Setup reference: [OBS_SETUP.md](./OBS_SETUP.md)

## Connection (Phase 1)

- [ ] 1. App connects with host `127.0.0.1`, port `4455`, and password
- [ ] 2. Incorrect credentials show clear error without crash
- [ ] 3. OBS can close/reopen while worship app stays active
- [ ] 4. Auto-reconnect works when enabled
- [ ] 5. Connection state shown in Settings and top bar
- [ ] 6. Password not visible after save; backup export has `passwordStored` flag only

## Mapping (Phase 2)

- [ ] 7. OBS scene list populates in Settings after connect
- [ ] 8. Operator can map worship functions to scenes
- [ ] 9. Operator can map overlay outputs to OBS Browser Sources
- [ ] 10. Validation warns when mapped scene/source no longer exists in OBS
- [ ] 11. Mappings persist across app restart

## Browser Sources (Phase 3)

- [ ] 12. Scripture Browser Source shows transparent 1920×1080 overlay
- [ ] 13. Hymn Browser Source shows lyric overlay on Live
- [ ] 14. Browser Sources update via SSE without manual refresh
- [ ] 15. Lower third show/hide works when mapped
- [ ] 16. Sermon title and announcement overlays work when mapped
- [ ] 17. Heartbeat indicator shows browser sources connected (Presenter sidebar)

## Preview vs Live (Phase 4)

- [ ] 18. Operator preview (builder/song view) does **not** change OBS
- [ ] 19. Sending Live (Present Current / presenter active) updates OBS immediately
- [ ] 20. Projector and OBS can show different layouts simultaneously
- [ ] 21. Clear scripture hides only scripture overlay
- [ ] 22. Clear overlay does not stop camera scene
- [ ] 23. Paused presenter does not push OBS updates

## OBS controls (Phase 5)

- [ ] 24. Mapped OBS scene can be selected manually from control panel
- [ ] 25. Studio Mode Program and Preview scenes display correctly
- [ ] 26. Streaming start/stop with confirmation
- [ ] 27. Recording start, pause, stop
- [ ] 28. Virtual Camera start/stop (if OBS supports)
- [ ] 29. OBS disconnect does not interrupt projector
- [ ] 30. No OBS password in logs or Browser Source pages

## Packaging (Phase 6)

- [ ] 31. Module works in packaged production build
- [ ] 32. `npm run test:obs` passes in CI/local

## Notes

Record OBS version, WebSocket version, worship app version, and any failed step numbers for follow-up.

| Field | Value |
|-------|-------|
| OBS version | |
| WebSocket version | |
| App version | |
| Tester | |
| Date | |
