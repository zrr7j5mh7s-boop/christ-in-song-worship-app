# Upgrade Guide — VaChinoda Worship App RC1

## Before upgrading

1. **Create a full backup:** Settings → Backup & Restore → Create Full Backup.
2. Note your current version (Settings or Help → About).
3. Close presenter, Stage Display, and OBS Browser Sources cleanly.
4. Exit the application normally (do not force-quit).

## What is preserved

Upgrading to **1.0.0-rc.1** preserves data stored under the same application ID (`com.vachinoda.christinsong`):

| Data | Preserved |
|------|-----------|
| Christ in Song editions | Yes (built-in) |
| Imported hymnals | Yes |
| Hymn favourites & recents | Yes (legacy keys migrated) |
| Categories & tags | Yes |
| Service plans & Today's Worship | Yes |
| Live hymn queue session | Yes (session recovery) |
| Bible preferences | Yes |
| Projector / output settings | Yes |
| Stage Display settings | Yes |
| Camera assignments | Yes |
| OBS connection settings | Yes (password re-enter if credential store unreadable) |
| Keyboard shortcuts | Yes |
| Help bookmarks & training progress | Yes |
| Backup history | Yes |

## Migration behaviour

- **Branding:** legacy "Christ in Song" application names migrate to "VaChinoda Worship App" once.
- **Song keys:** legacy `zu:051` format migrates to `christ-in-song-zulu:051` on load.
- **Hymnal library:** built-in books remain non-deletable; imported books retain stable IDs.
- Migrations are **idempotent** — safe to run on every startup.

## Upgrade steps (desktop)

1. Install RC1 over the existing installation (same app ID).
2. Launch once and wait for data-ready splash to complete.
3. If session recovery prompts appear, review labels before restoring.
4. Re-test OBS password if connection fails (password is not in backups).
5. Run Help Centre pre-service checklist.

## Rollback

If RC1 causes problems, see [ROLLBACK_PROCEDURE.md](./ROLLBACK_PROCEDURE.md).

## OBS note

OBS WebSocket passwords are stored encrypted in the desktop credential store and are **not** included in `.csbackup` files. Re-enter after restore on a new machine.
