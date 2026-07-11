(function () {
  "use strict";

  const route = window.CIS_OBS_ROUTE || "scripture";
  const port = Number(window.CIS_OBS_PORT) || 47823;
  const root = document.getElementById("overlayRoot");
  const baseUrl = `http://127.0.0.1:${port}`;
  let lastPayloadKey = "";
  let reconnectTimer = null;
  let eventSource = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ping() {
    fetch(`${baseUrl}/obs/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route }),
    }).catch(() => {});
  }

  function payloadKey(data) {
    try {
      return JSON.stringify(data || null);
    } catch (error) {
      return "";
    }
  }

  function applyTheme(theme) {
    if (!root) return;
    const reduced = theme && theme.reducedMotion;
    root.classList.toggle("no-motion", Boolean(reduced));
    if (theme && theme.fontScale) {
      root.style.fontSize = `${Math.round(42 * Number(theme.fontScale))}px`;
    }
  }

  function transitionClass(transition, reducedMotion) {
    if (reducedMotion || transition === "cut") return "";
    if (transition === "slide_up" || transition === "slide_down") return "slide-up-in";
    return "fade-in";
  }

  function renderScripture(data, layout) {
    if (!data || !data.text) return "";
    const preset = layout?.preset || data.layout || "lower_third";
    const showBg = layout?.showBackground !== false && data.showBackground !== false;
    const ref = data.reference ? `<div class="scripture-ref">${escapeHtml(data.reference)}</div>` : "";
    const translation = data.translation
      ? `<div class="scripture-translation">${escapeHtml(data.translation)}</div>`
      : "";
    const anim = transitionClass(layout?.transition || data.transition, layout?.reducedMotion);
    return `
      <div class="scripture-panel layout-${escapeHtml(preset)} ${showBg ? "" : "no-bg"} ${anim}">
        ${ref}
        <div class="scripture-text">${escapeHtml(data.text)}</div>
        ${translation}
      </div>
    `;
  }

  function renderHymn(data, layout) {
    if (!data || !data.lines) return "";
    const preset = layout?.obsLayout || layout?.preset || data.layout || "lower_third";
    const showBg = layout?.showBackground || data.showBackground;
    const meta = [
      data.number ? `#${escapeHtml(data.number)}` : "",
      data.title ? escapeHtml(data.title) : "",
      data.stanzaLabel ? escapeHtml(data.stanzaLabel) : "",
    ].filter(Boolean).join(" · ");
    const anim = transitionClass(layout?.transition || data.transition, layout?.reducedMotion);
    return `
      <div class="hymn-panel layout-${escapeHtml(preset)} ${showBg ? "with-bg" : ""} ${anim}">
        ${meta ? `<div class="hymn-meta">${meta}</div>` : ""}
        <div class="hymn-lines">${escapeHtml(data.lines)}</div>
      </div>
    `;
  }

  function renderLowerThird(data, layout) {
    if (!data || (!data.primary && !data.secondary)) return "";
    const anim = transitionClass(layout?.transition || data.transition, layout?.reducedMotion);
    return `
      <div class="lower-third-panel ${anim}">
        ${data.primary ? `<div class="lower-third-primary">${escapeHtml(data.primary)}</div>` : ""}
        ${data.secondary ? `<div class="lower-third-secondary">${escapeHtml(data.secondary)}</div>` : ""}
      </div>
    `;
  }

  function renderSermonTitle(data, layout) {
    if (!data || !data.title) return "";
    const anim = transitionClass(layout?.transition || data.transition, layout?.reducedMotion);
    return `
      <div class="sermon-title-panel ${anim}">
        <div>
          <div class="sermon-title-text">${escapeHtml(data.title)}</div>
          ${data.subtitle ? `<div class="sermon-subtitle-text">${escapeHtml(data.subtitle)}</div>` : ""}
        </div>
      </div>
    `;
  }

  function renderAnnouncement(data, layout) {
    if (!data || !data.body) return "";
    const anim = transitionClass(layout?.transition || data.transition, layout?.reducedMotion);
    return `
      <div class="announcement-panel ${anim}">
        ${data.title ? `<div class="announcement-title">${escapeHtml(data.title)}</div>` : ""}
        <div class="announcement-body">${escapeHtml(data.body)}</div>
      </div>
    `;
  }

  function renderFullscreen(data) {
    if (!data) return "";
    if (data.type === "scripture") return renderScripture({ ...data, layout: "fullscreen" }, { preset: "fullscreen" });
    if (data.type === "hymn") return renderHymn({ ...data, layout: "fullscreen" }, { preset: "fullscreen", obsLayout: "fullscreen" });
    return "";
  }

  function pickContent(live, layouts) {
    switch (route) {
      case "scripture":
        return { html: renderScripture(live.scripture, layouts?.scripture), visible: Boolean(live.scripture?.text) };
      case "hymn":
        return { html: renderHymn(live.hymn, layouts?.hymn), visible: Boolean(live.hymn?.lines) };
      case "lower-third":
        return { html: renderLowerThird(live.lowerThird, layouts?.lower_third), visible: Boolean(live.lowerThird?.primary || live.lowerThird?.secondary) };
      case "sermon-title":
        return { html: renderSermonTitle(live.sermonTitle, layouts?.sermon_title), visible: Boolean(live.sermonTitle?.title) };
      case "announcement":
        return { html: renderAnnouncement(live.announcement, layouts?.announcement), visible: Boolean(live.announcement?.body) };
      case "fullscreen":
        return { html: renderFullscreen(live.fullscreen), visible: Boolean(live.fullscreen) };
      case "clean-feed":
        return { html: "", visible: false };
      default:
        return { html: "", visible: false };
    }
  }

  function renderLive(message) {
    if (!root || !message || !message.payload) return;
    const live = message.payload;
    applyTheme(live.theme);
    const layouts = live.layouts || null;
    const content = pickContent(live, layouts);
    const key = payloadKey({ route, content: content.html, visible: content.visible });
    if (key === lastPayloadKey) return;
    lastPayloadKey = key;

    root.innerHTML = content.html;
    root.classList.toggle("hidden", !content.visible);
    root.classList.toggle("visible", content.visible);
    ping();
  }

  function connectSse() {
    if (eventSource) {
      try { eventSource.close(); } catch (error) {}
      eventSource = null;
    }
    eventSource = new EventSource(`${baseUrl}/obs/live-sse?route=${encodeURIComponent(route)}`);
    eventSource.onmessage = (event) => {
      try {
        renderLive(JSON.parse(event.data));
      } catch (error) {}
    };
    eventSource.onerror = () => {
      if (eventSource) {
        try { eventSource.close(); } catch (error) {}
        eventSource = null;
      }
      if (!reconnectTimer) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connectSse();
        }, 2000);
      }
    };
  }

  function bootstrap() {
    fetch(`${baseUrl}/obs/live`)
      .then((res) => res.json())
      .then((message) => renderLive(message))
      .catch(() => {});
    connectSse();
    window.setInterval(ping, 5000);
  }

  bootstrap();
})();
