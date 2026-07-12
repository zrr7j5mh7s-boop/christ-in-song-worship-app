(function () {
  "use strict";

  const liveState = {
    scripture: null,
    hymn: null,
    lowerThird: null,
    sermonTitle: null,
    announcement: null,
    fullscreen: null,
    activeOverlays: {
      scripture: false,
      hymn: false,
      lowerThird: false,
      sermonTitle: false,
      announcement: false,
    },
  };

  let previewState = null;
  let httpInfo = null;
  let commandLock = false;
  let lastPublishAt = 0;

  function sanitize() {
    return window.CISObsSanitize || {
      sanitizePayload: (value) => value,
      sanitizeText: (value) => String(value || ""),
    };
  }

  function getSettings() {
    return window.CISObsSettingsStore
      ? window.CISObsSettingsStore.loadSettings()
      : { overlayLayouts: {}, outputDefaults: {} };
  }

  async function ensureHttpServer() {
    if (window.electronAPI && window.electronAPI.obsHttp) {
      const settings = getSettings();
      const info = await window.electronAPI.obsHttp.getInfo();
      if (!info?.running) {
        httpInfo = await window.electronAPI.obsHttp.start({ port: settings.browserSourcePort });
      } else {
        httpInfo = info;
      }
      return httpInfo;
    }
    return null;
  }

  async function publishToHttp(payload) {
    const settings = getSettings();
    const sanitized = sanitize().sanitizePayload({
      ...payload,
      layouts: settings.overlayLayouts,
      theme: {
        fontScale: payload.theme?.fontScale || 1,
        reducedMotion: Boolean(payload.theme?.reducedMotion),
      },
      sentAt: Date.now(),
    });

    if (window.electronAPI && window.electronAPI.obsHttp) {
      await ensureHttpServer();
      await window.electronAPI.obsHttp.publish(sanitized);
      return sanitized;
    }
    return sanitized;
  }

  function shouldPublish(contentType, overrideTarget) {
    const store = window.CISObsSettingsStore;
    if (!store) return false;
    return store.shouldSendToObs(contentType, overrideTarget);
  }

  async function applyObsForContent(contentType, visible) {
    const constants = window.CISObsConstants;
    const sourceKey = constants?.CONTENT_TO_SOURCE_KEY[contentType];
    if (!sourceKey || !window.CISObsSourceService) return;

    try {
      if (visible) await window.CISObsSourceService.showSource(sourceKey);
      else await window.CISObsSourceService.hideSource(sourceKey);
    } catch (error) {
      if (window.CISObsEventService) {
        window.CISObsEventService.emit("mappingError", { contentType, message: error.message });
      }
    }

    if (visible && window.CISObsSceneService) {
      try {
        await window.CISObsSceneService.applySceneForContent(contentType);
      } catch (error) {}
    }
  }

  async function publishLive(contentType, payload, options) {
    if (commandLock) return null;
    const now = Date.now();
    if (now - lastPublishAt < 40 && !options?.force) return null;
    lastPublishAt = now;

    const target = options?.outputTarget;
    if (!shouldPublish(contentType, target)) return null;

    commandLock = true;
    try {
      const clean = sanitize().sanitizePayload(payload || {});
      const httpPayload = {};

      if (contentType === "bible" || contentType === "scripture") {
        liveState.scripture = clean.visible === false ? null : clean;
        liveState.activeOverlays.scripture = Boolean(liveState.scripture?.text);
        httpPayload.scripture = liveState.scripture;
        await applyObsForContent("scripture", liveState.activeOverlays.scripture);
      } else if (contentType === "hymn") {
        liveState.hymn = clean.visible === false ? null : clean;
        liveState.activeOverlays.hymn = Boolean(liveState.hymn?.lines);
        httpPayload.hymn = liveState.hymn;
        await applyObsForContent("hymn", liveState.activeOverlays.hymn);
      } else if (contentType === "lower_third") {
        liveState.lowerThird = clean.visible === false ? null : clean;
        liveState.activeOverlays.lowerThird = Boolean(liveState.lowerThird?.primary || liveState.lowerThird?.secondary);
        httpPayload.lowerThird = liveState.lowerThird;
        await applyObsForContent("lower_third", liveState.activeOverlays.lowerThird);
      } else if (contentType === "sermon_title") {
        liveState.sermonTitle = clean.visible === false ? null : clean;
        liveState.activeOverlays.sermonTitle = Boolean(liveState.sermonTitle?.title);
        httpPayload.sermonTitle = liveState.sermonTitle;
        await applyObsForContent("sermon_title", liveState.activeOverlays.sermonTitle);
      } else if (contentType === "announcement") {
        liveState.announcement = clean.visible === false ? null : clean;
        liveState.activeOverlays.announcement = Boolean(liveState.announcement?.body);
        httpPayload.announcement = liveState.announcement;
        await applyObsForContent("announcement", liveState.activeOverlays.announcement);
      }

      await publishToHttp(httpPayload);
      if (window.CISObsEventService) {
        window.CISObsEventService.emit("obsLivePublished", { contentType, activeOverlays: { ...liveState.activeOverlays } });
      }
      return { ...liveState };
    } finally {
      commandLock = false;
    }
  }

  function stagePreview(contentType, payload) {
    previewState = { contentType, payload: sanitize().sanitizePayload(payload || {}), stagedAt: Date.now() };
    return previewState;
  }

  async function commitPreview(outputTarget) {
    if (!previewState) return null;
    const { contentType, payload } = previewState;
    previewState = null;
    return publishLive(contentType, payload, { outputTarget, force: true });
  }

  async function clearOverlay(type) {
    const map = {
      scripture: "scripture",
      bible: "scripture",
      hymn: "hymn",
      lower_third: "lower_third",
      sermon_title: "sermon_title",
      announcement: "announcement",
    };
    const contentType = map[type] || type;
    return publishLive(contentType, { visible: false }, { force: true });
  }

  async function clearWorshipOverlays() {
    await clearOverlay("scripture");
    await clearOverlay("hymn");
    await clearOverlay("lower_third");
    await clearOverlay("sermon_title");
    await clearOverlay("announcement");
    if (window.CISObsSourceService) {
      await window.CISObsSourceService.clearWorshipOverlays();
    }
    return liveState;
  }

  function buildHymnPayload(snapshot, obsLayout) {
    const settings = getSettings();
    const layout = obsLayout || settings.overlayLayouts?.hymn?.obsLayout || "lower_third";
    const slide = snapshot?.slide || {};
    const body = String(slide.body || "").trim();
    const lines = body.split("\n").filter(Boolean).slice(0, settings.overlayLayouts?.hymn?.maxLines || 6).join("\n");
    return {
      number: snapshot?.hymnNumber || "",
      title: snapshot?.title || snapshot?.shortTitle || "",
      stanzaLabel: slide.label || "",
      lines,
      layout,
      language: snapshot?.language || "",
      visible: Boolean(lines),
    };
  }

  function buildScripturePayload(data) {
    const settings = getSettings();
    const layout = settings.overlayLayouts?.scripture?.obsLayout || "lower_third";
    return {
      reference: data.reference || "",
      text: data.text || "",
      translation: data.translation || "",
      layout,
      showBackground: settings.overlayLayouts?.scripture?.showBackground !== false,
      visible: Boolean(data.text),
    };
  }

  async function syncFromPresenter(snapshot, engineState, item) {
    if (!snapshot || !engineState?.active || engineState.paused) return null;
    if (engineState.displayMode && engineState.displayMode !== "lyrics") return null;

    const slide = snapshot.slide || {};
    const body = String(slide.body || "").trim();
    const contentKind = item?.contentKind || item?.type || "song";

    if (contentKind === "scripture" || (item?.type === "custom" && contentKind === "scripture")) {
      const reference = slide.reference || item?.title || item?.subtitle || snapshot.shortTitle || "";
      const translation = slide.translation || item?.translation || "";
      const obsLayout = item?.obsLayout || settings.overlayLayouts?.scripture?.obsLayout || "lower_third";
      return publishLive("scripture", {
        ...buildScripturePayload({
          reference,
          text: body,
          translation,
        }),
        layout: obsLayout,
      });
    }

    if (contentKind === "announcement") {
      return publishLive("announcement", {
        title: snapshot.shortTitle || "Announcement",
        body,
        visible: Boolean(body),
      });
    }

    if (contentKind === "sermon") {
      return publishLive("sermon_title", {
        title: snapshot.title || body.split("\n")[0] || "",
        subtitle: snapshot.subtitle || "",
        visible: Boolean(snapshot.title || body),
      });
    }

    if (contentKind === "offering" || contentKind === "special") {
      return publishLive("lower_third", {
        primary: snapshot.title || snapshot.shortTitle || "",
        secondary: body.split("\n")[0] || "",
        visible: Boolean(snapshot.title || body),
      });
    }

    const hymnPayload = buildHymnPayload(snapshot);
    if (!hymnPayload.lines) return null;
    return publishLive("hymn", hymnPayload);
  }

  function getLiveState() {
    return {
      ...liveState,
      activeOverlays: { ...liveState.activeOverlays },
    };
  }

  function getPreviewState() {
    return previewState ? { ...previewState } : null;
  }

  async function getBrowserSourceUrls() {
    if (window.electronAPI && window.electronAPI.obsHttp) {
      await ensureHttpServer();
      const info = await window.electronAPI.obsHttp.getInfo();
      return info?.routes || {};
    }
    const settings = getSettings();
    const port = settings.browserSourcePort || 47823;
    const base = `http://127.0.0.1:${port}`;
    const routes = window.CISObsConstants?.OVERLAY_ROUTES || [];
    return routes.reduce((acc, route) => {
      acc[route.key] = `${base}${route.path}`;
      return acc;
    }, {});
  }

  async function getHeartbeatStatus() {
    if (window.electronAPI && window.electronAPI.obsHttp) {
      const info = await window.electronAPI.obsHttp.getInfo();
      return info?.heartbeat || {};
    }
    return {};
  }

  window.CISObsOutputService = {
    publishLive,
    stagePreview,
    commitPreview,
    clearOverlay,
    clearWorshipOverlays,
    buildHymnPayload,
    buildScripturePayload,
    syncFromPresenter,
    getLiveState,
    getPreviewState,
    getBrowserSourceUrls,
    getHeartbeatStatus,
    ensureHttpServer,
    shouldPublish,
  };
})();
