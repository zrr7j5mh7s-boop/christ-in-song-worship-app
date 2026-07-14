# VaChinoda Worship App

Local worship presentation, hymn, Bible, media and OBS control system. Offline hymn library, worship builder, and full-screen presenter for Sabbath services. Includes the **Christ in Song** hymnal (Zulu, English, Shona, Venda, Sepedi) and support for imported hymnals such as SDA Hymnal.

Merged web PWA + Electron desktop build.

## Repository

`christ-in-song-worship-app/` (technical package name preserved for compatibility)

## Quick start

```bash
npm install
npm start
```

## Tests

```bash
npm run test:branding
npm run test:live-hymn-queue
npm run test:pilot-license
```

## Controlled pilot licensing

Pilot desktop builds require approved-email activation, one-device binding, signed server validation, and a seven-day offline grace period. See:

- [`docs/pilot/PILOT_DEPLOYMENT.md`](docs/pilot/PILOT_DEPLOYMENT.md)
- [`docs/pilot/DATABASE_SETUP.md`](docs/pilot/DATABASE_SETUP.md)
- [`docs/pilot/LICENCE_ADMINISTRATION.md`](docs/pilot/LICENCE_ADMINISTRATION.md)
- [`docs/pilot/RECOVERY_AND_DEVICE_RESET.md`](docs/pilot/RECOVERY_AND_DEVICE_RESET.md)
- [`.env.example`](.env.example)

Development mock server:

```bash
npm run mock:license-server
PILOT_LICENSE_MOCK_SERVER=true npm start
```
