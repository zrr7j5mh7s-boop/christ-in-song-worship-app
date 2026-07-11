(function () {
  "use strict";

  const ACCEPTED = [".json", ".pptx"];
  const MAX_FILE_MB = 250;

  let modalRoot = null;
  let escapeHtml = (value) => String(value || "");
  let callbacks = {};
  let uiState = null;
  let fileInput = null;

  function setModalRoot(el) {
    modalRoot = el;
  }

  function configure(options) {
    callbacks = options || {};
    if (typeof callbacks.escapeHtml === "function") escapeHtml = callbacks.escapeHtml;
    if (callbacks.modalRoot) modalRoot = callbacks.modalRoot;
  }

  function isOpen() {
    return Boolean(uiState);
  }

  function closeModal() {
    uiState = null;
    if (modalRoot) modalRoot.innerHTML = "";
    if (typeof callbacks.onClose === "function") callbacks.onClose();
  }

  function getExistingImportedPacks() {
    return typeof callbacks.getImportedPacks === "function" ? callbacks.getImportedPacks() : [];
  }

  function getAllLibraryPacks() {
    return typeof callbacks.getAllPacks === "function" ? callbacks.getAllPacks() : [];
  }

  function isBuiltinPack(code) {
    if (typeof callbacks.isBuiltinPack === "function") return callbacks.isBuiltinPack(code);
    return false;
  }

  function plainText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\r/g, "")
      .trim();
  }

  function padNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.padStart(3, "0");
  }

  function slugCode(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
  }

  function detectFileKind(file) {
    const name = String(file && file.name || "").toLowerCase();
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".pptx")) return "pptx";
    const type = String(file && file.type || "").toLowerCase();
    if (type.includes("json")) return "json";
    if (type.includes("presentation") || type.includes("officedocument")) return "pptx";
    return "";
  }

  function validateSelectedFile(file) {
    if (!file) return { ok: false, errors: ["No file was selected."] };
    const errors = [];
    const kind = detectFileKind(file);
    if (!kind) errors.push("Please choose a .json or .pptx language pack file.");
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      errors.push(`File is too large. Maximum size is ${MAX_FILE_MB} MB.`);
    }
    if (file.size === 0) errors.push("The selected file is empty.");
    return { ok: errors.length === 0, errors, kind };
  }

  function extractPacksFromJson(payload) {
    if (!payload || typeof payload !== "object") {
      return { packs: [], errors: ["JSON must be an object with language pack details."] };
    }
    const rawPacks = Array.isArray(payload.languagePacks)
      ? payload.languagePacks
      : Array.isArray(payload.songs)
        ? [payload]
        : payload.code && payload.songs
          ? [payload]
          : [];
    if (!rawPacks.length) {
      return {
        packs: [],
        errors: ["No language packs found. Expected `languagePacks`, or a single pack with `code`, `name`, and `songs`."],
      };
    }
    const packs = [];
    const errors = [];
    rawPacks.forEach((pack, index) => {
      const packErrors = validatePackShape(pack, index + 1);
      if (packErrors.length) {
        errors.push(...packErrors);
        return;
      }
      packs.push(normalizePackFromJson(pack));
    });
    return { packs, errors };
  }

  function validatePackShape(pack, indexLabel) {
    const errors = [];
    const label = typeof indexLabel === "number" ? `Pack ${indexLabel}` : String(indexLabel);
    if (!pack || typeof pack !== "object") return [`${label}: must be an object.`];
    if (!pack.code || !String(pack.code).trim()) errors.push(`${label}: missing language code (example: "sw").`);
    if (!pack.name || !String(pack.name).trim()) errors.push(`${label}: missing language name (example: "Swahili").`);
    if (!Array.isArray(pack.songs) || !pack.songs.length) errors.push(`${label}: must include at least one song in the songs array.`);
    if (Array.isArray(pack.songs)) {
      let invalidSongCount = 0;
      for (const song of pack.songs) {
        if (!song || !song.number || !song.title) invalidSongCount += 1;
        const hasSlides = Array.isArray(song.slides) && song.slides.length;
        const hasSections = Array.isArray(song.sections) && song.sections.length;
        if (!hasSlides && !hasSections) invalidSongCount += 1;
      }
      if (invalidSongCount) {
        errors.push(`${label}: ${invalidSongCount} song(s) are missing number, title, or slide/section content.`);
      }
    }
    return errors;
  }

  function normalizePackFromJson(pack, sourceName) {
    const store = window.CISPackStore;
    const normalized = store && store.normalizePack
      ? store.normalizePack({
          ...pack,
          source: pack.source || sourceName || "Imported JSON pack",
          importedAt: Date.now(),
        })
      : pack;
    return normalized;
  }

  function findEndOfCentralDirectory(buffer) {
    const view = new DataView(buffer);
    const minOffset = Math.max(0, buffer.byteLength - 65557);
    for (let offset = buffer.byteLength - 22; offset >= minOffset; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    return -1;
  }

  function readAscii(view, offset, length) {
    let out = "";
    for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
    return out;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot read PowerPoint files. Please export the pack as JSON and import that file instead.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer();
  }

  async function readZipEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const eocdOffset = findEndOfCentralDirectory(arrayBuffer);
    if (eocdOffset < 0) throw new Error("Could not read the PowerPoint archive. The file may be corrupted.");

    const centralDirOffset = view.getUint32(eocdOffset + 16, true);
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const entries = [];
    let offset = centralDirOffset;

    for (let index = 0; index < totalEntries; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const name = readAscii(view, offset + 46, fileNameLength);
      offset += 46 + fileNameLength + extraLength + commentLength;

      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = arrayBuffer.slice(dataOffset, dataOffset + compressedSize);
      let content = compressed;
      if (compression === 0) {
        content = compressed;
      } else if (compression === 8) {
        content = await inflateRaw(compressed);
      } else {
        continue;
      }
      entries.push({ name, content, size: uncompressedSize || content.byteLength });
    }
    return entries;
  }

  function xmlText(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return "";
    const parts = [];
    const nodes = doc.getElementsByTagName("*");
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node.localName === "t" && node.textContent) parts.push(node.textContent);
    }
    return plainText(parts.join("\n"));
  }

  function parseHymnHeading(text) {
    const lines = plainText(text).split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return null;
    const first = lines[0];
    const patterns = [
      /^(?:hymn|song|umculo|ingoma)?\s*#?\s*(\d{1,3})\s*[-.:)]\s*(.+)$/i,
      /^(\d{1,3})\s*[-.:)]\s*(.+)$/,
      /^(\d{1,3})\s+(.+)$/,
    ];
    for (const pattern of patterns) {
      const match = first.match(pattern);
      if (match) {
        return { number: padNumber(match[1]), title: match[2].trim(), bodyLines: lines.slice(1) };
      }
    }
    return null;
  }

  function classifySlideLabel(text, index) {
    const firstLine = plainText(text).split("\n")[0] || "";
    if (/chorus|refrain|soprano|isigqi|igama/i.test(firstLine)) return { kind: "chorus", label: "Chorus", marker: "" };
    const verseMatch = firstLine.match(/^verse\s*(\d+)/i);
    if (verseMatch) return { kind: "verse", label: `Verse ${verseMatch[1]}`, marker: verseMatch[1] };
    return { kind: "verse", label: `Verse ${index}`, marker: String(index) };
  }

  function buildSongFromSlides(number, title, slideTexts, languageCode, languageName) {
    const slides = [];
    const sections = [];
    slideTexts.forEach((text, index) => {
      const body = plainText(text);
      if (!body) return;
      const meta = classifySlideLabel(body, index + 1);
      const lines = body.split("\n");
      const cleanedBody = /^(verse|chorus|refrain)\b/i.test(lines[0] || "")
        ? lines.slice(1).join("\n").trim() || body
        : body;
      slides.push({
        kind: meta.kind,
        label: meta.label,
        marker: meta.marker,
        body: cleanedBody,
        sourceSlide: `PPTX ${index + 1}`,
        slideInHymn: slides.length + 1,
        totalSlides: 0,
      });
      sections.push({
        kind: meta.kind,
        label: meta.label,
        marker: meta.marker,
        body: cleanedBody,
      });
    });
    slides.forEach((slide) => { slide.totalSlides = slides.length; });
    return {
      number: padNumber(number),
      title: String(title || `Hymn ${number}`).trim(),
      language: languageName || "",
      languageCode: languageCode || "",
      slides,
      sections,
      hasChorus: sections.some((section) => section.kind === "chorus"),
    };
  }

  async function parsePptxFile(file, meta) {
    const buffer = await file.arrayBuffer();
    const entries = await readZipEntries(buffer);
    const slideEntries = entries
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
      .sort((a, b) => {
        const aNum = Number((a.name.match(/slide(\d+)/i) || [])[1] || 0);
        const bNum = Number((b.name.match(/slide(\d+)/i) || [])[1] || 0);
        return aNum - bNum;
      });
    if (!slideEntries.length) {
      throw new Error("No hymn slides were found inside the PowerPoint file.");
    }

    const texts = slideEntries.map((entry) => xmlText(new TextDecoder("utf-8").decode(entry.content))).filter(Boolean);
    if (!texts.length) throw new Error("Slides were found, but no readable hymn text could be extracted.");

    const songs = [];
    let current = null;
    texts.forEach((text) => {
      const heading = parseHymnHeading(text);
      if (heading && heading.number) {
        if (current) songs.push(current);
        const body = heading.bodyLines.length ? heading.bodyLines.join("\n") : "";
        current = {
          number: heading.number,
          title: heading.title,
          slideTexts: body ? [body] : [],
        };
        return;
      }
      if (!current) {
        const fallbackNumber = padNumber(songs.length + 1);
        current = { number: fallbackNumber, title: `Hymn ${fallbackNumber}`, slideTexts: [] };
      }
      current.slideTexts.push(text);
    });
    if (current) songs.push(current);

    const languageName = String(meta.name || "").trim() || "Imported Language";
    const languageCode = slugCode(meta.code || languageName).slice(0, 12) || `import-${Date.now()}`;
    const normalizedSongs = songs
      .map((song) => buildSongFromSlides(song.number, song.title, song.slideTexts, languageCode, languageName))
      .filter((song) => song.slides.length);

    if (!normalizedSongs.length) throw new Error("No complete hymns could be built from the PowerPoint slides.");

    const pack = normalizePackFromJson({
      code: languageCode,
      name: languageName,
      status: "ready",
      songCount: normalizedSongs.length,
      source: file.name,
      songs: normalizedSongs,
      importedAt: Date.now(),
    }, file.name);

    return { packs: [pack], errors: validatePackShape(pack, pack.name) };
  }

  function analyzeDuplicates(incomingPacks) {
    const imported = getExistingImportedPacks();
    const all = getAllLibraryPacks();
    return incomingPacks.map((pack) => {
      const existingImported = imported.find((item) => item.code === pack.code) || null;
      const existingAny = all.find((item) => item.code === pack.code) || null;
      const overlap = existingAny
        ? (pack.songs || []).filter((song) => (existingAny.songs || []).some((existingSong) => existingSong.number === song.number)).length
        : 0;
      return {
        pack,
        existingImported,
        existingAny,
        overlap,
        isBuiltin: isBuiltinPack(pack.code),
        isNew: !existingAny,
      };
    });
  }

  function applyDuplicateStrategy(existingPack, incomingPack, strategy) {
    if (!existingPack) return incomingPack;
    if (strategy === "overwrite") {
      return {
        ...incomingPack,
        source: incomingPack.source || existingPack.source,
        importedAt: Date.now(),
      };
    }
    const existingByNumber = new Map((existingPack.songs || []).map((song) => [song.number, song]));
    const incomingSongs = incomingPack.songs || [];
    if (strategy === "skip") {
      const newSongs = incomingSongs.filter((song) => !existingByNumber.has(song.number));
      return {
        ...existingPack,
        name: incomingPack.name || existingPack.name,
        songs: [...existingPack.songs, ...newSongs],
        songCount: existingPack.songs.length + newSongs.length,
        source: incomingPack.source || existingPack.source,
        importedAt: Date.now(),
      };
    }
    for (const song of incomingSongs) existingByNumber.set(song.number, song);
    const mergedSongs = [...existingByNumber.values()].sort((a, b) => Number(a.number) - Number(b.number));
    return {
      ...existingPack,
      ...incomingPack,
      songs: mergedSongs,
      songCount: mergedSongs.length,
      importedAt: Date.now(),
    };
  }

  async function commitImport(packs, duplicateStrategy) {
    const store = window.CISPackStore;
    const imported = getExistingImportedPacks();
    const byCode = new Map(imported.map((pack) => [pack.code, pack]));
    const summaryItems = [];

    for (const incoming of packs) {
      const existingImported = byCode.get(incoming.code) || null;
      const existingAny = getAllLibraryPacks().find((pack) => pack.code === incoming.code) || null;
      const baseExisting = existingImported || (existingAny && !isBuiltinPack(incoming.code) ? existingAny : null);
      let finalPack = incoming;
      let added = incoming.songs.length;
      let updated = 0;
      let skipped = 0;

      if (baseExisting) {
        const beforeNumbers = new Set((baseExisting.songs || []).map((song) => song.number));
        finalPack = applyDuplicateStrategy(baseExisting, incoming, duplicateStrategy);
        const afterNumbers = new Set((finalPack.songs || []).map((song) => song.number));
        added = [...afterNumbers].filter((number) => !beforeNumbers.has(number)).length;
        updated = duplicateStrategy === "merge"
          ? (incoming.songs || []).filter((song) => beforeNumbers.has(song.number)).length
          : duplicateStrategy === "overwrite"
            ? finalPack.songs.length
            : 0;
        skipped = duplicateStrategy === "skip"
          ? (incoming.songs || []).filter((song) => beforeNumbers.has(song.number)).length
          : 0;
      }

      if (store && store.savePack) await store.savePack(finalPack);
      byCode.set(finalPack.code, finalPack);
      summaryItems.push({
        code: finalPack.code,
        name: finalPack.name,
        added,
        updated,
        skipped,
        total: finalPack.songs.length,
        isNew: !baseExisting,
      });
    }

    const nextImported = [...byCode.values()];
    if (typeof callbacks.onImported === "function") {
      await callbacks.onImported({
        importedPacks: nextImported,
        summaryItems,
      });
    }
    if (store && store.recordImportSummary) {
      await store.recordImportSummary({
        items: summaryItems,
        importedAt: Date.now(),
      });
    }
    return summaryItems;
  }

  function renderProgress(value, label) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return `
      <div class="pack-import-progress">
        <div class="pack-import-progress-bar" style="width:${pct}%"></div>
      </div>
      <p class="pack-import-progress-label">${escapeHtml(label || "Processing…")}</p>
    `;
  }

  function renderErrorList(errors) {
    if (!errors || !errors.length) return "";
    return `
      <ul class="pack-import-errors">
        ${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}
      </ul>
    `;
  }

  function renderModal() {
    if (!modalRoot || !uiState) return;
    const step = uiState.step;
    const file = uiState.file;
    const fileName = file ? file.name : "";
    const fileSize = file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : "";

    let body = "";
    if (step === "select") {
      body = `
        <div class="pack-import-drop ${uiState.dragging ? "dragging" : ""}" data-drop-zone="true">
          <div class="pack-import-drop-icon" aria-hidden="true">⬆</div>
          <strong>Drop your language pack here</strong>
          <p>Accepted formats: <strong>.json</strong> (recommended) or <strong>.pptx</strong></p>
          <p class="muted">JSON packs import instantly. PowerPoint packs are converted in this app — no technical tools required.</p>
          <button class="action-button" type="button" data-import-action="choose-file">Choose File</button>
        </div>
        ${uiState.errors.length ? `<div class="pack-import-alert error">${renderErrorList(uiState.errors)}</div>` : ""}
      `;
    }

    if (step === "validate") {
      const duplicateInfo = uiState.duplicateAnalysis || [];
      const needsMeta = uiState.kind === "pptx";
      body = uiState.loading
        ? `
          <div class="pack-import-working">
            ${renderProgress(uiState.progress, uiState.progressLabel)}
            <p class="muted">Checking your file and preparing a safe import preview…</p>
          </div>
        `
        : `
        <div class="pack-import-review">
          <div class="pack-import-file-card">
            <strong>${escapeHtml(fileName)}</strong>
            <span class="muted">${escapeHtml(fileSize)} · ${uiState.kind === "json" ? "JSON pack" : "PowerPoint pack"}</span>
          </div>
          ${uiState.errors.length
            ? `<div class="pack-import-alert error"><strong>Please fix these issues</strong>${renderErrorList(uiState.errors)}</div>`
            : `<div class="pack-import-alert success"><strong>Ready to import</strong><p>${escapeHtml(uiState.readyMessage)}</p></div>`}
          ${needsMeta ? `
            <div class="pack-import-meta form-grid">
              <label>
                <span>Language name</span>
                <input id="packImportLanguageName" type="text" value="${escapeHtml(uiState.meta.name)}" placeholder="Swahili">
              </label>
              <label>
                <span>Language code</span>
                <input id="packImportLanguageCode" type="text" value="${escapeHtml(uiState.meta.code)}" placeholder="sw" maxlength="24">
                <small class="muted">Short code used in the language selector (example: sw, fr, pt).</small>
              </label>
            </div>
          ` : ""}
          ${duplicateInfo.some((item) => !item.isNew) ? `
            <div class="pack-import-duplicates">
              <strong>Duplicate language detected</strong>
              <p class="muted">Choose what to do when hymn numbers already exist in your library.</p>
              <div class="pack-import-strategy">
                <label><input type="radio" name="duplicateStrategy" value="skip" ${uiState.duplicateStrategy === "skip" ? "checked" : ""}> Skip duplicates — keep existing hymns, add only new numbers</label>
                <label><input type="radio" name="duplicateStrategy" value="overwrite" ${uiState.duplicateStrategy === "overwrite" ? "checked" : ""}> Overwrite — replace the entire imported language pack</label>
                <label><input type="radio" name="duplicateStrategy" value="merge" ${uiState.duplicateStrategy === "merge" ? "checked" : ""}> Merge — update matching hymn numbers, keep the rest</label>
              </div>
              <ul class="pack-import-duplicate-list">
                ${duplicateInfo.map((item) => `
                  <li>
                    <strong>${escapeHtml(item.pack.name)}</strong>
                    <span>${item.isNew ? "New language" : `${item.overlap} overlapping hymn number(s)`}${item.isBuiltin ? " · Built-in pack" : ""}</span>
                  </li>
                `).join("")}
              </ul>
            </div>
          ` : ""}
        </div>
      `;
    }

    if (step === "importing") {
      body = `
        <div class="pack-import-working">
          ${renderProgress(uiState.progress, uiState.progressLabel)}
          <p class="muted">Please keep this window open while hymns are added to your offline library.</p>
        </div>
      `;
    }

    if (step === "success") {
      const lines = (uiState.summaryItems || []).map((item) => {
        if (item.isNew) return `Imported ${item.added} new hymns in ${item.name}`;
        if (item.added && item.updated) return `Added ${item.added} and updated ${item.updated} hymns in ${item.name}`;
        if (item.added) return `Imported ${item.added} new hymns in ${item.name}`;
        if (item.updated) return `Updated ${item.updated} hymns in ${item.name}`;
        if (item.skipped) return `No new hymns added in ${item.name} (${item.skipped} duplicates skipped)`;
        return `${item.name} now has ${item.total} hymns`;
      });
      body = `
        <div class="pack-import-success">
          <div class="pack-import-success-icon" aria-hidden="true">✓</div>
          <strong>Import complete</strong>
          <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
          <p class="muted">The language selector and search index have been refreshed. You can start presenting immediately.</p>
        </div>
      `;
    }

    if (step === "error") {
      body = `
        <div class="pack-import-alert error">
          <strong>Import failed</strong>
          ${renderErrorList(uiState.errors)}
        </div>
      `;
    }

    const footer = step === "select"
      ? `<button class="secondary-button" type="button" data-import-action="close">Cancel</button>`
        : step === "validate"
        ? uiState.loading
          ? `<button class="secondary-button" type="button" data-import-action="back">Back</button>`
          : `
          <button class="secondary-button" type="button" data-import-action="back">Back</button>
          <button class="action-button" type="button" data-import-action="import" ${uiState.errors.length ? "disabled" : ""}>Import Language Pack</button>
        `
        : step === "success"
          ? `<button class="action-button" type="button" data-import-action="close">Done</button>`
          : step === "error"
            ? `
              <button class="secondary-button" type="button" data-import-action="back">Try Another File</button>
              <button class="secondary-button" type="button" data-import-action="close">Close</button>
            `
            : "";

    modalRoot.innerHTML = `
      <div class="modal-backdrop pack-import-backdrop" data-import-action="close">
        <div class="modal pack-import-modal" role="dialog" aria-modal="true" aria-label="Import language pack">
          <div class="song-header">
            <div>
              <p class="eyebrow">Language library</p>
              <h2>Import Language Pack</h2>
              <p class="muted">Add a new hymn language for offline worship — no coding required.</p>
            </div>
            <button class="secondary-button" type="button" data-import-action="close">Close</button>
          </div>
          <div class="pack-import-body">${body}</div>
          ${footer ? `<div class="pack-import-footer">${footer}</div>` : ""}
        </div>
      </div>
    `;

    bindModalEvents();
  }

  function bindModalEvents() {
    if (!modalRoot) return;
    const backdrop = modalRoot.querySelector(".pack-import-backdrop");
    const modal = modalRoot.querySelector(".pack-import-modal");
    const dropZone = modalRoot.querySelector("[data-drop-zone]");

    modalRoot.querySelectorAll("[data-import-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleAction(button.dataset.importAction, button);
      });
    });

    if (backdrop) {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop && uiState && uiState.step !== "importing") closeModal();
      });
    }
    if (modal) modal.addEventListener("click", (event) => event.stopPropagation());

    if (dropZone) {
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        uiState.dragging = true;
        renderModal();
      });
      dropZone.addEventListener("dragleave", () => {
        uiState.dragging = false;
        renderModal();
      });
      dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        uiState.dragging = false;
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        handleSelectedFile(file);
      });
    }

    const nameInput = modalRoot.querySelector("#packImportLanguageName");
    const codeInput = modalRoot.querySelector("#packImportLanguageCode");
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        uiState.meta.name = nameInput.value;
        if (!uiState.meta.codeTouched) uiState.meta.code = slugCode(nameInput.value);
        refreshDuplicatePreview();
      });
    }
    if (codeInput) {
      codeInput.addEventListener("input", () => {
        uiState.meta.codeTouched = true;
        uiState.meta.code = slugCode(codeInput.value);
        refreshDuplicatePreview();
      });
    }

    modalRoot.querySelectorAll('input[name="duplicateStrategy"]').forEach((input) => {
      input.addEventListener("change", () => {
        uiState.duplicateStrategy = input.value;
      });
    });
  }

  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,.pptx,application/json,application/vnd.openxmlformats-officedocument.presentationml.presentation";
    fileInput.className = "hidden";
    fileInput.addEventListener("change", () => {
      handleSelectedFile(fileInput.files && fileInput.files[0]);
      fileInput.value = "";
    });
    document.body.appendChild(fileInput);
    return fileInput;
  }

  async function handleSelectedFile(file) {
    const checked = validateSelectedFile(file);
    if (!checked.ok) {
      uiState = {
        step: uiState && uiState.step === "select" ? "select" : "error",
        file: file || null,
        errors: checked.errors,
        dragging: false,
      };
      renderModal();
      return;
    }

    uiState = {
      step: "validate",
      file,
      kind: checked.kind,
      errors: [],
      packs: [],
      duplicateAnalysis: [],
      duplicateStrategy: "skip",
      meta: {
        name: guessLanguageNameFromFile(file.name),
        code: slugCode(guessLanguageNameFromFile(file.name)),
        codeTouched: false,
      },
      progress: 8,
      progressLabel: "Reading file…",
      dragging: false,
      loading: true,
    };
    renderModal();

    try {
      if (checked.kind === "json") {
        uiState.progress = 25;
        uiState.progressLabel = "Validating JSON…";
        renderModal();
        const text = await file.text();
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (_error) {
          throw new Error("The JSON file could not be read. Check that it is valid JSON.");
        }
        const result = extractPacksFromJson(payload);
        uiState.errors = result.errors;
        uiState.packs = result.packs;
      } else {
        uiState.progress = 20;
        uiState.progressLabel = "Reading PowerPoint slides…";
        renderModal();
        const result = await parsePptxFile(file, uiState.meta);
        uiState.errors = result.errors;
        uiState.packs = result.packs;
        if (result.packs[0]) {
          uiState.meta.name = result.packs[0].name;
          uiState.meta.code = result.packs[0].code;
        }
      }

      if (!uiState.errors.length && uiState.packs.length) {
        const totalSongs = uiState.packs.reduce((sum, pack) => sum + (pack.songs || []).length, 0);
        uiState.readyMessage = `${uiState.packs.length} language pack(s), ${totalSongs} hymn(s) ready to import.`;
        uiState.duplicateAnalysis = analyzeDuplicates(uiState.packs);
        if (uiState.duplicateAnalysis.some((item) => item.isBuiltin)) {
          uiState.errors.push("One or more language codes match built-in packs. Choose a different code for imported languages.");
        }
        if (uiState.kind === "pptx" && (!uiState.meta.name || !uiState.meta.code)) {
          uiState.errors.push("Enter a language name and code before importing the PowerPoint pack.");
        }
      }
      uiState.progress = 0;
      uiState.progressLabel = "";
      uiState.loading = false;
    } catch (error) {
      uiState.step = "error";
      uiState.errors = [error && error.message ? error.message : "The file could not be processed."];
      uiState.loading = false;
    }
    renderModal();
  }

  function guessLanguageNameFromFile(name) {
    const base = String(name || "").replace(/\.(json|pptx)$/i, "");
    const cleaned = base
      .replace(/christ[_\s-]*in[_\s-]*song/gi, "")
      .replace(/language[_\s-]*pack/gi, "")
      .replace(/[_-]+/g, " ")
      .trim();
    return cleaned || "Imported Language";
  }

  async function runImport() {
    if (!uiState || uiState.step !== "validate" || uiState.errors.length) return;
    if (uiState.kind === "pptx") {
      const nameInput = modalRoot && modalRoot.querySelector("#packImportLanguageName");
      const codeInput = modalRoot && modalRoot.querySelector("#packImportLanguageCode");
      uiState.meta.name = nameInput ? nameInput.value.trim() : uiState.meta.name;
      uiState.meta.code = slugCode(codeInput ? codeInput.value : uiState.meta.code);
      if (!uiState.meta.name || !uiState.meta.code) {
        uiState.errors = ["Enter a language name and code before importing."];
        renderModal();
        return;
      }
      try {
        uiState.step = "importing";
        uiState.progress = 35;
        uiState.progressLabel = "Converting PowerPoint slides…";
        renderModal();
        const result = await parsePptxFile(uiState.file, uiState.meta);
        uiState.errors = result.errors;
        uiState.packs = result.packs;
        if (uiState.errors.length) {
          uiState.step = "error";
          renderModal();
          return;
        }
      } catch (error) {
        uiState.step = "error";
        uiState.errors = [error && error.message ? error.message : "PowerPoint conversion failed."];
        renderModal();
        return;
      }
    }

    uiState.step = "importing";
    uiState.progress = 72;
    uiState.progressLabel = "Saving hymns to your offline library…";
    renderModal();

    try {
      const summaryItems = await commitImport(uiState.packs, uiState.duplicateStrategy || "skip");
      uiState.step = "success";
      uiState.summaryItems = summaryItems;
      uiState.progress = 100;
      uiState.progressLabel = "Complete";
      renderModal();
    } catch (error) {
      uiState.step = "error";
      uiState.errors = [error && error.message ? error.message : "The import could not be saved."];
      renderModal();
    }
  }

  function refreshDuplicatePreview() {
    if (!uiState || !uiState.packs.length) {
      renderModal();
      return;
    }
    if (uiState.kind === "pptx") {
      uiState.packs = uiState.packs.map((pack) => ({
        ...pack,
        code: uiState.meta.code || pack.code,
        name: uiState.meta.name || pack.name,
      }));
    }
    uiState.duplicateAnalysis = analyzeDuplicates(uiState.packs);
    uiState.errors = uiState.errors.filter((error) => !/built-in packs/i.test(error));
    if (uiState.duplicateAnalysis.some((item) => item.isBuiltin)) {
      uiState.errors.push("One or more language codes match built-in packs. Choose a different code for imported languages.");
    }
    renderModal();
  }

  function handleAction(action) {
    if (action === "close") return closeModal();
    if (action === "choose-file") return ensureFileInput().click();
    if (action === "back") {
      uiState = { step: "select", errors: [], dragging: false };
      renderModal();
      return;
    }
    if (action === "import") return runImport();
  }

  function openModal(options) {
    configure(options);
    uiState = { step: "select", errors: [], dragging: false };
    renderModal();
  }

  window.CISPackImport = {
    configure,
    openModal,
    closeModal,
    isOpen,
    validateSelectedFile,
    extractPacksFromJson,
    parsePptxFile,
    analyzeDuplicates,
    commitImport,
  };
})();
