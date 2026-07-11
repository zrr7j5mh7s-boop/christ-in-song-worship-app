// scripts/notarize.js
//
// Runs automatically after electron-builder signs the macOS app (see
// "afterSign" in package.json). Notarization is what lets a signed app
// launch on another Mac without a Gatekeeper warning.
//
// Requires these environment variables to be set (see BUILD_GUIDE.md):
//   APPLE_ID                    - your Apple Developer email
//   APPLE_APP_SPECIFIC_PASSWORD - an app-specific password (not your Apple ID password)
//   APPLE_TEAM_ID                - your Developer Team ID
//
// If they aren't set (e.g. a Linux/Windows CI job, or a local unsigned
// dev build), this script skips notarization instead of failing the build.

const { notarize } = require('@electron/notarize');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;

  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] Skipping notarization: APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Notarizing ${appPath} \u2014 this can take several minutes...`);

  await notarize({
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('[notarize] Done.');
};
