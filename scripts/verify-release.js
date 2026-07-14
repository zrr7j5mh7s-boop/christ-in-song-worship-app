// scripts/verify-release.js
//
// Pre-flight checks before electron-builder packaging.
// Run automatically via npm run dist* and npm run release*.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const release = require(path.join(root, 'src/release-metadata.js'));

const requiredIcons = [
  'build/icons/vachinoda-app-icon.icns',
  'build/icons/vachinoda-app-icon.ico',
  'build/icons/vachinoda-app-icon-1024.png',
  'design/app-icon/master/vachinoda-app-icon-master.svg',
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
if (pkg.version !== release.version) {
  fail(`package.json version ${pkg.version} does not match src/release-metadata.js ${release.version}`);
}
if (pkg.build.buildVersion !== String(release.buildNumber)) {
  fail(`buildVersion ${pkg.build.buildVersion} does not match release buildNumber ${release.buildNumber}`);
}
if (pkg.build.appId !== release.appId) {
  fail(`appId changed — would create a new user-data profile: ${pkg.build.appId}`);
}
ok(`release ${release.releaseLabel}`);
ok(`publish https://github.com/${publish.owner}/${publish.repo}/releases`);
ok('icons and entitlements present');
ok('notarize hook wired (set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID for macOS release builds)');
ok('dist commands ready: dist:mac, dist:win, dist:linux, dist:all');

const { spawnSync } = require('node:child_process');
const helpTest = spawnSync(process.execPath, [path.join(__dirname, 'test-help-centre.js')], {
  cwd: root,
  stdio: 'pipe',
  encoding: 'utf8',
});
if (helpTest.status !== 0) {
  fail(`Help Centre tests failed:\n${helpTest.stdout || ''}${helpTest.stderr || ''}`);
}
ok('help centre tests passed');

const pilotTest = spawnSync(process.execPath, [path.join(__dirname, 'test-pilot-license.js')], {
  cwd: root,
  stdio: 'pipe',
  encoding: 'utf8',
});
if (pilotTest.status !== 0) {
  fail(`Pilot licence tests failed:\n${pilotTest.stdout || ''}${pilotTest.stderr || ''}`);
}
ok('pilot licence tests passed');

const deviceProofTest = spawnSync(process.execPath, [path.join(__dirname, 'test-pilot-device-proof.js')], {
  cwd: root,
  stdio: 'pipe',
  encoding: 'utf8',
});
if (deviceProofTest.status !== 0) {
  fail(`Pilot device proof tests failed:\n${deviceProofTest.stdout || ''}${deviceProofTest.stderr || ''}`);
}
ok('pilot device proof tests passed');

const secretScan = spawnSync(process.execPath, [path.join(__dirname, 'scan-packaged-secrets.js')], {
  cwd: root,
  stdio: 'pipe',
  encoding: 'utf8',
});
if (secretScan.status !== 0) {
  fail(`Secret scan failed:\n${secretScan.stdout || ''}${secretScan.stderr || ''}`);
}
ok('secret scan passed');
