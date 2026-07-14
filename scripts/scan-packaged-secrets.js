#!/usr/bin/env node
'use strict';

/**
 * Scan source and packaged output for forbidden pilot licensing secrets.
 * Fails the build when service-role keys, signing private keys, or raw activation codes appear.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const TARGET_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'app'),
  path.join(ROOT, 'dist'),
];

const ALLOWLIST = new Set([
  path.join(ROOT, 'scripts', 'mock-license-server.js'),
  path.join(ROOT, 'scripts', 'scan-packaged-secrets.js'),
  path.join(ROOT, 'scripts', 'test-pilot-license.js'),
  path.join(ROOT, 'supabase', 'functions', '_shared', 'pilot-license.ts'),
  path.join(ROOT, 'supabase', 'functions', 'activate-license', 'index.ts'),
  path.join(ROOT, 'supabase', 'functions', 'validate-license', 'index.ts'),
  path.join(ROOT, 'supabase', 'functions', 'deactivate-device', 'index.ts'),
  path.join(ROOT, 'supabase', 'functions', 'revoke-license', 'index.ts'),
  path.join(ROOT, 'supabase', 'functions', 'reset-device', 'index.ts'),
]);

const TEXT_EXTENSIONS = new Set([
  '.js', '.ts', '.json', '.html', '.css', '.md', '.txt', '.pem', '.env', '.example', '.sql', '.yml', '.yaml',
]);

const PATTERNS = [
  { name: 'Supabase service-role key', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'SUPABASE_SERVICE_ROLE_KEY assignment', regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/ },
  { name: 'Pilot signing private key env', regex: /PILOT_LICENSE_SIGNING_PRIVATE_KEY\s*=\s*['"][^'"]+['"]/ },
  { name: 'Embedded PKCS8 private key', regex: /-----BEGIN PRIVATE KEY-----[\s\S]{40,}-----END PRIVATE KEY-----/ },
  { name: 'Administrator token assignment', regex: /PILOT_ADMIN_TOKEN\s*=\s*['"][^'"]{8,}['"]/ },
  { name: 'Unencrypted activation code assignment', regex: /activationCode\s*[:=]\s*['"]PILOT-[A-Z0-9-]+['"]/i },
];

function walk(dir, visitor) {
  if (!fs.existsSync(dir)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error && (error.code === 'EPERM' || error.code === 'EACCES')) return;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, visitor);
      continue;
    }
    visitor(full);
  }
}

function shouldScan(filePath) {
  if (ALLOWLIST.has(filePath)) return false;
  if (filePath.includes(`${path.sep}.dev-keys${path.sep}`)) return false;
  if (filePath.endsWith('license-signing-private.pem')) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (filePath.endsWith('.asar')) return false;
  return false;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function scanFile(filePath, findings) {
  if (!shouldScan(filePath)) return;
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_error) {
    return;
  }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return;
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    return;
  }
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(text)) {
      findings.push({ file: path.relative(ROOT, filePath), pattern: pattern.name });
    }
  }
}

function main() {
  const findings = [];
  for (const dir of TARGET_DIRS) walk(dir, (file) => scanFile(file, findings));

  if (findings.length) {
    console.error('[scan:secrets] Forbidden material detected:');
    for (const finding of findings) {
      console.error(`  - ${finding.file}: ${finding.pattern}`);
    }
    process.exit(1);
  }

  console.log('[scan:secrets] no forbidden secrets detected in scanned output');
}

main();
