(function () {
  "use strict";

  const BRAND = {
    appName: "VaChinoda Worship App",
    shortName: "VaChinoda",
    productName: "VaChinoda Worship App",
    description: "Local worship presentation, hymn, Bible, media and OBS control system",
    brandMark: "VC",
    tagline: "Local worship presentation, hymn, Bible, media and OBS control",
    exportFilenamePrefix: "VaChinoda_Worship_App",
    legacyAppNames: [
      "Christ in Song Digital Worship System",
      "Christ in Song Worship System",
      "Christ in Song Worship App",
      "Christ in Song App",
    ],
    legacyShortNames: ["Christ in Song", "CIS"],
    backupFormat: "christ-in-song-backup",
    internalPackageName: "christ-in-song-worship-app",
    appId: "com.vachinoda.christinsong",
    obsSourceLabels: {
      scripture: "VaChinoda Scripture Overlay",
      hymn: "VaChinoda Hymn Overlay",
      lowerThird: "VaChinoda Lower Third",
      sermonTitle: "VaChinoda Sermon Title",
      announcement: "VaChinoda Announcement Overlay",
      presentation: "VaChinoda Presentation Output",
    },
  };

  function isLegacyAppName(name) {
    const text = String(name || "").trim();
    if (!text) return false;
    return BRAND.legacyAppNames.some((legacy) => legacy.toLowerCase() === text.toLowerCase());
  }

  function normalizeAppName(name) {
    return isLegacyAppName(name) ? BRAND.appName : (name || BRAND.appName);
  }

  function windowTitle(suffix) {
    if (!suffix) return BRAND.appName;
    return `${BRAND.shortName} · ${suffix}`;
  }

  function exportFilename(kind, stamp) {
    const date = stamp || new Date().toISOString().slice(0, 10);
    const map = {
      backup: `${BRAND.exportFilenamePrefix}_Backup_${date}`,
      service: `${BRAND.exportFilenamePrefix}_Service_Package_${date}`,
      diagnostic: `${BRAND.exportFilenamePrefix}_Diagnostic_Report_${date}`,
      worshipBuilder: `${BRAND.exportFilenamePrefix}_Worship_Builder_${date}`,
    };
    return map[kind] || `${BRAND.exportFilenamePrefix}_${date}`;
  }

  window.CISBrandConfig = {
    BRAND,
    isLegacyAppName,
    normalizeAppName,
    windowTitle,
    exportFilename,
  };
})();
