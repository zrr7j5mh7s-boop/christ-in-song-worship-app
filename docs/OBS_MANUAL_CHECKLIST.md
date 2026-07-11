# OBS Manual Acceptance Checklist

Use a real OBS Studio installation. Mark each item Pass / Fail / N/A.

## Connection

- [ ] 1. App connects with host, port, and password
- [ ] 2. Incorrect credentials show clear error without crash
- [ ] 3. OBS can close/reopen while worship app stays active
- [ ] 4. Auto-reconnect works when enabled
- [ ] 5. OBS scene lists populate in Settings
- [ ] 6. Operator can map worship functions to scenes
- [ ] 7. Operator can map overlay outputs to OBS sources

## Overlays

- [ ] 8. Bible/scripture shows as transparent camera overlay
- [ ] 9. Hymn stanza shows as OBS lyrics overlay
- [ ] 10. Projector and OBS can show different layouts simultaneously
- [ ] 11. Preview edits do not change OBS until Live
- [ ] 12. Sending Live updates OBS immediately
- [ ] 13. Clear scripture hides only scripture overlay
- [ ] 14. Clear overlay does not stop camera
- [ ] 15. Browser Sources update without manual refresh
- [ ] 16. Lower third show/hide works
- [ ] 17. Sermon title show/hide works

## OBS controls

- [ ] 18. Mapped OBS scene can be selected manually
- [ ] 19. Studio Mode Program and Preview scenes display correctly
- [ ] 20. Streaming start/stop with confirmation
- [ ] 21. Recording start, pause, stop
- [ ] 22. Virtual Camera start/stop (if OBS supports)
- [ ] 23. Mapped media source play/pause (if configured)
- [ ] 24. OBS disconnect does not interrupt projector
- [ ] 25. No OBS password in logs or Browser Source pages
- [ ] 26. Module works in packaged production build

## Notes

Record OBS version, WebSocket version, and any failed step numbers for follow-up.
