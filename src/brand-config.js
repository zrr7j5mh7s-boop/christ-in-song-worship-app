"use strict";

module.exports = {
  appName: "VaChinoda Worship App",
  shortName: "VaChinoda",
  productName: "VaChinoda Worship App",
  description: "Local worship presentation, hymn, Bible, media and OBS control system",
  brandMark: "VC",
  exportFilenamePrefix: "VaChinoda_Worship_App",
  windowTitle(suffix) {
    return suffix ? `${this.shortName} · ${suffix}` : this.appName;
  },
  legacyAppNames: [
    "Christ in Song Digital Worship System",
    "Christ in Song Worship System",
    "Christ in Song Worship App",
    "Christ in Song App",
  ],
};
