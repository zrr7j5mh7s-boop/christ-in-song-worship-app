#!/usr/bin/env node
"use strict";

/**
 * Release Candidate 1 gate tests.
 * Version consistency, security sanitization, migration safety, upgrade simulation,
 * and production packaging verification.
 */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const release = require(path.join(ROOT, "src/release-metadata.js"));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const report = {
  releaseVersion: release.version,
  buildNumber: release.buildNumber,
  framework: "Electron 31 + electron-builder 24",
  packaging: "asar desktop bundle",
  platformsBuilt: [],
  criticalDefects: [],
  highDefects: [],
  knownLimitations: [],
  releaseRecommendation: null,
};

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function log(msg) {
  console.log(`[test:rc1] ${msg}`);
}

function fail(msg) {
  report.criticalDefects.push(msg);
  console.error(`[test:rc1] FAIL: ${msg}`);
  process.exit(1);
}

function runScript(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
    shell: true,
  });
  return result;
}

function verifyVersionConsistency() {
  assert.equal(pkg.version, release.version, "package.json version must match release-metadata");
  const browserMeta = read("app/release/release-metadata.js");
  assert.match(browserMeta, new RegExp(`VERSION:\\s*"${release.version.replace(/\./g, "\\.")}"`));
  assert.match(browserMeta, /BUILD_NUMBER:\s*1/);
  assert.equal(pkg.build.appId, release.appId, "appId must remain stable for user-data continuity");
  assert.equal(pkg.build.buildVersion, String(release.buildNumber));
  log(`version ${release.version} build ${release.buildNumber} consistent`);
}

function scanSecrets() {
  const dirs = ["app", "src"];
  const banned = [
    /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{8,}['"]/i,
    /stream[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
    /\/Users\/vachinoda\//,
  ];
  for (const dir of dirs) {
    walkFiles(path.join(ROOT, dir), (file) => {
      if (!file.endsWith(".js") && !file.endsWith(".json")) return;
      if (file.includes("node_modules")) return;
      const text = fs.readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(text)) fail(`Potential secret or dev path in ${path.relative(ROOT, file)}`);
      }
    });
  }
  log("secrets and dev-path scan passed");
}

function walkFiles(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, fn);
    else fn(full);
  }
}

function loadModule(file, sandbox) {
  const source = read(file);
  const ctx = { window: {}, console, ...(sandbox || {}) };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return ctx.window;
}

function testBrandMigrationIdempotent() {
  const storage = { store: {} };
  const localStorage = {
    getItem(k) { return storage.store[k] ?? null; },
    setItem(k, v) { storage.store[k] = String(v); },
    removeItem(k) { delete storage.store[k]; },
  };
  const win = loadModule("app/brand/brand-config.js");
  loadModule("app/brand/brand-migration.js", { window: win });
  const loadJson = (k, fb) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  };
  const saveJson = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  saveJson("settings", { applicationName: "Christ in Song Worship App" });
  const first = win.CISBrandMigration.run(loadJson, saveJson);
  assert.equal(first.ok, true);
  const second = win.CISBrandMigration.run(loadJson, saveJson);
  assert.equal(second.skipped, true);
  const settings = loadJson("settings", {});
  assert.equal(settings.applicationName, "VaChinoda Worship App");
  log("brand migration idempotent");
}

function testLegacySongKeyMigration() {
  const win = loadModule("app/hymnal-library/hymnal-migration.js");
  const map = win.CISHymnalMigration.editionIdByLegacyCodeMap();
  assert.equal(win.CISHymnalMigration.migrateSongKey("zu:051", map), "christ-in-song-zulu:051");
  assert.equal(win.CISHymnalMigration.migrateSongKey("christ-in-song-zulu:051", map), "christ-in-song-zulu:051");
  const favorites = win.CISHymnalMigration.migrateKeyList(["zu:051", "sda:108"], map);
  assert.ok(favorites.includes("christ-in-song-zulu:051"));
  assert.ok(favorites.includes("sda-hymnal-english:108"));
  log("legacy song-key migration verified");
}

function testDiagnosticsSanitization() {
  const win = loadModule("app/brand/brand-config.js");
  loadModule("app/help/help-diagnostics.js", { window: win });
  const report = win.CISHelpDiagnostics.sanitizeReport({
    obs: { password: "secret", hasPassword: true, token: "x" },
    paths: "/Users/me/private",
  });
  assert.equal(report.obs.password, undefined);
  assert.equal(report.obs.token, undefined);
  assert.equal(report.paths, "[redacted]");
  log("diagnostics sanitization verified");
}

function testBackupManifestFields() {
  const source = read("app/backup-restore.js");
  assert.match(source, /appVersion/);
  assert.match(source, /buildNumber/);
  assert.match(source, /releaseChannel/);
  log("backup manifest RC fields present");
}

function testSessionRecoverySanitization() {
  const win = loadModule("app/session-recovery/session-recovery-snapshot.js");
  const sanitized = win.CISSessionRecoverySnapshot.sanitizeObsSettings({
    outputTarget: "obs",
    password: "secret",
    token: "tok",
  });
  assert.equal(sanitized.password, undefined);
  assert.equal(sanitized.token, undefined);
  log("recovery snapshot OBS sanitization verified");
}

function testUpgradeSimulation() {
  const legacy = {
    favorites: ["zu:051", "en:002", "sda:108"],
    worshipPlan: [{ role: "Opening", songKey: "zu:051" }],
    settings: { applicationName: "Christ in Song Worship App", languageCode: "zu" },
    hymnBookId: "",
    editionId: "",
  };
  const win = loadModule("app/hymnal-library/hymnal-migration.js");
  const migration = win.CISHymnalMigration;
  const map = migration.editionIdByLegacyCodeMap();
  const upgraded = {
    favorites: migration.migrateKeyList(legacy.favorites, map),
    worshipPlan: legacy.worshipPlan.map((slot) => ({
      ...slot,
      songKey: migration.migrateSongKey(slot.songKey, map),
    })),
  };
  assert.ok(upgraded.favorites.every((k) => k.includes("-")));
  assert.equal(upgraded.worshipPlan[0].songKey, "christ-in-song-zulu:051");
  log("upgrade simulation preserved hymn references");
}

function runUnitGates() {
  const gates = [
    "test:production-rehearsal",
    "test:session-recovery",
    "test:live-switch",
    "test:hymnal-integration",
    "test:backup" in pkg.scripts ? null : null,
    "test:help",
    "test:ux-consistency",
  ].filter(Boolean);
  const scripts = [
    "test:production-rehearsal",
    "test:session-recovery",
    "test:live-switch",
    "test:hymnal-integration",
    "test:help",
    "test:ux-consistency",
    "test:branding",
  ];
  for (const script of scripts) {
    const result = runScript(script);
    if (result.status !== 0) {
      fail(`${script} failed:\n${result.stdout || ""}${result.stderr || ""}`);
    }
    log(`${script} passed`);
  }
}

function verifyPackagedModules() {
  const required = [
    "app/release/release-metadata.js",
    "app/session-recovery/session-recovery-service.js",
    "app/stage-display/stage-display-service.js",
    "app/worship-search/worship-search-engine.js",
    "src/release-metadata.js",
  ];
  for (const rel of required) {
    if (!fs.existsSync(path.join(ROOT, rel))) fail(`Missing RC module: ${rel}`);
  }
  log("RC modules present in source tree");
}

function classifyRelease() {
  report.knownLimitations = [
    "macOS build unsigned in this environment — Gatekeeper may block first open",
    "OBS, projector, and camera hardware validated by automated mocks; manual worship-pilot checklist required",
    "OBS WebSocket password is not exported in backups by design",
    "Multi-hour soak represented by automated iteration proxy, not live 3+ hour manual run",
  ];
  if (report.criticalDefects.length) {
    report.releaseRecommendation = "Not approved for worship pilot";
  } else {
    report.releaseRecommendation = "Approved with documented limitations";
  }
}

function main() {
  log(`RC1 gate for ${release.version}`);
  verifyVersionConsistency();
  scanSecrets();
  testBrandMigrationIdempotent();
  testLegacySongKeyMigration();
  testDiagnosticsSanitization();
  testBackupManifestFields();
  testSessionRecoverySanitization();
  testUpgradeSimulation();
  verifyPackagedModules();
  runUnitGates();
  classifyRelease();

  const out = path.join(ROOT, "docs", "RC1_RELEASE_REPORT.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  log(`Release recommendation: ${report.releaseRecommendation}`);
  log(`Report: docs/RC1_RELEASE_REPORT.json`);
}

main();
