#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function loadModule(file, extraSandbox) {
  const source = read(file);
  const sandbox = { window: {}, console, ...(extraSandbox || {}) };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function run() {
  const brandWin = loadModule("app/brand/brand-config.js");
  const brand = brandWin.CISBrandConfig;

  assert.equal(brand.BRAND.appName, "VaChinoda Worship App");
  assert.equal(brand.BRAND.shortName, "VaChinoda");
  assert.ok(brand.isLegacyAppName("Christ in Song Worship App"));
  assert.ok(!brand.isLegacyAppName("Christ in Song"));
  assert.equal(brand.normalizeAppName("Christ in Song Worship App"), "VaChinoda Worship App");

  const migrationWin = loadModule("app/brand/brand-migration.js", { window: brandWin });
  const storage = new Map();
  const loadJson = (key, fallback) => {
    if (!storage.has(key)) return fallback;
    return JSON.parse(storage.get(key));
  };
  const saveJson = (key, value) => storage.set(key, JSON.stringify(value));

  const first = migrationWin.CISBrandMigration.run(loadJson, saveJson);
  assert.equal(first.ok, true);
  assert.equal(loadJson("settings", {}).applicationName, "VaChinoda Worship App");

  const second = migrationWin.CISBrandMigration.run(loadJson, saveJson);
  assert.equal(second.skipped, true);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /VaChinoda Worship App/);
  assert.doesNotMatch(indexHtml, /<strong>Christ in Song<\/strong>/);

  const manifest = read("app/manifest.webmanifest");
  assert.match(manifest, /"name": "VaChinoda Worship App"/);
  assert.match(manifest, /"short_name": "VaChinoda"/);

  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.build.productName, "VaChinoda Worship App");
  assert.equal(pkg.name, "christ-in-song-worship-app");
  assert.equal(pkg.build.appId, "com.vachinoda.christinsong");

  const hymnal = read("app/hymnal-library/hymnal-migration.js");
  assert.match(hymnal, /title: "Christ in Song"/);

  const help = read("app/help/help-content.js");
  assert.match(help, /VaChinoda Worship App/);
  assert.doesNotMatch(help, /About Christ in Song Worship App/);

  const main = read("src/main.js");
  assert.match(main, /VaChinoda Worship App/);

  console.log("test-branding: all assertions passed");
}

run();
