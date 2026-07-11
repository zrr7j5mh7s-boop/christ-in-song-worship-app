(function () {
  "use strict";

  const ENTITY_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ENTITY_MAP[ch] || ch);
  }

  function stripHtml(value) {
    return String(value == null ? "" : value)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeText(value, maxLength) {
    const plain = stripHtml(value);
    if (!maxLength || plain.length <= maxLength) return plain;
    return `${plain.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  function sanitizePayload(payload) {
    if (!payload || typeof payload !== "object") return {};
    const next = {};
    Object.keys(payload).forEach((key) => {
      const value = payload[key];
      if (value == null) {
        next[key] = value;
        return;
      }
      if (typeof value === "string") {
        next[key] = sanitizeText(value, 8000);
        return;
      }
      if (Array.isArray(value)) {
        next[key] = value.map((item) => (typeof item === "string" ? sanitizeText(item, 4000) : item));
        return;
      }
      if (typeof value === "object") {
        next[key] = sanitizePayload(value);
        return;
      }
      next[key] = value;
    });
    return next;
  }

  window.CISObsSanitize = {
    escapeHtml,
    stripHtml,
    sanitizeText,
    sanitizePayload,
  };
})();
