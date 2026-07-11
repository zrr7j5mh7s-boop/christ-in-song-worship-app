(function () {
  "use strict";

  const DEFAULT_PREFS = {
    churchName: "",
    churchSubtitle: "",
    serviceTitle: "Sabbath Worship Service",
    headerText: "",
    footerText: "Christ in Song · VaChinoda Worship",
    dateLabel: "",
    includeSongService: true,
    includeNotes: true,
  };

  let escapeHtml = (value) => String(value || "");
  let modalRoot = null;
  let callbacks = {};
  let uiState = null;

  function configure(options) {
    callbacks = options || {};
    if (typeof callbacks.escapeHtml === "function") escapeHtml = options.escapeHtml;
    if (callbacks.modalRoot) modalRoot = callbacks.modalRoot;
  }

  function call(name, ...args) {
    if (typeof callbacks[name] === "function") return callbacks[name](...args);
    return undefined;
  }

  function loadPrefs() {
    const saved = call("loadPrefs");
    return { ...DEFAULT_PREFS, ...(saved || {}) };
  }

  function savePrefs(prefs) {
    call("savePrefs", prefs);
  }

  function plainText(value) {
    if (window.CISSlideContent && window.CISSlideContent.plainText) {
      return window.CISSlideContent.plainText(value);
    }
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  function resolveSlotType(slot) {
    if (window.CISSlideContent && window.CISSlideContent.resolveSlotType) {
      return window.CISSlideContent.resolveSlotType(slot);
    }
    return slot && slot.songKey ? "hymn" : "announcement";
  }

  function hymnFirstLine(song) {
    if (!song) return "";
    const section = (song.sections && song.sections[0]) || (song.slides && song.slides[0]);
    if (!section || !section.body) return "";
    return plainText(section.body).split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
  }

  function buildSongEntry(song, role, number) {
    if (!song) {
      return {
        number,
        role: role || "Song",
        type: "hymn",
        title: "To be assigned",
        hymnNumber: "",
        hymnTitle: "",
        firstLine: "",
        bodyText: "",
        notes: "",
      };
    }
    return {
      number,
      role: role || "Song",
      type: "hymn",
      title: `Hymn ${song.number} · ${song.title}`,
      hymnNumber: song.number,
      hymnTitle: song.title,
      firstLine: hymnFirstLine(song),
      bodyText: "",
      notes: "",
      language: song.language || "",
    };
  }

  function buildSlotEntry(slot, index, helpers) {
    const number = index + 1;
    const role = slot.role || `Item ${number}`;
    const type = resolveSlotType(slot);
    const song = helpers.getSongForSlot(slot);
    const hasContent = helpers.slotHasContent(slot);

    if (type === "hymn") {
      if (!song) {
        return {
          number,
          role,
          type,
          title: "To be assigned",
          hymnNumber: "",
          hymnTitle: "",
          firstLine: "",
          bodyText: "",
          notes: slot.notes || "",
        };
      }
      return {
        number,
        role,
        type,
        title: `Hymn ${song.number} · ${song.title}`,
        hymnNumber: song.number,
        hymnTitle: song.title,
        firstLine: hymnFirstLine(song),
        bodyText: "",
        notes: slot.notes || "",
        language: song.language || helpers.getPackName(slot),
      };
    }

    const bodyText = plainText(slot.body || "");
    const scriptureRef = slot.scriptureRef || (type === "scripture" ? slot.title : "");
    const title = scriptureRef
      ? `${role}${slot.title && slot.title !== scriptureRef ? ` · ${slot.title}` : ""}`
      : (slot.title || role);

    return {
      number,
      role,
      type,
      title,
      hymnNumber: "",
      hymnTitle: "",
      firstLine: type !== "scripture" ? bodyText.split("\n").filter(Boolean)[0] || "" : "",
      bodyText: type === "scripture" || type === "prayer" || type === "benediction" ? bodyText : (hasContent ? bodyText : ""),
      scriptureRef,
      notes: slot.notes || "",
    };
  }

  function buildBulletinModel(serviceData, prefs) {
    const helpers = serviceData.helpers || serviceData;
    const songService = (serviceData.songService || []).filter((slot) => helpers.slotHasContent(slot));
    const worshipPlan = serviceData.worshipPlan || [];
    const dateLabel = (prefs && prefs.dateLabel)
      ? prefs.dateLabel
      : new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const openingSongs = prefs.includeSongService
      ? songService.map((slot, index) => buildSlotEntry(slot, index, helpers))
      : [];

    const orderOfService = worshipPlan.map((slot, index) => buildSlotEntry(slot, index, helpers));

    return {
      churchName: prefs.churchName || "Your Church Name",
      churchSubtitle: prefs.churchSubtitle || "",
      serviceTitle: prefs.serviceTitle || DEFAULT_PREFS.serviceTitle,
      headerText: prefs.headerText || prefs.churchName || "Your Church Name",
      footerText: prefs.footerText || DEFAULT_PREFS.footerText,
      dateLabel,
      includeNotes: prefs.includeNotes !== false,
      openingSongs,
      orderOfService,
      generatedAt: new Date().toLocaleString(),
    };
  }

  function bulletinStyles() {
    return `
      @page {
        size: letter;
        margin: 0.7in 0.8in 0.85in;
      }
      @page :first {
        margin-top: 0.75in;
      }
      * { box-sizing: border-box; }
      html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        margin: 0;
        color: #1a2433;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 11.5pt;
        line-height: 1.45;
        background: white;
      }
      .bulletin-sheet {
        max-width: 7.2in;
        margin: 0 auto;
        padding: 0.2in 0;
      }
      .bulletin-header {
        text-align: center;
        padding-bottom: 14px;
        border-bottom: 2px solid #1f3b63;
        margin-bottom: 22px;
        break-after: avoid;
        page-break-after: avoid;
      }
      .bulletin-header .church-name {
        font-size: 24pt;
        letter-spacing: 0.03em;
        margin: 0;
        font-weight: 700;
        color: #10233f;
      }
      .bulletin-header .church-subtitle,
      .bulletin-header .service-date {
        margin: 4px 0 0;
        color: #5e6575;
        font-size: 10.5pt;
        font-family: "Helvetica Neue", Arial, sans-serif;
      }
      .bulletin-header .service-title {
        margin: 14px 0 0;
        font-size: 15pt;
        font-weight: 700;
        color: #1f3b63;
      }
      .bulletin-section-title {
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 10pt;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6a7488;
        margin: 0 0 10px;
        break-after: avoid;
        page-break-after: avoid;
      }
      .bulletin-block {
        margin-bottom: 24px;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .bulletin-block + .bulletin-block {
        break-before: auto;
        page-break-before: auto;
      }
      .service-item {
        display: grid;
        grid-template-columns: 34px 1fr;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid #e4e0d6;
        break-inside: avoid;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
      }
      .service-item:last-child { border-bottom: 0; }
      .service-number {
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 12pt;
        font-weight: 800;
        color: #1f3b63;
        padding-top: 1px;
      }
      .service-role {
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #42526b;
        margin-bottom: 3px;
      }
      .service-content {
        font-size: 12pt;
        font-weight: 700;
        color: #10233f;
        margin-bottom: 4px;
      }
      .service-first-line {
        font-style: italic;
        color: #334155;
        margin: 2px 0 0;
      }
      .service-body {
        margin: 6px 0 0;
        white-space: pre-wrap;
        color: #243041;
      }
      .service-notes {
        margin-top: 6px;
        padding: 7px 9px;
        border-left: 3px solid #c9a24a;
        background: #faf7ef;
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 9.5pt;
        color: #5e4b2d;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .service-notes strong {
        display: block;
        font-size: 8.5pt;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .bulletin-footer {
        margin-top: 28px;
        padding-top: 10px;
        border-top: 1px solid #d9d4c8;
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 9pt;
        color: #6a7488;
        text-align: center;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .print-toolbar {
        text-align: center;
        margin-top: 18px;
        font-family: Arial, sans-serif;
        color: #5e6575;
        font-size: 13px;
      }
      .print-toolbar button {
        padding: 10px 18px;
        font-size: 14px;
        cursor: pointer;
        border: 1px solid #c8d0dc;
        border-radius: 8px;
        background: #f7f9fc;
        margin: 0 6px 8px;
      }
      @media screen {
        body { background: #eceae4; padding: 24px; }
        .bulletin-sheet {
          background: white;
          box-shadow: 0 10px 30px rgba(16, 35, 63, 0.12);
          padding: 0.55in 0.65in;
        }
      }
      @media print {
        body { background: white; padding: 0; }
        .bulletin-sheet {
          box-shadow: none;
          max-width: none;
          padding: 0;
        }
        .no-print { display: none !important; }
        a { color: inherit; text-decoration: none; }
      }
      @media print and (size: a4) {
        @page { size: A4; margin: 18mm 20mm 22mm; }
      }
    `;
  }

  function renderItemHtml(item, includeNotes) {
    const content = item.hymnNumber
      ? `Hymn ${escapeHtml(item.hymnNumber)} · ${escapeHtml(item.hymnTitle)}`
      : escapeHtml(item.scriptureRef ? `${item.role} · ${item.scriptureRef}` : item.title);
    const firstLine = item.firstLine && item.type !== "scripture"
      ? `<p class="service-first-line">"${escapeHtml(item.firstLine)}"</p>`
      : "";
    const body = item.bodyText
      ? `<div class="service-body">${escapeHtml(item.bodyText)}</div>`
      : "";
    const notes = includeNotes && item.notes
      ? `<div class="service-notes"><strong>Elder / AV Notes</strong>${escapeHtml(item.notes)}</div>`
      : "";
    return `
      <article class="service-item">
        <div class="service-number">${escapeHtml(String(item.number))}</div>
        <div>
          <div class="service-role">${escapeHtml(item.role)}</div>
          <div class="service-content">${content}</div>
          ${firstLine}
          ${body}
          ${notes}
        </div>
      </article>
    `;
  }

  function renderHtml(model) {
    const opening = model.openingSongs.length
      ? `
        <section class="bulletin-block">
          <h2 class="bulletin-section-title">Song Service</h2>
          ${model.openingSongs.map((item) => renderItemHtml(item, model.includeNotes)).join("")}
        </section>
      `
      : "";
    const order = `
      <section class="bulletin-block">
        <h2 class="bulletin-section-title">Order of Service</h2>
        ${model.orderOfService.map((item) => renderItemHtml(item, model.includeNotes)).join("")}
      </section>
    `;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.serviceTitle)} · ${escapeHtml(model.dateLabel)}</title>
  <style>${bulletinStyles()}</style>
</head>
<body>
  <div class="bulletin-sheet">
    <header class="bulletin-header">
      <h1 class="church-name">${escapeHtml(model.churchName)}</h1>
      ${model.churchSubtitle ? `<p class="church-subtitle">${escapeHtml(model.churchSubtitle)}</p>` : ""}
      <h2 class="service-title">${escapeHtml(model.serviceTitle)}</h2>
      <p class="service-date">${escapeHtml(model.dateLabel)}</p>
    </header>
    ${opening}
    ${order}
    <footer class="bulletin-footer">${escapeHtml(model.footerText)}</footer>
  </div>
  <div class="no-print print-toolbar">
    <p>Use your browser print dialog. Choose Letter or A4 paper for best results.</p>
    <button type="button" onclick="window.print()">Print Bulletin</button>
  </div>
</body>
</html>`;
  }

  function pdfItemStack(item, includeNotes) {
    const stack = [
      { text: item.role, style: "itemRole" },
    ];
    if (item.hymnNumber) {
      stack.push({ text: `Hymn ${item.hymnNumber} · ${item.hymnTitle}`, style: "itemContent" });
      if (item.firstLine) stack.push({ text: `"${item.firstLine}"`, style: "firstLine" });
    } else {
      const heading = item.scriptureRef ? `${item.role} · ${item.scriptureRef}` : item.title;
      stack.push({ text: heading, style: "itemContent" });
      if (item.firstLine && !item.bodyText) stack.push({ text: item.firstLine, style: "firstLine" });
      if (item.bodyText) stack.push({ text: item.bodyText, style: "scriptureBody" });
    }
    if (includeNotes && item.notes) {
      stack.push({
        margin: [0, 4, 0, 0],
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              { text: "Elder / AV Notes", style: "notesLabel" },
              { text: item.notes, style: "notesBody" },
            ],
            fillColor: "#faf7ef",
            border: [false, false, false, false],
          }]],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      });
    }
    return {
      columns: [
        { width: 24, text: String(item.number), style: "itemNumber" },
        { width: "*", stack },
      ],
      margin: [0, 0, 0, 10],
    };
  }

  function buildPdfDefinition(model) {
    const content = [
      { text: model.churchName, style: "churchName", alignment: "center" },
    ];
    if (model.churchSubtitle) {
      content.push({ text: model.churchSubtitle, style: "churchSubtitle", alignment: "center", margin: [0, 2, 0, 0] });
    }
    content.push(
      { text: model.serviceTitle, style: "serviceTitle", alignment: "center", margin: [0, 10, 0, 2] },
      { text: model.dateLabel, style: "serviceDate", alignment: "center", margin: [0, 0, 0, 10] },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 504, y2: 0, lineWidth: 1.4, lineColor: "#1f3b63" }],
        margin: [0, 0, 0, 16],
      },
    );

    if (model.openingSongs.length) {
      content.push({ text: "SONG SERVICE", style: "sectionTitle", margin: [0, 0, 0, 8] });
      model.openingSongs.forEach((item) => content.push(pdfItemStack(item, model.includeNotes)));
      content.push({ text: "", margin: [0, 0, 0, 8] });
    }

    content.push({ text: "ORDER OF SERVICE", style: "sectionTitle", margin: [0, 0, 0, 8] });
    model.orderOfService.forEach((item) => content.push(pdfItemStack(item, model.includeNotes)));

    return {
      pageSize: "LETTER",
      pageMargins: [54, 68, 54, 58],
      defaultStyle: {
        font: "Roboto",
        fontSize: 10.5,
        color: "#1a2433",
        lineHeight: 1.25,
      },
      styles: {
        churchName: { fontSize: 22, bold: true, color: "#10233f" },
        churchSubtitle: { fontSize: 10, color: "#5e6575" },
        serviceTitle: { fontSize: 14, bold: true, color: "#1f3b63" },
        serviceDate: { fontSize: 10, color: "#5e6575" },
        sectionTitle: { fontSize: 9, bold: true, color: "#6a7488", characterSpacing: 1 },
        itemNumber: { fontSize: 11, bold: true, color: "#1f3b63" },
        itemRole: { fontSize: 8.5, bold: true, color: "#42526b", characterSpacing: 0.6, margin: [0, 0, 0, 2] },
        itemContent: { fontSize: 11, bold: true, color: "#10233f" },
        firstLine: { fontSize: 10, italics: true, color: "#334155", margin: [0, 2, 0, 0] },
        scriptureBody: { fontSize: 10, color: "#243041", margin: [0, 4, 0, 0] },
        notesLabel: { fontSize: 7.5, bold: true, color: "#5e4b2d", characterSpacing: 0.8, margin: [0, 0, 0, 2] },
        notesBody: { fontSize: 9, color: "#5e4b2d" },
        runningHeader: { fontSize: 8.5, color: "#6a7488" },
        footer: { fontSize: 8.5, color: "#6a7488" },
      },
      header(currentPage) {
        if (currentPage === 1) return null;
        return {
          text: model.headerText,
          alignment: "center",
          style: "runningHeader",
          margin: [0, 22, 0, 0],
        };
      },
      footer(currentPage, pageCount) {
        return {
          margin: [54, 0, 54, 24],
          columns: [
            { text: model.footerText, style: "footer", alignment: "left" },
            { text: `Page ${currentPage} of ${pageCount}`, style: "footer", alignment: "right" },
          ],
        };
      },
      content,
      info: {
        title: `${model.serviceTitle} Bulletin`,
        author: model.churchName,
        subject: "Worship Service Bulletin",
      },
    };
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadHtml(model) {
    const html = renderHtml(model);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`christ-in-song-bulletin-${stamp}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function openPrintPreview(model) {
    const html = renderHtml(model);
    const preview = window.open("", "_blank");
    if (!preview) {
      call("setNotice", "Pop-up blocked. Allow pop-ups to preview the bulletin, or export HTML instead.");
      return;
    }
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
    preview.focus();
    preview.onload = () => {
      try {
        preview.print();
      } catch (_error) {
        /* print may require user gesture */
      }
    };
  }

  function ensurePdfMake() {
    if (typeof window.pdfMake === "undefined") {
      throw new Error("PDF tools failed to load. Refresh the app and try again.");
    }
    return window.pdfMake;
  }

  async function downloadPdf(model) {
    const pdfMake = ensurePdfMake();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `christ-in-song-bulletin-${stamp}.pdf`;
    return new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(buildPdfDefinition(model)).download(filename, () => resolve(filename));
      } catch (error) {
        reject(error);
      }
    });
  }

  function readPrefsFromModal() {
    if (!modalRoot) return loadPrefs();
    return {
      churchName: modalRoot.querySelector("#bulletinChurchName")?.value.trim() || "",
      churchSubtitle: modalRoot.querySelector("#bulletinChurchSubtitle")?.value.trim() || "",
      serviceTitle: modalRoot.querySelector("#bulletinServiceTitle")?.value.trim() || DEFAULT_PREFS.serviceTitle,
      headerText: modalRoot.querySelector("#bulletinHeaderText")?.value.trim() || "",
      footerText: modalRoot.querySelector("#bulletinFooterText")?.value.trim() || DEFAULT_PREFS.footerText,
      dateLabel: modalRoot.querySelector("#bulletinDateLabel")?.value.trim() || "",
      includeSongService: modalRoot.querySelector("#bulletinIncludeSongService")?.checked !== false,
      includeNotes: modalRoot.querySelector("#bulletinIncludeNotes")?.checked !== false,
    };
  }

  function renderModal() {
    if (!modalRoot || !uiState) return;
    const prefs = uiState.prefs;
    const preview = uiState.preview || {};
    const body = uiState.step === "working"
      ? `
        <h2>Preparing Bulletin</h2>
        <p class="muted">${escapeHtml(uiState.progressLabel || "Working…")}</p>
        <div class="backup-progress" role="status">
          <div class="backup-progress-track"><div class="backup-progress-bar" style="width:${uiState.progress || 35}%"></div></div>
        </div>
      `
      : `
        <h2>Export Service Bulletin</h2>
        <p class="muted">Create a polished bulletin from your current worship builder. Customize the church header and footer, then export as PDF or printable HTML.</p>
        <div class="bulletin-export-form">
          <div class="bulletin-form-grid">
            <label>
              <span>Church name</span>
              <input id="bulletinChurchName" type="text" value="${escapeHtml(prefs.churchName)}" placeholder="e.g. Berea Seventh-day Adventist Church">
            </label>
            <label>
              <span>Church subtitle</span>
              <input id="bulletinChurchSubtitle" type="text" value="${escapeHtml(prefs.churchSubtitle)}" placeholder="City, district, or tagline">
            </label>
            <label>
              <span>Service title</span>
              <input id="bulletinServiceTitle" type="text" value="${escapeHtml(prefs.serviceTitle)}" placeholder="Sabbath Worship Service">
            </label>
            <label>
              <span>Service date</span>
              <input id="bulletinDateLabel" type="text" value="${escapeHtml(prefs.dateLabel)}" placeholder="${escapeHtml(new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}">
            </label>
            <label>
              <span>Running header (pages 2+)</span>
              <input id="bulletinHeaderText" type="text" value="${escapeHtml(prefs.headerText)}" placeholder="Shown at top of continued pages">
            </label>
            <label>
              <span>Footer text</span>
              <input id="bulletinFooterText" type="text" value="${escapeHtml(prefs.footerText)}" placeholder="Printed at the bottom of each page">
            </label>
          </div>
          <div class="bulletin-form-options">
            <label><input id="bulletinIncludeSongService" type="checkbox" ${prefs.includeSongService ? "checked" : ""}> Include opening song service</label>
            <label><input id="bulletinIncludeNotes" type="checkbox" ${prefs.includeNotes ? "checked" : ""}> Include elder / AV notes</label>
          </div>
        <div class="bulletin-preview-card">
          <strong>Ready to export</strong>
          <span class="muted">${escapeHtml(String(preview.builderItems || 0))} builder items · ${escapeHtml(String(preview.openingSongs || 0))} opening songs · ${escapeHtml(String(preview.assignedItems || 0))} assigned</span>
        </div>
        ${uiState.error ? `<p class="bulletin-error">${escapeHtml(uiState.error)}</p>` : ""}
      </div>
      `;

    const footer = uiState.step === "working"
      ? ""
      : `
        <button class="secondary-button" type="button" data-bulletin-action="close">Cancel</button>
        <button class="secondary-button" type="button" data-bulletin-action="export-html">Export HTML</button>
        <button class="secondary-button" type="button" data-bulletin-action="print-preview">Print Preview</button>
        <button class="action-button" type="button" data-bulletin-action="export-pdf">Export PDF</button>
      `;

    modalRoot.innerHTML = `
      <div class="modal-backdrop bulletin-modal-backdrop" data-bulletin-action="close">
        <div class="modal bulletin-export-modal" role="dialog" aria-modal="true" aria-label="Export service bulletin">
          <div class="song-header">
            <div>
              <p class="eyebrow">Worship Builder</p>
            </div>
            <button class="secondary-button" type="button" data-bulletin-action="close">Close</button>
          </div>
          <div class="bulletin-modal-body">${body}</div>
          ${footer ? `<div class="backup-modal-footer">${footer}</div>` : ""}
        </div>
      </div>
    `;
    bindModalEvents();
  }

  function bindModalEvents() {
    if (!modalRoot) return;
    const backdrop = modalRoot.querySelector(".bulletin-modal-backdrop");
    const modal = modalRoot.querySelector(".bulletin-export-modal");
    modalRoot.querySelectorAll("[data-bulletin-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleAction(button.dataset.bulletinAction);
      });
    });
    if (backdrop) {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop && uiState && uiState.step !== "working") closeModal();
      });
    }
    if (modal) modal.addEventListener("click", (event) => event.stopPropagation());
  }

  function closeModal() {
    uiState = null;
    if (modalRoot) modalRoot.innerHTML = "";
  }

  async function handleAction(action) {
    if (action === "close") {
      closeModal();
      return;
    }
    const prefs = readPrefsFromModal();
    savePrefs(prefs);
    const serviceData = call("gatherServiceData");
    const model = buildBulletinModel(serviceData, prefs);

    if (action === "export-html") {
      uiState = { step: "working", progress: 70, progressLabel: "Creating printable HTML…", prefs };
      renderModal();
      await pause(80);
      downloadHtml(model);
      closeModal();
      call("setNotice", "Service bulletin HTML downloaded.");
      return;
    }

    if (action === "print-preview") {
      openPrintPreview(model);
      closeModal();
      call("setNotice", "Print preview opened in a new tab.");
      return;
    }

    if (action === "export-pdf") {
      uiState = { step: "working", progress: 28, progressLabel: "Building PDF layout…", prefs };
      renderModal();
      await pause(60);
      uiState.progress = 62;
      uiState.progressLabel = "Rendering professional PDF…";
      renderModal();
      try {
        const filename = await downloadPdf(model);
        closeModal();
        call("setNotice", `Service bulletin saved as ${filename}.`);
      } catch (error) {
        uiState = {
          step: "form",
          prefs,
          preview: uiState.preview,
          error: error && error.message ? error.message : "PDF export failed.",
        };
        renderModal();
        call("setNotice", "PDF export failed. Try Export HTML or Print Preview.");
      }
    }
  }

  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function openExportModal() {
    const prefs = loadPrefs();
    const serviceData = call("gatherServiceData") || {};
    const assignedItems = (serviceData.worshipPlan || []).filter((slot) => serviceData.helpers && serviceData.helpers.slotHasContent(slot)).length;
    const openingSongs = (serviceData.songService || []).filter((slot) => serviceData.helpers && serviceData.helpers.slotHasContent(slot)).length;
    uiState = {
      step: "form",
      prefs,
      preview: {
        builderItems: (serviceData.worshipPlan || []).length,
        openingSongs,
        assignedItems,
      },
    };
    renderModal();
  }

  window.CISBulletinExport = {
    configure,
    buildBulletinModel,
    renderHtml,
    downloadHtml,
    downloadPdf,
    openPrintPreview,
    openExportModal,
    DEFAULT_PREFS,
  };
})();
