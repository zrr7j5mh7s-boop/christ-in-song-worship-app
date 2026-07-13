(function () {
  "use strict";

  const GROUPS = {
    bibleReferences: { id: "bible-references", label: "Bible References", order: 1 },
    bibleText: { id: "bible-text", label: "Bible Text", order: 2 },
    hymns: { id: "hymns", label: "Hymns", order: 3 },
    serviceItems: { id: "service-items", label: "Service Items", order: 4 },
    media: { id: "media", label: "Media", order: 5 },
    recent: { id: "recent", label: "Recent Items", order: 6 },
    favorites: { id: "favorites", label: "Favourites", order: 7 },
  };

  let adapters = {};
  let searchGen = 0;
  let recentQueries = [];

  function configure(options) {
    adapters = { ...adapters, ...(options || {}) };
  }

  function cancelSearch() {
    searchGen += 1;
    if (window.CISBibleSearchService?.cancelActiveSearch) {
      window.CISBibleSearchService.cancelActiveSearch();
    }
    return searchGen;
  }

  function isCurrent(gen) {
    return gen === searchGen;
  }

  function loadRecentQueries() {
    if (typeof adapters.loadRecentQueries === "function") {
      recentQueries = adapters.loadRecentQueries() || [];
    }
    return recentQueries;
  }

  function rememberQuery(query) {
    const text = String(query || "").trim();
    if (!text) return;
    recentQueries = [text, ...recentQueries.filter((item) => item !== text)].slice(0, 12);
    if (typeof adapters.saveRecentQueries === "function") {
      adapters.saveRecentQueries(recentQueries);
    }
  }

  function makeResult(base) {
    return {
      id: base.id,
      groupId: base.groupId,
      type: base.type,
      title: base.title || "",
      subtitle: base.subtitle || "",
      snippetHtml: base.snippetHtml || "",
      score: base.score ?? 1,
      actions: base.actions || [],
      payload: base.payload || {},
    };
  }

  function defaultHymnActions() {
    return ["preview", "set-next", "add-queue", "add-service", "send-live"];
  }

  function defaultBibleActions() {
    return ["preview", "send-live"];
  }

  function searchBibleReferences(query, context, interpretation) {
    const results = [];
    const parser = window.CISBibleReferenceParser;
    if (!parser) return results;
    const parsed = interpretation?.parsed || parser.parseReference(query)?.parsed;
    if (!parsed) return results;
    const translation = context.bibleTranslation || "KJV";
    const abbrev = context.bibleAbbreviation || translation;
    results.push(makeResult({
      id: `bible-ref:${parsed.referenceLabel}`,
      groupId: GROUPS.bibleReferences.id,
      type: "bible-reference",
      title: parsed.referenceLabel,
      subtitle: `${abbrev} · Bible`,
      actions: defaultBibleActions(),
      payload: {
        reference: parsed.referenceLabel,
        referenceInput: parsed.referenceInput || query,
        translation,
        parsed,
      },
      score: 0,
    }));
    return results;
  }

  function searchHymns(query, context, interpretation) {
    if (!window.CISSearchEngine) return [];
    const scope = context.hymnScope || {};
    const limit = context.hymnLimit || 80;
    const payload = window.CISSearchEngine.search(query, { limit, ...scope });
    const isNumberSearch = interpretation?.type === "hymn_number";
    const normalizedNumber = String(query || "").trim().replace(/^0+/, "");

    return (payload.flat || []).map((item) => {
      const exactNumber = isNumberSearch
        && (item.number === query || item.number.replace(/^0+/, "") === normalizedNumber);
      return makeResult({
        id: `hymn:${item.hymnId || item.id}`,
        groupId: GROUPS.hymns.id,
        type: "hymn",
        title: item.title,
        subtitle: `${item.hymnBookTitle || item.packName || "Hymnal"} · ${item.packName || ""}${item.number ? ` · Hymn ${item.number}` : ""}`.replace(/ · $/, ""),
        snippetHtml: item.snippetHtml || "",
        score: exactNumber ? -1 : item.score,
        actions: defaultHymnActions(),
        payload: {
          songKey: adapters.makeSongKey ? adapters.makeSongKey(item) : item.hymnId,
          number: item.number,
          code: item.code,
          editionId: item.editionId,
          hymnBookTitle: item.hymnBookTitle,
          packName: item.packName,
        },
      });
    }).sort((a, b) => a.score - b.score);
  }

  function searchServiceItems(query, context) {
    const plan = Array.isArray(context.worshipPlan) ? context.worshipPlan : [];
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const numberMatch = /^\d+$/.test(q) ? Number(q) : null;
    const results = [];

    plan.forEach((slot, index) => {
      const title = adapters.slotTitle ? adapters.slotTitle(slot) : (slot.title || slot.role || "");
      const subtitle = adapters.slotSubtitle ? adapters.slotSubtitle(slot) : "";
      const role = String(slot.role || "").toLowerCase();
      const body = String(slot.body || "").toLowerCase();
      const position = index + 1;
      const song = slot.songKey && adapters.getSongByKey ? adapters.getSongByKey(slot.songKey) : null;
      const hymnNumber = song?.number ? String(song.number).replace(/^0+/, "") : "";
      const matches = (
        title.toLowerCase().includes(q)
        || role.includes(q)
        || body.includes(q)
        || (numberMatch !== null && (position === numberMatch || hymnNumber === q.replace(/^0+/, "")))
      );
      if (!matches) return;
      const actions = slot.songKey ? defaultHymnActions() : ["preview", "add-service"];
      results.push(makeResult({
        id: `service:${slot.id || index}`,
        groupId: GROUPS.serviceItems.id,
        type: "service-item",
        title: title || slot.role || `Service item ${position}`,
        subtitle: `Worship plan · ${slot.role || `Item ${position}`}`,
        actions,
        payload: {
          slotIndex: index,
          songKey: slot.songKey || "",
          role: slot.role || "",
        },
        score: numberMatch !== null && position === numberMatch ? 0 : 0.2,
      }));
    });
    return results;
  }

  async function searchBibleText(query, context, gen) {
    if (!window.CISBibleSearchService) return [];
    const translation = context.bibleTranslation || "KJV";
    const abbrev = context.bibleAbbreviation || translation;
    const verses = await window.CISBibleSearchService.searchText(query, {
      translation,
      translations: context.bibleTranslations || [translation],
      limit: context.bibleLimit || 24,
      allWords: true,
    });
    if (!isCurrent(gen) || verses === null) return null;
    return verses.map((verse) => makeResult({
      id: `bible-text:${verse.reference}:${verse.translation}`,
      groupId: GROUPS.bibleText.id,
      type: "bible-verse",
      title: verse.reference,
      subtitle: `${abbrev} · Bible`,
      snippetHtml: verse.highlighted || verse.text,
      actions: defaultBibleActions(),
      payload: {
        reference: verse.reference,
        translation: verse.translation,
        bookOrder: verse.bookOrder,
        chapter: verse.chapter,
        verse: verse.verse,
        text: verse.text,
      },
      score: 0.3,
    }));
  }

  async function searchMedia(query, context) {
    const store = window.CISSongAudioStore;
    if (!store?.listAllMeta) return [];
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const rows = await store.listAllMeta();
    return rows.filter((meta) => {
      const fileName = String(meta.fileName || "").toLowerCase();
      const songKey = String(meta.songKey || "");
      const song = adapters.getSongByKey ? adapters.getSongByKey(songKey) : null;
      const title = String(song?.title || "").toLowerCase();
      const number = String(song?.number || "");
      return fileName.includes(q) || title.includes(q) || number.includes(q);
    }).slice(0, 20).map((meta) => {
      const song = adapters.getSongByKey ? adapters.getSongByKey(meta.songKey) : null;
      const title = song ? `${song.title}` : meta.fileName;
      const subtitle = song
        ? `Media · Hymn ${song.number}`
        : `Media · ${meta.fileName}`;
      return makeResult({
        id: `media:${meta.songKey}`,
        groupId: GROUPS.media.id,
        type: "media",
        title,
        subtitle,
        actions: song ? ["preview", "set-next", "add-queue"] : [],
        payload: { songKey: meta.songKey, meta },
        score: 0.4,
      });
    });
  }

  function searchKeyedHymns(keys, groupId, groupLabel, query) {
    const q = String(query || "").trim().toLowerCase();
    const results = [];
    (keys || []).forEach((songKey) => {
      const song = adapters.getSongByKey ? adapters.getSongByKey(songKey) : null;
      if (!song) return;
      const meta = adapters.describeSongKey ? adapters.describeSongKey(songKey) : null;
      const title = song.title || "Hymn";
      const number = song.number || "";
      if (q) {
        const hay = `${title} ${number} ${meta?.shortLabel || ""}`.toLowerCase();
        if (!hay.includes(q) && !number.replace(/^0+/, "").includes(q.replace(/^0+/, ""))) return;
      }
      results.push(makeResult({
        id: `${groupId}:${songKey}`,
        groupId,
        type: groupId === GROUPS.favorites.id ? "favorite" : "recent",
        title,
        subtitle: meta?.shortLabel || `Hymn ${number}`,
        actions: defaultHymnActions(),
        payload: { songKey, number: song.number },
        score: 0.5,
      }));
    });
    return results;
  }

  function shouldRun(type, interpretation, enabledGroups) {
    if (enabledGroups && !enabledGroups.includes(type)) return false;
    const t = interpretation?.type;
    if (type === GROUPS.bibleReferences.id) {
      return t === "bible_reference" || t === "general" || !t;
    }
    if (type === GROUPS.bibleText.id) {
      return t === "bible_phrase" || t === "lyrics" || t === "general" || (t === "bible_reference" && !interpretation.parsed);
    }
    if (type === GROUPS.hymns.id) {
      return ["hymn_number", "hymn_title", "lyrics", "general", "service_item"].includes(t) || !t;
    }
    if (type === GROUPS.serviceItems.id) {
      return ["service_item", "hymn_number", "general", "hymn_title", "lyrics"].includes(t) || !t;
    }
    if (type === GROUPS.media.id) {
      return t === "media_title" || t === "general" || t === "hymn_title" || !t;
    }
    return true;
  }

  function assembleGroups(items) {
    const grouped = new Map();
    items.forEach((item) => {
      if (!grouped.has(item.groupId)) {
        const meta = Object.values(GROUPS).find((group) => group.id === item.groupId) || { label: item.groupId, order: 99 };
        grouped.set(item.groupId, { id: item.groupId, label: meta.label, order: meta.order, results: [] });
      }
      grouped.get(item.groupId).results.push(item);
    });
    return [...grouped.values()].sort((a, b) => a.order - b.order);
  }

  async function search(query, options) {
    const gen = cancelSearch();
    const context = options?.context || {};
    const interpretation = options?.interpretation
      || (window.CISWorshipSearchQueryDetector
        ? window.CISWorshipSearchQueryDetector.detect(query, options?.interpretationOverride)
        : { type: "general", label: "General search", query });
    const q = String(query || "").trim();
    if (!q) {
      loadRecentQueries();
      return {
        interpretation,
        groups: [],
        flat: [],
        total: 0,
        recentQueries: [...recentQueries],
      };
    }

    const merged = [];

    if (shouldRun(GROUPS.bibleReferences.id, interpretation)) {
      merged.push(...searchBibleReferences(q, context, interpretation));
    }

    if (shouldRun(GROUPS.hymns.id, interpretation)) {
      merged.push(...searchHymns(q, context, interpretation));
    }

    if (shouldRun(GROUPS.serviceItems.id, interpretation)) {
      merged.push(...searchServiceItems(q, context));
    }

    if (shouldRun(GROUPS.bibleText.id, interpretation)) {
      const bibleText = await searchBibleText(q, context, gen);
      if (bibleText === null) return null;
      merged.push(...bibleText);
    }
    if (!isCurrent(gen)) return null;

    if (shouldRun(GROUPS.media.id, interpretation)) {
      const media = await searchMedia(q, context);
      if (!isCurrent(gen)) return null;
      merged.push(...media);
    }

    if (shouldRun(GROUPS.recent.id, interpretation)) {
      merged.push(...searchKeyedHymns(context.recents, GROUPS.recent.id, GROUPS.recent.label, q));
    }
    if (shouldRun(GROUPS.favorites.id, interpretation)) {
      merged.push(...searchKeyedHymns(context.favorites, GROUPS.favorites.id, GROUPS.favorites.label, q));
    }

    const seen = new Set();
    const flat = merged
      .sort((a, b) => a.score - b.score)
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, options?.totalLimit || 140)
      .map((item, index) => ({ ...item, flatIndex: index }));

    rememberQuery(q);

    return {
      interpretation,
      groups: assembleGroups(flat),
      flat,
      total: flat.length,
      recentQueries: loadRecentQueries(),
    };
  }

  window.CISWorshipSearchEngine = {
    GROUPS,
    configure,
    search,
    cancelSearch,
    isCurrent,
    loadRecentQueries,
  };
})();
