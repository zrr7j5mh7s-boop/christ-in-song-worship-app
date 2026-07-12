(function () {
  "use strict";

  const meta = document.querySelector('meta[name="cis-build"]');
  window.CIS_BUILD_PREFIX = meta && meta.content === "production" ? "./dist/" : "./";
})();
