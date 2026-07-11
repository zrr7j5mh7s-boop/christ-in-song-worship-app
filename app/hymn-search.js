(function () {
  "use strict";

  const FIELD_LABELS = {
    number: "Hymn number",
    title: "Title",
    verses: "Verse",
    chorus: "Chorus",
    lyrics: "Lyrics",
  };

  const FIELD_PRIORITY = ["verses", "chorus", "title", "number", "lyrics"];

  let escapeHtml = (value) => String(value || "");
  let filterRecord = () => true;
  let fuse = null;
  let records = [];

  function configure(options) {
    if (options && typeof options.escapeHtml === "function") escapeHtml = options.escapeHtml;
    if (options && typeof options.filterRecord === "function") filterRecord = options.filterRecord;
  }

  function plainText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildRecord(song, pack) {
    const verses = [];
    const choruses = [];
    const sections = song.sections || song.slides || [];
    sections.forEach((section) => {
      const body = plainText(section.body);
      if (!body) return;
      if (section.kind === "chorus") choruses.push(body);
      else verses.push(body);
    });
    const lyrics = [...verses, ...choruses].join(" ");
    return {
      id: `${pack.code}:${song.number}`,
      code: pack.code,
      packName: pack.name || pack.code,
      number: String(song.number || ""),
      title: String(song.title || ""),
      verses: verses.join(" "),
      chorus: choruses.join(" "),
      lyrics,
      numberTitle: `${song.number} ${song.title}`,
      song,
      pack,
    };
  }

  function rebuildIndex(packs) {
    records = [];
    for (const pack of packs || []) {
      if (!pack || pack.status !== "ready") continue;
      for (const song of pack.songs || []) {
        records.push(buildRecord(song, pack));
      }
    }
    if (typeof window.Fuse === "undefined") {
      fuse = null;
      return records.length;
    }
    fuse = new window.Fuse(records, {
      keys: [
        { name: "number", weight: 0.2 },
        { name: "title", weight: 0.28 },
        { name: "verses", weight: 0.28 },
        { name: "chorus", weight: 0.24 },
      ],
      threshold: 0.38,
      ignoreLocation: true,
      includeMatches: true,
      minMatchCharLength: 2,
      distance: 120,
    });
    return records.length;
  }

  function mergeIndices(indices) {
    const sorted = [...indices].sort((a, b) => a[0] - b[0]);
    const merged = [];
    sorted.forEach((range) => {
      const last = merged[merged.length - 1];
      if (!last || range[0] > last[1] + 1) merged.push([range[0], range[1]]);
      else last[1] = Math.max(last[1], range[1]);
    });
    return merged;
  }

  function highlightIndices(text, indices, options = {}) {
    if (!text) return "";
    if (!indices || !indices.length) return escapeHtml(text);
    const merged = mergeIndices(indices);
    let html = options.leadingEllipsis ? "<span class=\"snippet-ellipsis\">…</span>" : "";
    let cursor = 0;
    merged.forEach(([start, end]) => {
      const safeStart = Math.max(0, start);
      const safeEnd = Math.min(text.length - 1, end);
      html += escapeHtml(text.slice(cursor, safeStart));
      html += `<mark class="search-hit">${escapeHtml(text.slice(safeStart, safeEnd + 1))}</mark>`;
      cursor = safeEnd + 1;
    });
    html += escapeHtml(text.slice(cursor));
    if (options.trailingEllipsis) html += "<span class=\"snippet-ellipsis\">…</span>";
    return html;
  }

  function fieldLabel(key) {
    return FIELD_LABELS[key] || "Match";
  }

  function pickBestMatch(matches) {
    if (!matches || !matches.length) return null;
    return [...matches].sort((a, b) => {
      const pa = FIELD_PRIORITY.indexOf(a.key);
      const pb = FIELD_PRIORITY.indexOf(b.key);
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    })[0];
  }

  function buildSnippet(match) {
    if (!match || !match.value) return "";
    const value = match.value;
    const indices = match.indices || [];
    if (!indices.length) return escapeHtml(value.slice(0, 170));
    const anchor = indices[0];
    const start = Math.max(0, anchor[0] - 70);
    const end = Math.min(value.length - 1, anchor[1] + 110);
    const excerpt = value.slice(start, end + 1);
    const adjusted = indices
      .map(([s, e]) => [s - start, e - start])
      .filter(([s, e]) => e >= 0 && s <= excerpt.length - 1);
    return highlightIndices(excerpt, adjusted, {
      leadingEllipsis: start > 0,
      trailingEllipsis: end < value.length - 1,
    });
  }

  function titleHighlight(item, matches) {
    const titleMatch = (matches || []).find((match) => match.key === "title");
    if (!titleMatch) return escapeHtml(item.title);
    return highlightIndices(item.title, titleMatch.indices || []);
  }

  function formatResult(result) {
    const item = result.item;
    const bestMatch = pickBestMatch(result.matches);
    return {
      id: item.id,
      code: item.code,
      packName: item.packName,
      number: item.number,
      title: item.title,
      song: item.song,
      pack: item.pack,
      score: result.score,
      matchField: bestMatch ? bestMatch.key : "",
      matchLabel: bestMatch ? fieldLabel(bestMatch.key) : "",
      snippetHtml: buildSnippet(bestMatch),
      titleHtml: titleHighlight(item, result.matches),
    };
  }

  function fallbackNumberSearch(query) {
    const q = String(query || "").trim();
    if (!/^\d+$/.test(q)) return [];
    return records
      .filter((record) => record.number.includes(q) || record.number.replace(/^0+/, "").includes(q.replace(/^0+/, "")))
      .slice(0, 40)
      .map((item) => ({
        item,
        score: item.number === q.padStart(3, "0") ? 0 : 0.1,
        matches: [{ key: "number", value: item.number, indices: [[0, q.length - 1]] }],
      }));
  }

  function search(query, options = {}) {
    const q = String(query || "").trim();
    const limit = options.limit || 120;
    if (!q) return { groups: [], total: 0, flat: [] };
    if (!fuse) {
      return { groups: [], total: 0, flat: [] };
    }

    const seen = new Set();
    const merged = [];
    fallbackNumberSearch(q).forEach((result) => {
      if (seen.has(result.item.id)) return;
      seen.add(result.item.id);
      merged.push(result);
    });
    fuse.search(q, { limit }).forEach((result) => {
      if (seen.has(result.item.id)) return;
      seen.add(result.item.id);
      merged.push(result);
    });

    const filtered = merged
      .filter((result) => filterRecord(result.item))
      .slice(0, limit)
      .map((result) => formatResult(result));

    const groupMap = new Map();
    filtered.forEach((entry) => {
      if (!groupMap.has(entry.code)) {
        groupMap.set(entry.code, {
          code: entry.code,
          packName: entry.packName,
          results: [],
        });
      }
      groupMap.get(entry.code).results.push(entry);
    });

    const groups = [...groupMap.values()];
    return {
      groups,
      total: filtered.length,
      flat: filtered,
    };
  }

  window.CISSearchEngine = {
    configure,
    rebuildIndex,
    search,
    getRecordCount: () => records.length,
  };
})();
