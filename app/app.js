(function () {
  "use strict";

  const STORAGE_PREFIX = "cis-va-chinoda:";
  const electronBridge = window.electronAPI || null;
  const legacyDesktopBridge = window.ChristInSongDesktop || null;
  const desktopBridge = electronBridge || legacyDesktopBridge;
  const baseData = window.CIS_DATA || { meta: {}, languagePacks: [] };
  const extraPacks = window.CIS_EXTRA_LANGUAGE_PACKS || [];
  let importedPacks = loadJson("importedLanguagePacks", []);
  const data = {
    meta: baseData.meta || {},
    languagePacks: mergeLanguagePacks([...(baseData.languagePacks || []), ...extraPacks, ...importedPacks]),
  };
  const rangeSize = 50;
  const defaultSlots = [
    "Opening Hymn",
    "Doxology",
    "Prayer Hymn",
    "Offering Hymn",
    "Special Music",
    "Sermon Hymn",
    "Closing Hymn",
  ];
  const defaultSongServiceSlots = Array.from({ length: 15 }, (_, index) => `Song ${index + 1}`);
  const customItemTypes = [
    ["scripture", "Scripture Reading"],
    ["prayer", "Prayer"],
    ["announcement", "Announcement"],
    ["offering", "Offering Appeal"],
    ["sermon", "Sermon Title"],
    ["special", "Special Music"],
    ["note", "Service Note"],
  ];
  const serviceTemplates = [
    {
      id: "sabbath",
      name: "Sabbath Worship",
      detail: "Opening, doxology, prayer, scripture, offering, sermon, closing.",
      slots: [
        { role: "Opening Hymn" },
        { role: "Doxology" },
        { role: "Invocation", type: "custom", itemType: "prayer", title: "Opening Prayer", body: "Opening prayer" },
        { role: "Scripture Reading", type: "custom", itemType: "scripture", title: "Scripture Reading", body: "Scripture reading" },
        { role: "Offering Hymn" },
        { role: "Special Music", type: "custom", itemType: "special", title: "Special Music", body: "Special music" },
        { role: "Sermon", type: "custom", itemType: "sermon", title: "Sermon Title", body: "Sermon title" },
        { role: "Closing Hymn" },
      ],
    },
    {
      id: "prayer",
      name: "Prayer Meeting",
      detail: "Simple evening flow for hymns, scripture, requests, and prayer.",
      slots: [
        { role: "Opening Hymn" },
        { role: "Scripture Reading", type: "custom", itemType: "scripture", title: "Scripture Reading", body: "Scripture reading" },
        { role: "Prayer Requests", type: "custom", itemType: "prayer", title: "Prayer Requests", body: "Prayer requests" },
        { role: "Prayer Hymn" },
        { role: "Closing Prayer", type: "custom", itemType: "prayer", title: "Closing Prayer", body: "Closing prayer" },
      ],
    },
    {
      id: "communion",
      name: "Communion",
      detail: "Reverent service pattern for communion Sabbath.",
      slots: [
        { role: "Opening Hymn" },
        { role: "Doxology" },
        { role: "Scripture Reading", type: "custom", itemType: "scripture", title: "Communion Scripture", body: "Communion scripture" },
        { role: "Prayer Hymn" },
        { role: "Ordinance", type: "custom", itemType: "note", title: "Ordinance of Humility", body: "Ordinance of humility" },
        { role: "Communion Hymn" },
        { role: "Closing Hymn" },
      ],
    },
    {
      id: "funeral",
      name: "Funeral",
      detail: "Comfort-focused order with scripture, tribute, message, and closing.",
      slots: [
        { role: "Processional Hymn" },
        { role: "Opening Prayer", type: "custom", itemType: "prayer", title: "Opening Prayer", body: "Opening prayer" },
        { role: "Scripture Reading", type: "custom", itemType: "scripture", title: "Scripture Reading", body: "Scripture reading" },
        { role: "Tribute", type: "custom", itemType: "note", title: "Tribute", body: "Tribute" },
        { role: "Sermon", type: "custom", itemType: "sermon", title: "Message of Hope", body: "Message of hope" },
        { role: "Closing Hymn" },
      ],
    },
    {
      id: "youth",
      name: "Youth Service",
      detail: "Flexible, music-forward youth programme.",
      slots: [
        { role: "Opening Song" },
        { role: "Welcome", type: "custom", itemType: "announcement", title: "Welcome", body: "Welcome" },
        { role: "Praise Hymn" },
        { role: "Scripture Reading", type: "custom", itemType: "scripture", title: "Scripture Reading", body: "Scripture reading" },
        { role: "Special Music", type: "custom", itemType: "special", title: "Special Music", body: "Special music" },
        { role: "Message", type: "custom", itemType: "sermon", title: "Message", body: "Message" },
        { role: "Closing Song" },
      ],
    },
    {
      id: "camp",
      name: "Camp Meeting",
      detail: "Larger service with song service, announcements, appeal, and sermon.",
      slots: [
        { role: "Opening Hymn" },
        { role: "Doxology" },
        { role: "Welcome", type: "custom", itemType: "announcement", title: "Welcome", body: "Welcome" },
        { role: "Announcements", type: "custom", itemType: "announcement", title: "Announcements", body: "Announcements" },
        { role: "Offering Appeal", type: "custom", itemType: "offering", title: "Offering Appeal", body: "Offering appeal" },
        { role: "Special Music", type: "custom", itemType: "special", title: "Special Music", body: "Special music" },
        { role: "Sermon", type: "custom", itemType: "sermon", title: "Sermon Title", body: "Sermon title" },
        { role: "Appeal Hymn" },
        { role: "Closing Hymn" },
      ],
    },
  ];
  const categoryDefinitions = [
    { id: "all", label: "All", keywords: [] },
    { id: "opening", label: "Opening", keywords: ["opening", "come", "worship", "praise", "sing", "joy"] },
    { id: "praise", label: "Praise", keywords: ["praise", "hallelu", "glory", "sing", "hosanna", "tumi"] },
    { id: "prayer", label: "Prayer", keywords: ["prayer", "pray", "thandaza", "khuleka", "morena", "nkosi"] },
    { id: "offering", label: "Offering", keywords: ["offering", "give", "gift", "nikela", "mnikelo"] },
    { id: "communion", label: "Communion", keywords: ["cross", "blood", "calvary", "communion", "supper", "jesu"] },
    { id: "second-coming", label: "Second Coming", keywords: ["coming", "king", "door", "yeza", "buya", "advent"] },
    { id: "invitation", label: "Invitation", keywords: ["come", "saviour", "mercy", "grace", "today", "jesus"] },
    { id: "closing", label: "Closing", keywords: ["rest", "home", "closing", "peace", "mphumula", "amen"] },
  ];
  const navItems = [
    { id: "home", label: "Home Dashboard", icon: "⌂" },
    { id: "index", label: "Hymn Index", icon: "☰" },
    { id: "search", label: "Search", icon: "⌕" },
    { id: "builder", label: "Worship Builder", icon: "+" },
    { id: "presenter", label: "Presenter", icon: "▶" },
    { id: "favorites", label: "Favorites", icon: "★" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];
  const launchParams = new URLSearchParams(window.location.search);
  const launchView = launchParams.get("view");
  const initialView = navItems.some((item) => item.id === launchView) ? launchView : loadValue("view", "home");

  const els = {
    content: document.getElementById("content"),
    nav: document.getElementById("primaryNav"),
    title: document.getElementById("pageTitle"),
    languageSwitcher: document.getElementById("languageSwitcher"),
    modalRoot: document.getElementById("modalRoot"),
    presenterOverlay: document.getElementById("presenterOverlay"),
    emergencyOverlay: document.getElementById("emergencyOverlay"),
  };

  const state = {
    view: initialView,
    languageCode: loadValue("language", "zu"),
    songNumber: loadValue("songNumber", "001"),
    indexRange: loadValue("range", "001-050"),
    query: "",
    builderQuery: "",
    searchScope: loadValue("searchScope", "current"),
    category: loadValue("category", "all"),
    activeSlot: Number(loadValue("activeSlot", 0)) || 0,
    activeSongServiceSlot: Number(loadValue("activeSongServiceSlot", 0)) || 0,
    slideIndex: 0,
    displayMode: loadValue("displayMode", "slides"),
    fontScale: Number(loadValue("fontScale", 1)) || 1,
    notice: "",
    desktopInfo: null,
    presenter: {
      open: false,
      songKey: "",
      slideIndex: 0,
      planIndex: null,
      queueKeys: [],
      queueIndex: null,
    },
    timerSeconds: Number(loadValue("timerSeconds", 600)) || 600,
    timerRunning: loadValue("timerRunning", "false") === "true",
    timerEndsAt: Number(loadValue("timerEndsAt", 0)) || 0,
    emergencyMode: "",
  };

  let favorites = new Set(loadJson("favorites", []));
  let recents = loadJson("recents", []);
  let customTemplates = loadJson("customTemplates", []);
  let worshipPlan = normalizeWorshipPlan(loadJson("worshipPlan", null));
  let songService = normalizeSongService(loadJson("songService", null));
  state.activeSlot = Math.min(state.activeSlot, worshipPlan.length - 1);
  state.activeSongServiceSlot = Math.min(state.activeSongServiceSlot, songService.length - 1);

  function mergeLanguagePacks(packs) {
    const byCode = new Map();
    for (const pack of packs || []) {
      if (!pack || !pack.code) continue;
      byCode.set(pack.code, {
        ...pack,
        status: pack.status || "ready",
        songCount: pack.songCount || (pack.songs || []).length,
        songs: pack.songs || [],
      });
    }
    return [...byCode.values()];
  }

  function createPlanSlot(role, index, overrides = {}) {
    return {
      id: overrides.id || `slot-${index + 1}`,
      role,
      type: overrides.type || "song",
      itemType: overrides.itemType || "",
      title: overrides.title || "",
      body: overrides.body || "",
      notes: overrides.notes || "",
      songKey: overrides.songKey || "",
    };
  }

  function createDefaultPlan() {
    return defaultSlots.map((role, index) => createPlanSlot(role, index));
  }

  function createDefaultSongService() {
    return defaultSongServiceSlots.map((role, index) => ({
      id: `song-service-${index + 1}`,
      role,
      songKey: "",
    }));
  }

  function normalizePlanSlot(slot, index, fallbackRole) {
    const source = slot || {};
    const isCustom = source.type === "custom" || source.itemType || source.body || source.title;
    return createPlanSlot(source.role || fallbackRole || `Item ${index + 1}`, index, {
      id: source.id || `slot-${index + 1}`,
      type: isCustom ? "custom" : "song",
      itemType: source.itemType || "",
      title: source.title || "",
      body: source.body || "",
      notes: source.notes || "",
      songKey: isCustom ? "" : (source.songKey || ""),
    });
  }

  function normalizeWorshipPlan(plan) {
    if (!Array.isArray(plan)) return createDefaultPlan();
    const legacyRoles = new Set([...defaultSlots, "Praise Hymn 1", "Praise Hymn 2"]);
    const looksLikeLegacyDefault = plan.length === defaultSlots.length
      && plan.every((slot) => slot && legacyRoles.has(slot.role || ""))
      && !plan.some((slot) => slot && (slot.type === "custom" || slot.itemType || slot.body || slot.title));
    if (!looksLikeLegacyDefault || plan.length !== defaultSlots.length) {
      return plan.map((slot, index) => normalizePlanSlot(slot, index, slot && slot.role));
    }
    return defaultSlots.map((role, index) => {
      let source = plan.find((slot) => slot && slot.role === role);
      if (role === "Doxology") {
        source = source || plan.find((slot) => slot && ["Praise Hymn 1", "Praise Hymn 2"].includes(slot.role) && slot.songKey);
      }
      return normalizePlanSlot(source, index, role);
    });
  }

  function normalizeSongService(plan) {
    if (!Array.isArray(plan)) return createDefaultSongService();
    return defaultSongServiceSlots.map((role, index) => {
      const source = plan[index] || {};
      return {
        id: `song-service-${index + 1}`,
        role: source.role || role,
        songKey: source.songKey || "",
      };
    });
  }

  function storageKey(key) {
    return STORAGE_PREFIX + key;
  }

  function loadValue(key, fallback) {
    try {
      const value = localStorage.getItem(storageKey(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function saveValue(key, value) {
    try {
      localStorage.setItem(storageKey(key), String(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function loadJson(key, fallback) {
    try {
      const value = localStorage.getItem(storageKey(key));
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  function plain(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function lyricHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function itemTypeLabel(type) {
    return (customItemTypes.find((item) => item[0] === type) || ["", "Service Item"])[1];
  }

  function getPack(code = state.languageCode) {
    return data.languagePacks.find((pack) => pack.code === code) || data.languagePacks[0] || { songs: [] };
  }

  function getSongs(code = state.languageCode) {
    return getPack(code).songs || [];
  }

  function paddedNumber(value) {
    return String(value).padStart(3, "0");
  }

  function rangeOptions(pack = getPack()) {
    const songs = pack.songs || [];
    const maxNumber = songs.reduce((max, song) => Math.max(max, Number(song.number) || 0), 0);
    const upper = Math.max(rangeSize, maxNumber);
    const options = [];
    for (let start = 1; start <= upper; start += rangeSize) {
      const end = Math.min(start + rangeSize - 1, upper);
      options.push([`${paddedNumber(start)}-${paddedNumber(end)}`, start, end]);
    }
    return options;
  }

  function activeRangeKey(pack = getPack()) {
    const options = rangeOptions(pack);
    return options.some((range) => range[0] === state.indexRange) ? state.indexRange : options[0][0];
  }

  function makeSongKey(code, number) {
    return `${code}:${number}`;
  }

  function parseSongKey(key) {
    const parts = String(key || "").split(":");
    return { code: parts[0] || state.languageCode, number: parts[1] || "" };
  }

  function getSong(number, code = state.languageCode) {
    return getSongs(code).find((song) => song.number === String(number).padStart(3, "0")) || null;
  }

  function getSongByKey(key) {
    const parsed = parseSongKey(key);
    return getSong(parsed.number, parsed.code);
  }

  function selectedSong() {
    return getSong(state.songNumber);
  }

  function ensureSelectedSong() {
    const songs = getSongs();
    if (!songs.length) return null;
    const found = selectedSong();
    if (found) return found;
    state.songNumber = songs[0].number;
    saveValue("songNumber", state.songNumber);
    return songs[0];
  }

  function viewTitle() {
    if (state.view === "song") {
      const song = selectedSong();
      return song ? `Hymn ${song.number}` : "Hymn";
    }
    const item = navItems.find((nav) => nav.id === state.view);
    return item ? item.label : "Home Dashboard";
  }

  function songKey(song, code = state.languageCode) {
    return makeSongKey(code, song.number);
  }

  function addRecent(song, code = state.languageCode) {
    if (!song) return;
    const key = songKey(song, code);
    recents = [key, ...recents.filter((item) => item !== key)].slice(0, 16);
    saveJson("recents", recents);
  }

  function searchSongs(query, limit, code = state.languageCode, useCategory = false) {
    const songs = getSongs(code);
    const q = plain(query).toLowerCase();
    const results = q
      ? songs.filter((song) => (song.searchText || `${song.number} ${song.title}`.toLowerCase()).includes(q))
      : songs;
    const filtered = useCategory ? filterByCategory(results) : results;
    return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  }

  function allSearchResults(query, limit = 120) {
    const q = plain(query).toLowerCase();
    const results = [];
    for (const pack of data.languagePacks) {
      if (pack.status !== "ready") continue;
      for (const song of pack.songs || []) {
        const haystack = song.searchText || `${song.number} ${song.title}`.toLowerCase();
        if (!q || haystack.includes(q)) results.push({ song, code: pack.code, pack });
      }
    }
    return filterByCategory(results, (item) => item.song).slice(0, limit);
  }

  function filterByCategory(items, getSongItem = (song) => song) {
    if (state.category === "all") return items;
    return items.filter((item) => matchesCategory(getSongItem(item), state.category));
  }

  function matchesCategory(song, categoryId) {
    const category = categoryDefinitions.find((item) => item.id === categoryId);
    if (!category || !category.keywords.length) return true;
    const text = (song.searchText || `${song.number} ${song.title}`).toLowerCase();
    return category.keywords.some((keyword) => text.includes(keyword));
  }

  function resultSnippet(song, query) {
    const q = plain(query).toLowerCase();
    const sections = song.sections || [];
    const section = q ? sections.find((item) => item.body.toLowerCase().includes(q)) : sections[0];
    const text = plain((section && section.body) || (sections[0] && sections[0].body) || song.title);
    if (!q) return escapeHtml(text.slice(0, 170));
    const index = text.toLowerCase().indexOf(q);
    if (index < 0) return escapeHtml(text.slice(0, 170));
    const start = Math.max(0, index - 55);
    const end = Math.min(text.length, index + q.length + 95);
    const before = escapeHtml((start > 0 ? "..." : "") + text.slice(start, index));
    const match = escapeHtml(text.slice(index, index + q.length));
    const after = escapeHtml(text.slice(index + q.length, end) + (end < text.length ? "..." : ""));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function rangeSongs(rangeKey, query) {
    const options = rangeOptions();
    const range = options.find((item) => item[0] === rangeKey) || options[0];
    return searchSongs(query).filter((song) => {
      const number = Number(song.number);
      return number >= range[1] && number <= range[2];
    });
  }

  function compactSource(source) {
    return source ? source.replace(/^ppt\/slides\//, "") : "Awaiting upload";
  }

  function isCustomSlot(slot) {
    return slot && slot.type === "custom";
  }

  function slotSong(slot) {
    return slot && slot.songKey ? getSongByKey(slot.songKey) : null;
  }

  function slotHasContent(slot) {
    if (!slot) return false;
    if (isCustomSlot(slot)) return !!plain(`${slot.title} ${slot.body}`);
    return !!slotSong(slot);
  }

  function slotTitle(slot) {
    if (!slot) return "";
    const song = slotSong(slot);
    if (song) return `Hymn ${song.number} · ${song.title}`;
    return slot.title || slot.role || itemTypeLabel(slot.itemType);
  }

  function slotSubtitle(slot) {
    if (!slot) return "";
    const song = slotSong(slot);
    if (song) return `${song.slides.length} slides · ${getPack(parseSongKey(slot.songKey).code).name}`;
    return `${itemTypeLabel(slot.itemType)} · ${plain(slot.body).slice(0, 80) || "Custom slide"}`;
  }

  function slotSlides(slot) {
    const song = slotSong(slot);
    if (song) return song.slides;
    if (!isCustomSlot(slot)) return [];
    const chunks = String(slot.body || slot.title || slot.role)
      .split(/\n-{3,}\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const slides = chunks.length ? chunks : [slot.title || slot.role || itemTypeLabel(slot.itemType)];
    return slides.map((body, index) => ({
      kind: "custom",
      label: index === 0 ? itemTypeLabel(slot.itemType) : `${itemTypeLabel(slot.itemType)} ${index + 1}`,
      marker: "",
      body,
      sourceSlide: "Custom",
      slideInHymn: index + 1,
      totalSlides: slides.length,
    }));
  }

  function timerRemaining() {
    if (!state.timerRunning) return Math.max(0, state.timerSeconds);
    return Math.max(0, Math.ceil((state.timerEndsAt - Date.now()) / 1000));
  }

  function formatDuration(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function downloadText(filename, text, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function render() {
    ensureSelectedSong();
    renderNav();
    renderLanguageSwitcher();
    els.title.textContent = viewTitle();
    els.content.innerHTML = `${renderNotice()}${renderView()}`;
    renderPresenterOverlay();
    renderEmergencyOverlay();
    document.body.classList.add("app-ready");
  }

  function renderNotice() {
    if (!state.notice) return "";
    return `<div class="app-notice" role="status">${escapeHtml(state.notice)}</div>`;
  }

  function setNotice(message) {
    state.notice = message || "";
    render();
    if (message) {
      window.clearTimeout(setNotice.timer);
      setNotice.timer = window.setTimeout(() => {
        if (state.notice === message) {
          state.notice = "";
          render();
        }
      }, 5200);
    }
  }

  function renderNav() {
    els.nav.innerHTML = navItems.map((item) => `
      <button class="rail-btn ${state.view === item.id ? "active" : ""}" type="button" data-view="${item.id}">
        <span class="ico" aria-hidden="true">${item.icon}</span>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `).join("");
  }

  function renderLanguageSwitcher() {
    els.languageSwitcher.innerHTML = data.languagePacks.map((pack) => {
      const active = pack.code === state.languageCode ? "active" : "";
      const status = pack.status === "ready" ? "ready" : "awaiting";
      const label = pack.status === "ready" ? `${pack.name} (${pack.songCount})` : `${pack.name}`;
      return `<button class="language-button ${status} ${active}" type="button" data-lang="${escapeHtml(pack.code)}">${escapeHtml(label)}</button>`;
    }).join("");
  }

  function renderView() {
    if (state.view === "index") return renderIndex();
    if (state.view === "search") return renderSearch();
    if (state.view === "song") return renderSong();
    if (state.view === "builder") return renderBuilder();
    if (state.view === "presenter") return renderPresenterDashboard();
    if (state.view === "favorites") return renderFavorites();
    if (state.view === "settings") return renderSettings();
    return renderHome();
  }

  function renderHome() {
    const pack = getPack();
    const ranges = rangeOptions(pack);
    const readyPacks = data.languagePacks.filter((item) => item.status === "ready").length;
    const firstAssigned = firstAssignedSlot();
    const current = selectedSong();
    const recent = recents.map((key) => ({ key, song: getSongByKey(key) })).find((item) => item.song);
    const favoriteCount = [...favorites].filter((key) => getSongByKey(key)).length;
    const assignedCount = assignedSlots().length;
    return `
      <section class="hero worship-hero">
        <p class="eyebrow">Christ in Song · VaChinoda Edition</p>
        <h2>Your worship, ready to lead.</h2>
        <p>Search, build a Sabbath order of service, and present any hymn full-screen in the navy and gold worship theme.</p>
        <label class="hero-search">
          <span aria-hidden="true">⌕</span>
          <input id="homeSearchInput" type="search" value="" placeholder="Search by number, title, or a line of lyrics...">
        </label>
        <div class="stat-row">
          <div class="stat-chip"><strong>${pack.songCount || 0}</strong><span>${escapeHtml(pack.name || "Language")} hymns</span></div>
          <div class="stat-chip"><strong>${favoriteCount}</strong><span>Favorites</span></div>
          <div class="stat-chip"><strong>${assignedCount}</strong><span>In today's set</span></div>
        </div>
      </section>
      ${recent ? `
        <div class="continue-strip">
          <div>
            <span>Continue reading</span>
            <strong>${escapeHtml(getPack(parseSongKey(recent.key).code).name)} · Hymn ${escapeHtml(recent.song.number)} · ${escapeHtml(recent.song.title)}</strong>
          </div>
          <button type="button" data-song="${escapeHtml(recent.song.number)}" data-lang-jump="${escapeHtml(parseSongKey(recent.key).code)}">Open</button>
        </div>
      ` : ""}
      <div class="dashboard-grid">
        <section class="section">
          <div class="metric-row">
            <div class="metric"><strong>${pack.songCount || 0}</strong><span>${escapeHtml(pack.name || "Language")} hymns</span></div>
            <div class="metric"><strong>${data.meta.deckSlideCount || 0}</strong><span>Source slides integrated</span></div>
            <div class="metric"><strong>${readyPacks}/${data.languagePacks.length}</strong><span>Language packs ready</span></div>
          </div>
          <div class="command-grid">
            ${commandCard("index", "☰", "Hymn Index", "Browse by 50-hymn ranges")}
            ${commandCard("search", "⌕", "Search Centre", "Find titles, numbers, and lyrics")}
            ${commandCard("builder", "+", "Worship Builder", "Prepare the service order")}
            ${commandCard("favorites", "★", "Favorites", "Open saved hymns")}
            ${commandCard("presenter", "▶", "Presenter Dashboard", "Run the current worship flow")}
            ${commandCard("settings", "⚙", "Language Packs", "Manage multilingual hymn libraries")}
          </div>
        </section>
        <aside class="panel">
          <h2>Quick Jump</h2>
          <div class="range-grid">
            ${ranges.map((range) => `<button class="range-button" type="button" data-command="range-open" data-range="${range[0]}">${range[0]}</button>`).join("")}
          </div>
          <hr>
          <h3>Live Service</h3>
          ${firstAssigned ? renderCurrentSlot(firstAssigned) : renderCurrentSong(current)}
          <div class="button-row">
            <button class="action-button" type="button" data-command="present-current">Present</button>
            <button class="secondary-button" type="button" data-view="builder">Worship Builder</button>
          </div>
        </aside>
      </div>
    `;
  }

  function commandCard(view, icon, title, detail) {
    return `
      <button class="command-card" type="button" data-view="${view}">
        <span class="command-icon" aria-hidden="true">${icon}</span>
        <span>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(detail)}</span>
        </span>
      </button>
    `;
  }

  function renderCurrentSong(song) {
    if (!song) return `<div class="empty-state">No hymn selected for this language.</div>`;
    return `
      <div class="result-item" data-song="${song.number}">
        <strong>Current Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
        <small>${song.slides.length} presentation slides</small>
      </div>
    `;
  }

  function renderCurrentSlot(slotInfo) {
    const song = getSongByKey(slotInfo.slot.songKey);
    if (!slotHasContent(slotInfo.slot)) return "";
    return `
      <div class="result-item" ${song ? `data-song="${song.number}" data-lang-jump="${parseSongKey(slotInfo.slot.songKey).code}"` : `data-command="present-plan-slot" data-slot="${slotInfo.index}"`}>
        <strong>${escapeHtml(slotInfo.slot.role)}</strong>
        <span>${escapeHtml(slotTitle(slotInfo.slot))}</span>
        <small>${escapeHtml(slotSubtitle(slotInfo.slot))}</small>
      </div>
    `;
  }

  function renderIndex() {
    const pack = getPack();
    if (pack.status !== "ready") return renderAwaitingPack(pack);
    const ranges = rangeOptions(pack);
    const activeRange = activeRangeKey(pack);
    const songs = rangeSongs(activeRange, state.query);
    return `
      <section class="section">
        <div class="toolbar">
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="indexSearchInput" type="search" value="${escapeHtml(state.query)}" placeholder="Search hymns">
          </label>
          <div class="tab-row">
            ${ranges.map((range) => `<button class="range-button ${activeRange === range[0] ? "active" : ""}" type="button" data-command="set-range" data-range="${range[0]}">${range[0]}</button>`).join("")}
          </div>
        </div>
        <div class="tile-grid">
          ${songs.map(renderSongCard).join("") || `<div class="empty-state">No hymns match this search.</div>`}
        </div>
      </section>
    `;
  }

  function renderSongCard(song) {
    const key = songKey(song);
    const starred = favorites.has(key);
    return `
      <button class="tile song-tile" type="button" data-song="${song.number}">
        ${starred ? '<span class="star" aria-hidden="true">★</span>' : ""}
        <span class="tnum">${escapeHtml(song.number)}</span>
        <span class="ttitle">${escapeHtml(song.title)}</span>
      </button>
    `;
  }

  function renderSearch() {
    const pack = getPack();
    if (pack.status !== "ready" && state.searchScope !== "all") return renderAwaitingPack(pack);
    const results = state.searchScope === "all"
      ? allSearchResults(state.query, 120)
      : searchSongs(state.query, 80, state.languageCode, true).map((song) => ({ song, code: state.languageCode, pack }));
    return `
      <section class="section">
        <div class="toolbar">
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="globalSearchInput" type="search" value="${escapeHtml(state.query)}" placeholder="Search number, title, verse, or chorus">
          </label>
          <div class="segmented-control" aria-label="Search scope">
            <button class="${state.searchScope === "current" ? "active" : ""}" type="button" data-command="set-search-scope" data-scope="current">Current</button>
            <button class="${state.searchScope === "all" ? "active" : ""}" type="button" data-command="set-search-scope" data-scope="all">All Languages</button>
          </div>
          <span class="muted">${results.length} result${results.length === 1 ? "" : "s"}</span>
        </div>
        <div class="filter-row">
          ${categoryDefinitions.map((category) => `<button class="filter-chip ${state.category === category.id ? "active" : ""}" type="button" data-command="set-category" data-category="${category.id}">${escapeHtml(category.label)}</button>`).join("")}
        </div>
        <div class="result-list">
          ${results.map((item) => renderSearchResult(item.song, item.code, item.pack)).join("") || `<div class="empty-state">No hymns match this search.</div>`}
        </div>
      </section>
    `;
  }

  function renderSearchResult(song, code = state.languageCode, pack = getPack(code)) {
    return `
      <button class="result-item" type="button" data-song="${song.number}" data-lang-jump="${escapeHtml(code)}">
        <strong>${escapeHtml(pack.name || "Language")} · Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
        <small>${resultSnippet(song, state.query)}</small>
      </button>
    `;
  }

  function renderSong() {
    const song = ensureSelectedSong();
    if (!song) return renderAwaitingPack(getPack());
    const key = songKey(song);
    const isFavorite = favorites.has(key);
    const slide = song.slides[Math.min(state.slideIndex, song.slides.length - 1)] || song.slides[0];
    const fontSize = Math.round(42 * state.fontScale);
    return `
      <div class="song-layout">
        <section class="section">
          <div class="song-header">
            <div class="song-title-block reader-badge">
              <span class="reader-numtile" aria-hidden="true">${escapeHtml(song.number)}</span>
              <div>
                <p class="eyebrow">${escapeHtml(getPack().name)}</p>
                <h2>${escapeHtml(song.title)}</h2>
                <p class="muted">${song.slides.length} presentation slides · ${song.sections.length} unique sections</p>
              </div>
            </div>
            <div class="song-actions">
              <button class="secondary-button" type="button" data-command="toggle-favorite">${isFavorite ? "★ Saved" : "☆ Save"}</button>
              <button class="secondary-button" type="button" data-command="open-slot-picker">Add to Set</button>
              <button class="action-button" type="button" data-command="present-song">Present</button>
            </div>
          </div>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="set-display" data-mode="slides">Slides</button>
            <button class="secondary-button" type="button" data-command="set-display" data-mode="sections">Sections</button>
            <span class="font-controls">
              <button class="secondary-button" type="button" data-command="font-down" title="Smaller text">A-</button>
              <button class="secondary-button" type="button" data-command="font-reset" title="Reset text">A</button>
              <button class="secondary-button" type="button" data-command="font-up" title="Larger text">A+</button>
            </span>
          </div>
          ${state.displayMode === "sections" ? renderSections(song) : renderSlideStage(song, slide, fontSize)}
        </section>
        <aside class="panel">
          <h3>Slides</h3>
          <div class="slide-list">
            ${song.slides.map((item, index) => renderSlideChip(item, index)).join("")}
          </div>
        </aside>
      </div>
    `;
  }

  function renderSlideStage(song, slide, fontSize) {
    const current = state.slideIndex + 1;
    return `
      <div class="lyric-stage" style="--stage-font: ${fontSize}px">
        <div class="stage-top">
          <div>
            <div class="stage-label">${escapeHtml(slide.label)}</div>
            <div>Hymn ${escapeHtml(song.number)} · ${escapeHtml(song.title)}</div>
          </div>
          <div class="stage-count">${current} of ${song.slides.length}</div>
        </div>
        <div class="lyric-body">${lyricHtml(slide.body)}</div>
        <div class="stage-bottom">
          <button class="stage-nav" type="button" data-command="prev-slide" ${state.slideIndex === 0 ? "disabled" : ""}>‹ Prev</button>
          <span class="stage-count">Source slide ${escapeHtml(slide.sourceSlide)}</span>
          <button class="stage-nav" type="button" data-command="next-slide" ${state.slideIndex >= song.slides.length - 1 ? "disabled" : ""}>Next ›</button>
        </div>
      </div>
    `;
  }

  function renderSlideChip(slide, index) {
    return `
      <button class="slide-chip ${index === state.slideIndex ? "active" : ""}" type="button" data-slide="${index}">
        <strong>${escapeHtml(index + 1)}. ${escapeHtml(slide.label)}</strong>
        <span>${escapeHtml(plain(slide.body).slice(0, 80))}</span>
      </button>
    `;
  }

  function renderSections(song) {
    return `
      <div class="stanza-list">
        ${song.sections.map((section) => `
          <article class="stanza ${section.kind}">
            <div class="slabel">${escapeHtml(section.label)}</div>
            <div class="stext">${lyricHtml(section.body)}</div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderBuilder() {
    const pack = getPack();
    const current = selectedSong();
    const results = pack.status === "ready" ? searchSongs(state.builderQuery, 32) : [];
    const songServiceAssigned = assignedSongServiceSlots();
    const allTemplates = [...serviceTemplates, ...customTemplates];
    return `
      <section class="section opens-service">
        <div class="song-header">
          <div>
            <p class="eyebrow">Opens the Service</p>
            <h2>Song Service</h2>
            <p class="muted">Up to fifteen hymns sung to gather the congregation before the main order begins.</p>
          </div>
          <div class="song-actions">
            ${current ? `<button class="secondary-button" type="button" data-command="assign-current-service">Use Hymn ${escapeHtml(current.number)}</button>` : ""}
            <button class="action-button" type="button" data-command="present-song-service">Present Song Service</button>
            <button class="secondary-button" type="button" data-command="clear-song-service">Clear Song Service</button>
          </div>
        </div>
        <div class="service-summary">${songServiceAssigned.length} of ${songService.length} opening songs assigned</div>
        <div class="song-service-list">
          ${songService.map(renderSongServiceRow).join("")}
        </div>
      </section>
      <div class="builder-grid">
        <section class="section">
          <div class="song-header">
            <div>
              <h2>Worship Builder</h2>
              <p class="muted">${assignedSlots().length} of ${worshipPlan.length} service items ready</p>
            </div>
            <div class="song-actions">
              <button class="action-button" type="button" data-command="open-custom-item">Add Item</button>
              <button class="secondary-button" type="button" data-command="save-template">Save Template</button>
              <button class="secondary-button" type="button" data-command="copy-plan">Copy Builder</button>
              <button class="secondary-button" type="button" data-command="export-plan">Export Builder</button>
              <button class="secondary-button" type="button" data-command="export-bulletin">Export Bulletin</button>
              <button class="secondary-button" type="button" data-command="import-plan">Import Builder</button>
              <button class="secondary-button" type="button" data-command="print-set">Print</button>
              <button class="danger-button" type="button" data-command="clear-plan">Clear</button>
              <input id="worshipPlanImport" class="hidden" type="file" accept="application/json">
            </div>
          </div>
          <div class="set-list">
            ${worshipPlan.map(renderPlanRow).join("")}
          </div>
        </section>
        <aside class="panel">
          <h3>Service Templates</h3>
          <div class="template-list">
            ${allTemplates.map((template) => `
              <button class="template-button" type="button" data-command="load-template" data-template="${escapeHtml(template.id)}">
                <strong>${escapeHtml(template.name)}</strong>
                <span>${escapeHtml(template.detail || `${template.slots.length} service items`)}</span>
              </button>
            `).join("")}
          </div>
          <hr>
          <h3>Assign Hymn</h3>
          <p class="muted">Builder: ${escapeHtml(worshipPlan[state.activeSlot]?.role || worshipPlan[0].role)} · Song Service: ${escapeHtml(songService[state.activeSongServiceSlot]?.role || songService[0].role)}</p>
          ${current ? `<button class="action-button" type="button" data-command="assign-current">Use Hymn ${escapeHtml(current.number)}</button>` : ""}
          ${current ? `<button class="secondary-button" type="button" data-command="assign-current-service">Use Hymn ${escapeHtml(current.number)} in Song Service</button>` : ""}
          <hr>
          <label class="search-box">
            <span aria-hidden="true">⌕</span>
            <input id="builderSearchInput" type="search" value="${escapeHtml(state.builderQuery)}" placeholder="Find a hymn">
          </label>
          <div class="result-list">
            ${results.map((song) => `
              <div class="result-item result-choice">
                <button type="button" data-command="assign-song" data-song="${song.number}">
                  <strong>Hymn ${escapeHtml(song.number)}</strong>
                  <span>${escapeHtml(song.title)}</span>
                </button>
                <button type="button" data-command="assign-service-song" data-song="${song.number}">Song Service</button>
              </div>
            `).join("") || `<div class="empty-state">No hymns available in this language.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderPlanRow(slot, index) {
    const song = getSongByKey(slot.songKey);
    const custom = isCustomSlot(slot);
    const active = state.activeSlot === index ? "active" : "";
    return `
      <div class="set-row ${active} ${custom ? "custom-row" : ""}">
        <div class="set-number">${index + 1}</div>
        <button class="slot-button ${active}" type="button" data-command="activate-slot" data-slot="${index}">${escapeHtml(slot.role)}</button>
        <div class="set-song ${slotHasContent(slot) ? "assigned" : ""}">
          ${slotHasContent(slot) ? `${escapeHtml(slotTitle(slot))}<small>${escapeHtml(slotSubtitle(slot))}</small>` : "No hymn assigned"}
        </div>
        <div class="mini-actions">
          ${slotHasContent(slot) ? `<button type="button" data-command="present-plan-slot" data-slot="${index}" title="Present">▶</button>` : ""}
          ${song ? `<button type="button" data-command="open-plan-song" data-slot="${index}" title="Open">↗</button>` : ""}
          ${custom ? `<button type="button" data-command="edit-custom-item" data-slot="${index}" title="Edit">✎</button>` : ""}
          <button type="button" data-command="move-slot-up" data-slot="${index}" title="Move up">↑</button>
          <button type="button" data-command="move-slot-down" data-slot="${index}" title="Move down">↓</button>
          <button type="button" data-command="remove-slot-song" data-slot="${index}" title="Remove">×</button>
        </div>
      </div>
    `;
  }

  function renderSongServiceRow(slot, index) {
    const song = getSongByKey(slot.songKey);
    const active = state.activeSongServiceSlot === index ? "active" : "";
    return `
      <div class="set-row song-service-row ${active}">
        <div class="set-number">${index + 1}</div>
        <button class="slot-button ${active}" type="button" data-command="activate-service-slot" data-service-slot="${index}">${escapeHtml(slot.role)}</button>
        <div class="set-song ${song ? "assigned" : ""}">${song ? `Hymn ${escapeHtml(song.number)} · ${escapeHtml(song.title)}` : "No hymn assigned"}</div>
        <div class="mini-actions">
          ${song ? `<button type="button" data-command="present-service-slot" data-service-slot="${index}" title="Present">▶</button>` : ""}
          ${song ? `<button type="button" data-command="open-service-song" data-service-slot="${index}" title="Open">↗</button>` : ""}
          <button type="button" data-command="move-service-up" data-service-slot="${index}" title="Move up">↑</button>
          <button type="button" data-command="move-service-down" data-service-slot="${index}" title="Move down">↓</button>
          <button type="button" data-command="remove-service-song" data-service-slot="${index}" title="Remove">×</button>
        </div>
      </div>
    `;
  }

  function assignedSlots() {
    return worshipPlan
      .map((slot, index) => ({ slot, index }))
      .filter((item) => slotHasContent(item.slot));
  }

  function assignedSongServiceSlots() {
    return songService
      .map((slot, index) => ({ slot, index }))
      .filter((item) => item.slot.songKey && getSongByKey(item.slot.songKey));
  }

  function firstAssignedSlot() {
    return assignedSlots()[0] || null;
  }

  function renderPresenterDashboard() {
    const assigned = assignedSlots();
    const currentInfo = assigned.find((item) => item.index === state.activeSlot) || assigned[0] || null;
    const currentSong = currentInfo ? getSongByKey(currentInfo.slot.songKey) : selectedSong();
    const nextInfo = currentInfo ? assigned.find((item) => item.index > currentInfo.index) : null;
    const remaining = timerRemaining();
    const time = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date());
    return `
      <div class="operator-grid">
        <section class="section">
          <p class="eyebrow">Clock ${escapeHtml(time)}</p>
          <h2>${currentInfo ? `Current: ${escapeHtml(slotTitle(currentInfo.slot))}` : currentSong ? `Current: Hymn ${escapeHtml(currentSong.number)} · ${escapeHtml(currentSong.title)}` : "Current: No hymn selected"}</h2>
          <p class="muted">${nextInfo ? `Next: ${escapeHtml(slotTitle(nextInfo.slot))}` : "Next: Not assigned"}</p>
          <div class="button-row">
            <button class="action-button" type="button" data-command="present-current">Present Current</button>
            <button class="secondary-button" type="button" data-command="emergency-black">Black Screen</button>
            <button class="secondary-button" type="button" data-command="emergency-white">White Screen</button>
            <button class="secondary-button" type="button" data-command="emergency-logo">Logo Screen</button>
          </div>
          <div class="operator-preview-grid">
            <article class="preview-card">
              <span>Current Preview</span>
              <strong>${currentInfo ? escapeHtml(slotTitle(currentInfo.slot)) : currentSong ? `Hymn ${escapeHtml(currentSong.number)}` : "No item"}</strong>
              <p>${escapeHtml(currentInfo ? plain(slotSlides(currentInfo.slot)[0]?.body).slice(0, 170) : currentSong ? plain(currentSong.slides[0]?.body).slice(0, 170) : "Build a service queue first.")}</p>
            </article>
            <article class="preview-card next">
              <span>Next Preview</span>
              <strong>${nextInfo ? escapeHtml(slotTitle(nextInfo.slot)) : "End of queue"}</strong>
              <p>${escapeHtml(nextInfo ? plain(slotSlides(nextInfo.slot)[0]?.body).slice(0, 170) : "No next item assigned.")}</p>
            </article>
            <article class="timer-card">
              <span>Countdown</span>
              <strong>${formatDuration(remaining)}</strong>
              <div class="button-row">
                <button class="secondary-button" type="button" data-command="timer-minus">-5</button>
                <button class="secondary-button" type="button" data-command="timer-plus">+5</button>
                <button class="action-button" type="button" data-command="timer-toggle">${state.timerRunning ? "Pause" : "Start"}</button>
                <button class="secondary-button" type="button" data-command="timer-reset">Reset</button>
              </div>
            </article>
          </div>
          <hr>
          <div class="set-list">
            ${worshipPlan.map(renderPlanRow).join("")}
          </div>
        </section>
        <aside class="panel">
          <h3>Presenter Queue</h3>
          <div class="result-list">
            ${assigned.map((item) => {
              const song = getSongByKey(item.slot.songKey);
              return `
                <button class="result-item" type="button" data-command="present-plan-slot" data-slot="${item.index}">
                  <strong>${escapeHtml(item.slot.role)}</strong>
                  <span>${escapeHtml(slotTitle(item.slot))}</span>
                  <small>${escapeHtml(song ? `${song.slides.length} slides` : slotSubtitle(item.slot))}</small>
                </button>
              `;
            }).join("") || `<div class="empty-state">Build a worship builder order to create a queue.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderFavorites() {
    const favoriteSongs = [...favorites].map((key) => ({ key, song: getSongByKey(key) })).filter((item) => item.song);
    const recentSongs = recents.map((key) => ({ key, song: getSongByKey(key) })).filter((item) => item.song);
    return `
      <div class="dashboard-grid">
        <section class="section">
          <h2>Favorites</h2>
          <div class="tile-grid">
            ${favoriteSongs.map((item) => renderStoredSongCard(item.key, item.song)).join("") || `<div class="empty-state">No favorites saved yet.</div>`}
          </div>
        </section>
        <aside class="panel">
          <h3>Recently Used</h3>
          <div class="result-list">
            ${recentSongs.map((item) => renderStoredResult(item.key, item.song)).join("") || `<div class="empty-state">No recent hymns yet.</div>`}
          </div>
        </aside>
      </div>
    `;
  }

  function renderStoredSongCard(key, song) {
    const parsed = parseSongKey(key);
    return `
      <button class="tile song-tile" type="button" data-song="${song.number}" data-lang-jump="${parsed.code}">
        <span class="star" aria-hidden="true">★</span>
        <span class="tnum">${escapeHtml(song.number)}</span>
        <span class="ttitle">${escapeHtml(song.title)}</span>
        <small class="tile-meta">${escapeHtml(getPack(parsed.code).name)}</small>
      </button>
    `;
  }

  function renderStoredResult(key, song) {
    const parsed = parseSongKey(key);
    return `
      <button class="result-item" type="button" data-song="${song.number}" data-lang-jump="${parsed.code}">
        <strong>${escapeHtml(getPack(parsed.code).name)} · Hymn ${escapeHtml(song.number)}</strong>
        <span>${escapeHtml(song.title)}</span>
      </button>
    `;
  }

  function renderSettings() {
    return `
      <div class="dashboard-grid">
        <section class="section">
          <h2>Language Packs</h2>
          <div class="import-zone" data-command="import-language-pack">
            <strong>Import Language Pack</strong>
            <span>Drop a Christ in Song JSON pack here, or choose a file. PowerPoint packs can be converted by Codex and added as JSON.</span>
            <button class="secondary-button" type="button" data-command="import-language-pack">Choose JSON Pack</button>
            <input id="languagePackImport" class="hidden" type="file" accept=".json,application/json,.pptx">
          </div>
          <div class="language-status">
            ${data.languagePacks.map((pack) => `
              <div class="language-row">
                <strong>${escapeHtml(pack.name)}</strong>
                <span class="status-pill ${pack.status === "ready" ? "ready" : "awaiting"}">${pack.status === "ready" ? `${pack.songCount} hymns` : "Awaiting upload"}</span>
                <span class="muted">${escapeHtml(compactSource(pack.source))}</span>
              </div>
            `).join("")}
          </div>
        </section>
        <aside class="panel">
          <h3>Local Worship Data</h3>
          <p class="muted">Favorites: ${favorites.size} · Recent hymns: ${recents.length} · Builder items: ${assignedSlots().length} · Opening songs: ${assignedSongServiceSlots().length}</p>
          <div class="button-row">
            <button class="action-button" type="button" data-command="export-backup">Export Backup</button>
            <button class="secondary-button" type="button" data-command="restore-backup">Restore Backup</button>
            <button class="danger-button" type="button" data-command="reset-local-data">Reset Local Data</button>
            <input id="backupImport" class="hidden" type="file" accept="application/json,.json">
          </div>
          <hr>
          <h3>Install & Offline</h3>
          <p class="muted">This app includes a web app manifest and service worker so it can be installed by supported browsers and cached for offline worship use.</p>
          <div class="button-row">
            <button class="secondary-button" type="button" data-command="install-app">Install App</button>
          </div>
          ${desktopBridge ? `
            <hr>
            <h3>Desktop App</h3>
            <p class="muted">Native desktop mode is active${state.desktopInfo ? ` · Version ${escapeHtml(state.desktopInfo.version)} · ${escapeHtml(state.desktopInfo.platform)}` : ""}.</p>
            <div class="button-row">
              <button class="secondary-button" type="button" data-command="check-updates">Check Updates</button>
            </div>
          ` : ""}
          <hr>
          <h3>Source Integration</h3>
          <p class="muted">${escapeHtml((data.meta.generatedFrom || []).join(" + "))}</p>
        </aside>
      </div>
    `;
  }

  function renderAwaitingPack(pack) {
    return `
      <section class="section">
        <div class="empty-state">
          <div>
            <h2>${escapeHtml(pack.name || "Language")} Pack</h2>
            <p>Awaiting hymn upload.</p>
          </div>
        </div>
      </section>
    `;
  }

  function openSong(number, code) {
    if (code && code !== state.languageCode) {
      state.languageCode = code;
      saveValue("language", code);
    }
    const song = getSong(number);
    if (!song) return;
    state.songNumber = song.number;
    state.slideIndex = 0;
    state.view = "song";
    saveValue("songNumber", state.songNumber);
    saveValue("view", state.view);
    addRecent(song);
    render();
  }

  function moveSlide(delta) {
    const song = selectedSong();
    if (!song) return;
    state.slideIndex = Math.max(0, Math.min(song.slides.length - 1, state.slideIndex + delta));
    render();
  }

  function toggleFavorite() {
    const song = selectedSong();
    if (!song) return;
    const key = songKey(song);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveJson("favorites", [...favorites]);
    render();
  }

  function openSlotPicker() {
    const song = selectedSong();
    if (!song) return;
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-command="close-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Add hymn to worship builder">
          <div class="song-header">
            <div>
              <h2>Hymn ${escapeHtml(song.number)}</h2>
              <p class="muted">${escapeHtml(song.title)}</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <div class="slot-picker">
            ${worshipPlan.map((slot, index) => `
              <button class="slot-button" type="button" data-command="slot-add" data-slot="${index}">
                ${escapeHtml(slot.role)}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function closeModal() {
    els.modalRoot.innerHTML = "";
  }

  function assignSongToSlot(index, song) {
    if (!song || !worshipPlan[index]) return;
    worshipPlan[index].type = "song";
    worshipPlan[index].songKey = songKey(song);
    worshipPlan[index].title = "";
    worshipPlan[index].body = "";
    worshipPlan[index].itemType = "";
    state.activeSlot = index;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    closeModal();
    render();
  }

  function openCustomItemEditor(index = null) {
    const slot = typeof index === "number" ? worshipPlan[index] : null;
    const targetIndex = typeof index === "number" ? index : state.activeSlot;
    const itemType = slot && slot.itemType ? slot.itemType : "scripture";
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-command="close-modal">
        <form class="modal form-grid" role="dialog" aria-modal="true" aria-label="Custom service item" data-command="modal-form">
          <div class="song-header">
            <div>
              <h2>${slot ? "Edit Service Item" : "Add Service Item"}</h2>
              <p class="muted">Use three hyphens on a line by themselves to split a custom item into multiple projector slides.</p>
            </div>
            <button class="secondary-button" type="button" data-command="close-modal">Close</button>
          </div>
          <label>
            <span>Target slot</span>
            <select id="customItemSlot">
              ${worshipPlan.map((item, planIndex) => `<option value="${planIndex}" ${planIndex === targetIndex ? "selected" : ""}>${planIndex + 1}. ${escapeHtml(item.role)}</option>`).join("")}
              <option value="append">Append as new item</option>
            </select>
          </label>
          <label>
            <span>Item type</span>
            <select id="customItemType">
              ${customItemTypes.map((item) => `<option value="${item[0]}" ${item[0] === itemType ? "selected" : ""}>${escapeHtml(item[1])}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Role in service</span>
            <input id="customItemRole" value="${escapeHtml(slot ? slot.role : itemTypeLabel(itemType))}" placeholder="Scripture Reading">
          </label>
          <label>
            <span>Slide title</span>
            <input id="customItemTitle" value="${escapeHtml(slot ? slot.title : "")}" placeholder="John 14:1-3">
          </label>
          <label class="full">
            <span>Projector text</span>
            <textarea id="customItemBody" rows="8" placeholder="Text to show on the projector">${escapeHtml(slot ? slot.body : "")}</textarea>
          </label>
          <label class="full">
            <span>Private notes</span>
            <textarea id="customItemNotes" rows="3" placeholder="Notes for the worship team">${escapeHtml(slot ? slot.notes : "")}</textarea>
          </label>
          <div class="button-row">
            <button class="action-button" type="button" data-command="save-custom-item">Save Item</button>
            <button class="secondary-button" type="button" data-command="close-modal">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  function saveCustomItemFromModal() {
    const target = document.getElementById("customItemSlot")?.value || String(state.activeSlot);
    const itemType = document.getElementById("customItemType")?.value || "note";
    const role = plain(document.getElementById("customItemRole")?.value) || itemTypeLabel(itemType);
    const title = plain(document.getElementById("customItemTitle")?.value) || role;
    const body = document.getElementById("customItemBody")?.value.trim() || title;
    const notes = document.getElementById("customItemNotes")?.value.trim() || "";
    const slot = createPlanSlot(role, target === "append" ? worshipPlan.length : Number(target), {
      type: "custom",
      itemType,
      title,
      body,
      notes,
    });
    if (target === "append") {
      worshipPlan.push(slot);
      state.activeSlot = worshipPlan.length - 1;
    } else {
      worshipPlan[Number(target)] = slot;
      state.activeSlot = Number(target);
    }
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    closeModal();
    render();
  }

  function loadTemplate(templateId) {
    const template = [...serviceTemplates, ...customTemplates].find((item) => item.id === templateId);
    if (!template) return;
    worshipPlan = normalizeWorshipPlan(template.slots);
    state.activeSlot = 0;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    render();
  }

  function saveCurrentTemplate() {
    const name = window.prompt("Template name", "Custom Worship Service");
    if (!name) return;
    const id = `custom-${Date.now()}`;
    customTemplates = [
      ...customTemplates.filter((template) => template.name !== name),
      {
        id,
        name,
        detail: `${worshipPlan.length} service items`,
        slots: worshipPlan,
      },
    ];
    saveJson("customTemplates", customTemplates);
    render();
  }

  function assignSongToServiceSlot(index, song) {
    if (!song || !songService[index]) return;
    songService[index].songKey = songKey(song);
    state.activeSongServiceSlot = index;
    saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
    saveJson("songService", songService);
    render();
  }

  function moveSlot(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= worshipPlan.length) return;
    const temp = worshipPlan[index];
    worshipPlan[index] = worshipPlan[next];
    worshipPlan[next] = temp;
    state.activeSlot = next;
    saveValue("activeSlot", state.activeSlot);
    saveJson("worshipPlan", worshipPlan);
    render();
  }

  function moveServiceSlot(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= songService.length) return;
    const temp = songService[index];
    songService[index] = songService[next];
    songService[next] = temp;
    state.activeSongServiceSlot = next;
    saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
    saveJson("songService", songService);
    render();
  }

  function presenterItemFromSlot(slot, index) {
    const song = slotSong(slot);
    if (song) {
      const parsed = parseSongKey(slot.songKey);
      return {
        type: "song",
        title: `Hymn ${song.number} · ${song.title}`,
        shortTitle: `Hymn ${song.number}`,
        subtitle: `${getPack(parsed.code).name} · ${slot.role}`,
        slides: song.slides,
        song,
        songKey: slot.songKey,
        planIndex: index,
      };
    }
    if (isCustomSlot(slot)) {
      return {
        type: "custom",
        title: slot.title || slot.role || itemTypeLabel(slot.itemType),
        shortTitle: slot.title || slot.role || "Service Item",
        subtitle: `${slot.role} · ${itemTypeLabel(slot.itemType)}`,
        slides: slotSlides(slot),
        song: null,
        songKey: "",
        planIndex: index,
      };
    }
    return null;
  }

  function currentPresenterItem() {
    if (state.presenter.songKey) {
      const song = getSongByKey(state.presenter.songKey);
      if (!song) return null;
      const parsed = parseSongKey(state.presenter.songKey);
      return {
        type: "song",
        title: `Hymn ${song.number} · ${song.title}`,
        shortTitle: `Hymn ${song.number}`,
        subtitle: getPack(parsed.code).name,
        slides: song.slides,
        song,
        songKey: state.presenter.songKey,
        planIndex: state.presenter.planIndex,
      };
    }
    if (typeof state.presenter.planIndex === "number") {
      return presenterItemFromSlot(worshipPlan[state.presenter.planIndex], state.presenter.planIndex);
    }
    return null;
  }

  function openPresenter(song, planIndex) {
    if (!song) return;
    state.presenter.open = true;
    state.presenter.songKey = songKey(song);
    state.presenter.slideIndex = 0;
    state.presenter.planIndex = typeof planIndex === "number" ? planIndex : null;
    state.presenter.queueKeys = [];
    state.presenter.queueIndex = null;
    addRecent(song);
    render();
    if (els.presenterOverlay.requestFullscreen) {
      els.presenterOverlay.requestFullscreen().catch(() => {});
    }
  }

  function openCustomPresenter(planIndex) {
    const item = presenterItemFromSlot(worshipPlan[planIndex], planIndex);
    if (!item) return;
    state.presenter.open = true;
    state.presenter.songKey = "";
    state.presenter.slideIndex = 0;
    state.presenter.planIndex = planIndex;
    state.presenter.queueKeys = [];
    state.presenter.queueIndex = null;
    render();
    if (els.presenterOverlay.requestFullscreen) {
      els.presenterOverlay.requestFullscreen().catch(() => {});
    }
  }

  function openPresenterQueue(keys, startIndex = 0) {
    const queueKeys = keys.filter((key) => getSongByKey(key));
    if (!queueKeys.length) return;
    const boundedIndex = Math.max(0, Math.min(queueKeys.length - 1, startIndex));
    const song = getSongByKey(queueKeys[boundedIndex]);
    state.presenter.open = true;
    state.presenter.songKey = queueKeys[boundedIndex];
    state.presenter.slideIndex = 0;
    state.presenter.planIndex = null;
    state.presenter.queueKeys = queueKeys;
    state.presenter.queueIndex = boundedIndex;
    const parsed = parseSongKey(queueKeys[boundedIndex]);
    state.languageCode = parsed.code;
    state.songNumber = parsed.number;
    addRecent(song, parsed.code);
    render();
    if (els.presenterOverlay.requestFullscreen) {
      els.presenterOverlay.requestFullscreen().catch(() => {});
    }
  }

  function presentCurrent() {
    const assigned = firstAssignedSlot();
    if (assigned) {
      presentPlanSlot(assigned.index);
      return;
    }
    openPresenter(selectedSong(), null);
  }

  function presentPlanSlot(index) {
    const slot = worshipPlan[index];
    if (!slotHasContent(slot)) return;
    if (isCustomSlot(slot)) return openCustomPresenter(index);
    const song = getSongByKey(slot.songKey);
    const parsed = parseSongKey(slot.songKey);
    state.languageCode = parsed.code;
    state.songNumber = song.number;
    state.activeSlot = index;
    saveValue("language", state.languageCode);
    saveValue("songNumber", state.songNumber);
    saveValue("activeSlot", state.activeSlot);
    openPresenter(song, index);
  }

  function presentSongService(startIndex = 0) {
    const assigned = assignedSongServiceSlots();
    if (!assigned.length) return;
    const startPosition = Math.max(0, assigned.findIndex((item) => item.index === startIndex));
    const keys = assigned.map((item) => item.slot.songKey);
    openPresenterQueue(keys, startPosition === -1 ? 0 : startPosition);
  }

  function togglePresenterFullscreen() {
    const target = els.presenterOverlay;
    if (!target || !state.presenter.open) return;
    if (document.fullscreenElement === target && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {});
    }
  }

  function renderPresenterOverlay() {
    if (!state.presenter.open) {
      els.presenterOverlay.className = "presenter-overlay hidden";
      els.presenterOverlay.setAttribute("aria-hidden", "true");
      els.presenterOverlay.innerHTML = "";
      return;
    }
    const item = currentPresenterItem();
    if (!item || !item.slides.length) {
      state.presenter.open = false;
      renderPresenterOverlay();
      return;
    }
    const index = Math.max(0, Math.min(item.slides.length - 1, state.presenter.slideIndex));
    const slide = item.slides[index];
    const queuedNextKey = state.presenter.queueIndex !== null ? state.presenter.queueKeys[state.presenter.queueIndex + 1] : "";
    const queuedNextSong = queuedNextKey ? getSongByKey(queuedNextKey) : null;
    const nextSlot = queuedNextSong ? null : nextAssignedSlot(state.presenter.planIndex);
    const nextItem = queuedNextSong
      ? { title: `Hymn ${queuedNextSong.number} · ${queuedNextSong.title}`, shortTitle: `Hymn ${queuedNextSong.number}`, slides: queuedNextSong.slides }
      : nextSlot
        ? presenterItemFromSlot(nextSlot.slot, nextSlot.index)
        : null;
    const nextSlide = item.slides[index + 1];
    const nextText = nextSlide
      ? `Next: ${nextSlide.label}`
      : nextItem
        ? `Next: ${nextItem.shortTitle}`
        : "End of queue";
    const nextPreview = nextSlide ? nextSlide.body : nextItem && nextItem.slides[0] ? nextItem.slides[0].body : "";
    const progress = item.slides.map((_, dotIndex) => `<span class="presenter-dot ${dotIndex === index ? "on" : ""}"></span>`).join("");
    const presenterFont = Math.round(58 * state.fontScale);
    const canPrev = index > 0
      || (state.presenter.queueIndex !== null && state.presenter.queueIndex > 0)
      || (typeof state.presenter.planIndex === "number" && previousAssignedSlot(state.presenter.planIndex));
    const canNext = index < item.slides.length - 1
      || (state.presenter.queueIndex !== null && state.presenter.queueKeys[state.presenter.queueIndex + 1])
      || nextAssignedSlot(state.presenter.planIndex);
    els.presenterOverlay.className = "presenter-overlay";
    els.presenterOverlay.setAttribute("aria-hidden", "false");
    els.presenterOverlay.innerHTML = `
      <div class="presenter-top">
        <div><strong>${escapeHtml(item.shortTitle)}</strong> · ${escapeHtml(item.title.replace(item.shortTitle, "").replace(/^ · /, ""))}</div>
        <div class="stage-count">${index + 1} of ${item.slides.length}</div>
      </div>
      <div class="presenter-body">
        <button class="presenter-arrow" type="button" data-command="presenter-prev" ${canPrev ? "" : "disabled"} aria-label="Previous slide">‹</button>
        <div class="presenter-stage" style="--presenter-font: ${presenterFont}px">${lyricHtml(slide.body)}</div>
        <button class="presenter-arrow" type="button" data-command="presenter-next" ${canNext ? "" : "disabled"} aria-label="Next slide">›</button>
      </div>
      <div class="presenter-bottom">
        <div>
          <span class="stage-label">${escapeHtml(slide.label)}</span>
          ${nextItem ? `<span class="stage-count"> · ${escapeHtml(nextText)}</span>` : ""}
        </div>
        <div class="presenter-progress" aria-label="Slide progress">${progress}</div>
        <div class="presenter-next-info"><strong>${escapeHtml(nextText)}</strong><span>${escapeHtml(plain(nextPreview).slice(0, 120))}</span></div>
        <div class="presenter-controls">
          <button type="button" data-command="presenter-prev">‹ Prev</button>
          <button type="button" data-command="presenter-next">Next ›</button>
          <button type="button" data-command="presenter-fullscreen">Fullscreen</button>
          <button type="button" data-command="emergency-black">Black</button>
          <button type="button" data-command="emergency-white">White</button>
          <button type="button" data-command="emergency-logo">Logo</button>
          <button type="button" data-command="close-presenter">Close</button>
        </div>
      </div>
      <div class="presenter-hint">Use ← → or Space · F fullscreen · B / W / L blank screen · H home · Esc exit</div>
    `;
  }

  function nextAssignedSlot(index) {
    if (typeof index !== "number") return null;
    return assignedSlots().find((item) => item.index > index) || null;
  }

  function previousAssignedSlot(index) {
    if (typeof index !== "number") return null;
    return [...assignedSlots()].reverse().find((item) => item.index < index) || null;
  }

  function presenterMove(delta) {
    const item = currentPresenterItem();
    if (!item) return;
    const next = state.presenter.slideIndex + delta;
    if (next >= 0 && next < item.slides.length) {
      state.presenter.slideIndex = next;
      renderPresenterOverlay();
      return;
    }
    if (delta > 0) {
      if (state.presenter.queueIndex !== null) {
        const nextKey = state.presenter.queueKeys[state.presenter.queueIndex + 1];
        const nextSong = nextKey ? getSongByKey(nextKey) : null;
        if (nextSong) {
          state.presenter.songKey = nextKey;
          state.presenter.slideIndex = 0;
          state.presenter.queueIndex += 1;
          renderPresenterOverlay();
        }
        return;
      }
      const nextSlot = nextAssignedSlot(state.presenter.planIndex);
      if (nextSlot) {
        const nextItem = presenterItemFromSlot(nextSlot.slot, nextSlot.index);
        if (nextItem) {
          state.presenter.songKey = nextSlot.slot.songKey;
          state.presenter.slideIndex = 0;
          state.presenter.planIndex = nextSlot.index;
          state.activeSlot = nextSlot.index;
          renderPresenterOverlay();
        }
      }
      return;
    }
    if (state.presenter.queueIndex !== null) {
      const prevKey = state.presenter.queueKeys[state.presenter.queueIndex - 1];
      const prevSong = prevKey ? getSongByKey(prevKey) : null;
      if (prevSong) {
        state.presenter.songKey = prevKey;
        state.presenter.slideIndex = prevSong.slides.length - 1;
        state.presenter.queueIndex -= 1;
        renderPresenterOverlay();
      }
      return;
    }
      const prevSlot = previousAssignedSlot(state.presenter.planIndex);
      if (prevSlot) {
      const prevItem = presenterItemFromSlot(prevSlot.slot, prevSlot.index);
      if (prevItem) {
        state.presenter.songKey = prevSlot.slot.songKey;
        state.presenter.slideIndex = prevItem.slides.length - 1;
        state.presenter.planIndex = prevSlot.index;
        state.activeSlot = prevSlot.index;
        renderPresenterOverlay();
      }
    }
  }

  function closePresenter() {
    state.presenter.open = false;
    if (document.fullscreenElement === els.presenterOverlay && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    render();
  }

  function setEmergency(mode) {
    state.emergencyMode = mode;
    renderEmergencyOverlay();
    if (els.emergencyOverlay.requestFullscreen) {
      els.emergencyOverlay.requestFullscreen().catch(() => {});
    }
  }

  function clearEmergency() {
    state.emergencyMode = "";
    if (document.fullscreenElement === els.emergencyOverlay && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    renderEmergencyOverlay();
  }

  function renderEmergencyOverlay() {
    if (!state.emergencyMode) {
      els.emergencyOverlay.className = "emergency-overlay hidden";
      els.emergencyOverlay.setAttribute("aria-hidden", "true");
      els.emergencyOverlay.innerHTML = "";
      return;
    }
    els.emergencyOverlay.className = `emergency-overlay ${state.emergencyMode}`;
    els.emergencyOverlay.setAttribute("aria-hidden", "false");
    els.emergencyOverlay.innerHTML = state.emergencyMode === "logo"
      ? `<div class="emergency-logo"><strong>CHRIST IN SONG</strong><span>VaChinoda Worship</span></div><button class="emergency-return" type="button" data-command="emergency-clear">Return</button>`
      : `<button class="emergency-return" type="button" data-command="emergency-clear">Return</button>`;
  }

  function copyPlan() {
    const lines = worshipPlan.map((slot, index) => {
      const song = getSongByKey(slot.songKey);
      const detail = slotHasContent(slot) ? slotTitle(slot) : song ? `Hymn ${song.number} - ${song.title}` : "Unassigned";
      return `${index + 1}. ${slot.role}: ${detail}`;
    });
    const text = lines.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        state.notice = "Worship builder copied.";
        render();
      }).catch(() => window.prompt("Copy worship builder", text));
    } else {
      window.prompt("Copy worship builder", text);
    }
  }

  function exportPlan() {
    const payload = {
      app: "Christ in Song Worship App",
      exportedAt: new Date().toISOString(),
      languageCode: state.languageCode,
      worshipPlan,
      songService,
      favorites: [...favorites],
      recents,
      customTemplates,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`christ-in-song-worship-builder-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportBackup() {
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      app: "Christ in Song Worship App",
      type: "full-backup",
      exportedAt: new Date().toISOString(),
      languageCode: state.languageCode,
      worshipPlan,
      songService,
      favorites: [...favorites],
      recents,
      customTemplates,
      importedLanguagePacks: importedPacks,
      settings: {
        displayMode: state.displayMode,
        fontScale: state.fontScale,
        timerSeconds: state.timerSeconds,
      },
    };
    downloadText(`christ-in-song-backup-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportBulletin() {
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = worshipPlan.map((slot, index) => {
      const content = slotHasContent(slot) ? slotTitle(slot) : "To be assigned";
      const detail = isCustomSlot(slot) ? plain(slot.body) : slotSubtitle(slot);
      return `<tr><td>${index + 1}</td><td>${escapeHtml(slot.role)}</td><td>${escapeHtml(content)}</td><td>${escapeHtml(detail)}</td></tr>`;
    }).join("");
    const openingSongs = assignedSongServiceSlots().map((item, index) => {
      const song = getSongByKey(item.slot.songKey);
      return `<li>${index + 1}. Hymn ${escapeHtml(song.number)} - ${escapeHtml(song.title)}</li>`;
    }).join("");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Christ in Song Service Bulletin</title>
  <style>
    body{font-family:Arial,sans-serif;margin:40px;color:#131f38}
    h1{font-family:Georgia,serif;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{border:1px solid #d9d4c8;padding:10px;text-align:left;vertical-align:top}
    th{background:#f5efe0}
    td:first-child{width:44px;text-align:center;font-weight:bold}
    .muted{color:#5e6575}
  </style>
</head>
<body>
  <h1>Christ in Song Worship Builder</h1>
  <p class="muted">Generated ${new Date().toLocaleString()}</p>
  ${openingSongs ? `<h2>Song Service</h2><ol>${openingSongs}</ol>` : ""}
  <h2>Order of Service</h2>
  <table>
    <thead><tr><th>#</th><th>Service Item</th><th>Content</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    downloadText(`christ-in-song-service-bulletin-${stamp}.html`, html, "text/html");
  }

  function importPlanFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (!Array.isArray(payload.worshipPlan)) throw new Error("Missing worshipPlan");
        worshipPlan = normalizeWorshipPlan(payload.worshipPlan);
        if (Array.isArray(payload.songService)) songService = normalizeSongService(payload.songService);
        if (Array.isArray(payload.favorites)) favorites = new Set(payload.favorites);
        if (Array.isArray(payload.recents)) recents = payload.recents.slice(0, 16);
        if (Array.isArray(payload.customTemplates)) customTemplates = payload.customTemplates;
        saveJson("worshipPlan", worshipPlan);
        saveJson("songService", songService);
        saveJson("favorites", [...favorites]);
        saveJson("recents", recents);
        saveJson("customTemplates", customTemplates);
        render();
      } catch (error) {
        window.alert("That worship builder file could not be imported.");
      }
    };
    reader.readAsText(file);
  }

  function restoreBackupFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(payload.worshipPlan)) worshipPlan = normalizeWorshipPlan(payload.worshipPlan);
        if (Array.isArray(payload.songService)) songService = normalizeSongService(payload.songService);
        if (Array.isArray(payload.favorites)) favorites = new Set(payload.favorites);
        if (Array.isArray(payload.recents)) recents = payload.recents.slice(0, 16);
        if (Array.isArray(payload.customTemplates)) customTemplates = payload.customTemplates;
        if (Array.isArray(payload.importedLanguagePacks)) {
          importedPacks = payload.importedLanguagePacks;
          data.languagePacks = mergeLanguagePacks([...(baseData.languagePacks || []), ...extraPacks, ...importedPacks]);
        }
        saveJson("worshipPlan", worshipPlan);
        saveJson("songService", songService);
        saveJson("favorites", [...favorites]);
        saveJson("recents", recents);
        saveJson("customTemplates", customTemplates);
        saveJson("importedLanguagePacks", importedPacks);
        render();
      } catch (error) {
        window.alert("That backup file could not be restored.");
      }
    };
    reader.readAsText(file);
  }

  function importLanguagePackFromFile(file) {
    if (!file) return;
    if (/\.pptx$/i.test(file.name)) {
      window.alert("PowerPoint language packs need to be converted to Christ in Song JSON before browser import. Send the PPTX through Codex and import the generated JSON pack here.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        const packs = Array.isArray(payload.languagePacks) ? payload.languagePacks : Array.isArray(payload.songs) ? [payload] : [];
        const valid = packs.filter((pack) => pack && pack.code && pack.name && Array.isArray(pack.songs));
        if (!valid.length) throw new Error("No valid packs");
        importedPacks = mergeLanguagePacks([...importedPacks, ...valid.map((pack) => ({
          ...pack,
          status: "ready",
          songCount: pack.songs.length,
          source: pack.source || file.name,
        }))]);
        data.languagePacks = mergeLanguagePacks([...(baseData.languagePacks || []), ...extraPacks, ...importedPacks]);
        saveJson("importedLanguagePacks", importedPacks);
        render();
      } catch (error) {
        window.alert("That language pack JSON could not be imported.");
      }
    };
    reader.readAsText(file);
  }

  function resetLocalData() {
    favorites = new Set();
    recents = [];
    customTemplates = [];
    importedPacks = [];
    data.languagePacks = mergeLanguagePacks([...(baseData.languagePacks || []), ...extraPacks]);
    worshipPlan = createDefaultPlan();
    songService = createDefaultSongService();
    saveJson("favorites", []);
    saveJson("recents", []);
    saveJson("customTemplates", []);
    saveJson("importedLanguagePacks", []);
    saveJson("worshipPlan", worshipPlan);
    saveJson("songService", songService);
    render();
  }

  function persistTimer() {
    saveValue("timerSeconds", state.timerSeconds);
    saveValue("timerRunning", state.timerRunning);
    saveValue("timerEndsAt", state.timerEndsAt);
  }

  function adjustTimer(delta) {
    const next = Math.max(60, timerRemaining() + delta);
    state.timerSeconds = next;
    state.timerEndsAt = state.timerRunning ? Date.now() + next * 1000 : 0;
    persistTimer();
    render();
  }

  function toggleTimer() {
    if (state.timerRunning) {
      state.timerSeconds = timerRemaining();
      state.timerRunning = false;
      state.timerEndsAt = 0;
    } else {
      state.timerRunning = true;
      state.timerEndsAt = Date.now() + Math.max(1, state.timerSeconds) * 1000;
    }
    persistTimer();
    render();
  }

  function resetTimer() {
    state.timerRunning = false;
    state.timerSeconds = 600;
    state.timerEndsAt = 0;
    persistTimer();
    render();
  }

  let deferredInstallPrompt = null;

  function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt = null;
      return;
    }
    window.alert("If your browser supports installable web apps, use its Install or Add to Dock menu for this app.");
  }

  function handleDesktopCommand(command) {
    if (!command) return;
    if (command === "show-about") {
      const version = state.desktopInfo?.version || "";
      setNotice(version ? `Christ in Song Worship App · v${version}` : "Christ in Song Worship App");
      return;
    }
    if (command.startsWith("view:")) {
      const view = command.slice(5);
      if (navItems.some((item) => item.id === view)) {
        state.view = view;
        saveValue("view", view);
        render();
      }
      return;
    }
    if (command.startsWith("notice:")) {
      setNotice(command.slice(7));
      return;
    }
    handleCommand(command, { dataset: {} });
  }

  function rerenderKeepingFocus(target) {
    const id = target.id;
    const position = target.selectionStart || target.value.length;
    render();
    const next = document.getElementById(id);
    if (next) {
      next.focus();
      next.setSelectionRange(position, position);
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-view], [data-command], [data-song], [data-lang], [data-slide]");
    if (!target) return;

    const backdrop = event.target.classList.contains("modal-backdrop");
    if (backdrop) {
      closeModal();
      return;
    }

    const lang = target.dataset.lang;
    if (lang) {
      state.languageCode = lang;
      state.slideIndex = 0;
      state.indexRange = activeRangeKey(getPack(lang));
      saveValue("language", lang);
      saveValue("range", state.indexRange);
      render();
      return;
    }

    const view = target.dataset.view;
    if (view) {
      state.view = view;
      saveValue("view", view);
      render();
      return;
    }

    const songNumber = target.dataset.song;
    const command = target.dataset.command;
    if (songNumber && !command) {
      openSong(songNumber, target.dataset.langJump);
      return;
    }

    if (target.dataset.slide) {
      state.slideIndex = Number(target.dataset.slide);
      render();
      return;
    }

    handleCommand(command, target);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "homeSearchInput") {
      state.query = target.value;
      state.view = "search";
      saveValue("view", state.view);
      render();
      return;
    }
    if (target.id === "indexSearchInput" || target.id === "globalSearchInput") {
      state.query = target.value;
      rerenderKeepingFocus(target);
    }
    if (target.id === "builderSearchInput") {
      state.builderQuery = target.value;
      rerenderKeepingFocus(target);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "worshipPlanImport") {
      importPlanFromFile(target.files && target.files[0]);
      target.value = "";
    }
    if (target.id === "backupImport") {
      restoreBackupFromFile(target.files && target.files[0]);
      target.value = "";
    }
    if (target.id === "languagePackImport") {
      importLanguagePackFromFile(target.files && target.files[0]);
      target.value = "";
    }
  });

  document.addEventListener("dragover", (event) => {
    const zone = event.target.closest(".import-zone");
    if (!zone) return;
    event.preventDefault();
    zone.classList.add("dragging");
  });

  document.addEventListener("dragleave", (event) => {
    const zone = event.target.closest(".import-zone");
    if (zone) zone.classList.remove("dragging");
  });

  document.addEventListener("drop", (event) => {
    const zone = event.target.closest(".import-zone");
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove("dragging");
    importLanguagePackFromFile(event.dataTransfer.files && event.dataTransfer.files[0]);
  });

  document.addEventListener("keydown", (event) => {
    if (state.emergencyMode) {
      if (event.key === "Escape") clearEmergency();
      return;
    }
    if (state.presenter.open) {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        presenterMove(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        presenterMove(-1);
      }
      if (event.key === "Escape") closePresenter();
      if (event.key.toLowerCase() === "f") togglePresenterFullscreen();
      if (event.key.toLowerCase() === "h") closePresenter();
      if (event.key.toLowerCase() === "b") setEmergency("black");
      if (event.key.toLowerCase() === "w") setEmergency("white");
      if (event.key.toLowerCase() === "l") setEmergency("logo");
      if (event.key.toLowerCase() === "c") closePresenter();
      return;
    }
    if (state.view === "song") {
      if (event.key === "ArrowRight") moveSlide(1);
      if (event.key === "ArrowLeft") moveSlide(-1);
    }
  });

  function handleCommand(command, target) {
    const slotIndex = Number(target.dataset.slot);
    const serviceSlotIndex = Number(target.dataset.serviceSlot);
    if (command === "range-open") {
      state.indexRange = target.dataset.range || state.indexRange;
      state.view = "index";
      saveValue("range", state.indexRange);
      saveValue("view", state.view);
      render();
      return;
    }
    if (command === "set-range") {
      state.indexRange = target.dataset.range || state.indexRange;
      saveValue("range", state.indexRange);
      render();
      return;
    }
    if (command === "toggle-favorite") return toggleFavorite();
    if (command === "open-slot-picker") return openSlotPicker();
    if (command === "open-custom-item") return openCustomItemEditor();
    if (command === "edit-custom-item") return openCustomItemEditor(slotIndex);
    if (command === "save-custom-item") return saveCustomItemFromModal();
    if (command === "load-template") return loadTemplate(target.dataset.template);
    if (command === "save-template") return saveCurrentTemplate();
    if (command === "slot-add") return assignSongToSlot(slotIndex, selectedSong());
    if (command === "set-search-scope") {
      state.searchScope = target.dataset.scope || "current";
      saveValue("searchScope", state.searchScope);
      render();
      return;
    }
    if (command === "set-category") {
      state.category = target.dataset.category || "all";
      saveValue("category", state.category);
      render();
      return;
    }
    if (command === "activate-slot") {
      state.activeSlot = slotIndex;
      saveValue("activeSlot", state.activeSlot);
      render();
      return;
    }
    if (command === "activate-service-slot") {
      state.activeSongServiceSlot = serviceSlotIndex;
      saveValue("activeSongServiceSlot", state.activeSongServiceSlot);
      render();
      return;
    }
    if (command === "assign-current") return assignSongToSlot(state.activeSlot, selectedSong());
    if (command === "assign-current-service") return assignSongToServiceSlot(state.activeSongServiceSlot, selectedSong());
    if (command === "assign-song") return assignSongToSlot(state.activeSlot, getSong(target.dataset.song));
    if (command === "assign-service-song") return assignSongToServiceSlot(state.activeSongServiceSlot, getSong(target.dataset.song));
    if (command === "remove-slot-song") {
      if (worshipPlan[slotIndex]) {
        if (isCustomSlot(worshipPlan[slotIndex]) || worshipPlan.length > defaultSlots.length) worshipPlan.splice(slotIndex, 1);
        else worshipPlan[slotIndex] = createPlanSlot(worshipPlan[slotIndex].role, slotIndex);
      }
      saveJson("worshipPlan", worshipPlan);
      state.activeSlot = Math.max(0, Math.min(state.activeSlot, worshipPlan.length - 1));
      render();
      return;
    }
    if (command === "remove-service-song") {
      if (songService[serviceSlotIndex]) songService[serviceSlotIndex].songKey = "";
      saveJson("songService", songService);
      render();
      return;
    }
    if (command === "move-slot-up") return moveSlot(slotIndex, -1);
    if (command === "move-slot-down") return moveSlot(slotIndex, 1);
    if (command === "move-service-up") return moveServiceSlot(serviceSlotIndex, -1);
    if (command === "move-service-down") return moveServiceSlot(serviceSlotIndex, 1);
    if (command === "open-plan-song") {
      const slot = worshipPlan[slotIndex];
      if (slot) {
        const parsed = parseSongKey(slot.songKey);
        openSong(parsed.number, parsed.code);
      }
      return;
    }
    if (command === "open-service-song") {
      const slot = songService[serviceSlotIndex];
      if (slot) {
        const parsed = parseSongKey(slot.songKey);
        openSong(parsed.number, parsed.code);
      }
      return;
    }
    if (command === "present-plan-slot") return presentPlanSlot(slotIndex);
    if (command === "present-service-slot") return presentSongService(serviceSlotIndex);
    if (command === "present-song-service") return presentSongService(0);
    if (command === "copy-plan") return copyPlan();
    if (command === "export-plan") return exportPlan();
    if (command === "export-backup") return exportBackup();
    if (command === "export-bulletin") return exportBulletin();
    if (command === "restore-backup") {
      const input = document.getElementById("backupImport");
      if (input) input.click();
      return;
    }
    if (command === "import-language-pack") {
      const input = document.getElementById("languagePackImport");
      if (input) input.click();
      return;
    }
    if (command === "import-plan") {
      const input = document.getElementById("worshipPlanImport");
      if (input) input.click();
      return;
    }
    if (command === "print-set") return window.print();
    if (command === "clear-plan") {
      worshipPlan = createDefaultPlan();
      saveJson("worshipPlan", worshipPlan);
      render();
      return;
    }
    if (command === "clear-song-service") {
      songService = createDefaultSongService();
      saveJson("songService", songService);
      render();
      return;
    }
    if (command === "reset-local-data") return resetLocalData();
    if (command === "set-display") {
      state.displayMode = target.dataset.mode || "slides";
      saveValue("displayMode", state.displayMode);
      render();
      return;
    }
    if (command === "font-up") {
      state.fontScale = Math.min(1.6, state.fontScale + 0.1);
      saveValue("fontScale", state.fontScale);
      render();
      return;
    }
    if (command === "font-down") {
      state.fontScale = Math.max(0.7, state.fontScale - 0.1);
      saveValue("fontScale", state.fontScale);
      render();
      return;
    }
    if (command === "font-reset") {
      state.fontScale = 1;
      saveValue("fontScale", state.fontScale);
      render();
      return;
    }
    if (command === "timer-plus") return adjustTimer(300);
    if (command === "timer-minus") return adjustTimer(-300);
    if (command === "timer-toggle") return toggleTimer();
    if (command === "timer-reset") return resetTimer();
    if (command === "install-app") return installApp();
    if (command === "check-updates") {
      if (desktopBridge && desktopBridge.checkForUpdates) {
        desktopBridge.checkForUpdates();
        setNotice("Checking for desktop app updates.");
      } else {
        setNotice("Updates are available in the packaged desktop app.");
      }
      return;
    }
    if (command === "next-slide") return moveSlide(1);
    if (command === "prev-slide") return moveSlide(-1);
    if (command === "present-song") return openPresenter(selectedSong(), null);
    if (command === "present-current" || command === "open-presenter") return presentCurrent();
    if (command === "presenter-next") return presenterMove(1);
    if (command === "presenter-prev") return presenterMove(-1);
    if (command === "presenter-fullscreen") return togglePresenterFullscreen();
    if (command === "close-presenter") return closePresenter();
    if (command === "emergency-black") return setEmergency("black");
    if (command === "emergency-white") return setEmergency("white");
    if (command === "emergency-logo") return setEmergency("logo");
    if (command === "emergency-clear") return clearEmergency();
    if (command === "close-modal") return closeModal();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  function setupDesktopBridge() {
    if (!desktopBridge) return;

    const loadInfo = () => {
      if (electronBridge && electronBridge.getAppInfo) {
        return electronBridge.getAppInfo();
      }
      if (legacyDesktopBridge && legacyDesktopBridge.getAppInfo) {
        return legacyDesktopBridge.getAppInfo();
      }
      if (electronBridge && electronBridge.getAppVersion) {
        return electronBridge.getAppVersion().then((version) => ({
          name: "Christ in Song Worship App",
          version,
          platform: electronBridge.platform || "desktop",
          packaged: true,
        }));
      }
      return Promise.resolve(null);
    };

    loadInfo().then((info) => {
      if (!info) return;
      state.desktopInfo = info;
      if (state.view === "settings") render();
    }).catch(() => {});

    if (electronBridge && electronBridge.onMenuCommand) {
      electronBridge.onMenuCommand(handleDesktopCommand);
    } else if (legacyDesktopBridge && legacyDesktopBridge.onCommand) {
      legacyDesktopBridge.onCommand(handleDesktopCommand);
    }

    if (electronBridge && electronBridge.onUpdateStatus) {
      electronBridge.onUpdateStatus((payload) => {
        if (!payload) return;
        if (payload.status === "downloading") {
          setNotice(`Downloading update… ${payload.percent || 0}%`);
        } else if (payload.status === "downloaded") {
          setNotice(`Update ${payload.version || ""} ready — restart to install.`);
        } else if (payload.status === "available") {
          setNotice(`Update ${payload.version || ""} available.`);
        } else if (payload.status === "error") {
          setNotice(payload.message || "Update check failed.");
        }
      });
    }
  }

  setupDesktopBridge();

  render();
  if (!data.languagePacks.length) {
    setNotice("Hymn library failed to load. Check app/data/songs.js.");
  }
  setInterval(() => {
    if (state.timerRunning && timerRemaining() <= 0) {
      state.timerRunning = false;
      state.timerSeconds = 0;
      persistTimer();
    }
    if (state.view === "presenter" || state.presenter.open) render();
  }, 1000);
})();
