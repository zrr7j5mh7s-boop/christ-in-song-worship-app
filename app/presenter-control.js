(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let plain = (value) => String(value || "").trim();
  let formatDuration = (seconds) => String(seconds || 0);
  let t = (key) => key;

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.plain) plain = options.plain;
    if (options.formatDuration) formatDuration = options.formatDuration;
    if (options.t) t = options.t;
  }

  function previewBlock(label, title, body, emptyText) {
    const text = plain(body || "").split("\n").filter(Boolean)[0] || "";
    return `
      <article class="av-preview-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(title || emptyText)}</strong>
        <p>${escapeHtml(text || t("presenterControl.noPreview"))}</p>
      </article>
    `;
  }

  function hymnTitleFromSnapshot(snapshot) {
    if (snapshot.hymnTitle) return snapshot.hymnTitle;
    const title = snapshot.title || "";
    const split = title.indexOf(" · ");
    if (split >= 0) return title.slice(split + 3);
    return title;
  }

  function renderProgressDots(slideIndex, slideCount) {
    if (!slideCount || slideCount <= 1) return "";
    const dots = Array.from({ length: slideCount }, (_, index) => {
      const active = index === slideIndex ? " active" : "";
      return `<span class="av-progress-dot${active}" aria-hidden="true"></span>`;
    }).join("");
    return `<div class="av-progress-dots" aria-label="Stanza ${slideIndex + 1} of ${slideCount}">${dots}</div>`;
  }

  function renderKeyboardHints() {
    return `
      <footer class="av-keyboard-hints" aria-label="Keyboard shortcuts">
        <span><kbd>←</kbd><kbd>→</kbd> ${escapeHtml(t("presenterControl.navigate"))}</span>
        <span><kbd>B</kbd> ${escapeHtml(t("presenterControl.black"))}</span>
        <span><kbd>C</kbd> ${escapeHtml(t("presenterControl.clear"))}</span>
        <span><kbd>L</kbd> ${escapeHtml(t("presenterControl.logo"))}</span>
        <span><kbd>P</kbd> ${escapeHtml(t("presenterControl.pauseDisplay"))}</span>
        <span><kbd>Esc</kbd> ${escapeHtml(t("presenterControl.exit"))}</span>
        <span><kbd>F</kbd> ${escapeHtml(t("presenterControl.fullscreen"))}</span>
        <span><kbd>Shift</kbd><kbd>]</kbd> Take Next Live</span>
        <span><kbd>Shift</kbd><kbd>[</kbd> Restore previous hymn</span>
        <span><kbd>V</kbd> Camera live</span>
        <span><kbd>N</kbd> Next camera</span>
      </footer>
    `;
  }

  function renderToolbar(snapshot) {
    const paused = snapshot.paused ? "active is-pressed" : "";
    return `
      <div class="av-floating-toolbar live-touch-row" role="toolbar" aria-label="Live presentation controls">
        <button type="button" class="live-touch-btn" data-command="emergency-black" aria-label="Black screen" aria-keyshortcuts="B">Black</button>
        <button type="button" class="live-touch-btn" data-command="emergency-white" aria-label="White screen" aria-keyshortcuts="W">White</button>
        <button type="button" class="live-touch-btn" data-command="emergency-logo" aria-label="Show logo screen" aria-keyshortcuts="L">Logo</button>
        <button type="button" class="live-touch-btn" data-command="emergency-clear" aria-label="Return to lyrics" aria-keyshortcuts="C">Clear</button>
        <button type="button" class="live-touch-btn ${paused}" data-command="presenter-pause" aria-label="${snapshot.paused ? "Resume display" : "Pause display"}" aria-pressed="${snapshot.paused ? "true" : "false"}" aria-keyshortcuts="P">${snapshot.paused ? escapeHtml(t("presenterControl.resume")) : escapeHtml(t("presenterControl.pauseDisplay"))}</button>
      </div>
    `;
  }

  function renderLivePreview(snapshot, currentSlide) {
    const hymnNumber = snapshot.shortTitle || "";
    const hymnTitle = hymnTitleFromSnapshot(snapshot);
    const bodyPreview = plain(currentSlide.body).slice(0, 280);
    const statusBadge = snapshot.paused
      ? `<div class="av-paused-badge">${escapeHtml(t("presenterControl.paused"))}</div>`
      : snapshot.displayMode !== "lyrics"
        ? `<div class="av-paused-badge">${escapeHtml(snapshot.displayMode)} screen</div>`
        : "";

    return `
      <div class="av-live-frame">
        <div class="av-live-header">
          ${hymnNumber ? `<span class="av-live-hymn-number">${escapeHtml(hymnNumber)}</span>` : ""}
          ${hymnTitle ? `<strong class="av-live-hymn-title">${escapeHtml(hymnTitle)}</strong>` : ""}
        </div>
        <div class="av-live-slide-label">${escapeHtml(currentSlide.label || t("presenterControl.liveSlide"))}</div>
        <div class="av-live-slide-body">${escapeHtml(bodyPreview)}</div>
        ${renderProgressDots(snapshot.slideIndex, snapshot.slideCount)}
        ${statusBadge}
      </div>
    `;
  }

  function render(root, snapshot) {
    if (!root) return;
    if (!snapshot || !snapshot.active) {
      root.className = "presenter-control-root hidden";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = "";
      return;
    }

    const nextSlide = snapshot.nextSlide;
    const nextHymn = snapshot.nextHymn;
    const currentSlide = snapshot.slide || { label: "", body: "" };
    const nextSlideTitle = nextSlide ? `Next slide: ${nextSlide.label || "Slide"}` : `Next slide: ${t("presenterControl.endOfHymn")}`;
    const nextHymnTitle = nextHymn ? nextHymn.title : `Next hymn: ${t("presenterControl.endOfQueue")}`;

    root.className = "presenter-control-root";
    root.setAttribute("aria-hidden", "false");
    root.innerHTML = `
      <div class="av-control-shell">
        <header class="av-control-header">
          <div>
            <p class="eyebrow">${escapeHtml(t("presenterControl.live"))}</p>
            <h2>${escapeHtml(snapshot.shortTitle || snapshot.title || t("topbar.presenter"))}</h2>
            <p class="muted">${escapeHtml(snapshot.subtitle || "")}</p>
          </div>
          <div class="av-header-stats">
            <div class="av-stat">
              <span>${escapeHtml(t("presenterControl.clock"))}</span>
              <strong data-presenter-clock>${escapeHtml(snapshot.clock || "--:--")}</strong>
            </div>
            <div class="av-stat">
              <span>${escapeHtml(t("presenterControl.timer"))}</span>
              <strong data-presenter-timer>${escapeHtml(formatDuration(snapshot.timerRemaining || 0))}</strong>
            </div>
            <div class="av-stat">
              <span>${escapeHtml(t("presenterControl.slide"))}</span>
              <strong>${snapshot.slideCount ? `${snapshot.slideIndex + 1} of ${snapshot.slideCount}` : "—"}</strong>
            </div>
          </div>
        </header>

        <div class="av-control-grid">
          <section class="av-live-panel">
            <div class="av-live-label">${escapeHtml(t("presenterControl.audienceScreen"))}</div>
            ${renderLivePreview(snapshot, currentSlide)}
            <div class="av-transport live-touch-row">
              <button type="button" class="live-touch-btn" data-command="presenter-prev" ${snapshot.canPrev ? "" : "disabled"} aria-label="Previous stanza">${escapeHtml(t("presenterControl.previous"))}</button>
              <button type="button" class="action-button live-touch-btn" data-command="presenter-next" ${snapshot.canNext ? "" : "disabled"} aria-label="Next stanza">${escapeHtml(t("presenterControl.next"))}</button>
              <button type="button" class="live-touch-btn" data-command="show-chorus" aria-label="Show chorus">Chorus</button>
              <button type="button" class="live-touch-btn" data-command="presenter-fullscreen" aria-label="Fullscreen">${escapeHtml(t("presenterControl.fullscreen"))}</button>
              <button type="button" class="live-touch-btn" data-command="close-presenter" aria-label="Exit presenter">${escapeHtml(t("presenterControl.exit"))}</button>
            </div>
          </section>

          <aside class="av-side-panel">
            ${window.CISLiveHymnQueueUI && window.CISLiveHymnQueueService
    ? window.CISLiveHymnQueueUI.renderCompactNextPanel(window.CISLiveHymnQueueService.getState())
    : previewBlock(t("presenterControl.nextHymn"), nextHymnTitle, nextHymn && nextHymn.firstLine, t("presenterControl.endOfQueue"))}
            ${previewBlock(t("presenterControl.nextSlide"), nextSlideTitle, nextSlide && nextSlide.body, t("presenterControl.endOfHymn"))}
            <article class="av-preview-card timer-card">
              <span>${escapeHtml(t("presenterControl.timer"))}</span>
              <strong data-presenter-timer>${escapeHtml(formatDuration(snapshot.timerRemaining || 0))}</strong>
              <div class="button-row">
                <button type="button" data-command="timer-minus">-5 min</button>
                <button type="button" data-command="timer-plus">+5 min</button>
                <button type="button" class="action-button" data-command="timer-toggle">${snapshot.timerRunning ? escapeHtml(t("presenterControl.pauseTimer")) : escapeHtml(t("presenterControl.startTimer"))}</button>
                <button type="button" data-command="timer-reset">${escapeHtml(t("common.reset"))}</button>
              </div>
            </article>
          </aside>
        </div>

        ${window.CISCameraSourceUI ? window.CISCameraSourceUI.renderPresenterPanel(window.CISCameraSourceService?.getState?.() || {}) : ""}

        ${renderToolbar(snapshot)}
        ${renderKeyboardHints()}
      </div>
    `;
  }

  window.CISPresenterControl = {
    configure,
    render,
  };
})();
