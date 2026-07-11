(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let lyricHtml = (value) => escapeHtml(value).replace(/\n/g, "<br>");
  let richTextHtml = (value) => lyricHtml(value);
  let lastTransitionKey = "";

  function configure(options) {
    if (options.escapeHtml) escapeHtml = options.escapeHtml;
    if (options.lyricHtml) lyricHtml = options.lyricHtml;
    if (options.richTextHtml) richTextHtml = options.richTextHtml;
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

  function renderBody(slide) {
    const body = slide.body || "";
    if (body.includes("<")) return richTextHtml(body);
    return lyricHtml(body);
  }

  function renderSlide(snapshot) {
    const fontSize = Math.round(64 * (snapshot.fontScale || 1));
    const slide = snapshot.slide || { body: "", label: "", kind: "hymn" };
    const kind = slide.kind || snapshot.contentKind || "hymn";
    const transitionClass = snapshot.transitionKey !== lastTransitionKey ? " is-entering" : "";
    lastTransitionKey = snapshot.transitionKey;
    const pausedClass = snapshot.paused ? " is-paused" : "";

    if (kind === "scripture") {
      return `
        <div class="projector-stage-wrap projector-kind-scripture${transitionClass}${pausedClass}">
          <div class="projector-meta">
            <span class="projector-title">${escapeHtml(slide.reference || slide.title || snapshot.shortTitle || "Scripture")}</span>
            <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
          </div>
          <div class="projector-scripture-ref">${escapeHtml(slide.reference || slide.label || "")}</div>
          <div class="projector-lyrics projector-text-block" style="--projector-font:${Math.round(fontSize * 0.92)}px">${renderBody(slide)}</div>
        </div>
      `;
    }

    if (kind === "sermon") {
      return `
        <div class="projector-stage-wrap projector-kind-sermon${transitionClass}${pausedClass}">
          <div class="projector-meta">
            <span class="projector-title">${escapeHtml(snapshot.shortTitle || "Sermon")}</span>
            <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
          </div>
          <div class="projector-sermon-title" style="--projector-font:${Math.round(fontSize * 1.05)}px">${escapeHtml(slide.title || slide.label || "")}</div>
          <div class="projector-lyrics projector-text-block" style="--projector-font:${Math.round(fontSize * 0.72)}px">${renderBody(slide)}</div>
        </div>
      `;
    }

    if (kind === "prayer" || kind === "benediction") {
      return `
        <div class="projector-stage-wrap projector-kind-${kind}${transitionClass}${pausedClass}">
          <div class="projector-meta">
            <span class="projector-title">${escapeHtml(slide.label || snapshot.shortTitle || "")}</span>
            <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
          </div>
          <div class="projector-lyrics projector-text-block projector-text-centered" style="--projector-font:${Math.round(fontSize * 0.82)}px">${renderBody(slide)}</div>
        </div>
      `;
    }

    if (kind === "announcement" || kind === "offering" || kind === "special") {
      return `
        <div class="projector-stage-wrap projector-kind-${kind}${transitionClass}${pausedClass}">
          <div class="projector-meta">
            <span class="projector-title">${escapeHtml(slide.title || slide.label || snapshot.shortTitle || "")}</span>
            <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
          </div>
          <div class="projector-label">${escapeHtml(slide.label || "")}</div>
          <div class="projector-lyrics projector-text-block projector-text-readable" style="--projector-font:${Math.round(fontSize * 0.78)}px">${renderBody(slide)}</div>
        </div>
      `;
    }

    return `
      <div class="projector-stage-wrap projector-kind-hymn${transitionClass}${pausedClass}">
        <div class="projector-meta">
          <span class="projector-title">${escapeHtml(snapshot.shortTitle || snapshot.title)}</span>
          <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
        </div>
        <div class="projector-label">${escapeHtml(slide.label || "")}</div>
        <div class="projector-lyrics" style="--projector-font:${fontSize}px">${renderBody(slide)}</div>
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

    const kind = snapshot.slide && snapshot.slide.kind ? snapshot.slide.kind : "hymn";
    root.className = `projector-output ${kind !== "hymn" ? `projector-${kind}` : ""}`;
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
