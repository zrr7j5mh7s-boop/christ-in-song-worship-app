// scripts/build-production-assets.js
//
// Minifies app JS/CSS into app/dist/ for production Electron/PWA builds.
// Dev workflow keeps using unminified sources in app/.

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appDir = path.join(root, "app");
const distDir = path.join(appDir, "dist");

const SKIP_DIRS = new Set(["dist", "icons"]);
const SKIP_FILE_RE = [
  /\.min\.js$/,
  /\.map$/,
  /index\.prod\.html$/,
];

const SCRIPT_REWRITES = [
  [/\.\/styles\.css\?v=\d+/g, "./dist/styles.css"],
];

function rewriteScriptSrc(match, file) {
  if (file.startsWith("vendor/") || file.startsWith("data/")) return match;
  return `src="./dist/${file}"`;
}

function shouldSkip(relPath) {
  const parts = relPath.split(path.sep);
  if (parts.some((part) => SKIP_DIRS.has(part))) return true;
  const base = path.basename(relPath);
  return SKIP_FILE_RE.some((re) => re.test(base));
}

function walkFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) {
      if (shouldSkip(rel)) continue;
      files.push(...walkFiles(full, base));
      continue;
    }
    if (!shouldSkip(rel)) files.push(full);
  }
  return files;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  ensureDir(dest);
  fs.copyFileSync(src, dest);
  return true;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch (_error) {
    console.error("[build:web-assets] esbuild is required. Run: npm install");
    process.exit(1);
  }

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  const jsFiles = walkFiles(appDir).filter((file) => file.endsWith(".js"));
  const cssFiles = walkFiles(appDir).filter((file) => file.endsWith(".css"));

  let savedBytes = 0;
  let builtCount = 0;

  for (const file of jsFiles) {
    const rel = path.relative(appDir, file);
    const out = path.join(distDir, rel);
    const source = fs.readFileSync(file, "utf8");
    const result = await esbuild.transform(source, {
      loader: "js",
      minify: true,
      legalComments: "none",
      target: ["chrome100", "firefox100", "safari15"],
    });
    ensureDir(out);
    fs.writeFileSync(out, result.code);
    savedBytes += Math.max(0, source.length - result.code.length);
    builtCount += 1;
  }

  for (const file of cssFiles) {
    const rel = path.relative(appDir, file);
    const out = path.join(distDir, rel);
    const source = fs.readFileSync(file, "utf8");
    const result = await esbuild.transform(source, {
      loader: "css",
      minify: true,
    });
    ensureDir(out);
    fs.writeFileSync(out, result.code);
    savedBytes += Math.max(0, source.length - result.code.length);
    builtCount += 1;
  }

  const indexSrc = path.join(appDir, "index.html");
  let indexHtml = fs.readFileSync(indexSrc, "utf8");
  indexHtml = indexHtml.replace(
    "<head>",
    "<head>\n    <meta name=\"cis-build\" content=\"production\">\n    <script>window.CIS_BUILD_PREFIX = \"./dist/\";</script>",
  );
  for (const [pattern, replacement] of SCRIPT_REWRITES) {
    indexHtml = indexHtml.replace(pattern, replacement);
  }
  indexHtml = indexHtml.replace(
    /src="\.\/([^"]+\.js)(\?v=\d+)?"/g,
    rewriteScriptSrc,
  );
  fs.writeFileSync(path.join(appDir, "index.prod.html"), indexHtml);

  copyIfExists(path.join(appDir, "sw.js"), path.join(distDir, "sw.js"));

  console.log(`[build:web-assets] Minified ${builtCount} files into app/dist/`);
  console.log(`[build:web-assets] Approx source savings: ${formatBytes(savedBytes)}`);
  console.log("[build:web-assets] Wrote app/index.prod.html for packaged builds");
}

main().catch((error) => {
  console.error(`[build:web-assets] ${error.message || error}`);
  process.exit(1);
});
