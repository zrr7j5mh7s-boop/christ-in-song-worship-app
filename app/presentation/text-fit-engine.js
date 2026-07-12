(function () {
  "use strict";

  function plainText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitLines(text, maxCharsPerLine) {
    const words = plainText(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxCharsPerLine) {
        current = next;
        return;
      }
      if (current) lines.push(current);
      if (word.length > maxCharsPerLine) {
        let chunk = "";
        word.split("").forEach((ch) => {
          const attempt = chunk + ch;
          if (attempt.length > maxCharsPerLine) {
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else chunk = attempt;
        });
        current = chunk;
      } else {
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function chunkLines(lines, maxLines) {
    const chunks = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      chunks.push(lines.slice(i, i + maxLines).join("\n"));
    }
    return chunks.length ? chunks : [""];
  }

  function estimateLineCount(text, maxCharsPerLine) {
    return normalizeLines(text, maxCharsPerLine).length;
  }

  function normalizeLines(text, maxCharsPerLine) {
    const raw = String(text || "");
    if (raw.includes("\n")) {
      return raw
        .split("\n")
        .map((line) => plainText(line))
        .filter(Boolean);
    }
    return splitLines(text, maxCharsPerLine);
  }

  function fitContent(options) {
    const theme = options.theme || {};
    const text = String(options.text || "");
    const maxLines = options.maxLines || theme.maxLinesPerSlide || 5;
    const maxChars = options.maxCharsPerLine || theme.maxCharsPerLine || 42;
    const preferred = Math.round((options.preferredFontPx || theme.preferredFontPx || 76) * (options.fontScale || 1));
    const minFont = Math.round((options.minFontPx || theme.minFontPx || 30) * (options.fontScale || 1));
    const lines = normalizeLines(text, maxChars);
    const lineCount = lines.length;
    const warning = [];

    if (lineCount <= maxLines) {
      return {
        fontSize: preferred,
        body: lines.join("\n"),
        lineCount,
        splitBodies: null,
        layout: options.layout || "fullscreen",
        warning,
      };
    }

    const splitBodies = chunkLines(lines, maxLines);
    if (splitBodies.length > 1) {
      return {
        fontSize: preferred,
        body: splitBodies[0],
        lineCount: maxLines,
        splitBodies,
        layout: options.layout || "fullscreen",
        warning,
      };
    }

    let fontSize = preferred;
    while (fontSize > minFont && estimateLineCount(text, Math.floor(maxChars * (preferred / fontSize))) > maxLines) {
      fontSize -= 2;
    }

    if (estimateLineCount(text, Math.floor(maxChars * (preferred / fontSize))) > maxLines) {
      const forced = chunkLines(normalizeLines(text, maxChars), maxLines);
      warning.push("Content was split across slides to preserve readability.");
      return {
        fontSize: Math.max(minFont, fontSize),
        body: forced[0],
        lineCount: maxLines,
        splitBodies: forced,
        layout: options.layout || "fullscreen",
        warning,
      };
    }

    if (fontSize < preferred) {
      warning.push("Font size was reduced slightly to improve readability.");
    }

    return {
      fontSize: Math.max(minFont, fontSize),
      body: lines.join("\n"),
      lineCount,
      splitBodies: null,
      layout: options.layout || "fullscreen",
      warning,
    };
  }

  window.CISTextFitEngine = {
    plainText,
    splitLines,
    normalizeLines,
    chunkLines,
    estimateLineCount,
    fitContent,
  };
})();
