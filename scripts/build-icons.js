#!/usr/bin/env node
// scripts/build-icons.js
//
// Regenerates VaChinoda Worship App icon assets from design masters.
// macOS: uses qlmanage + sips + iconutil.
// Windows ICO: pure Node PNG-to-ICO assembler.

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const masterSvg = path.join(root, "design/app-icon/master/vachinoda-app-icon-master.svg");
const smallSvg = path.join(root, "design/app-icon/optical-sizes/vachinoda-app-icon-small.svg");
const outDir = path.join(root, "build/icons");
const legacyDir = path.join(root, "build");
const iconsetDir = path.join(outDir, "vachinoda-app-icon.iconset");

const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const SMALL_THRESHOLD = 64;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function assertExists(file, label) {
  if (!fs.existsSync(file)) {
    console.error(`[build:icons] Missing ${label}: ${file}`);
    process.exit(1);
  }
}

function renderSvgToPng(svgPath, size, outPath) {
  const tmp = path.join(outDir, `.tmp-${size}.png`);
  if (process.platform === "darwin") {
    run(`qlmanage -t -s ${size} -o "${outDir}" "${svgPath}"`);
    const generated = `${svgPath}.png`;
    const qlOut = path.join(outDir, path.basename(svgPath) + ".png");
    const source = fs.existsSync(qlOut) ? qlOut : generated;
    if (!fs.existsSync(source)) {
      throw new Error(`qlmanage did not produce PNG for ${svgPath}`);
    }
    fs.renameSync(source, tmp);
    if (size !== 1024) {
      run(`sips -z ${size} ${size} "${tmp}" --out "${outPath}"`);
      fs.unlinkSync(tmp);
    } else {
      fs.renameSync(tmp, outPath);
    }
    return;
  }
  throw new Error("SVG rendering requires macOS qlmanage in this project setup.");
}

function writeIco(pngPaths, outPath) {
  const entries = pngPaths.map((file) => {
    const data = fs.readFileSync(file);
    return { size: Number(path.basename(file).match(/-(\d+)\.png$/)[1]), data };
  }).sort((a, b) => a.size - b.size);

  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntrySize = 16;
  const headerSize = 6 + count * dirEntrySize;
  let offset = headerSize;
  const dir = Buffer.alloc(count * dirEntrySize);
  const images = [];

  entries.forEach((entry, index) => {
    const size = entry.size;
    const width = size >= 256 ? 0 : size;
    const height = size >= 256 ? 0 : size;
    const pos = index * dirEntrySize;
    dir.writeUInt8(width, pos);
    dir.writeUInt8(height, pos + 1);
    dir.writeUInt8(0, pos + 2);
    dir.writeUInt8(0, pos + 3);
    dir.writeUInt16LE(1, pos + 4);
    dir.writeUInt16LE(32, pos + 6);
    dir.writeUInt32LE(entry.data.length, pos + 8);
    dir.writeUInt32LE(offset, pos + 12);
    images.push(entry.data);
    offset += entry.data.length;
  });

  fs.writeFileSync(outPath, Buffer.concat([header, dir, ...images]));
}

function buildIconset(masterPng1024) {
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true, force: true });
  }
  ensureDir(iconsetDir);
  const map = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];
  for (const [size, name] of map) {
    const src = path.join(outDir, `vachinoda-app-icon-${size}.png`);
    fs.copyFileSync(src, path.join(iconsetDir, name));
  }
  if (process.platform === "darwin") {
    run(`iconutil -c icns "${iconsetDir}" -o "${path.join(outDir, "vachinoda-app-icon.icns")}"`);
  } else {
    console.warn("[build:icons] iconutil unavailable; copy existing ICNS manually on macOS.");
  }
}

function main() {
  assertExists(masterSvg, "master SVG");
  assertExists(smallSvg, "small optical SVG");
  ensureDir(outDir);

  for (const size of PNG_SIZES) {
    const out = path.join(outDir, `vachinoda-app-icon-${size}.png`);
    const source = size <= SMALL_THRESHOLD ? smallSvg : masterSvg;
    console.log(`[build:icons] Rendering ${size}x${size} from ${path.basename(source)}`);
    renderSvgToPng(source, size, out);
  }

  const png1024 = path.join(outDir, "vachinoda-app-icon-1024.png");

  buildIconset(png1024);

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  writeIco(
    icoSizes.map((size) => path.join(outDir, `vachinoda-app-icon-${size}.png`)),
    path.join(outDir, "vachinoda-app-icon.ico"),
  );

  // Sync legacy electron-builder paths without deleting backups.
  const legacyTargets = [
    ["vachinoda-app-icon.icns", "icon.icns"],
    ["vachinoda-app-icon.ico", "icon.ico"],
    ["vachinoda-app-icon-512.png", "icon.png"],
  ];
  for (const [srcName, destName] of legacyTargets) {
    const src = path.join(outDir, srcName);
    fs.copyFileSync(src, path.join(legacyDir, destName));
  }
  fs.copyFileSync(masterSvg, path.join(legacyDir, "icon.svg"));
  fs.copyFileSync(masterSvg, path.join(outDir, "vachinoda-app-icon-master.svg"));

  const required = [
    masterSvg,
    png1024,
    path.join(outDir, "vachinoda-app-icon.icns"),
    path.join(outDir, "vachinoda-app-icon.ico"),
    path.join(legacyDir, "icon.icns"),
    path.join(legacyDir, "icon.ico"),
    path.join(legacyDir, "icon.png"),
  ];
  for (const file of required) {
    assertExists(file, "generated asset");
    const stat = fs.statSync(file);
    if (stat.size < 32) {
      console.error(`[build:icons] Suspiciously small file: ${file}`);
      process.exit(1);
    }
  }

  console.log("[build:icons] Complete.");
  console.log(`[build:icons] ICNS: ${path.join(outDir, "vachinoda-app-icon.icns")}`);
  console.log(`[build:icons] ICO:  ${path.join(outDir, "vachinoda-app-icon.ico")}`);
  console.log(`[build:icons] PNG:  ${png1024}`);
}

main();
