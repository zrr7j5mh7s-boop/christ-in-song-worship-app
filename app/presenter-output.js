(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let lyricHtml = (value) => escapeHtml(value).replace(/\n/g, "<br>");
  let lastTransitionKey = "";

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.lyricHtml) lyricHtml = options.lyricHtml;
  }

  function renderEmergency(mode) {
    if (mode === "logo") {
      return `
        <div class="projector-emergency logo">
          <div class="projector-logo-lockup">
            <strong>CHRIST IN SONG</strong>
            <span>VaChinoda Worship</span>
          </div>
        </div>
      `;
    }
    if (mode === "black") return `<div class="projector-emergency black" aria-label="Black screen"></div>`;
    if (mode === "white") return `<div class="projector-emergency white" aria-label="White screen"></div>`;
    if (mode === "clear") return `<div class="projector-emergency clear" aria-label="Cleared screen"></div>`;
    return "";
  }

  function renderSlide(snapshot) {
    const fontSize = Math.round(64 * (snapshot.fontScale || 1));
    const slide = snapshot.slide || { body: "", label: "" };
    const transitionClass = snapshot.transitionKey !== lastTransitionKey ? " is-entering" : "";
    lastTransitionKey = snapshot.transitionKey;
    const pausedClass = snapshot.paused ? " is-paused" : "";
    return `
      <div class="projector-stage-wrap${transitionClass}${pausedClass}">
        <div class="projector-meta">
          <span class="projector-title">${escapeHtml(snapshot.shortTitle || snapshot.title)}</span>
          <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
        </div>
        <div class="projector-label">${escapeHtml(slide.label || "")}</div>
        <div class="projector-lyrics" style="--projector-font:${fontSize}px">${lyricHtml(slide.body || "")}</div>
      </div>
    `;
  }

  function render(root, snapshot) {
    if (!root) return;
    if (!snapshot || !snapshot.active) {
      root.className = "projector-output hidden";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = "";
      return;
    }

    root.className = "projector-output";
    root.setAttribute("aria-hidden", "false");

    if (snapshot.displayMode && snapshot.displayMode !== "lyrics") {
      root.innerHTML = renderEmergency(snapshot.displayMode);
      return;
    }

    root.innerHTML = renderSlide(snapshot);
  }

  function requestFullscreen(root) {
    const target = root || document.documentElement;
    if (document.fullscreenElement === target && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
  }

  window.CISPresenterOutput = {
    configure,
    render,
    requestFullscreen,
  };
})();
