(function () {
  "use strict";

  const SNAPSHOT_VERSION = 1;
  const CLEAN_EXIT_KEY = "cis-va-chinoda:sessionCleanExit";
  const ACTIVE_SESSION_KEY = "cis-va-chinoda:sessionWasActive";

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function sanitizeObsSettings(obs) {
    if (!isPlainObject(obs)) return {};
    const next = { ...obs };
    delete next.password;
    delete next.passwordStored;
    delete next.token;
    delete next.secret;
    return next;
  }

  function validateSnapshot(snapshot) {
    const errors = [];
    if (!snapshot || typeof snapshot !== "object") {
      return { ok: false, errors: ["Snapshot missing."] };
    }
    if (snapshot.version !== SNAPSHOT_VERSION) {
      errors.push(`Unsupported snapshot version: ${snapshot.version}`);
    }
    if (!snapshot.savedAt || Number.isNaN(Date.parse(snapshot.savedAt))) {
      errors.push("Invalid savedAt timestamp.");
    }
    if (!isPlainObject(snapshot.session)) {
      errors.push("Session payload missing.");
    } else {
      if (!Array.isArray(snapshot.session.worshipPlan)) errors.push("worshipPlan must be an array.");
      if (!Array.isArray(snapshot.session.songService)) errors.push("songService must be an array.");
      if (!isPlainObject(snapshot.session.presenter)) errors.push("presenter state missing.");
    }
    return { ok: errors.length === 0, errors };
  }

  function buildLabels(session, helpers) {
    const describe = helpers?.describeLiveItem || (() => null);
    const previous = describe(session?.live?.previous || session?.presenter, session);
    const preview = describe(session?.live?.preview || session?.hymnQueue?.preview, session);
    const next = describe(session?.live?.next || session?.hymnQueue?.next, session);
    return {
      previousLive: previous?.label || "—",
      preview: preview?.label || "—",
      next: next?.label || "—",
      queueCount: Array.isArray(session?.hymnQueue?.queue) ? session.hymnQueue.queue.length : 0,
    };
  }

  function normalizeSnapshot(raw, helpers) {
    if (!raw || typeof raw !== "object") return null;
    const session = raw.session || {};
    const snapshot = {
      version: SNAPSHOT_VERSION,
      id: raw.id || `sr-${Date.now()}`,
      savedAt: raw.savedAt || new Date().toISOString(),
      sessionActive: Boolean(raw.sessionActive),
      session: {
        worshipPlan: Array.isArray(session.worshipPlan) ? session.worshipPlan : [],
        songService: Array.isArray(session.songService) ? session.songService : [],
        activeSlot: Number(session.activeSlot) || 0,
        presenter: {
          open: Boolean(session.presenter?.open),
          songKey: String(session.presenter?.songKey || ""),
          slideIndex: Number(session.presenter?.slideIndex) || 0,
          planIndex: session.presenter?.planIndex ?? null,
          queueKeys: Array.isArray(session.presenter?.queueKeys) ? session.presenter.queueKeys : [],
          queueIndex: session.presenter?.queueIndex ?? null,
        },
        emergencyMode: String(session.emergencyMode || ""),
        displayMode: String(session.displayMode || "lyrics"),
        bible: {
          translation: String(session.bible?.translation || ""),
          bookOrder: Number(session.bible?.bookOrder) || 0,
          chapter: Number(session.bible?.chapter) || 0,
          verse: Number(session.bible?.verse) || 0,
          live: session.bible?.live || null,
          preview: session.bible?.preview || null,
          previousLive: session.bible?.previousLive || null,
        },
        hymnQueue: {
          preview: session.hymnQueue?.preview || null,
          next: session.hymnQueue?.next || null,
          queue: Array.isArray(session.hymnQueue?.queue) ? session.hymnQueue.queue : [],
        },
        live: {
          previous: session.live?.previous || null,
          preview: session.live?.preview || null,
          next: session.live?.next || null,
          contentType: String(session.live?.contentType || ""),
          phase: String(session.live?.phase || ""),
        },
        language: {
          languageCode: String(session.language?.languageCode || ""),
          hymnBookId: String(session.language?.hymnBookId || ""),
          editionId: String(session.language?.editionId || ""),
          uiLocale: String(session.language?.uiLocale || ""),
        },
        outputs: {
          destinations: Array.isArray(session.outputs?.destinations) ? session.outputs.destinations : [],
          themeId: String(session.outputs?.themeId || ""),
          projection: session.outputs?.projection || {},
          obs: sanitizeObsSettings(session.outputs?.obs || {}),
        },
        stageDisplay: session.stageDisplay || {},
        camera: {
          defaultCameraId: String(session.camera?.defaultCameraId || ""),
          backupCameraId: String(session.camera?.backupCameraId || ""),
          activeCameraId: String(session.camera?.activeCameraId || ""),
        },
        media: {
          songKey: String(session.media?.songKey || ""),
          position: Number(session.media?.position) || 0,
          playing: Boolean(session.media?.playing),
        },
        timer: {
          seconds: Number(session.timer?.seconds) || 0,
          running: Boolean(session.timer?.running),
          endsAt: Number(session.timer?.endsAt) || 0,
        },
      },
      labels: raw.labels || buildLabels(session, helpers),
    };
    const validation = validateSnapshot(snapshot);
    if (!validation.ok) return { snapshot: null, validation };
    return { snapshot, validation };
  }

  window.CISSessionRecoverySnapshot = {
    SNAPSHOT_VERSION,
    CLEAN_EXIT_KEY,
    ACTIVE_SESSION_KEY,
    validateSnapshot,
    normalizeSnapshot,
    sanitizeObsSettings,
    buildLabels,
  };
})();
