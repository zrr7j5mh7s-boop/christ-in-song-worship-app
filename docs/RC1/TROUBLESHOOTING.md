# Troubleshooting — RC1

## App will not open (macOS)

- **Gatekeeper block:** System Settings → Privacy & Security → Open Anyway
- **Corrupt install:** Delete app, reinstall from DMG

## Projector shows blank screen

1. Service Mode → **Restart Output**
2. Presenter → confirm session is open
3. Check display assignment in Settings → Outputs
4. Emergency **Clear** then restore previous hymn

## Hymn will not go Live

- Message "unchanged" means preparation failed — current congregation output is safe
- Verify hymnal edition is **ready** (not still loading)
- Check hymn exists in selected edition

## Bible reference not found

- Use standard format: `John 3:16`, `Psalm 23:1-3`
- Wait for Preview to finish loading before Send Live

## OBS will not connect

1. OBS → Tools → WebSocket Server Settings → Enable
2. Match host `127.0.0.1`, port `4455`
3. Re-enter password in Settings → OBS Studio
4. Test connection before service

## OBS connected but overlay blank

- Verify Browser Source URL matches app mapping page
- Check OBS scene mapping in Settings
- Restart Browser Source in OBS

## Camera not listed

- Grant camera permission in OS settings
- Refresh device list in Camera Sources
- Virtual cameras require OBS or Camo/Iriun running

## Session recovery keeps appearing

- Previous session ended uncleanly (force-quit or crash)
- Choose **Restore** or **Discard** explicitly
- Clean quit: close outputs, then quit app

## Backup restore fails

- Confirm file ends in `.csbackup`
- Try older backup from autosave list
- Check manifest inside ZIP for `format: christ-in-song-backup`

## Performance slow

- Close unused camera previews
- Reduce background hymnal indexing (wait for data-ready)
- Enable Quiet Service Mode during live service

## Diagnostics

Help Centre → **System Diagnostics** → Copy report (passwords redacted)

## Further help

- [OPERATOR_QUICK_START.md](./OPERATOR_QUICK_START.md)
- [../OBS_SETUP_GUIDE.md](../OBS_SETUP_GUIDE.md)
- juliuschinoda@gmail.com
