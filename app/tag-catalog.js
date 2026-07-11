(function () {
  "use strict";

  const TAG_CATALOG = [
    { id: "opening", label: "Opening", color: "#1f6b3a", keywords: ["opening", "come", "worship", "gather", "begin", "vuthela", "joy"] },
    { id: "closing", label: "Closing", color: "#5e4b8b", keywords: ["closing", "rest", "home", "peace", "amen", "mphumula", "farewell"] },
    { id: "praise", label: "Praise", color: "#c9a24a", keywords: ["praise", "hallelu", "glory", "hosanna", "tumi", "sing", "magnify"] },
    { id: "worship", label: "Worship", color: "#2f5d9f", keywords: ["worship", "adore", "bow", "throne", "holiness", "saba"] },
    { id: "prayer", label: "Prayer", color: "#3d6f8c", keywords: ["prayer", "pray", "thandaza", "khuleka", "morena", "nkosi", "supplication"] },
    { id: "invitation", label: "Invitation", color: "#b85c38", keywords: ["invitation", "come", "saviour", "mercy", "grace", "today", "jesus", "accept"] },
    { id: "communion", label: "Communion", color: "#8b2f39", keywords: ["communion", "supper", "cross", "blood", "calvary", "bread", "cup"] },
    { id: "baptism", label: "Baptism", color: "#2d8f8f", keywords: ["baptism", "baptize", "water", "buried", "resurrection", "river"] },
    { id: "offering", label: "Offering", color: "#7a5c1e", keywords: ["offering", "give", "gift", "nikela", "mnikelo", "tithe", "generous"] },
    { id: "second-coming", label: "Second Coming", color: "#4b3f8c", keywords: ["coming", "advent", "king", "door", "yeza", "buya", "trumpet", "glory"] },
    { id: "funeral", label: "Funeral", color: "#4a4a4a", keywords: ["funeral", "grave", "mourning", "comfort", "rest", "funeral", "memorial"] },
    { id: "christmas", label: "Christmas", color: "#9b2d3a", keywords: ["christmas", "bethlehem", "manger", "nativity", "advent", "noel", "incarnation"] },
    { id: "easter", label: "Easter", color: "#6d3b9a", keywords: ["easter", "resurrection", "risen", "tomb", "alive", "passover", "victory"] },
    { id: "youth", label: "Youth", color: "#2f9b6a", keywords: ["youth", "young", "children", "teen", "student"] },
  ];

  const SLOT_TAG_HINTS = {
    "Opening Hymn": ["opening", "praise", "worship"],
    "Opening Song": ["opening", "praise", "worship"],
    "Processional Hymn": ["opening", "worship"],
    "Doxology": ["praise", "worship"],
    "Prayer Hymn": ["prayer", "worship"],
    "Offering Hymn": ["offering", "praise"],
    "Offering Appeal": ["offering"],
    "Communion Hymn": ["communion"],
    "Appeal Hymn": ["invitation", "praise"],
    "Invitation Hymn": ["invitation"],
    "Closing Hymn": ["closing"],
    "Closing Song": ["closing"],
    "Sermon Hymn": ["worship", "praise"],
    "Special Music": ["praise", "worship"],
  };

  function getTag(id) {
    return TAG_CATALOG.find((tag) => tag.id === id) || null;
  }

  function getAllTags() {
    return TAG_CATALOG.slice();
  }

  function inferTagsFromSong(song) {
    if (!song) return [];
    const text = [
      song.title,
      song.searchText,
      ...(song.sections || []).map((section) => section.body),
      ...(song.slides || []).map((slide) => slide.body),
    ].join(" ").toLowerCase();
    return TAG_CATALOG
      .filter((tag) => tag.keywords.some((keyword) => text.includes(keyword)))
      .map((tag) => tag.id);
  }

  function normalizeTags(tags) {
    const allowed = new Set(TAG_CATALOG.map((tag) => tag.id));
    return [...new Set((tags || []).map((tag) => String(tag).trim().toLowerCase()).filter((tag) => allowed.has(tag)))];
  }

  function tagsForSlotRole(role) {
    return SLOT_TAG_HINTS[role] || [];
  }

  window.CISTagCatalog = {
    TAG_CATALOG,
    SLOT_TAG_HINTS,
    getTag,
    getAllTags,
    inferTagsFromSong,
    normalizeTags,
    tagsForSlotRole,
  };
})();
