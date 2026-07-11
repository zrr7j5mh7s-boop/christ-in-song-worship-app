(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let plain = (value) => String(value || "").trim();
  let formatDuration = (seconds) => String(seconds || 0);

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.plain) plain = options.plain;
    if (options.formatDuration) formatDuration = options.formatDuration;
  }

  function previewBlock(label, title, body, emptyText) {
    const text = plain(body || "").split("\n").filter(Boolean)[0] || "";
    return `
      <article class="av-preview-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(title || emptyText)}</strong>
        <p>${escapeHtml(text || "No preview available.")}</p>
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
        <span><kbd>←</kbd><kbd>→</kbd> Navigate</span>
        <span><kbd>B</kbd> Black</span>
        <span><kbd>C</kbd> Clear</span>
        <span><kbd>L</kbd> Logo</span>
        <span><kbd>P</kbd> Pause</span>
        <span><kbd>Esc</kbd> Exit</span>
        <span><kbd>F</kbd> Fullscreen</span>
      </footer>
    `;
  }

  function renderToolbar(snapshot) {
    const paused = snapshot.paused ? "active" : "";
    return `
      <div class="av-floating-toolbar" role="toolbar" aria-label="Live presentation controls">
        <button type="button" data-command="emergency-black" title="Black screen (B)">Black</button>
        <button type="button" data-command="emergency-white" title="White screen (W)">White</button>
        <button type="button" data-command="emergency-logo" title="Logo screen (L)">Logo</button>
        <button type="button" data-command="emergency-clear" title="Return to lyrics (C)">Clear</button>
        <button type="button" class="${paused}" data-command="presenter-pause" title="Pause display (P)">${snapshot.paused ? "Resume" : "Pause"}</button>
      </div>
    `;
  }

  function renderLivePreview(snapshot, currentSlide) {
    const hymnNumber = snapshot.shortTitle || "";
    const hymnTitle = hymnTitleFromSnapshot(snapshot);
    const bodyPreview = plain(currentSlide.body).slice(0, 280);
    const statusBadge = snapshot.paused
      ? `<div class="av-paused-badge">Paused</div>`
      : snapshot.displayMode !== "lyrics"
        ? `<div class="av-paused-badge">${escapeHtml(snapshot.displayMode)} screen</div>`
        : "";

    return `
      <div class="av-live-frame">
        <div class="av-live-header">
          ${hymnNumber ? `<span class="av-live-hymn-number">${escapeHtml(hymnNumber)}</span>` : ""}
          ${hymnTitle ? `<strong class="av-live-hymn-title">${escapeHtml(hymnTitle)}</strong>` : ""}
        </div>
        <div class="av-live-slide-label">${escapeHtml(currentSlide.label || "Live slide")}</div>
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
    const nextSlideTitle = nextSlide ? `Next slide: ${nextSlide.label || "Slide"}` : "Next slide: End";
    const nextHymnTitle = nextHymn ? nextHymn.title : "Next hymn: End of queue";

    root.className = "presenter-control-root";
    root.setAttribute("aria-hidden", "false");
    root.innerHTML = `
      <div class="av-control-shell">
        <header class="av-control-header">
          <div>
            <p class="eyebrow">Operator Control · Live</p>
            <h2>${escapeHtml(snapshot.shortTitle || snapshot.title || "Presenter")}</h2>
            <p class="muted">${escapeHtml(snapshot.subtitle || "")}</p>
          </div>
          <div class="av-header-stats">
            <div class="av-stat">
              <span>Clock</span>
              <strong>${escapeHtml(snapshot.clock || "--:--")}</strong>
            </div>
            <div class="av-stat">
              <span>Timer</span>
              <strong>${escapeHtml(formatDuration(snapshot.timerRemaining || 0))}</strong>
            </div>
            <div class="av-stat">
              <span>Slide</span>
              <strong>${snapshot.slideCount ? `${snapshot.slideIndex + 1} of ${snapshot.slideCount}` : "—"}</strong>
            </div>
          </div>
        </header>

        <div class="av-control-grid">
          <section class="av-live-panel">
            <div class="av-live-label">Audience screen</div>
            ${renderLivePreview(snapshot, currentSlide)}
            <div class="av-transport">
              <button type="button" data-command="presenter-prev" ${snapshot.canPrev ? "" : "disabled"}>‹ Previous</button>
              <button type="button" class="action-button" data-command="presenter-next" ${snapshot.canNext ? "" : "disabled"}>Next ›</button>
              <button type="button" data-command="presenter-fullscreen">Fullscreen Output</button>
              <button type="button" data-command="close-presenter">Exit Presenter</button>
            </div>
          </section>

          <aside class="av-side-panel">
            ${previewBlock("Next Slide Preview", nextSlideTitle, nextSlide && nextSlide.body, "End of hymn")}
            ${previewBlock("Next Hymn Preview", nextHymnTitle, nextHymn && nextHymn.firstLine, "End of queue")}
            <article class="av-preview-card timer-card">
              <span>Countdown Timer</span>
              <strong>${escapeHtml(formatDuration(snapshot.timerRemaining || 0))}</strong>
              <div class="button-row">
                <button type="button" data-command="timer-minus">-5 min</button>
                <button type="button" data-command="timer-plus">+5 min</button>
                <button type="button" class="action-button" data-command="timer-toggle">${snapshot.timerRunning ? "Pause Timer" : "Start Timer"}</button>
                <button type="button" data-command="timer-reset">Reset</button>
              </div>
            </article>
          </aside>
        </div>

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
