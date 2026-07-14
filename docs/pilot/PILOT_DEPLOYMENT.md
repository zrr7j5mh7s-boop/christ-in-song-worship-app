# Controlled pilot deployment guide

VaChinoda Worship App pilot builds add licence activation, one-device binding, offline grace, and remote revocation on top of the existing offline worship stack.

## Pilot policy (default)

| Setting | Value |
| --- | --- |
| Maximum devices | 1 |
| Licence period | 45 days |
| Validation interval | 24 hours |
| Offline grace | 7 days |
| Remote revocation | Enabled |
| Organisation watermark | Enabled in Settings and presenter setup |

## What is protected

- Live presentation and projection
- OBS program monitor and HTTP live output
- Stage display output
- Camera preview output
- Service Mode and Quiet Service Mode entry
- Emergency blackout/white/logo when licence is blocked

## What remains available when blocked

- Settings (including licence panel)
- Local backup export and restore
- Help and diagnostics
- Hymn/Bible library browsing without sending live

User data is never deleted when a licence expires or is revoked.

## Build prerequisites

1. Generate an Ed25519 signing key pair for the licence server.
2. Embed **only** the verification public key in the desktop app (`src/license/license-public-key.pem` or `PILOT_LICENSE_PUBLIC_KEY`).
3. Configure Supabase Edge Functions with the signing **private** key.
4. Apply database migrations in `supabase/migrations/202607140001_pilot_licensing.sql`.
5. Deploy Edge Functions: `activate-license`, `validate-license`, `deactivate-device`, `revoke-license`, `reset-device`.

## Environment variables

See [`.env.example`](../.env.example). Production builds must **not** set `PILOT_LICENSE_MOCK_SERVER`.

## Packaging commands

```bash
npm run test:pilot-license
npm run scan:secrets
npm run dist:mac
npm run dist:win
```

`verify:release` runs help-centre tests. Include `npm run test:pilot-license` and `npm run scan:secrets` in your pilot release gate.

## Supported platforms

- macOS Apple Silicon (`arm64`)
- macOS Intel (`x64`) where supported by electron-builder targets
- Windows x64

## Development workflow

Terminal 1:

```bash
npm run mock:license-server
```

Terminal 2:

```bash
export PILOT_LICENSE_MOCK_SERVER=true
unset ELECTRON_RUN_AS_NODE
npm start
```

Seeded dev credentials: `pilot@example.org` / `PILOT-DEV-0001`.

## Security model summary

- Random installation ID + Ed25519 device key pair created on first launch
- Device private key stored with Electron `safeStorage` in the main process only
- Licence cache encrypted locally; server responses are signed
- Copied installers cannot reuse another machine's licence cache or device identity
- Clock rollback is detected against last trusted server time (best-effort, not bypass-proof)

## Related guides

- [Database setup](./DATABASE_SETUP.md)
- [Licence administration](./LICENCE_ADMINISTRATION.md)
- [Recovery and device reset](./RECOVERY_AND_DEVICE_RESET.md)
