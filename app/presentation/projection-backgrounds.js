(function () {
  "use strict";

  const BUNDLED = {
    black: {
      id: "black",
      label: "Black",
      css: "#000000",
      kind: "solid",
    },
    white: {
      id: "white",
      label: "White",
      css: "#ffffff",
      kind: "solid",
    },
    navy_soft: {
      id: "navy_soft",
      label: "Soft Navy",
      css: "linear-gradient(165deg, #0a1020 0%, #152238 55%, #0b1220 100%)",
      kind: "gradient",
    },
    warm_stone: {
      id: "warm_stone",
      label: "Warm Stone",
      css: "linear-gradient(165deg, #2a2118 0%, #4a3b2d 55%, #1f1812 100%)",
      kind: "gradient",
    },
    deep_blue: {
      id: "deep_blue",
      label: "Deep Blue",
      css: "linear-gradient(165deg, #081428 0%, #12345a 50%, #07101f 100%)",
      kind: "gradient",
    },
  };

  const MAX_BYTES = 3 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

  function listBundled() {
    return Object.values(BUNDLED);
  }

  function getBundled(id) {
    return BUNDLED[id] ? { ...BUNDLED[id] } : null;
  }

  function resolveBackground(settings) {
    const backgroundId = settings?.backgroundId || "black";
    if (backgroundId === "custom" && settings?.customBackgroundDataUrl) {
      return {
        id: "custom",
        label: "Custom image",
        css: `url("${settings.customBackgroundDataUrl}") center / cover no-repeat`,
        kind: "image",
      };
    }
    return getBundled(backgroundId) || getBundled("black");
  }

  function validateFile(file) {
    if (!file) return { ok: false, message: "No background image selected." };
    if (!ALLOWED_TYPES.has(file.type)) {
      return { ok: false, message: "Use PNG, JPG, or WebP for custom backgrounds." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, message: "Background image must be 3 MB or smaller." };
    }
    return { ok: true };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the background file."));
      reader.readAsDataURL(file);
    });
  }

  async function importCustomFile(file) {
    const check = validateFile(file);
    if (!check.ok) return check;
    try {
      const customBackgroundDataUrl = await readFileAsDataUrl(file);
      return {
        ok: true,
        patch: {
          backgroundId: "custom",
          customBackgroundDataUrl,
          customBackgroundName: file.name || "background",
        },
      };
    } catch (error) {
      return { ok: false, message: error.message || "Background import failed." };
    }
  }

  window.CISProjectionBackgrounds = {
    BUNDLED,
    MAX_BYTES,
    ALLOWED_TYPES,
    listBundled,
    getBundled,
    resolveBackground,
    validateFile,
    importCustomFile,
  };
})();
