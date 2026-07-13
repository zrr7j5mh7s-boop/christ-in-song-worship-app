(function () {
  "use strict";

  function sanitizeReport(payload) {
    const copy = JSON.parse(JSON.stringify(payload || {}));
    if (copy.obs) {
      delete copy.obs.password;
      delete copy.obs.token;
      delete copy.obs.secret;
      copy.obs.hasPassword = Boolean(copy.obs.hasPassword);
    }
    if (copy.paths) {
      copy.paths = "[redacted]";
    }
    return copy;
  }

  function gatherDiagnostics(context) {
    const ctx = context || {};
    const obsStatus = ctx.obsStatus || {};
    const obsRuntime = obsStatus.obsRuntime || {};
    const desktopInfo = ctx.desktopInfo || {};
    const packs = ctx.languagePacks || [];
    const readyPacks = packs.filter((p) => p.status === "ready").length;

    return sanitizeReport({
      generatedAt: new Date().toISOString(),
      app: {
        name: window.CISBrandConfig ? window.CISBrandConfig.BRAND.appName : "VaChinoda Worship App",
        version: desktopInfo.version || window.CISReleaseMetadata?.VERSION || "1.0.0-rc.1",
        platform: desktopInfo.platform || (window.electronAPI ? "electron" : "pwa"),
        build: desktopInfo.build || window.CISReleaseMetadata?.BUILD_NUMBER || "",
        releaseChannel: desktopInfo.releaseChannel || window.CISReleaseMetadata?.RELEASE_CHANNEL || "",
        releaseLabel: desktopInfo.releaseLabel || window.CISReleaseMetadata?.RELEASE_LABEL || "",
      },
      database: {
        hymnPacks: packs.length,
        readyHymnPacks: readyPacks,
        bibleTranslations: ["KJV", "ASV", "WEB"],
      },
      projector: {
        active: Boolean(ctx.presenterActive),
        embedded: Boolean(ctx.embeddedProjector),
        displayMode: ctx.displayMode || "",
      },
      obs: {
        enabled: obsStatus.enabled,
        connected: obsStatus.connected,
        state: obsStatus.state,
        obsVersion: obsStatus.obsInfo?.obsVersion || "",
        webSocketVersion: obsStatus.obsInfo?.obsWebSocketVersion || "",
        programScene: obsRuntime.programScene || "",
        previewScene: obsRuntime.previewScene || "",
        streaming: obsRuntime.streaming,
        recording: obsRuntime.recording,
        virtualCamera: obsRuntime.virtualCamera,
        browserHeartbeat: ctx.obsHeartbeat || {},
      },
      backup: {
        autosaveCount: ctx.autosaveCount || 0,
        lastAutosave: ctx.lastAutosave || "",
      },
      help: {
        offline: true,
        articles: window.CISHelpContent ? window.CISHelpContent.ARTICLES.length : 0,
      },
      lastError: ctx.lastError || "",
      lastNotice: ctx.lastNotice || "",
    });
  }

  function formatReportText(report) {
    const appLabel = window.CISBrandConfig ? window.CISBrandConfig.BRAND.appName : "VaChinoda Worship App";
    const lines = [`${appLabel} — Diagnostic Report`, "================================", ""];
    Object.entries(report).forEach(([section, value]) => {
      lines.push(`[${section}]`);
      if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, val]) => {
          lines.push(`  ${key}: ${typeof val === "object" ? JSON.stringify(val) : val}`);
        });
      } else {
        lines.push(`  ${value}`);
      }
      lines.push("");
    });
    return lines.join("\n");
  }

  function renderDiagnostics(report, escapeHtml) {
    const rows = [];
    return `
      <section class="section help-diagnostics">
        <div class="section-heading-row">
          <h2>System Diagnostics</h2>
          <div class="button-row">
            <button type="button" class="secondary-button" data-command="help-refresh-diagnostics">Refresh</button>
            <button type="button" class="secondary-button" data-command="help-copy-diagnostics">Copy report</button>
          </div>
        </div>
        <dl class="help-diag-grid">
          ${Object.entries(report).filter(([k]) => k !== "generatedAt").map(([section, data]) => {
            if (!data || typeof data !== "object") return "";
            return `<div class="help-diag-section"><h3>${escapeHtml(section)}</h3>${Object.entries(data).map(([key, val]) => `<div class="help-diag-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(typeof val === "object" ? JSON.stringify(val) : String(val))}</dd></div>`).join("")}</div>`;
          }).join("")}
        </dl>
        <p class="muted">Passwords and sensitive paths are removed from exported reports.</p>
      </section>
    `;
  }

  window.CISHelpDiagnostics = {
    gatherDiagnostics,
    formatReportText,
    renderDiagnostics,
    sanitizeReport,
  };
})();
