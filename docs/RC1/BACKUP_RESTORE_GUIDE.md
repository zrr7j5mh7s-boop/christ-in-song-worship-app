# Backup & Restore Guide — RC1

## Backup format

- Extension: `.csbackup` (ZIP archive)
- Manifest: `manifest.json` with `formatVersion`, `appVersion`, `buildNumber`, `releaseChannel`
- Components: worship plans, favourites, imported packs, templates, tags, settings

## Create a backup

1. **Settings → Backup & Restore**
2. Choose **Full Backup** or individual components.
3. Save file to USB, cloud, or network share.
4. README inside archive lists contents and counts.

## What is NOT in backups

- OBS WebSocket password (re-enter after restore)
- Session recovery IndexedDB snapshots (separate autosave mechanism)
- Packaged built-in hymn/Bible files (re-shipped with app)

## Restore procedure

1. Settings → Backup & Restore → **Restore Backup**
2. Select `.csbackup` file.
3. Choose per-component strategy: **Replace**, **Merge**, or **Skip**.
4. Confirm — app reloads affected data.
5. Verify hymn counts and service plans.

## RC1 manifest fields

```json
{
  "format": "christ-in-song-backup",
  "formatVersion": 1,
  "appVersion": "1.0.0-rc.1",
  "buildNumber": 1,
  "releaseChannel": "rc"
}
```

Older backups without `appVersion` remain compatible.

## Worship-pilot test sequence

1. Record counts (hymnals, favourites, plans).
2. Create backup.
3. Upgrade to RC1.
4. Verify counts match.
5. Restore pre-upgrade backup — verify backward compatibility.
6. Create RC1 backup.
7. Restore into clean profile — verify full restoration.
