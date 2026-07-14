(function () {
  "use strict";

  const LEVELS = {
    critical: "critical",
    important: "important",
    nonessential: "nonessential",
  };

  const CRITICAL_PATTERNS = [
    /output disconnected/i,
    /projector.*(lost|disconnect|closed)/i,
    /storage.*(critically|full|quota|exceeded)/i,
    /autosave.*fail/i,
    /backup.*fail/i,
    /database.*(corrupt|error)/i,
    /indexeddb/i,
    /media.*fail/i,
    /camera.*fail/i,
    /obs.*(auth|password|authentication).*(required|fail|loss|missing)/i,
    /authentication.*required/i,
    /could not save/i,
    /failed to save/i,
  ];

  const IMPORTANT_PATTERNS = [
    /backup.*(outdated|old|overdue)/i,
    /camera.*(unavailable|not found|denied)/i,
    /stage display.*(disconnect|unavailable)/i,
    /obs.*disconnect/i,
    /reconnect/i,
  ];

  const NONESSENTIAL_PATTERNS = [
    /update.*(available|ready|download)/i,
    /downloading update/i,
    /help content/i,
    /training/i,
    /usage tip/i,
    /tags? (applied|suggested|saved)/i,
    /index(ing)? complete/i,
    /pack imported/i,
    /connected to obs/i,
    /daily backup saved/i,
    /lesson (started|complete)/i,
    /diagnostic.*copied/i,
    /url copied/i,
    /settings saved/i,
    /checking for/i,
  ];

  function matchesAny(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
  }

  function classifyNotice(message, options) {
    const text = String(message || "");
    const levelOverride = options?.level;
    if (levelOverride && LEVELS[levelOverride]) {
      return { level: levelOverride, message: text };
    }
    if (options?.critical) return { level: LEVELS.critical, message: text };
    if (options?.important) return { level: LEVELS.important, message: text };
    if (options?.nonessential) return { level: LEVELS.nonessential, message: text };

    if (matchesAny(text, CRITICAL_PATTERNS)) {
      return { level: LEVELS.critical, message: text };
    }
    if (matchesAny(text, IMPORTANT_PATTERNS)) {
      return { level: LEVELS.important, message: text };
    }
    if (matchesAny(text, NONESSENTIAL_PATTERNS)) {
      return { level: LEVELS.nonessential, message: text };
    }
    return { level: LEVELS.nonessential, message: text };
  }

  function shouldDeferInQuietMode(classification) {
    return classification.level === LEVELS.nonessential;
  }

  function shouldShowUnobtrusively(classification) {
    return classification.level === LEVELS.important;
  }

  window.CISNotificationClassifier = {
    LEVELS,
    classifyNotice,
    shouldDeferInQuietMode,
    shouldShowUnobtrusively,
  };
})();
