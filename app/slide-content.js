(function () {
  "use strict";

  const SLIDE_TYPES = [
    { id: "hymn", label: "Hymn", icon: "♪", role: "Hymn", projectorClass: "kind-hymn" },
    { id: "scripture", label: "Scripture Reading", icon: "✞", role: "Scripture Reading", projectorClass: "kind-scripture" },
    { id: "prayer", label: "Prayer / Opening Prayer", icon: "✦", role: "Opening Prayer", projectorClass: "kind-prayer" },
    { id: "announcement", label: "Welcome & Announcements", icon: "☷", role: "Welcome & Announcements", projectorClass: "kind-announcement" },
    { id: "offering", label: "Offering Appeal", icon: "❤", role: "Offering Appeal", projectorClass: "kind-offering" },
    { id: "sermon", label: "Sermon Title / Topic", icon: "▣", role: "Sermon Title", projectorClass: "kind-sermon" },
    { id: "special", label: "Special Music", icon: "♫", role: "Special Music", projectorClass: "kind-special" },
    { id: "benediction", label: "Benediction / Closing", icon: "☼", role: "Benediction", projectorClass: "kind-benediction" },
  ];

  const LEGACY_TYPE_MAP = {
    note: "benediction",
    scripture: "scripture",
    prayer: "prayer",
    announcement: "announcement",
    offering: "offering",
    sermon: "sermon",
    special: "special",
    song: "hymn",
    song: "hymn",
    custom: "announcement",
  };

  const SCRIPTURE_SUGGESTIONS = [
    "John 3:16", "John 14:1-3", "Psalm 23", "Psalm 27:1", "Psalm 46:1", "Psalm 51:10",
    "Psalm 95:1-7", "Psalm 100", "Psalm 118:24", "Psalm 150", "Proverbs 3:5-6",
    "Isaiah 40:31", "Isaiah 53:5", "Jeremiah 29:11", "Matthew 5:16", "Matthew 6:33",
    "Matthew 11:28", "Matthew 28:19-20", "Mark 10:27", "Luke 2:10-11", "Luke 15:20",
    "John 1:1-5", "John 10:10", "John 14:6", "John 15:13", "Acts 2:38", "Acts 4:12",
    "Romans 5:8", "Romans 8:28", "Romans 8:38-39", "Romans 12:1-2", "1 Corinthians 13:4-7",
    "1 Corinthians 15:55", "2 Corinthians 5:17", "Galatians 5:22-23", "Ephesians 2:8-9",
    "Ephesians 3:20", "Philippians 4:6-7", "Philippians 4:13", "Philippians 4:19",
    "Colossians 3:23", "1 Thessalonians 5:16-18", "2 Timothy 1:7", "Hebrews 11:1",
    "Hebrews 13:8", "James 1:5", "James 4:8", "1 Peter 5:7", "1 John 1:9",
    "1 John 4:8", "Revelation 3:20", "Revelation 21:4",
  ];

  function getSlideType(id) {
    return SLIDE_TYPES.find((type) => type.id === id) || SLIDE_TYPES[0];
  }

  function resolveSlotType(slot) {
    if (!slot) return "hymn";
    if (slot.type && SLIDE_TYPES.some((type) => type.id === slot.type)) return slot.type;
    if (slot.songKey && slot.type !== "custom") return "hymn";
    if (slot.itemType && LEGACY_TYPE_MAP[slot.itemType]) return LEGACY_TYPE_MAP[slot.itemType];
    if (slot.type === "song") return "hymn";
    if (slot.type === "custom" && slot.itemType) return LEGACY_TYPE_MAP[slot.itemType] || "announcement";
    if (slot.type === "custom") return "announcement";
    return "hymn";
  }

  function isContentSlot(slot) {
    const type = resolveSlotType(slot);
    return type !== "hymn" || !!slot.songKey;
  }

  function isCustomContentSlot(slot) {
    return resolveSlotType(slot) !== "hymn";
  }

  function plainText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .trim();
  }

  function sanitizeRichHtml(value) {
    const allowed = String(value || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/on\w+='[^']*'/gi, "");
    return allowed
      .replace(/<(?!\/?(strong|em|br|p)\b)[^>]+>/gi, "")
      .trim();
  }

  function richTextHtml(value) {
    const safe = sanitizeRichHtml(value);
    if (!safe) return "";
    if (safe.includes("<")) return safe.replace(/<p>/gi, "").replace(/<\/p>/gi, "<br>");
    return safe.replace(/\n/g, "<br>");
  }

  function splitBodyIntoSlides(body, type) {
    const text = plainText(body);
    if (!text) return [];
    const manual = text.split(/\n-{3,}\n/g).map((chunk) => chunk.trim()).filter(Boolean);
    if (manual.length > 1) return manual;
    if (type === "scripture") {
      const verses = text.split(/\n(?=\d+\s)/).map((chunk) => chunk.trim()).filter(Boolean);
      if (verses.length > 1) return verses;
    }
    return [text];
  }

  function buildSlidesFromSlot(slot, getSongSlides) {
    const type = resolveSlotType(slot);
    if (type === "hymn") {
      const songSlides = typeof getSongSlides === "function" ? getSongSlides(slot) : [];
      return (songSlides || []).map((slide, index) => ({
        kind: "hymn",
        label: slide.label || `Slide ${index + 1}`,
        marker: slide.marker || "",
        body: slide.body || "",
        reference: "",
        title: "",
        slideInHymn: index + 1,
        totalSlides: songSlides.length,
      }));
    }

    const chunks = splitBodyIntoSlides(slot.body, type);
    const meta = getSlideType(type);
    const reference = slot.scriptureRef || (type === "scripture" ? slot.title : "");
    return chunks.map((chunk, index) => ({
      kind: type,
      label: type === "scripture" && reference
        ? `${reference}${chunks.length > 1 ? ` · Verse ${index + 1}` : ""}`
        : index === 0
          ? meta.label
          : `${meta.label} ${index + 1}`,
      marker: "",
      body: chunk,
      reference: type === "scripture" ? reference : "",
      title: slot.title || slot.role || meta.label,
      slideInHymn: index + 1,
      totalSlides: chunks.length,
    }));
  }

  function slotTitle(slot, getSongTitle) {
    const type = resolveSlotType(slot);
    if (type === "hymn") {
      return typeof getSongTitle === "function" ? getSongTitle(slot) : slot.role || "Hymn";
    }
    if (type === "scripture" && slot.scriptureRef) return `${slot.role} · ${slot.scriptureRef}`;
    return slot.title || slot.role || getSlideType(type).label;
  }

  function slotSubtitle(slot, getSongSubtitle) {
    const type = resolveSlotType(slot);
    if (type === "hymn") {
      return typeof getSongSubtitle === "function" ? getSongSubtitle(slot) : "Assign a hymn";
    }
    const preview = plainText(slot.body).split("\n").filter(Boolean)[0] || "Custom slide";
    const slideCount = buildSlidesFromSlot(slot).length;
    return `${getSlideType(type).label} · ${slideCount} slide${slideCount === 1 ? "" : "s"} · ${preview.slice(0, 72)}`;
  }

  function normalizeContentSlot(slot, index, fallbackRole) {
    const type = resolveSlotType(slot);
    const meta = getSlideType(type);
    const isHymn = type === "hymn";
    return {
      id: slot.id || `slot-${index + 1}`,
      role: slot.role || fallbackRole || meta.role,
      type,
      itemType: slot.itemType || (isHymn ? "" : type),
      title: slot.title || "",
      body: slot.body || "",
      notes: slot.notes || "",
      scriptureRef: slot.scriptureRef || "",
      contentFormat: slot.contentFormat || "plain",
      songKey: isHymn ? (slot.songKey || "") : "",
    };
  }

  function filterScriptureSuggestions(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return SCRIPTURE_SUGGESTIONS.slice(0, 12);
    return SCRIPTURE_SUGGESTIONS.filter((item) => item.toLowerCase().includes(q)).slice(0, 12);
  }

  window.CISSlideContent = {
    SLIDE_TYPES,
    SCRIPTURE_SUGGESTIONS,
    getSlideType,
    resolveSlotType,
    isContentSlot,
    isCustomContentSlot,
    plainText,
    sanitizeRichHtml,
    richTextHtml,
    buildSlidesFromSlot,
    slotTitle,
    slotSubtitle,
    normalizeContentSlot,
    filterScriptureSuggestions,
    splitBodyIntoSlides,
  };
})();
