# Code Signing Notes

Signing is what lets your app run on someone else's machine without an OS
security warning, and (on macOS especially) is a hard requirement for
auto-update to work reliably. This project is already wired for both
platforms — you mainly need to obtain a certificate and set a few
environment variables.

---

## macOS

### What you need

1. An **Apple Developer Program** membership (US$99/year) —
   developer.apple.com.
2. A **"Developer ID Application"** certificate (for distributing *outside*
   the Mac App Store, which is what electron-builder's `dmg`/`zip` targets
   assume). Create it in Xcode (Settings → Accounts → Manage Certificates)
   or via the Apple Developer portal, then export it as a `.p12` file with
   a password.
3. An **app-specific password** for notarization — generate one at
   appleid.apple.com (Sign-In and Security → App-Specific Passwords). Do
   **not** use your real Apple ID password here.
4. Your **Team ID** — found at developer.apple.com/account under
   Membership Details.

### Wiring it up

This project already has:
- `appId` `com.vachinoda.christinsong` in `package.json`.
- `"hardenedRuntime": true` and `build/entitlements.mac.plist` in
  `package.json` / `build/` (hardened runtime is required for notarization).
- `scripts/notarize.js` wired as the `afterSign` hook, so notarization
  happens automatically as part of `npm run dist:mac` / `npm run release:mac`
  — *if* the right environment variables are present.

Set these before building:

```bash
export CSC_LINK=/path/to/your/certificate.p12
export CSC_KEY_PASSWORD=your_p12_password

export APPLE_ID=you@example.com
export APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop
export APPLE_TEAM_ID=ABCDE12345
```

(`CSC_LINK` can also be a base64-encoded string of the `.p12` instead of a
file path — useful for CI secrets.)

If `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` are **not**
set, `scripts/notarize.js` skips notarization instead of failing the build
— handy for a quick local unsigned test build, but **do not distribute an
un-notarized build publicly**; it will be blocked by Gatekeeper on any
other Mac.

### Verifying it worked

```bash
codesign --verify --deep --strict "dist/mac/Christ in Song Worship App.app"
spctl -a -vvv -t install "dist/mac/Christ in Song Worship App.app"
xcrun stapler validate "dist/mac/Christ in Song Worship App.app"
```

All three should report success/accepted.

---

## Windows

### What you need

A **code signing certificate** from a Certificate Authority (DigiCert,
Sectigo, SSL.com, GlobalSign, etc.). Two flavors:

- **OV (Organization Validation)** — cheaper, but Windows SmartScreen
  treats a brand-new OV-signed app as unfamiliar at first; reputation
  builds up over days/weeks as more people run it.
- **EV (Extended Validation)** — more expensive and requires the private
  key live on a hardware token or cloud HSM, but SmartScreen trusts it
  **immediately**.

As of mid-2023, CA/Browser Forum rules require Windows code-signing keys
to live on a hardware token or a cloud HSM — plain exportable `.pfx` files
from a CA are largely a thing of the past for new certs. In practice this
means either:
- a physical USB HSM token plugged into your build machine (works, but
  awkward in CI), or
- a **cloud signing service** — e.g. **Azure Trusted Signing**,
  DigiCert KeyLocker, or SSL.com's eSigner — which electron-builder can
  call out to instead of a local file. Check electron-builder's docs for
  the specific provider you choose; the general shape is the same env-var
  based wiring as below, just pointing at the cloud provider's config
  instead of a local `.pfx`.

### Wiring it up (traditional `.pfx`/token file, if you have one)

```bash
export CSC_LINK=/path/to/your/certificate.pfx
export CSC_KEY_PASSWORD=your_pfx_password
```

electron-builder signs the NSIS installer and the app executable
automatically during `npm run dist:win` / `npm run release` when these are
set, including timestamping (so the signature stays valid after the cert
itself expires).

### Without a certificate yet

`npm run dist:win` still works and produces a usable installer — it just
won't be signed, so Windows SmartScreen will show "Windows protected your
PC" until enough people have run it (or forever, if it's OV and rarely
run). This is fine for internal/testing distribution; sign before a public
release.

---

## Linux

No code signing is required to build or install `.AppImage`, `.deb`, or
`.rpm` packages — Linux package managers don't have an equivalent of
Gatekeeper/SmartScreen. Optionally, you can GPG-sign your `.deb`/`.rpm`
repository metadata if you're distributing through your own APT/YUM repo,
but that's a repository-level concern, not something electron-builder
needs to do per-build.
