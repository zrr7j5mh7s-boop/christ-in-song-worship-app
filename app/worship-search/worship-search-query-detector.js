(function () {
  "use strict";

  const TYPES = {
    bible_reference: "bible_reference",
    bible_phrase: "bible_phrase",
    hymn_number: "hymn_number",
    hymn_title: "hymn_title",
    lyrics: "lyrics",
    media_title: "media_title",
    service_item: "service_item",
    general: "general",
  };

  const TYPE_LABELS = {
    bible_reference: "Bible reference",
    bible_phrase: "Bible phrase",
    hymn_number: "Hymn number",
    hymn_title: "Hymn title",
    lyrics: "Hymn lyrics",
    media_title: "Media title",
    general: "General search",
    service_item: "Service item",
  };

  const BIBLE_REF_PATTERN = /^((?:\d\s*)?[A-Za-z]+(?:\s+(?:of\s+)?[A-Za-z]+)?)\s*(\d+)?\s*(?::\s*(\d+)(?:\s*-\s*(\d+))?)?\s*$/i;
  const NUMBER_PATTERN = /^\d{1,4}$/;

  function normalize(query) {
    return String(query || "").trim();
  }

  function looksLikeBibleReference(query) {
    const text = normalize(query);
    if (!text) return false;
    if (/^[1-3]?\s*[A-Za-z]{1,4}\.?\s+\d/i.test(text)) return true;
    if (/^[A-Za-z]+\s+\d+:\d+/i.test(text)) return true;
    if (/[:\d]/.test(text) && BIBLE_REF_PATTERN.test(text)) return true;
    const parser = window.CISBibleReferenceParser;
    if (parser) {
      const parsed = parser.parseReference(text);
      if (parsed.ok) return true;
    }
    return false;
  }

  function looksLikeBiblePhrase(query) {
    const text = normalize(query).toLowerCase();
    if (!text) return false;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 4) return true;
    if (words.length >= 3 && /\b(for|unto|thou|thee|yea|verily|amen|lord|god|christ|spirit|faith|love)\b/.test(text)) return true;
    return false;
  }

  function looksLikeHymnNumber(query) {
    return NUMBER_PATTERN.test(normalize(query));
  }

  function looksLikeHymnTitle(query) {
    const text = normalize(query);
    if (!text || looksLikeBibleReference(text) || looksLikeBiblePhrase(text)) return false;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 5 && !text.includes(":")) return true;
    return false;
  }

  function detect(query, override) {
    const text = normalize(query);
    if (override && TYPES[override]) {
      return {
        type: override,
        label: TYPE_LABELS[override] || override,
        confidence: "manual",
        query: text,
      };
    }
    if (!text) {
      return { type: TYPES.general, label: TYPE_LABELS.general, confidence: "empty", query: text };
    }

    if (looksLikeBibleReference(text)) {
      const parser = window.CISBibleReferenceParser;
      if (parser) {
        const parsed = parser.parseReference(text);
        if (parsed.ok) {
          return {
            type: TYPES.bible_reference,
            label: TYPE_LABELS.bible_reference,
            confidence: "high",
            query: text,
            parsed: parsed.parsed,
          };
        }
      }
      return { type: TYPES.bible_reference, label: TYPE_LABELS.bible_reference, confidence: "medium", query: text };
    }

    if (looksLikeHymnNumber(text)) {
      return { type: TYPES.hymn_number, label: TYPE_LABELS.hymn_number, confidence: "high", query: text };
    }

    if (looksLikeBiblePhrase(text)) {
      return { type: TYPES.bible_phrase, label: TYPE_LABELS.bible_phrase, confidence: "medium", query: text };
    }

    if (looksLikeHymnTitle(text)) {
      return { type: TYPES.hymn_title, label: TYPE_LABELS.hymn_title, confidence: "medium", query: text };
    }

    return { type: TYPES.lyrics, label: TYPE_LABELS.lyrics, confidence: "low", query: text };
  }

  function interpretationChoices(current) {
    const preferred = [
      TYPES.bible_reference,
      TYPES.bible_phrase,
      TYPES.hymn_number,
      TYPES.hymn_title,
      TYPES.lyrics,
      TYPES.service_item,
      TYPES.media_title,
      TYPES.general,
    ];
    return preferred.map((type) => ({
      id: type,
      label: TYPE_LABELS[type],
      active: current?.type === type,
    }));
  }

  window.CISWorshipSearchQueryDetector = {
    TYPES,
    TYPE_LABELS,
    detect,
    interpretationChoices,
    looksLikeBibleReference,
    looksLikeBiblePhrase,
    looksLikeHymnNumber,
  };
})();
