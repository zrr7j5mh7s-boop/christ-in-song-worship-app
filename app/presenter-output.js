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

  function resolveTheme(snapshot) {
    const profile = snapshot.outputProfile || "projector";
    const themeId = snapshot.projectionTheme || snapshot.themeId || "classic_dark";
    if (!window.CISProjectionThemes) return null;
    return window.CISProjectionThemes.resolveThemeForProfile(themeId, profile);
  }

  function transitionClass(snapshot, theme) {
    const reduced = snapshot.reducedMotion || (theme && theme.transitionMs === 0);
    if (reduced) return "";
    const id = snapshot.transition || theme?.transition || "fade";
    const map = window.CISProjectionThemes?.TRANSITIONS || {};
    return (map[id] || map.fade || {}).className || "projector-transition-fade";
  }

  function hymnTitleFromSnapshot(snapshot) {
    if (snapshot.hymnTitle) return snapshot.hymnTitle;
    const title = snapshot.title || "";
    const split = title.indexOf(" · ");
    if (split >= 0) return title.slice(split + 3);
    return title;
  }

  function shouldShowHymnHeader(snapshot) {
    if (snapshot.hideTitleAfterFirst && (snapshot.slideIndex || 0) > 0) return false;
    return true;
  }

  function parseStanzaLabel(label) {
    const raw = String(label || "");
    const match = raw.match(/^(verse|stanza|v\.?)\s*(\d+)/i);
    if (!match) return { number: "", text: raw };
    return { number: match[2], text: raw };
  }

  function renderProgressDots(slideIndex, slideCount) {
    if (!slideCount || slideCount <= 1) return "";
    const dots = Array.from({ length: slideCount }, (_, index) => {
      const active = index === slideIndex ? " active" : "";
      return `<span class="projector-dot${active}" aria-hidden="true"></span>`;
    }).join("");
    return `
      <div class="projector-progress" role="presentation" aria-hidden="true">
        ${dots}
      </div>
    `;
  }

  function renderHymnHeader(snapshot) {
    if (!shouldShowHymnHeader(snapshot)) return "";
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

  function renderEmergency(mode) {
    const appName = window.CISBrandConfig ? window.CISBrandConfig.BRAND.appName.toUpperCase() : "VACHINODA WORSHIP APP";
    const shortName = window.CISBrandConfig ? window.CISBrandConfig.BRAND.shortName : "VaChinoda";
    if (mode === "logo") {
      return `
        <div class="projector-emergency logo" aria-label="Show Logo">
          <div class="projector-logo-lockup">
            <span class="projector-logo-mark" aria-hidden="true">✦</span>
            <strong>${escapeHtml(appName)}</strong>
            <span>${escapeHtml(shortName)}</span>
          </div>
        </div>
      `;
    }
    if (mode === "black") {
      return `<div class="projector-emergency black" aria-label="Blackout"></div>`;
    }
    if (mode === "white") {
      return `<div class="projector-emergency white" aria-label="White screen"></div>`;
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
    if (["scripture", "sermon", "prayer", "benediction", "announcement", "offering", "special", "camera", "chorus", "verse", "refrain"].includes(slideKind)) {
      if (slideKind === "chorus" || slideKind === "refrain") return "hymn";
      return slideKind === "verse" ? "hymn" : slideKind;
    }
    return snapshot.contentKind || "hymn";
  }

  function computeFontSize(snapshot, theme, slide, kind) {
    const scale = snapshot.fontScale || 1;
    if (slide.fitFontPx) return Math.round(slide.fitFontPx);
    const preferred = theme?.preferredFontPx || 76;
    if (kind === "scripture") return Math.round(preferred * 0.88 * scale);
    if (kind === "sermon") return Math.round(preferred * 0.74 * scale);
    if (kind === "prayer" || kind === "benediction") return Math.round(preferred * 0.84 * scale);
    if (kind === "announcement" || kind === "offering" || kind === "special") return Math.round(preferred * 0.8 * scale);
    return Math.round(preferred * scale);
  }

  function renderScriptureBlock(snapshot, slide, theme, transitionClassName) {
    const fontSize = computeFontSize(snapshot, theme, slide, "scripture");
    const layout = slide.layout || snapshot.layout || "fullscreen";
    const layoutClass = `projector-layout-${String(layout).replace(/_/g, "-")}`;
    const showTranslation = snapshot.showTranslationOnOutput !== false && slide.translation;
    const referenceOnly = layout === "reference_only";
    const stageNext = snapshot.outputProfile === "stage" && snapshot.stageShowNextVerse !== false && snapshot.nextSlide;
    const fit = window.CISTextFitEngine?.fitContent({
      text: slide.body,
      theme,
      fontScale: snapshot.fontScale || 1,
      layout,
    });
    const minFont = Math.max(theme?.minFontPx || 30, fit?.fontSize || fontSize);

    return `
      <div class="projector-stage-wrap projector-kind-scripture ${layoutClass} ${transitionClassName}${snapshot.paused ? " is-paused" : ""}">
        <div class="projector-safe-area">
          <div class="projector-reference-bar">
            <span class="projector-scripture-ref">${escapeHtml(slide.reference || slide.label || "")}</span>
            ${showTranslation ? `<span class="projector-translation-badge">${escapeHtml(slide.translation)}</span>` : ""}
            <span class="projector-position" aria-hidden="true">${snapshot.slideIndex + 1} / ${snapshot.slideCount}</span>
          </div>
          ${referenceOnly ? "" : `
            <div class="projector-lyrics projector-lyrics-serif projector-text-block projector-scripture-body"
              style="--projector-font:${minFont}px; --projector-min-font:${theme?.minFontPx || 30}px">
              ${renderBody(slide)}
            </div>
          `}
          ${stageNext ? `
            <div class="projector-stage-next" aria-label="Next verse preview">
              <span class="projector-stage-next-label">Next</span>
              <span class="projector-stage-next-text">${escapeHtml(snapshot.nextSlide.label || "")}</span>
              <p>${lyricHtml((snapshot.nextSlide.body || "").split("\n")[0] || "")}</p>
            </div>
          ` : ""}
          ${renderProgressDots(snapshot.slideIndex, snapshot.slideCount)}
        </div>
      </div>
    `;
  }

  function renderHymnBlock(snapshot, slide, theme, transitionClassName) {
    const fontSize = computeFontSize(snapshot, theme, slide, "hymn");
    const chorusClass = slide.chorusClass || (window.CISlideLayoutEngine?.chorusClass(slide.label) || "");
    const labelClass = chorusClass ? ` projector-label-${chorusClass}` : "";

    const stanza = parseStanzaLabel(slide.label);

    return `
      <div class="projector-stage-wrap projector-kind-hymn${transitionClassName}${snapshot.paused ? " is-paused" : ""}">
        <div class="projector-safe-area">
          ${renderHymnHeader(snapshot)}
          ${slide.label ? `
            <div class="projector-label${labelClass}">
              ${stanza.number ? `<span class="projector-stanza-number">${escapeHtml(stanza.number)}</span>` : ""}
              <span class="projector-label-text">${escapeHtml(stanza.text)}</span>
            </div>
          ` : ""}
          <div class="projector-lyrics projector-lyrics-serif ${chorusClass ? `projector-chorus ${chorusClass}` : ""}"
            style="--projector-font:${fontSize}px; --projector-min-font:${theme?.minFontPx || 30}px">
            ${renderBody(slide)}
          </div>
          ${renderProgressDots(snapshot.slideIndex, snapshot.slideCount)}
        </div>
      </div>
    `;
  }

  function renderSlide(snapshot) {
    const theme = resolveTheme(snapshot);
    const slide = snapshot.slide || { body: "", label: "", kind: "hymn" };
    const kind = contentKind(slide, snapshot);
    const entering = snapshot.transitionKey !== lastTransitionKey;
    lastTransitionKey = snapshot.transitionKey;
    const transitionClassName = `${entering ? " is-entering" : ""} ${transitionClass(snapshot, theme)}`.trim();

    if (kind === "scripture") return renderScriptureBlock(snapshot, slide, theme, transitionClassName);

    if (kind === "sermon") {
      const fontSize = computeFontSize(snapshot, theme, slide, "sermon");
      return `
        <div class="projector-stage-wrap projector-kind-sermon${transitionClassName}${snapshot.paused ? " is-paused" : ""}">
          <div class="projector-safe-area">
            <div class="projector-reference-bar">
              <span class="projector-title">${escapeHtml(snapshot.shortTitle || "Sermon")}</span>
              <span class="projector-position">${snapshot.slideIndex + 1} / ${snapshot.slideCount}</span>
            </div>
            <div class="projector-sermon-title" style="--projector-font:${fontSize}px">${escapeHtml(slide.title || slide.label || "")}</div>
            <div class="projector-lyrics projector-lyrics-serif projector-text-block" style="--projector-font:${Math.round(fontSize * 0.72)}px">${renderBody(slide)}</div>
          </div>
        </div>
      `;
    }

    if (kind === "prayer" || kind === "benediction") {
      const fontSize = computeFontSize(snapshot, theme, slide, kind);
      return `
        <div class="projector-stage-wrap projector-kind-${kind}${transitionClassName}${snapshot.paused ? " is-paused" : ""}">
          <div class="projector-safe-area">
            <div class="projector-reference-bar"><span class="projector-title">${escapeHtml(slide.label || snapshot.shortTitle || "")}</span></div>
            <div class="projector-lyrics projector-lyrics-serif projector-text-centered" style="--projector-font:${fontSize}px">${renderBody(slide)}</div>
          </div>
        </div>
      `;
    }

    if (kind === "announcement" || kind === "offering" || kind === "special") {
      const fontSize = computeFontSize(snapshot, theme, slide, kind);
      return `
        <div class="projector-stage-wrap projector-kind-${kind}${transitionClassName}${snapshot.paused ? " is-paused" : ""}">
          <div class="projector-safe-area">
            <div class="projector-reference-bar"><span class="projector-title">${escapeHtml(slide.title || slide.label || snapshot.shortTitle || "")}</span></div>
            <div class="projector-lyrics projector-lyrics-serif projector-text-readable" style="--projector-font:${fontSize}px">${renderBody(slide)}</div>
          </div>
        </div>
      `;
    }

    return renderHymnBlock(snapshot, slide, theme, transitionClassName);
  }

  function render(root, snapshot, cameraState) {
    if (!root) return;
    const theme = snapshot ? resolveTheme(snapshot) : null;
    if (theme && window.CISProjectionThemes) {
      window.CISProjectionThemes.applyThemeToRoot(root, theme);
    }

    if (!snapshot || !snapshot.active) {
      root.className = "projector-output hidden";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = "";
      lastTransitionKey = "";
      return;
    }

    const slide = snapshot.slide || {};
    const kind = contentKind(slide, snapshot);
    root.className = `projector-output ${kind !== "hymn" ? `projector-${kind}` : ""}`.trim();
    root.setAttribute("aria-hidden", "false");

    if (snapshot.displayMode && snapshot.displayMode !== "lyrics") {
      root.innerHTML = renderEmergency(snapshot.displayMode);
      return;
    }

    const liveCamera = cameraState?.live;
    const compositor = window.CISCameraCompositor;
    if (liveCamera?.active && !liveCamera.hidden && compositor) {
      const layout = liveCamera.layout || slide.layout || "fullscreen";
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
    resolveTheme,
  };
})();
