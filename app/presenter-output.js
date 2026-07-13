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
      return `<span class="projector-dot${active}" aria-hidden="true"></span>`;
    }).join("");
    return `
      <div class="projector-progress" role="group" aria-label="Stanza ${slideIndex + 1} of ${slideCount}">
        ${dots}
      </div>
    `;
  }

  function renderHymnHeader(snapshot) {
    const number = snapshot.shortTitle || "";
    const title = hymnTitleFromSnapshot(snapshot);
    if (!number && !title) return "";
    return `
      <header class="projector-header">
        ${number ? `<span class="projector-hymn-number">${escapeHtml(number)}</span>` : ""}
        ${title ? `<h1 class="projector-hymn-title">${escapeHtml(title)}</h1>` : ""}
      </header>
    `;
  }

  function renderEmergencyReturn() {
    return `<button type="button" class="projector-emergency-return" data-command="emergency-clear" aria-label="Return to lyrics (C)">Return to lyrics</button>`;
  }

  function renderEmergency(mode) {
    if (mode === "logo") {
      return `
        <div class="projector-emergency logo">
          <div class="projector-logo-lockup">
            <span class="projector-logo-mark" aria-hidden="true">✦</span>
            <strong>CHRIST IN SONG</strong>
            <span>VaChinoda Worship</span>
          </div>
          ${renderEmergencyReturn()}
        </div>
      `;
    }
    if (mode === "black") {
      return `
        <div class="projector-emergency black" aria-label="Black screen">
          ${renderEmergencyReturn()}
        </div>
      `;
    }
    if (mode === "white") {
      return `
        <div class="projector-emergency white" aria-label="White screen">
          ${renderEmergencyReturn()}
        </div>
      `;
    }
    if (mode === "clear") {
      return `<div class="projector-emergency clear" aria-label="Cleared screen"></div>`;
    }
    return "";
  }

  function renderBody(slide) {
    const body = slide.body || "";
    if (body.includes("<")) return richTextHtml(body);
    return lyricHtml(body);
  }

  function contentKind(slide, snapshot) {
    const slideKind = slide.kind || "";
    if (["scripture", "sermon", "prayer", "benediction", "announcement", "offering", "special", "camera"].includes(slideKind)) {
      return slideKind;
    }
    return snapshot.contentKind || "hymn";
  }

  function renderSlide(snapshot) {
    const fontScale = snapshot.fontScale || 1;
    const fontSize = Math.round(76 * fontScale);
    const slide = snapshot.slide || { body: "", label: "", kind: "hymn" };
    const kind = contentKind(slide, snapshot);
    const transitionClass = snapshot.transitionKey !== lastTransitionKey ? " is-entering" : "";
    lastTransitionKey = snapshot.transitionKey;
    const pausedClass = snapshot.paused ? " is-paused" : "";
    const progress = renderProgressDots(snapshot.slideIndex, snapshot.slideCount);

    if (kind === "scripture") {
      return `
        <div class="projector-stage-wrap projector-kind-scripture${transitionClass}${pausedClass}">
          <div class="projector-meta">
            <span class="projector-title">${escapeHtml(slide.reference || slide.title || snapshot.shortTitle || "Scripture")}</span>
            <span class="projector-position">${snapshot.slideIndex + 1} of ${snapshot.slideCount}</span>
          </div>
          <div class="projector-scripture-ref">${escapeHtml(slide.reference || slide.label || "")}</div>
          <div class="projector-lyrics projector-lyrics-serif projector-text-block" style="--projector-font:${Math.round(fontSize * 0.88)}px">${renderBody(slide)}</div>
          ${progress}
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
          <div class="projector-sermon-title" style="--projector-font:${Math.round(fontSize * 1.02)}px">${escapeHtml(slide.title || slide.label || "")}</div>
          <div class="projector-lyrics projector-lyrics-serif projector-text-block" style="--projector-font:${Math.round(fontSize * 0.74)}px">${renderBody(slide)}</div>
          ${progress}
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
          <div class="projector-lyrics projector-lyrics-serif projector-text-block projector-text-centered" style="--projector-font:${Math.round(fontSize * 0.84)}px">${renderBody(slide)}</div>
          ${progress}
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
          <div class="projector-lyrics projector-lyrics-serif projector-text-block projector-text-readable" style="--projector-font:${Math.round(fontSize * 0.8)}px">${renderBody(slide)}</div>
          ${progress}
        </div>
      `;
    }

    return `
      <div class="projector-stage-wrap projector-kind-hymn${transitionClass}${pausedClass}">
        ${renderHymnHeader(snapshot)}
        ${slide.label ? `<div class="projector-label">${escapeHtml(slide.label)}</div>` : ""}
        <div class="projector-lyrics projector-lyrics-serif" style="--projector-font:${fontSize}px">${renderBody(slide)}</div>
        ${progress}
      </div>
    `;
  }

  function render(root, snapshot, cameraState) {
    if (!root) return;
    if (!snapshot || !snapshot.active) {
      root.className = "projector-output hidden";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = "";
      lastTransitionKey = "";
      return;
    }

    const slide = snapshot.slide || {};
    const kind = contentKind(slide, snapshot);
    root.className = `projector-output ${kind !== "hymn" ? `projector-${kind}` : ""}`;
    root.setAttribute("aria-hidden", "false");

    if (snapshot.displayMode && snapshot.displayMode !== "lyrics") {
      root.innerHTML = renderEmergency(snapshot.displayMode);
      return;
    }

    const liveCamera = cameraState?.live;
    const compositor = window.CISCameraCompositor;
    if (liveCamera?.active && !liveCamera.hidden && compositor) {
      const layout = liveCamera.layout || "fullscreen";
      const useOverlay = compositor.hasOverlayLayout(layout) || (kind !== "camera" && kind !== "hymn");
      if (layout === "fullscreen" && kind === "camera") {
        root.innerHTML = compositor.renderCameraStage(layout, "", {
          cameraName: liveCamera.cameraName,
          frozen: liveCamera.frozen,
          hidden: liveCamera.hidden,
          transition: liveCamera.transition,
        });
        return;
      }
      if (useOverlay) {
        const overlayHtml = kind === "camera" ? "" : renderSlide(snapshot);
        root.innerHTML = compositor.renderCameraStage(layout, overlayHtml, {
          cameraName: liveCamera.cameraName,
          frozen: liveCamera.frozen,
          hidden: liveCamera.hidden,
          transition: liveCamera.transition,
        });
        return;
      }
      if (layout === "fullscreen") {
        root.innerHTML = compositor.renderCameraStage(layout, "", {
          cameraName: liveCamera.cameraName,
          frozen: liveCamera.frozen,
          hidden: liveCamera.hidden,
          transition: liveCamera.transition,
        });
        return;
      }
    }

    root.innerHTML = renderSlide(snapshot);
  }

  function bindCameraVideos(root, service) {
    if (window.CISCameraCompositor && service) {
      window.CISCameraCompositor.bindCameraVideos(root, service);
    }
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
    bindCameraVideos,
    requestFullscreen,
  };
})();
