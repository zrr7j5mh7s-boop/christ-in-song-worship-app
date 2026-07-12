(function () {
  "use strict";

  const PHASE = {
    BROWSE: "browse",
    PREVIEW: "preview",
    PREPARING: "preparing",
    READY: "ready",
    LIVE: "live",
    NEXT: "next",
    PREVIOUS_LIVE: "previous_live",
    CLEARED: "cleared",
    LOGO: "logo",
    BLACKOUT: "blackout",
    ERROR: "error",
  };

  const LIVE_OUTPUT_PHASES = new Set([
    PHASE.LIVE,
    PHASE.LOGO,
    PHASE.BLACKOUT,
    PHASE.CLEARED,
  ]);

  const EXPLICIT_LIVE_ACTIONS = new Set([
    "send-live",
    "hymn-send-live",
    "hymn-queue-send-live",
    "hymn-take-next",
    "present-current",
    "present-song",
    "present-plan-slot",
    "open-presenter",
    "camera-send-live",
    "emergency-clear",
    "emergency-logo",
    "emergency-black",
    "hymn-restore-previous",
    "restore-scripture",
    "change-live-version",
  ]);

  const PREVIEW_ONLY_ACTIONS = new Set([
    "hymn-preview",
    "hymn-preview-open",
    "hymn-set-next",
    "hymn-add-queue",
    "set-preview-version",
    "search-reference",
    "apply-suggestion",
    "set-destinations",
    "bible-preview",
  ]);

  function isLiveOutputPhase(phase) {
    return LIVE_OUTPUT_PHASES.has(phase);
  }

  function isExplicitLiveAction(command) {
    return EXPLICIT_LIVE_ACTIONS.has(command);
  }

  function isPreviewOnlyAction(command) {
    return PREVIEW_ONLY_ACTIONS.has(command);
  }

  function labelForPhase(phase) {
    const map = {
      browse: "Browse",
      preview: "Preview",
      preparing: "Preparing",
      ready: "Ready",
      live: "Live",
      next: "Next",
      previous_live: "Previous Live",
      cleared: "Cleared",
      logo: "Logo",
      blackout: "Blackout",
      error: "Error",
    };
    return map[phase] || phase || "Browse";
  }

  window.CISPresentationStateModel = {
    PHASE,
    LIVE_OUTPUT_PHASES,
    EXPLICIT_LIVE_ACTIONS,
    PREVIEW_ONLY_ACTIONS,
    isLiveOutputPhase,
    isExplicitLiveAction,
    isPreviewOnlyAction,
    labelForPhase,
  };
})();
