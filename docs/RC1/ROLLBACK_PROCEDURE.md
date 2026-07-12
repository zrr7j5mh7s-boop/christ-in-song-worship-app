# Rollback Procedure — RC1

## When to rollback

- Data loss after upgrade
- Unrecoverable presenter crash during rehearsal
- Backup restore fails on RC1

## Steps

### 1. Stop live outputs

- Emergency **Blackout** or **Clear**
- Close projector, Stage Display, OBS Browser Sources
- Exit Service Mode

### 2. Preserve evidence

- Help Centre → Copy diagnostics report
- Note last autosave backup ID in Settings
- Export session recovery is automatic — do not delete app data yet

### 3. Restore from pre-upgrade backup

1. If RC1 still launches: Settings → Restore Backup → select pre-upgrade `.csbackup`
2. Restart app and verify hymn/service data

### 4. Reinstall previous version (if needed)

1. Uninstall RC1 (macOS: move app to Trash; Windows: uninstaller)
2. Install previous known-good build
3. **Do not delete** user data folder:
   - macOS: `~/Library/Application Support/VaChinoda Worship App/` or Electron default for `com.vachinoda.christinsong`
4. Launch previous version — data should reattach to same profile

### 5. Verify

- Christ in Song editions open
- Imported hymnals present
- Service plans intact
- OBS settings (re-enter password)

### 6. Report

Email juliuschinoda@gmail.com with diagnostics report and rollback outcome.

## Prevention

Always create a full backup immediately before upgrading to any release candidate.
