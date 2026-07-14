(function () {
  "use strict";

  const SVG_ATTRS = 'class="ui-icon" viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true" focusable="false"';

  function svg(path, extra) {
    return `<svg ${SVG_ATTRS}${extra ? ` ${extra}` : ""}>${path}</svg>`;
  }

  const ICONS = {
    search: svg('<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    star: svg('<path d="M10 2.5l1.8 4.2 4.6.4-3.5 3 1.1 4.5L10 12.8 5.9 14.6l1.1-4.5-3.5-3 4.6-.4L10 2.5z" fill="currentColor"/>'),
    starOutline: svg('<path d="M10 3.2l1.4 3.3 3.6.3-2.7 2.3.8 3.5L10 11.4 6.9 12.6l.8-3.5-2.7-2.3 3.6-.3L10 3.2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
    lock: svg('<rect x="4.5" y="9" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
    home: svg('<path d="M3 8.5 10 2l7 6.5V17a1 1 0 0 1-1 1h-4.5v-5H8.5v5H4a1 1 0 0 1-1-1V8.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
    list: svg('<path d="M3 4h14M3 10h14M3 16h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    bible: svg('<path d="M4 3.5h5.5a2 2 0 0 1 2 2V17l-3.5-2-3.5 2V5.5a2 2 0 0 0-2-2zm7 0H16.5A2 2 0 0 1 18.5 5.5V17l-3.5-2-3.5 2V5.5a2 2 0 0 0-2-2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
    plus: svg('<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    play: svg('<path d="M7 5.5v9l7.5-4.5L7 5.5z" fill="currentColor"/>'),
    camera: svg('<rect x="3" y="6" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="11" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 6l1.5-2h3L13 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
    help: svg('<circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.2 8a2.2 2.2 0 0 1 3.9 1.1c0 1.4-2.1 1.6-2.1 3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="14.8" r="0.9" fill="currentColor"/>'),
    settings: svg('<circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.5v2M10 15.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M5.4 14.6l1.4-1.4M13.2 6.8l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
    service: svg('<circle cx="10" cy="10" r="6.5" fill="currentColor" opacity="0.9"/>'),
    restore: svg('<path d="M5 6.5V3.5H8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 6.5A6 6 0 1 1 6 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
    clear: svg('<path d="M5 6h10l-1 10H6L5 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6V4.5h4V6M3 6h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
    logo: svg('<rect x="4" y="5" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 9h5v2h-5z" fill="currentColor"/>'),
    blackout: svg('<rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/>'),
  };

  const NAV_MAP = {
    home: "home",
    index: "list",
    search: "search",
    bible: "bible",
    builder: "plus",
    presenter: "play",
    cameras: "camera",
    favorites: "star",
    help: "help",
    settings: "settings",
    service: "service",
  };

  function get(name) {
    return ICONS[name] || "";
  }

  function nav(id) {
    return get(NAV_MAP[id] || "list");
  }

  window.CISUiIcons = {
    get,
    nav,
    ICONS,
  };
})();
