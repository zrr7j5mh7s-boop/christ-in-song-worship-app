(function () {
  "use strict";

  window.CISReleaseMetadata = {
    VERSION: "1.0.0-rc.1",
    BUILD_NUMBER: 1,
    RELEASE_CHANNEL: "rc",
    RELEASE_LABEL: "Release Candidate 1",
    PRODUCT_NAME: "VaChinoda Worship App",
    SHORT_NAME: "VaChinoda",
    APP_ID: "com.vachinoda.christinsong",
    displayVersion() {
      return `${this.VERSION} (${this.RELEASE_LABEL})`;
    },
  };
})();
