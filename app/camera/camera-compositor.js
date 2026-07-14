(function () {
  "use strict";

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function hasOverlayLayout(layout) {
    return [
      "scripture-overlay",
      "hymn-overlay",
      "sermon-title",
      "lower-third",
      "announcement-overlay",
      "pip-bottom-right",
      "pip-bottom-left",
      "split-screen",
      "transparent-overlay",
      "church-logo",
      "safe-area",
    ].includes(layout);
  }

  function renderCameraVideo(attrs) {
    const attrStr = attrs || 'class="projector-camera-video" data-camera-purpose="live"';
    return `<video ${attrStr} muted playsinline autoplay aria-label="Camera feed"></video>`;
  }

  function renderCameraStage(layout, overlayHtml, options) {
    const opts = options || {};
    const layoutClass = `projector-camera-layout-${layout || "fullscreen"}`;
    const hiddenClass = opts.hidden ? " is-hidden" : "";
    const frozenClass = opts.frozen ? " is-frozen" : "";
    const transition = opts.transition || "cut";
    const safeGuides = layout === "safe-area"
      ? `<div class="projector-camera-safe-guides" aria-hidden="true"><span class="safe-title"></span><span class="safe-lower"></span></div>`
      : "";
    const logoBadge = layout === "church-logo"
      ? `<div class="projector-camera-logo-badge" aria-hidden="true"><span>✦</span><strong>${escapeHtml((window.CISBrandConfig?.BRAND?.shortName || "VaChinoda").toUpperCase())}</strong></div>`
      : "";

    if (layout === "fullscreen" || !hasOverlayLayout(layout)) {
      return `
        <div class="projector-camera-stage ${layoutClass}${hiddenClass}${frozenClass} projector-transition-${transition}" role="img" aria-label="${escapeAttr(opts.cameraName || "Camera")}">
          ${renderCameraVideo()}
          ${logoBadge}
          ${safeGuides}
        </div>
      `;
    }

    return `
      <div class="projector-camera-stage ${layoutClass}${hiddenClass}${frozenClass} projector-transition-${transition}">
        ${renderCameraVideo()}
        <div class="projector-camera-overlay-content">
          ${overlayHtml || ""}
        </div>
        ${logoBadge}
        ${safeGuides}
      </div>
    `;
  }

  function renderOperatorPreview(cameraName, status) {
    return `
      <div class="camera-preview-frame" data-camera-preview-root>
        <div class="camera-preview-header">
          <strong>${escapeAttr(cameraName || "Camera Preview")}</strong>
          <span class="camera-status-pill status-${escapeAttr(status || "idle")}">${escapeAttr(status || "idle")}</span>
        </div>
        <div class="camera-preview-video-wrap">
          <video class="camera-preview-video" data-camera-purpose="preview" muted playsinline autoplay aria-label="Operator camera preview"></video>
          <div class="camera-preview-empty">Select a camera and click Preview Camera.</div>
        </div>
      </div>
    `;
  }

  function bindCameraVideos(root, service) {
    if (!root || !service) return;
    root.querySelectorAll("video[data-camera-purpose]").forEach((video) => {
      const purpose = video.getAttribute("data-camera-purpose") || "live";
      service.bindVideoElement(video, purpose);
      const wrap = video.closest(".camera-preview-video-wrap");
      if (wrap) {
        const empty = wrap.querySelector(".camera-preview-empty");
        if (empty) empty.style.display = video.srcObject ? "none" : "";
      }
    });
  }

  window.CISCameraCompositor = {
    hasOverlayLayout,
    renderCameraStage,
    renderCameraVideo,
    renderOperatorPreview,
    bindCameraVideos,
  };
})();
