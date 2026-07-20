(function () {
  "use strict";

  const STORAGE_KEY = "churchLogoSettings";
  const MAX_BYTES = 2 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

  const DEFAULTS = {
    imageDataUrl: "",
    fileName: "",
    updatedAt: null,
  };

  const MAX_DATA_URL_CHARS = MAX_BYTES * 2 + 256;

  function isValidImageDataUrl(value) {
    return typeof value === "string"
      && value.startsWith("data:image/")
      && value.length <= MAX_DATA_URL_CHARS;
  }

  function sanitize(settings) {
    const merged = { ...DEFAULTS, ...(settings && typeof settings === "object" ? settings : {}) };
    if (!isValidImageDataUrl(merged.imageDataUrl)) {
      merged.imageDataUrl = "";
      merged.fileName = "";
      merged.updatedAt = null;
    } else if (typeof merged.fileName !== "string") {
      merged.fileName = "";
    }
    return merged;
  }

  function load(loadJson) {
    try {
      const raw = typeof loadJson === "function" ? loadJson(STORAGE_KEY, null) : null;
      if (!raw || typeof raw !== "object") return { ...DEFAULTS };
      return sanitize(raw);
    } catch (error) {
      console.warn("[church-logo-settings] Could not load saved logo settings:", error);
      return { ...DEFAULTS };
    }
  }

  function save(settings, saveJson) {
    const merged = sanitize(settings);
    if (typeof saveJson === "function") saveJson(STORAGE_KEY, merged);
    return merged;
  }

  function validateFile(file) {
    if (!file) return { ok: false, message: "No image selected." };
    if (!ALLOWED_TYPES.has(file.type)) {
      return { ok: false, message: "Use PNG, JPG, or WebP for the church logo." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, message: "Logo must be 2 MB or smaller." };
    }
    return { ok: true };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the logo file."));
      reader.readAsDataURL(file);
    });
  }

  async function importFile(file, loadJson, saveJson) {
    const check = validateFile(file);
    if (!check.ok) return check;
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const saved = save({
        imageDataUrl,
        fileName: file.name || "logo",
        updatedAt: Date.now(),
      }, saveJson);
      return { ok: true, settings: saved };
    } catch (error) {
      return { ok: false, message: error.message || "Logo import failed." };
    }
  }

  function remove(saveJson) {
    const saved = save({ ...DEFAULTS }, saveJson);
    return { ok: true, settings: saved };
  }

  function hasCustomLogo(settings) {
    return Boolean(settings && settings.imageDataUrl);
  }

  window.CISChurchLogoSettings = {
    STORAGE_KEY,
    DEFAULTS,
    MAX_BYTES,
    ALLOWED_TYPES,
    load,
    save,
    validateFile,
    importFile,
    remove,
    hasCustomLogo,
  };
})();
