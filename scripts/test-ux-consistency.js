// scripts/test-ux-consistency.js
//
// UX consistency regression tests: hierarchy, terminology, tokens, accessibility hooks.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appDir = path.join(root, "app");

function fail(message) {
  console.error(`[test:ux-consistency] FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[test:ux-consistency] ${message}`);
}

function read(rel) {
  return fs.readFileSync(path.join(appDir, rel), "utf8");
}

function testDesignTokens() {
  const css = read("styles.css");
  for (const token of ["--btn-height", "--panel-padding", "--focus-ring", "--status-ready"]) {
    if (!css.includes(token)) fail(`Missing design token ${token}`);
  }
  if (!css.includes(".safety-button")) fail("Missing safety-button class");
  ok("design tokens and safety button role present");
}

function testButtonHierarchyInPresenter() {
  const app = read("app.js");
  if (!app.includes("operator-primary-actions")) fail("Presenter should separate primary actions");
  if (!app.includes("operator-safety-actions")) fail("Presenter should separate safety actions");
  if (!app.match(/operator-primary-actions[\s\S]*action-button[\s\S]*presenter\.presentCurrent/)) {
    fail("Presenter primary action should use presenter.presentCurrent (Send Live)");
  }
  if (!app.match(/operator-safety-actions[\s\S]*?safety-button/)) {
    fail("Safety row should use safety-button class");
  }
  ok("presenter dashboard button hierarchy is structured");
}

function testTerminology() {
  const i18n = read("i18n/i18n-catalog.js");
  if (!i18n.includes('"presenter.presentCurrent": "Send Live"')) fail('i18n should use "Send Live"');
  if (!i18n.includes('"presenter.blackScreen": "Blackout"')) fail('i18n should use "Blackout"');
  if (!i18n.includes('"presenter.logoScreen": "Show Logo"')) fail('i18n should use "Show Logo"');
  const app = read("app.js");
  if (/\bGo Live\b/.test(app) || /\bStart Live\b/.test(app) || /\bProject Now\b/.test(app)) {
    fail("app.js should not use deprecated live terminology");
  }
  ok("live terminology is consistent");
}

function testSvgIcons() {
  const icons = read("ux/ui-icons.js");
  if (!icons.includes("window.CISUiIcons")) fail("ui-icons module missing");
  if (!icons.includes("<svg")) fail("ui-icons should provide SVG markup");
  const indexHtml = read("index.html");
  if (!indexHtml.includes("ux/ui-icons.js")) fail("index.html should load ui-icons.js");
  const lockUi = read("presentation/live-lock-ui.js");
  if (lockUi.includes("🔒")) fail("Live lock should not use emoji lock");
  ok("SVG icon system wired and emoji reduced");
}

function testOperatorStatusStrip() {
  const strip = read("ux/operator-status-strip.js");
  const indexHtml = read("index.html");
  const app = read("app.js");
  if (!strip.includes("operator-status-pill")) fail("Operator status strip should render pills");
  if (!indexHtml.includes("operatorStatusRoot")) fail("index.html should include operator status root");
  if (!app.includes("gatherOperatorStatus")) fail("app.js should gather operator status");
  if (!app.includes("Local Outputs")) fail("Status strip should label Local Outputs");
  ok("unified operator status strip integrated");
}

function testAccessibilityHooks() {
  const css = read("styles.css");
  const indexHtml = read("index.html");
  if (!css.includes(":focus-visible")) fail("Styles should define focus-visible indicators");
  if (!css.includes("prefers-reduced-motion")) fail("Styles should support reduced motion");
  if (!indexHtml.includes('aria-label="Emergency safety controls"')) fail("Sidebar emergency controls need aria-label");
  const nav = read("app.js");
  if (!nav.includes('aria-current')) fail("Navigation should expose aria-current");
  ok("accessibility hooks present");
}

function testHymnCardLongTitles() {
  const css = read("styles.css");
  if (!css.includes(".hymn-card-title") || !css.includes("text-overflow: ellipsis")) {
    fail("Hymn card titles should ellipsize long text");
  }
  const indexUi = read("hymn-index-ui.js");
  if (!indexUi.includes("data-hymn-key")) fail("Hymn cards should use stable keys");
  ok("hymn grid long-title and key handling present");
}

function testCacheVersion() {
  const sw = read("sw.js");
  if (!sw.includes("christ-in-song-worship-v47")) fail("Service worker cache should be v47");
  ok("cache version v47 for RC1 release");
}

testDesignTokens();
testButtonHierarchyInPresenter();
testTerminology();
testSvgIcons();
testOperatorStatusStrip();
testAccessibilityHooks();
testHymnCardLongTitles();
testCacheVersion();
ok("all UX consistency tests passed");
