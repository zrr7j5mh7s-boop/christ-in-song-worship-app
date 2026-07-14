(function () {
  "use strict";

  const CHORUS_PATTERN = /chorus|refrain|pinda|impinda/i;

  function isChorusLabel(label) {
    return CHORUS_PATTERN.test(String(label || ""));
  }

  function chorusClass(label) {
    const raw = String(label || "").toLowerCase();
    if (raw.includes("impinda")) return "is-impinda";
    if (raw.includes("refrain")) return "is-refrain";
    if (raw.includes("pinda")) return "is-pinda";
    if (raw.includes("chorus")) return "is-chorus";
    return "";
  }

  function splitVerseText(text, maxChars) {
    const fit = window.CISTextFitEngine;
    if (!fit) return [text];
    const lines = fit.splitLines(text, maxChars);
    const chunks = fit.chunkLines(lines, 4);
    return chunks.length > 1 ? chunks : [text];
  }

  function resolveVersesPerSlide(settings, verses) {
    const requested = settings?.versesPerSlide;
    if (requested === "auto" || settings?.verseGrouping === "auto" || settings?.autoSplit) {
      const theme = window.CISProjectionThemes
        ? window.CISProjectionThemes.getTheme(settings?.projectionTheme || "scripture_focus")
        : { maxCharsPerVerse: 320 };
      const long = verses.some((v) => String(v.text || "").length > (theme.maxCharsPerVerse || 320));
      return long ? 1 : Math.min(2, verses.length);
    }
    return Math.max(1, Number(requested) || 1);
  }

  function buildScriptureSlides(verses, parsed, options) {
    const settings = options?.settings || {};
    const store = window.CISBibleStore;
    const parser = window.CISBibleReferenceParser;
    const translationCode = options.translation || settings.defaultTranslation || "KJV";
    const meta = store ? store.getTranslationMeta(translationCode) : null;
    const secondaryMeta = settings.secondaryTranslation && store
      ? store.getTranslationMeta(settings.secondaryTranslation)
      : null;
    const secondaryVerses = options.secondaryVerses || null;
    const layout = options.layout || settings.defaultLayout || "fullscreen";
    const theme = window.CISProjectionThemes
      ? window.CISProjectionThemes.getTheme(settings.projectionTheme || "scripture_focus")
      : null;
    const perSlide = resolveVersesPerSlide(settings, verses);
    const slides = [];
    const expanded = [];

    verses.forEach((verse, index) => {
      const sec = secondaryVerses ? secondaryVerses[index] : null;
      const body = formatVerseBody(verse, sec, settings, meta, secondaryMeta);
      const maxChars = theme?.maxCharsPerVerse || 320;
      if (settings.autoSplit !== false && body.length > maxChars) {
        const parts = splitVerseText(body, theme?.maxCharsPerLine || 42);
        parts.forEach((part, partIndex) => {
          expanded.push({
            verse,
            secondary: sec,
            body: part,
            partIndex,
            partCount: parts.length,
          });
        });
      } else {
        expanded.push({ verse, secondary: sec, body, partIndex: 0, partCount: 1 });
      }
    });

    for (let index = 0; index < expanded.length; index += perSlide) {
      const chunk = expanded.slice(index, index + perSlide);
      const start = chunk[0].verse.verse;
      const end = chunk[chunk.length - 1].verse.verse;
      const book = store.getBookMeta(parsed.bookOrder);
      const reference = parser.formatReferenceLabel(book, parsed.chapter, start, end !== start ? end : null);
      const slideBody = chunk.map((item) => item.body).join("\n\n");
      slides.push({
        kind: "scripture",
        label: reference,
        reference,
        body: slideBody,
        translation: settings.showTranslationAbbr !== false ? (meta?.abbreviation || translationCode) : "",
        secondaryTranslation: settings.dualVersion ? (secondaryMeta?.abbreviation || settings.secondaryTranslation || "") : "",
        layout,
        obsLayout: settings.obsLayout || "lower_third",
        slideInHymn: slides.length + 1,
        totalSlides: 0,
      });
    }

    slides.forEach((slide, idx) => {
      slide.slideInHymn = idx + 1;
      slide.totalSlides = slides.length;
    });
    return slides;
  }

  function formatVerseBody(verse, secondary, settings, meta, secondaryMeta) {
    const showNums = settings.showVerseNumbers !== false;
    const primary = showNums ? `${verse.verse} ${verse.text}` : verse.text;
    if (!settings.dualVersion || !secondary) return primary;
    const sec = showNums ? `${secondary.verse} ${secondary.text}` : secondary.text;
    const primaryLabel = meta?.abbreviation || "";
    const secondaryLabel = secondaryMeta?.abbreviation || "";
    if (settings.dualLayout === "side_by_side") {
      return `${primaryLabel}\n${primary}\n\n---\n\n${secondaryLabel}\n${sec}`;
    }
    return `${primaryLabel}\n${primary}\n\n${secondaryLabel}\n${sec}`;
  }

  function prepareHymnSlides(song, options) {
    const settings = options || {};
    const theme = window.CISProjectionThemes
      ? window.CISProjectionThemes.getTheme(settings.projectionTheme || "classic_dark")
      : null;
    const maxLines = settings.hymnMaxLines || theme?.maxLinesPerSlide || 5;
    const fit = window.CISTextFitEngine;
    const source = song?.slides || song?.sections || [];
    const prepared = [];

    source.forEach((slide, index) => {
      const label = slide.label || `Stanza ${index + 1}`;
      const body = slide.body || "";
      const chorus = isChorusLabel(label);
      const fitResult = fit
        ? fit.fitContent({
          text: body,
          maxLines,
          theme,
          fontScale: settings.fontScale || 1,
        })
        : { body, fontSize: null, splitBodies: null, warning: [] };

      const bodies = fitResult.splitBodies || [fitResult.body];
      bodies.forEach((chunk, chunkIndex) => {
        prepared.push({
          ...slide,
          kind: chorus ? "chorus" : (slide.kind || "verse"),
          label: bodies.length > 1 ? `${label} (${chunkIndex + 1}/${bodies.length})` : label,
          body: chunk,
          chorusClass: chorusClass(label),
          fitFontPx: fitResult.fontSize,
          fitWarning: fitResult.warning,
          sourceSlide: slide.sourceSlide || slide.label || index + 1,
          slideInHymn: prepared.length + 1,
        });
      });
    });

    prepared.forEach((slide, idx) => {
      slide.slideInHymn = idx + 1;
      slide.totalSlides = prepared.length;
    });
    return prepared;
  }

  window.CISlideLayoutEngine = {
    isChorusLabel,
    chorusClass,
    buildScriptureSlides,
    prepareHymnSlides,
    resolveVersesPerSlide,
  };
})();
