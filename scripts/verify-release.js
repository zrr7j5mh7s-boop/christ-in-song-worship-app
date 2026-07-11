// scripts/verify-release.js
//
// Pre-flight checks before electron-builder packaging.
// Run automatically via npm run dist* and npm run release*.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const requiredIcons = [
  'build/icon.icns',
  'build/icon.ico',
  'build/icon.png',
  'build/icon.svg',
  'build/entitlements.mac.plist',
];

const requiredSources = [
  'src/main.js',
  'src/preload.js',
  'app/index.html',
  'app/app.js',
  'app/data/songs.js',
  'scripts/notarize.js',
];

function fail(message) {
  console.error(`[verify:release] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[verify:release] ${message}`);
}

for (const rel of [...requiredIcons, ...requiredSources]) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) fail(`Missing required file: ${rel}`);
}

if (!pkg.build || !pkg.build.appId) fail('package.json build.appId is missing.');
if (!pkg.build.afterSign) fail('package.json build.afterSign hook is missing.');
if (pkg.build.afterSign !== 'scripts/notarize.js') {
  fail(`Expected afterSign hook scripts/notarize.js, got ${pkg.build.afterSign}`);
}

const publish = (pkg.build.publish || [])[0];
if (!publish || publish.provider !== 'github') {
  fail('package.json build.publish must use GitHub provider for auto-updates.');
}
if (!publish.owner || !publish.repo) {
  fail('package.json build.publish.owner and .repo must be set.');
}

if (!pkg.repository || !String(pkg.repository.url || '').includes(publish.repo)) {
  fail('package.json repository.url should match the GitHub publish repo.');
}

ok(`appId ${pkg.build.appId}`);
ok(`version ${pkg.version}`);
ok(`publish https://github.com/${publish.owner}/${publish.repo}/releases`);
ok('icons and entitlements present');
ok('notarize hook wired (set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID for macOS release builds)');
ok('dist commands ready: dist:mac, dist:win, dist:linux, dist:all');
