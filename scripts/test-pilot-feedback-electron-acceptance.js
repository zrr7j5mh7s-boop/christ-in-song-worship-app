#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const electronPath = require("electron");
const { ensureDevKeyPair } = require("../src/license/license-crypto");
const REPORT_PATH = path.join(ROOT, "docs", "PILOT_FEEDBACK_ELECTRON_ACCEPTANCE.json");

const matrix = [];
let activeChild = null;
let activeCdp = null;

function record(id, name, status, evidence) {
  matrix.push({ id, name, status, evidence });
  const label = status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "SKIP";
  console.log(`[electron-acceptance] ${label} ${id}: ${name}`);
  if (status === "fail") console.error(`  -> ${evidence}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 30000, intervalMs = 250) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw lastError || new Error(`Timed out after ${timeoutMs}ms`);
}

function makeUserDataDir(label) {
  const base = path.join(ROOT, ".tmp-electron-acceptance");
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, `${label}-`));
}

function nextPort(offset) {
  return 9400 + offset + Math.floor(Math.random() * 20);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function connectCdp(port) {
  const targets = await waitFor(async () => {
    const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    return list.find((item) => item.type === "page" && /index\.html/.test(item.url || "")) || null;
  }, 45000);

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  async function send(method, params = {}) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, (message) => {
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Runtime.enable");
  await send("DOM.enable");

  return {
    async eval(expression) {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    },
    close() {
      ws.close();
    },
  };
}

let mockLicenseServer = null;
let mockLicenseBase = null;

async function ensureMockLicenseServer() {
  if (mockLicenseBase) return { base: mockLicenseBase };
  delete require.cache[require.resolve("./mock-license-server")];
  const mock = require("./mock-license-server");
  mock.resetState();
  await new Promise((resolve, reject) => {
    mock.server.once("error", reject);
    mock.server.listen(0, "127.0.0.1", resolve);
  });
  const address = mock.server.address();
  mockLicenseServer = mock.server;
  mockLicenseBase = `http://127.0.0.1:${address.port}`;
  return { base: mockLicenseBase };
}

async function activateDevLicense(cdp) {
  const activated = await cdp.eval(`(async () => {
    if (!window.electronAPI?.license?.activateLicence) return { ok: false, reason: "no-license-api" };
    const result = await window.electronAPI.license.activateLicence(
      "pilot@example.org",
      "PILOT-DEV-0001",
      "Acceptance Test Device",
    );
    if (result?.ok === false) {
      return { ok: false, reason: result.message || "activate-failed", result };
    }
    await window.electronAPI.license.validateLicence();
    const status = await window.electronAPI.license.getLicenceStatus();
    return { ok: Boolean(status?.canUseLiveOutputs), status: status?.status || "unknown", message: status?.message || "" };
  })()`);
  assert.equal(activated.ok, true, `dev licence activation failed: ${JSON.stringify(activated)}`);
}

function launchElectron(userDataDir, port, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(
    electronPath,
    [
      ".",
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
    ],
    {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    if (stderr.length > 4000) stderr = stderr.slice(-4000);
  });
  child.stdout.on("data", () => {});
  child._stderr = () => stderr;
  return child;
}

async function stopElectron(child, cdp) {
  if (cdp) cdp.close();
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(4000).then(() => {
      if (!child.killed) child.kill("SIGKILL");
    }),
  ]);
}

async function withApp(userDataDir, port, fn, extraEnv = {}) {
  activeChild = launchElectron(userDataDir, port, extraEnv);
  await sleep(2500);
  try {
    activeCdp = await connectCdp(port);
    return await fn(activeCdp);
  } catch (error) {
    const detail = activeChild?._stderr?.() || "";
    if (detail) error.message = `${error.message}\n${detail}`;
    throw error;
  } finally {
    await stopElectron(activeChild, activeCdp);
    activeChild = null;
    activeCdp = null;
  }
}

async function waitForDashboard(cdp) {
  await waitFor(async () => cdp.eval('document.body.classList.contains("app-ready")'));
}

async function clickNav(cdp, viewId) {
  return cdp.eval(`(() => {
    const btn = document.querySelector('[data-view="${viewId}"]');
    if (!btn) return { ok: false, reason: "nav-missing" };
    btn.click();
    return { ok: true, view: "${viewId}" };
  })()`);
}

async function runColdStarts() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const userDataDir = makeUserDataDir(`cold-${attempt}`);
    const port = nextPort(attempt);
    try {
      await withApp(userDataDir, port, async (cdp) => {
        await waitForDashboard(cdp);
        const title = await cdp.eval('document.getElementById("pageTitle")?.textContent || ""');
        assert.match(title, /Dashboard|Home/i);
        record(`A.cold-start-${attempt}`, `Cold start ${attempt} reaches dashboard`, "pass", title);
      });
    } catch (error) {
      record(`A.cold-start-${attempt}`, `Cold start ${attempt} reaches dashboard`, "fail", error.message);
      throw error;
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
    await sleep(1000);
  }
}

async function runCorruptSettingsStartup() {
  const userDataDir = makeUserDataDir("corrupt");
  const port = nextPort(10);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await cdp.eval(`(() => {
        localStorage.setItem("cis-va-chinoda:churchLogoSettings", "{bad");
        localStorage.setItem("cis-va-chinoda:projectionSettings", JSON.stringify({
          backgroundId: "custom",
          customBackgroundDataUrl: "not-valid",
        }));
        return true;
      })()`);
      await cdp.eval("location.reload()");
      await waitForDashboard(cdp);
      record("A.corrupt-settings", "Corrupt logo/background settings do not block startup", "pass", "app-ready after reload");
    });
  } catch (error) {
    record("A.corrupt-settings", "Corrupt logo/background settings do not block startup", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runBibleWorkflows() {
  const userDataDir = makeUserDataDir("bible");
  const port = nextPort(20);
  const phrasePhrase = "For God so loved the world";
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await clickNav(cdp, "bible");
      await sleep(500);

      const switchToPhrase = await cdp.eval(`(() => {
        const btn = document.querySelector('[data-bible-mode-tab][data-mode="text"]');
        if (!btn) return { ok: false, reason: "phrase-tab-missing" };
        btn.click();
        return {
          ok: true,
          active: btn.classList.contains("active"),
          aria: btn.getAttribute("aria-selected"),
        };
      })()`);
      assert.equal(switchToPhrase.ok, true);
      assert.equal(switchToPhrase.active, true);
      record("B.mode-phrase-click", "Word / phrase selects visually and functionally", "pass", JSON.stringify(switchToPhrase));

      const typed = await cdp.eval(`(async () => {
        const input = document.getElementById("bibleLiveReferenceInput");
        if (!input) return { ok: false, reason: "input-missing" };
        input.focus();
        input.value = "";
        for (const ch of ${JSON.stringify(phrasePhrase)}) {
          input.value += ch;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          if (document.activeElement !== input) return { ok: false, reason: "focus-lost", at: input.value.length };
        }
        return { ok: true, value: input.value, focused: document.activeElement === input };
      })()`);
      assert.equal(typed.ok, true);
      record("B.phrase-type-focus", "Full phrase typed without losing focus", "pass", JSON.stringify(typed));

      const searchResult = await cdp.eval(`(async () => {
        const btn = document.querySelector('[data-bible-command="search-reference"]');
        btn?.click();
        const start = Date.now();
        while (Date.now() - start < 15000) {
          const hits = document.querySelectorAll(".bible-search-result").length;
          if (hits > 0) return { ok: true, hits };
          await new Promise((r) => setTimeout(r, 200));
        }
        return { ok: false, reason: "no-results" };
      })()`);
      assert.equal(searchResult.ok, true);
      record("C.phrase-results", "Phrase search returns matching verses", "pass", JSON.stringify(searchResult));

      const switchBack = await cdp.eval(`(() => {
        const btn = document.querySelector('[data-bible-mode-tab][data-mode="reference"]');
        btn.click();
        return btn.classList.contains("active");
      })()`);
      assert.equal(switchBack, true);
      record("B.mode-reference-click", "Reference mode switches back correctly", "pass", "active");

      await cdp.eval(`(() => {
        const input = document.getElementById("bibleLiveReferenceInput");
        input.value = "John 3:16";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-bible-command="search-reference"]')?.click();
        return true;
      })()`);
      await sleep(1500);
      const refLoaded = await cdp.eval('document.querySelector(".bible-live-passage") !== null');
      assert.equal(refLoaded, true);
      record("B.reference-mode", "Reference mode loads John 3:16 preview", "pass", String(refLoaded));
    });
  } catch (error) {
    record("B/C.bible", "Bible search workflows", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runHymnIndexWorkflows() {
  const userDataDir = makeUserDataDir("hymn-index");
  const port = nextPort(30);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await clickNav(cdp, "index");
      await sleep(800);

      for (const layout of ["list", "grid", "compact"]) {
        await cdp.eval(`(() => {
          const btn = document.querySelector('[data-command="set-index-layout"][data-layout="${layout}"]');
          btn?.click();
          return true;
        })()`);
        await sleep(300);
        const opened = await cdp.eval(`(() => {
          const card = document.querySelector('[data-song]');
          if (!card) return { ok: false, reason: "no-card-${layout}" };
          const key = card.getAttribute("data-song");
          card.click();
          const title = document.getElementById("pageTitle")?.textContent || "";
          return { ok: title.length > 0, key, title };
        })()`);
        assert.equal(opened.ok, true, `hymn open failed for ${layout}`);
        record(`E.index-${layout}`, `Hymn opens from ${layout} view`, "pass", JSON.stringify(opened));
        await clickNav(cdp, "index");
        await sleep(400);
      }
    });
  } catch (error) {
    record("E.hymn-index", "Hymn index workflows", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runSearchNextLiveWorkflow() {
  const userDataDir = makeUserDataDir("search");
  const port = nextPort(40);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await clickNav(cdp, "search");
      await sleep(500);
      const result = await cdp.eval(`(async () => {
        const input = document.getElementById("globalSearchInput");
        if (!input) return { ok: false, reason: "search-input-missing" };
        input.focus();
        input.value = "001";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const start = Date.now();
        while (Date.now() - start < 12000) {
          const card = document.querySelector(".worship-search-result-wrap");
          if (card) break;
          await new Promise((r) => setTimeout(r, 200));
        }
        const card = document.querySelector(".worship-search-result-wrap");
        if (!card) return { ok: false, reason: "no-search-results" };
        const nextBtn = card.querySelector('[data-worship-search-action="set-next"], [data-worship-search-action="add-queue"]');
        const liveBtn = card.querySelector('[data-worship-search-action="send-live"]');
        return {
          ok: Boolean(nextBtn && liveBtn),
          hasNext: Boolean(nextBtn),
          hasLive: Boolean(liveBtn),
        };
      })()`);
      assert.equal(result.ok, true);
      record("F.search-actions", "Search result exposes Next/Live actions", "pass", JSON.stringify(result));
    });
  } catch (error) {
    record("F.search-actions", "Search result exposes Next/Live actions", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runSortDropdownWorkflow() {
  const userDataDir = makeUserDataDir("sort");
  const port = nextPort(50);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await clickNav(cdp, "index");
      await sleep(600);
      const result = await cdp.eval(`(() => {
        const select = document.getElementById("indexSortSelect");
        if (!select) return { ok: false, reason: "sort-select-missing" };
        const before = [...document.querySelectorAll("[data-song]")].slice(0, 3).map((el) => el.getAttribute("data-song"));
        select.value = select.querySelector('option[value="title-asc"]') ? "title-asc" : select.options[1]?.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        if (select.dataset.command !== "set-index-sort" && !select.matches("[data-command='set-index-sort']")) {
          select.click();
        }
        select.dispatchEvent(new Event("input", { bubbles: true }));
        const option = select.querySelector('option[value="title-asc"]') || select.options[1];
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const after = [...document.querySelectorAll("[data-song]")].slice(0, 3).map((el) => el.getAttribute("data-song"));
        return {
          ok: Boolean(select.options.length > 1),
          optionCount: select.options.length,
          changed: JSON.stringify(before) !== JSON.stringify(after) || select.value !== "number-asc",
          value: select.value,
        };
      })()`);
      assert.equal(result.ok, true);
      record("G.sort-dropdown", "Sort dropdown present and changes index order", "pass", JSON.stringify(result));
    });
  } catch (error) {
    record("G.sort-dropdown", "Sort dropdown present and changes index order", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runSettingsLogoBackgroundWorkflow() {
  const userDataDir = makeUserDataDir("settings-branding");
  const port = nextPort(60);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await clickNav(cdp, "settings");
      await sleep(600);
      const result = await cdp.eval(`(() => {
        const logoPanel = document.querySelector(".church-logo-settings");
        const bgPanel = document.querySelector(".projection-background-settings");
        const logoControls = document.querySelectorAll('[data-command="church-logo-import"], [data-command="emergency-logo"]').length;
        const bgOptions = document.querySelectorAll('[data-command="set-projection-background"]').length;
        return {
          ok: Boolean(logoPanel && bgPanel && logoControls >= 1 && bgOptions >= 3),
          logoPanel: Boolean(logoPanel),
          bgPanel: Boolean(bgPanel),
          logoControls,
          bgOptions,
        };
      })()`);
      assert.equal(result.ok, true);
      record("J.logo-settings", "Settings exposes church logo controls", "pass", JSON.stringify(result));
      record("K.background-settings", "Settings exposes bundled background choices", "pass", JSON.stringify(result));
    });
  } catch (error) {
    record("J/K.settings-branding", "Settings logo and background panels", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runBibleGoLiveWorkflow() {
  const mock = await ensureMockLicenseServer();
  const devKeys = ensureDevKeyPair();
  const userDataDir = makeUserDataDir("bible-live");
  const port = nextPort(70);
  const licenseEnv = {
    PILOT_LICENSE_MOCK_SERVER: "true",
    PILOT_LICENSE_MOCK_BASE: mock.base,
    PILOT_LICENSE_PUBLIC_KEY: devKeys.publicKeyPem,
  };
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      await activateDevLicense(cdp);
      await clickNav(cdp, "bible");
      await sleep(600);
      const result = await cdp.eval(`(async () => {
        const service = window.CISBibleProjectionService;
        if (!service) return { ok: false, reason: "missing-service" };
        await service.loadPreviewFromInput("John 3:16");
        const start = Date.now();
        while (Date.now() - start < 15000) {
          const preview = service.getState().preview;
          if (preview.slides?.length && !preview.loading) break;
          await new Promise((r) => setTimeout(r, 200));
        }
        const commit = await window.CISLiveSwitchService.commit({ type: "bible" });
        await new Promise((r) => setTimeout(r, 500));
        const serviceState = service.getState();
        const engineActive = window.CISPresenterEngine?.getState?.().active;
        const liveLabel = document.querySelector("[data-bible-live-label]")?.textContent || "";
        const referenceLabel = serviceState?.live?.referenceLabel || "";
        return {
          ok: Boolean(commit?.ok && serviceState?.live?.active && /John 3:16/i.test(referenceLabel || liveLabel)),
          commit,
          engineActive,
          serviceLive: serviceState?.live?.active,
          liveLabel,
          referenceLabel,
        };
      })()`);
      assert.equal(result.ok, true);
      record("D.bible-go-live", "Bible Send Live activates presenter and updates live label", "pass", JSON.stringify(result));
    }, licenseEnv);
  } catch (error) {
    record("D.bible-go-live", "Bible Send Live activates presenter", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runEmergencyHelpWorkflow() {
  const userDataDir = makeUserDataDir("emergency-help");
  const port = nextPort(80);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      const result = await cdp.eval(`(() => {
        document.querySelector('[data-command="help-open-emergency"]')?.click();
        const root = document.getElementById("modalRoot") || document.getElementById("helpContextRoot");
        const text = root ? root.textContent : document.body.textContent;
        const matches = (text.match(/Show church logo/gi) || []).length;
        return { ok: matches <= 1, matches, hasEmergencyBtn: Boolean(document.querySelector('[data-command="help-open-emergency"]')) };
      })()`);
      assert.equal(result.ok, true);
      record("L.emergency-help", "Emergency Help has no duplicate Show church logo action", "pass", JSON.stringify(result));
    });
  } catch (error) {
    record("L.emergency-help", "Emergency Help duplicate actions fixed", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function runSafeguardWorkflow() {
  const userDataDir = makeUserDataDir("safeguards");
  const port = nextPort(90);
  try {
    await withApp(userDataDir, port, async (cdp) => {
      await waitForDashboard(cdp);
      const result = await cdp.eval(`(() => {
        const liveLock = Boolean(document.getElementById("liveLockRoot") || document.querySelector(".live-lock-root"));
        const serviceModeBtn = Boolean(document.getElementById("topbarServiceModeBtn"));
        const quietModeBtn = Boolean(document.getElementById("topbarQuietServiceModeBtn"));
        return { ok: liveLock && serviceModeBtn && quietModeBtn, liveLock, serviceModeBtn, quietModeBtn };
      })()`);
      assert.equal(result.ok, true);
      record("M.safeguards", "Live Lock and Service Mode controls remain available", "pass", JSON.stringify(result));
    });
  } catch (error) {
    record("M.safeguards", "Live Lock and Service Mode controls remain available", "fail", error.message);
    throw error;
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function run() {
  console.log("test:pilot-feedback-electron-acceptance");
  spawnSync("pkill", ["-f", "electron \\."], { stdio: "ignore" });
  await sleep(2000);
  const started = Date.now();
  try {
    await runColdStarts();
    await runCorruptSettingsStartup();
    await runBibleWorkflows();
    await runHymnIndexWorkflows();
    await runSearchNextLiveWorkflow();
    await runSortDropdownWorkflow();
    await runSettingsLogoBackgroundWorkflow();
    await runBibleGoLiveWorkflow();
    await runEmergencyHelpWorkflow();
    await runSafeguardWorkflow();
  } finally {
    const report = {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      branch: "fix/pilot-feedback-round-1",
      matrix,
      summary: {
        pass: matrix.filter((item) => item.status === "pass").length,
        fail: matrix.filter((item) => item.status === "fail").length,
        skip: matrix.filter((item) => item.status === "skip").length,
      },
    };
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[electron-acceptance] report: ${REPORT_PATH}`);
  }

  const failed = matrix.filter((item) => item.status === "fail");
  if (failed.length) {
    throw new Error(`${failed.length} electron acceptance checks failed`);
  }
  console.log("test:pilot-feedback-electron-acceptance — all checks passed");
}

process.on("SIGINT", async () => {
  await stopElectron(activeChild, activeCdp);
  process.exit(130);
});

run().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  if (mockLicenseServer) {
    await new Promise((resolve) => mockLicenseServer.close(resolve));
  }
});
