(function () {
  "use strict";

  const CHORUS_PATTERN = /chorus|refrain|pinda|impinda/i;

  const THEMES = {
    classic_dark: {
      id: "classic_dark",
      label: "Classic Dark",
      background: "#0a1020",
      textColor: "#fffdf6",
      accentColor: "#f5d58b",
      referenceColor: "rgba(245, 213, 139, 0.92)",
      chorusColor: "#e4c568",
      fontFamily: 'Georgia, "Palatino Linotype", Palatino, serif',
      minFontPx: 30,
      preferredFontPx: 76,
      lineHeight: 1.42,
      safeMargin: "5.5vmin",
      referenceSize: "0.34em",
      chorusStyle: "italic",
      transition: "fade",
      transitionMs: 220,
      logoPlacement: "center",
      maxLinesPerSlide: 5,
      maxCharsPerLine: 42,
      maxCharsPerVerse: 320,
    },
    high_contrast: {
      id: "high_contrast",
      label: "High Contrast",
      background: "#000000",
      textColor: "#ffffff",
      accentColor: "#ffff00",
      referenceColor: "#ffff00",
      chorusColor: "#ffffff",
      fontFamily: 'Arial, Helvetica, sans-serif',
      minFontPx: 34,
      preferredFontPx: 72,
      lineHeight: 1.35,
      safeMargin: "6vmin",
      referenceSize: "0.36em",
      chorusStyle: "bold",
      transition: "cut",
      transitionMs: 0,
      logoPlacement: "center",
      maxLinesPerSlide: 4,
      maxCharsPerLine: 36,
      maxCharsPerVerse: 280,
    },
    warm_worship: {
      id: "warm_worship",
      label: "Warm Worship",
      background: "linear-gradient(160deg, #1a1208 0%, #2d1f10 55%, #120c06 100%)",
      textColor: "#fff8ea",
      accentColor: "#e4c568",
      referenceColor: "#f0d890",
      chorusColor: "#f5d58b",
      fontFamily: 'Georgia, "Palatino Linotype", Palatino, serif',
      minFontPx: 30,
      preferredFontPx: 74,
      lineHeight: 1.45,
      safeMargin: "5.5vmin",
      referenceSize: "0.34em",
      chorusStyle: "italic",
      transition: "fade",
      transitionMs: 260,
      logoPlacement: "center",
      maxLinesPerSlide: 5,
      maxCharsPerLine: 40,
      maxCharsPerVerse: 300,
    },
    scripture_focus: {
      id: "scripture_focus",
      label: "Scripture Focus",
      background: "#0d1528",
      textColor: "#f8f4e8",
      accentColor: "#c9a227",
      referenceColor: "#e4c568",
      chorusColor: "#e4c568",
      fontFamily: 'Georgia, "Palatino Linotype", Palatino, serif',
      minFontPx: 32,
      preferredFontPx: 68,
      lineHeight: 1.5,
      safeMargin: "7vmin",
      referenceSize: "0.32em",
      chorusStyle: "normal",
      transition: "fade",
      transitionMs: 240,
      logoPlacement: "top-left",
      maxLinesPerSlide: 6,
      maxCharsPerLine: 44,
      maxCharsPerVerse: 360,
    },
    camera_overlay: {
      id: "camera_overlay",
      label: "Camera Overlay",
      background: "transparent",
      textColor: "#ffffff",
      accentColor: "#f5d58b",
      referenceColor: "#f5d58b",
      chorusColor: "#ffffff",
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minFontPx: 22,
      preferredFontPx: 42,
      lineHeight: 1.3,
      safeMargin: "4vmin",
      referenceSize: "0.38em",
      chorusStyle: "normal",
      transition: "fade",
      transitionMs: 180,
      logoPlacement: "bottom-right",
      maxLinesPerSlide: 3,
      maxCharsPerLine: 38,
      maxCharsPerVerse: 200,
    },
    stage_display: {
      id: "stage_display",
      label: "Stage Display",
      background: "#111827",
      textColor: "#f9fafb",
      accentColor: "#93c5fd",
      referenceColor: "#93c5fd",
      chorusColor: "#fde68a",
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minFontPx: 28,
      preferredFontPx: 52,
      lineHeight: 1.35,
      safeMargin: "4vmin",
      referenceSize: "0.3em",
      chorusStyle: "normal",
      transition: "cut",
      transitionMs: 120,
      logoPlacement: "none",
      maxLinesPerSlide: 4,
      maxCharsPerLine: 48,
      maxCharsPerVerse: 280,
      showNextVerse: true,
    },
  };

  const ALLOWED_THEME_IDS = Object.keys(THEMES);

  const LAYOUTS = {
    fullscreen: { id: "fullscreen", label: "Full-screen" },
    lower_third: { id: "lower_third", label: "Lower third" },
    scripture_overlay: { id: "scripture_overlay", label: "Scripture over camera" },
    reference_only: { id: "reference_only", label: "Reference only" },
    stage_display: { id: "stage_display", label: "Stage display" },
  };

  const TRANSITIONS = {
    cut: { id: "cut", label: "Cut", className: "" },
    fade: { id: "fade", label: "Fade", className: "projector-transition-fade" },
    crossfade: { id: "crossfade", label: "Crossfade", className: "projector-transition-crossfade" },
    dip_black: { id: "dip_black", label: "Dip to black", className: "projector-transition-dip-black" },
    dip_logo: { id: "dip_logo", label: "Dip to logo", className: "projector-transition-dip-logo" },
  };

  function getTheme(id) {
    const key = ALLOWED_THEME_IDS.includes(id) ? id : "classic_dark";
    return { ...THEMES[key] };
  }

  function resolveThemeForProfile(themeId, profile) {
    if (profile === "obs") return getTheme(themeId === "stage_display" ? "camera_overlay" : (themeId || "camera_overlay"));
    if (profile === "stage") return getTheme("stage_display");
    return getTheme(themeId || "classic_dark");
  }

  function applyThemeToRoot(root, theme) {
    if (!root || !theme) return;
    ALLOWED_THEME_IDS.forEach((id) => root.classList.remove(`projector-theme-${id.replace(/_/g, "-")}`));
    root.classList.add(`projector-theme-${theme.id.replace(/_/g, "-")}`);
    root.style.setProperty("--projector-bg", theme.background);
    root.style.setProperty("--projector-text", theme.textColor);
    root.style.setProperty("--projector-accent", theme.accentColor);
    root.style.setProperty("--projector-reference", theme.referenceColor);
    root.style.setProperty("--projector-chorus", theme.chorusColor);
    root.style.setProperty("--projector-font-family", theme.fontFamily);
    root.style.setProperty("--projector-line-height", String(theme.lineHeight));
    root.style.setProperty("--projector-safe-margin", theme.safeMargin);
    root.style.setProperty("--projector-min-font", `${theme.minFontPx}px`);
  }

  window.CISProjectionThemes = {
    THEMES,
    LAYOUTS,
    TRANSITIONS,
    ALLOWED_THEME_IDS,
    getTheme,
    resolveThemeForProfile,
    applyThemeToRoot,
  };
})();
