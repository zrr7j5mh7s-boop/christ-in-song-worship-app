#!/usr/bin/env node
// scripts/generate-icon-previews.js
// Renders concept and master icons at multiple sizes for legibility review.

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const previewRoot = path.join(root, "design/app-icon/previews");
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

const sources = [
  ["concept-a", "design/app-icon/concepts/vachinoda-icon-concept-a.svg"],
  ["concept-b", "design/app-icon/concepts/vachinoda-icon-concept-b.svg"],
  ["concept-c", "design/app-icon/concepts/vachinoda-icon-concept-c.svg"],
  ["master", "design/app-icon/master/vachinoda-app-icon-master.svg"],
  ["small-optical", "design/app-icon/optical-sizes/vachinoda-app-icon-small.svg"],
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function render(svgPath, size, outPath) {
  const dir = path.dirname(outPath);
  ensureDir(dir);
  execSync(`qlmanage -t -s ${size} -o "${dir}" "${svgPath}"`, { cwd: root, stdio: "pipe" });
  const qlOut = path.join(dir, `${path.basename(svgPath)}.png`);
  if (!fs.existsSync(qlOut)) throw new Error(`Preview render failed: ${svgPath}`);
  if (size === 1024) {
    fs.renameSync(qlOut, outPath);
    return;
  }
  execSync(`sips -z ${size} ${size} "${qlOut}" --out "${outPath}"`, { cwd: root, stdio: "pipe" });
  fs.unlinkSync(qlOut);
}

function main() {
  if (process.platform !== "darwin") {
    console.error("[generate-icon-previews] Requires macOS qlmanage.");
    process.exit(1);
  }
  for (const [label, rel] of sources) {
    const svg = path.join(root, rel);
    for (const size of sizes) {
      const out = path.join(previewRoot, label, `${label}-${size}.png`);
      render(svg, size, out);
      console.log(`[generate-icon-previews] ${label} ${size}px`);
    }
  }
  console.log(`[generate-icon-previews] Wrote previews to ${previewRoot}`);
}

main();
