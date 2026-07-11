# Help Centre Integration

Offline Help Centre for Christ in Song Worship App — integrated into existing navigation and design system.

## Architecture

```
app/help/
  help-icons.js       — SVG icons (no emoji)
  help-content.js     — Categories, articles, glossary, FAQ, checklists, training lessons
  help-store.js       — localStorage persistence (checklists, bookmarks, recent, analytics, training)
  help-search.js      — Fuse.js offline search with aliases and highlighting
  help-checklists.js  — Interactive setup and pre-service checklists
  help-diagnostics.js — Sanitized diagnostic report (no passwords)
  help-training.js    — Training Mode UI
  help-contextual.js  — Contextual help triggers
  help-ui.js          — Home, categories, articles, emergency, glossary, FAQ, about
```

Integration: `app.js` view `help`, sidebar nav, topbar Help button, F1 shortcut, Presenter Emergency Help button.

## Features

- 12 category cards + Glossary, FAQ, Diagnostics
- Offline search (Fuse.js)
- Standard article structure (What/When/How/Workflow/Notes/Troubleshooting)
- Setup and pre-service interactive checklists with progress
- Emergency Help with wired actions (clear overlays, reconnect OBS, diagnostics)
- Training Mode (no real stream/record from training UI)
- Diagnostics with copy report (passwords stripped)
- Role selector (operator/admin/editor/remote) for future filtering
- Recently viewed articles
- Bookmarks
- What's New panel after updates

## Tests

```bash
npm run test:help
npm run build
```

Manual checklist: [HELP_MANUAL_CHECKLIST.md](./HELP_MANUAL_CHECKLIST.md)

## Known limitations

- Bible reader modules exist (`bible-store.js`, `bible-reader-ui.js`) but Bible view is not in main nav yet; help articles document Bible workflow for when wired.
- Contextual `?` triggers are defined in `help-contextual.js`; add triggers to more controls incrementally.
- Speech recognition and remote phone control documented as planned where not yet in app.
- Packaged build verified via `npm run build` (unsigned macOS arm64).
