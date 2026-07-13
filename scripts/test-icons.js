#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

function exists(rel) {
  const full = path.join(ROOT, rel);
  assert.ok(fs.existsSync(full), `missing ${rel}`);
  const stat = fs.statSync(full);
  assert.ok(stat.size > 32, `${rel} is too small`);
}

function run() {
  const required = [
    "design/app-icon/master/vachinoda-app-icon-master.svg",
    "build/icons/vachinoda-app-icon-1024.png",
    "build/icons/vachinoda-app-icon-512.png",
    "build/icons/vachinoda-app-icon-256.png",
    "build/icons/vachinoda-app-icon-32.png",
    "build/icons/vachinoda-app-icon.icns",
    "build/icons/vachinoda-app-icon.ico",
    "build/icon.icns",
    "build/icon.ico",
    "build/icon.png",
    "build/icon.svg",
  ];
  required.forEach(exists);

  assert.equal(pkg.build.mac.icon, "build/icons/vachinoda-app-icon.icns");
  assert.equal(pkg.build.win.icon, "build/icons/vachinoda-app-icon.ico");
  assert.match(fs.readFileSync(path.join(ROOT, "src/main.js"), "utf8"), /build',\s*'icon\.png/);
  assert.ok(pkg.scripts["build:icons"], "package.json should define build:icons");

  const ico = fs.readFileSync(path.join(ROOT, "build/icons/vachinoda-app-icon.ico"));
  assert.ok(ico.length > 1024, "ICO should contain embedded PNG data");

  console.log("test:icons — all assertions passed");
}

run();
