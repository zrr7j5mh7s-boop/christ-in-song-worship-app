(function () {
  "use strict";

  const CHRIST_IN_SONG = "christ-in-song";
  const SDA_HYMNAL = "sda-hymnal";
  const UNCLASSIFIED = "unclassified-hymn-books";
  const CHURCH_HYMNAL = "church-hymnal";

  const BUILTIN_LEGACY_MAP = {
    zu: { hymnBookId: CHRIST_IN_SONG, editionId: "christ-in-song-zulu", packCode: "zu", languageCode: "zu", languageName: "Zulu", nativeLanguageName: "isiZulu" },
    en: { hymnBookId: CHRIST_IN_SONG, editionId: "christ-in-song-english", packCode: "en", languageCode: "en", languageName: "English", nativeLanguageName: "English" },
    sn: { hymnBookId: CHRIST_IN_SONG, editionId: "christ-in-song-shona", packCode: "sn", languageCode: "sn", languageName: "Shona", nativeLanguageName: "chiShona" },
    ve: { hymnBookId: CHRIST_IN_SONG, editionId: "christ-in-song-venda", packCode: "ve", languageCode: "ve", languageName: "Venda", nativeLanguageName: "Tshivenḓa" },
    nso: { hymnBookId: CHRIST_IN_SONG, editionId: "christ-in-song-sepedi", packCode: "nso", languageCode: "nso", languageName: "Sepedi", nativeLanguageName: "Sepedi" },
    sda: { hymnBookId: SDA_HYMNAL, editionId: "sda-hymnal-english", packCode: "sda", languageCode: "en", languageName: "English", nativeLanguageName: "English" },
  };

  const ZULU_SOURCE_FIX = "Christ_in_Song_Zulu.pptx";
  const ZULU_SOURCE_OLD = "Christ_in_Song_VaChinoda. v2_QA_Clean.pptx";

  function slug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function now() {
    return Date.now();
  }

  function builtInHymnBooks() {
    return [
      {
        hymnBookId: CHRIST_IN_SONG,
        title: "Christ in Song",
        shortTitle: "CIS",
        publisher: "Southern African Union Conference",
        denomination: "Seventh-day Adventist",
        edition: "VaChinoda Digital",
        publicationYear: null,
        description: "Multilingual Christ in Song hymnal for Southern African worship.",
        coverImage: "",
        copyrightNotice: "Christ in Song content © respective copyright holders. Used under licence for worship presentation.",
        licenceInformation: "Built-in packs ship with the app for offline worship use.",
        attribution: "VaChinoda Worship",
        createdAt: now(),
        updatedAt: now(),
        isBuiltIn: true,
        isEditable: false,
      },
      {
        hymnBookId: SDA_HYMNAL,
        title: "SDA Hymnal",
        shortTitle: "SDA",
        publisher: "Review and Herald",
        denomination: "Seventh-day Adventist",
        edition: "Standard",
        publicationYear: 1985,
        description: "Seventh-day Adventist Church Hymnal (English).",
        coverImage: "",
        copyrightNotice: "SDA Hymnal © Review and Herald Publishing Association.",
        licenceInformation: "Included for worship presentation where licensed.",
        attribution: "Seventh-day Adventist Church",
        createdAt: now(),
        updatedAt: now(),
        isBuiltIn: true,
        isEditable: false,
      },
      {
        hymnBookId: UNCLASSIFIED,
        title: "Unclassified Hymn Books",
        shortTitle: "Unclassified",
        publisher: "",
        denomination: "",
        edition: "",
        publicationYear: null,
        description: "Imports awaiting admin classification into a hymn book.",
        coverImage: "",
        copyrightNotice: "",
        licenceInformation: "",
        attribution: "",
        createdAt: now(),
        updatedAt: now(),
        isBuiltIn: false,
        isEditable: true,
      },
    ];
  }

  function builtInEditionFromLegacy(packCode, pack) {
    const meta = BUILTIN_LEGACY_MAP[packCode];
    if (!meta) return null;
    const source = pack && pack.source ? pack.source : "";
    const fixedSource = packCode === "zu" && source.includes("VaChinoda") ? ZULU_SOURCE_FIX : source;
    return {
      editionId: meta.editionId,
      hymnBookId: meta.hymnBookId,
      languageCode: meta.languageCode,
      languageName: meta.languageName,
      nativeLanguageName: meta.nativeLanguageName,
      editionName: meta.languageName,
      sourceFileName: fixedSource,
      sourceType: "builtin",
      packCode: meta.packCode,
      version: 1,
      hymnCount: pack ? (pack.songCount || (pack.songs || []).length) : 0,
      checksum: "",
      importedAt: now(),
      updatedAt: now(),
      validationStatus: "valid",
      status: pack ? (pack.status || "ready") : "ready",
    };
  }

  function builtInEditionsFromBaseData(baseData, extraPacks) {
    const editions = [];
    const allPacks = [...(baseData && baseData.languagePacks || []), ...(extraPacks || [])];
    for (const pack of allPacks) {
      const edition = builtInEditionFromLegacy(pack.code, pack);
      if (edition) editions.push(edition);
    }
    return editions;
  }

  function resolveEditionFromLegacyCode(code) {
    return BUILTIN_LEGACY_MAP[String(code || "").trim()] || null;
  }

  function resolveLegacyCodeFromEdition(editionId) {
    const entry = Object.values(BUILTIN_LEGACY_MAP).find((item) => item.editionId === editionId);
    return entry ? entry.packCode : "";
  }

  function resolveEditionMeta(editionId) {
    const builtIn = Object.values(BUILTIN_LEGACY_MAP).find((item) => item.editionId === editionId);
    if (builtIn) return builtIn;
    return null;
  }

  function migrateSongKey(key, editionIdByLegacyCode) {
    const text = String(key || "");
    const idx = text.indexOf(":");
    if (idx < 0) return text;
    const prefix = text.slice(0, idx);
    const number = text.slice(idx + 1);
    if (prefix.includes("-")) return text;
    const editionId = editionIdByLegacyCode[prefix];
    if (!editionId) return text;
    return `${editionId}:${number}`;
  }

  function migrateSongKeyMap(map, editionIdByLegacyCode) {
    const next = {};
    Object.entries(map || {}).forEach(([key, value]) => {
      next[migrateSongKey(key, editionIdByLegacyCode)] = value;
    });
    return next;
  }

  function migrateKeyList(keys, editionIdByLegacyCode) {
    return (keys || []).map((key) => migrateSongKey(key, editionIdByLegacyCode));
  }

  function detectHymnBookFromFilename(filename) {
    const name = String(filename || "").toLowerCase();
    if (/christ[\s_.-]*in[\s_.-]*song|\bcis[\s_.-]/.test(name)) {
      return { hymnBookId: CHRIST_IN_SONG, title: "Christ in Song", confidence: "high" };
    }
    if (/sda[\s_.-]*hymnal|\b695[\s_.-]*hymn/.test(name)) {
      return { hymnBookId: SDA_HYMNAL, title: "SDA Hymnal", confidence: "high" };
    }
    if (/church[\s_.-]*hymnal/.test(name)) {
      return { hymnBookId: CHURCH_HYMNAL, title: "Church Hymnal", confidence: "medium" };
    }
    return { hymnBookId: UNCLASSIFIED, title: "Unclassified Hymn Books", confidence: "low" };
  }

  function detectLanguageFromFilename(filename, pack) {
    const name = String(filename || "").toLowerCase();
    const fromPack = pack && (pack.name || pack.languageName);
    const patterns = [
      ["zulu", "zu", "Zulu", "isiZulu"],
      ["english", "en", "English", "English"],
      ["shona", "sn", "Shona", "chiShona"],
      ["venda", "ve", "Venda", "Tshivenḓa"],
      ["sepedi", "nso", "Sepedi", "Sepedi"],
      ["ndebele", "nd", "Ndebele", "isiNdebele"],
      ["xhosa", "xh", "Xhosa", "isiXhosa"],
      ["tswana", "tn", "Tswana", "Setswana"],
    ];
    for (const [token, code, label, native] of patterns) {
      if (name.includes(token)) return { languageCode: code, languageName: label, nativeLanguageName: native };
    }
    if (fromPack) {
      const code = slug(fromPack).slice(0, 12) || "import";
      return { languageCode: code, languageName: fromPack, nativeLanguageName: fromPack };
    }
    return { languageCode: "en", languageName: "English", nativeLanguageName: "English" };
  }

  function buildEditionId(hymnBookId, languageCode, languageName) {
    const langSlug = slug(languageName || languageCode || "edition");
    return `${hymnBookId}-${langSlug}`;
  }

  function buildHymnId(editionId, hymnNumber, recordId) {
    const number = String(hymnNumber || "").padStart(3, "0");
    if (recordId) return `${editionId}:${number}:${recordId}`;
    return `${editionId}:${number}`;
  }

  function classifyImportedPack(pack, sourceFileName) {
    const detection = detectHymnBookFromFilename(sourceFileName || pack.source || pack.name || "");
    const lang = detectLanguageFromFilename(sourceFileName || pack.source || "", pack);
    let hymnBookId = detection.hymnBookId;

    if (hymnBookId === UNCLASSIFIED && pack.code) {
      const legacy = resolveEditionFromLegacyCode(pack.code);
      if (legacy) hymnBookId = legacy.hymnBookId;
    }

    if (pack.code === "sda" || (pack.name || "").toLowerCase().includes("sda")) {
      hymnBookId = SDA_HYMNAL;
    }

    const editionId = hymnBookId === SDA_HYMNAL && lang.languageCode === "en"
      ? "sda-hymnal-english"
      : buildEditionId(hymnBookId, lang.languageCode, lang.languageName);

    return {
      hymnBookId,
      editionId,
      languageCode: lang.languageCode,
      languageName: lang.languageName,
      nativeLanguageName: lang.nativeLanguageName,
      detection,
    };
  }

  function editionIdByLegacyCodeMap(extraEntries) {
    const map = {};
    Object.entries(BUILTIN_LEGACY_MAP).forEach(([code, meta]) => {
      map[code] = meta.editionId;
    });
    (extraEntries || []).forEach((entry) => {
      if (entry.packCode && entry.editionId) map[entry.packCode] = entry.editionId;
    });
    return map;
  }

  window.CISHymnalMigration = {
    CHRIST_IN_SONG,
    SDA_HYMNAL,
    UNCLASSIFIED,
    CHURCH_HYMNAL,
    BUILTIN_LEGACY_MAP,
    ZULU_SOURCE_FIX,
    builtInHymnBooks,
    builtInEditionsFromBaseData,
    builtInEditionFromLegacy,
    resolveEditionFromLegacyCode,
    resolveLegacyCodeFromEdition,
    resolveEditionMeta,
    migrateSongKey,
    migrateSongKeyMap,
    migrateKeyList,
    detectHymnBookFromFilename,
    detectLanguageFromFilename,
    buildEditionId,
    buildHymnId,
    classifyImportedPack,
    editionIdByLegacyCodeMap,
    slug,
  };
})();
