# Known Issues — 1.0.0-rc.1

| Issue | Severity | Platforms | Workaround | Blocks live use? |
|-------|----------|-----------|------------|------------------|
| Unsigned macOS build blocked by Gatekeeper | Medium | macOS | Right-click → Open, or allow in Privacy & Security | No |
| OBS password not in backup archives | Low | All | Re-enter password after restore | No |
| Real projector/OBS/camera hardware not validated in CI | Medium | All | Complete manual worship-pilot checklist on site hardware | **Yes until checklist done** |
| Code signing / notarization not configured in dev environment | Medium | macOS | Use unsigned build for pilot; sign for production | No for internal pilot |
| SDA Hymnal lazy-load delay on first open | Low | All | Open hymnal once before service; wait for ready status | No |
| Multi-hour soak tested via automated proxy (400 iterations) | Low | All | Run supervised 3+ hour rehearsal before production Sabbath | Recommended |
| GitHub auto-update requires signed published release | Low | Desktop | Manual install for RC1 | No |

## Critical defects

**None unresolved in automated RC1 gate tests.**

## High defects

**None unresolved in automated RC1 gate tests.**

## Planned corrections (post-RC1)

- Apple Developer ID signing and notarization for public macOS distribution
- Full hardware validation sign-off template in release pipeline
- Extended long-run soak harness with memory/timer leak assertions
