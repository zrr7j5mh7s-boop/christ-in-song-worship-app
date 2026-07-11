(function () {
  "use strict";

  let escapeHtml = (value) => String(value || "");
  let callbacks = {};
  let modalRoot = null;
  let fileInput = null;

  function configure(options) {
    callbacks = options || {};
    if (typeof callbacks.escapeHtml === "function") escapeHtml = callbacks.escapeHtml;
    if (callbacks.modalRoot) modalRoot = callbacks.modalRoot;
  }

  function call(name, ...args) {
    if (typeof callbacks[name] === "function") return callbacks[name](...args);
    return undefined;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function renderPlayerDock(state, song, meta, practiceMode) {
    const loaded = !!meta;
    const playerState = state || {};
    const sections = playerState.sectionRanges || window.CISHymnAudioPlayer.buildSectionRanges(song);
    const currentSection = sections[playerState.currentSectionIndex] || sections[0];
    const progress = playerState.duration
      ? Math.min(100, ((playerState.currentTime || 0) / playerState.duration) * 100)
      : 0;

    return `
      <section class="hymn-audio-dock ${practiceMode ? "practice-mode" : ""}" aria-label="Hymn audio player">
        <div class="hymn-audio-head">
          <div>
            <strong>${practiceMode ? "Practice Audio" : "Hymn Audio"}</strong>
            <span class="muted">${loaded ? `${escapeHtml(meta.fileName)} · ${escapeHtml(meta.kind.toUpperCase())}` : "No audio attached yet"}</span>
          </div>
          <div class="hymn-audio-head-actions">
            ${loaded ? `<button class="text-button" type="button" data-audio-command="replace-audio">Replace</button>` : ""}
            ${loaded ? `<button class="text-button" type="button" data-audio-command="remove-audio">Remove</button>` : ""}
            <button class="secondary-button" type="button" data-audio-command="upload-audio">${loaded ? "Change File" : "Upload Audio"}</button>
          </div>
        </div>
        ${loaded ? `
          <div class="hymn-audio-controls">
            <button class="audio-transport-button" type="button" data-audio-command="toggle-play" aria-label="${playerState.playing ? "Pause" : "Play"}">
              ${playerState.playing ? "❚❚" : "▶"}
            </button>
            <button class="secondary-button" type="button" data-audio-command="next-verse">Next Verse</button>
            <div class="hymn-audio-progress">
              <div class="hymn-audio-progress-track"><div class="hymn-audio-progress-bar" style="width:${progress}%"></div></div>
              <span class="muted">${formatTime(playerState.currentTime || 0)} / ${formatTime(playerState.duration || meta.duration || 0)}</span>
            </div>
            <label class="hymn-audio-slider">
              <span>Volume</span>
              <input type="range" min="0" max="100" value="${Math.round((playerState.volume ?? 0.85) * 100)}" data-audio-command="volume">
            </label>
            ${meta.kind === "midi" ? `
              <div class="hymn-audio-tempo">
                <button class="secondary-button" type="button" data-audio-command="tempo-down" title="Slower">−</button>
                <span>${Math.round((playerState.tempo || 1) * 100)}%</span>
                <button class="secondary-button" type="button" data-audio-command="tempo-up" title="Faster">+</button>
              </div>
            ` : `
              <div class="hymn-audio-tempo">
                <button class="secondary-button" type="button" data-audio-command="tempo-down" title="Slower">−</button>
                <span>${Math.round((playerState.tempo || 1) * 100)}%</span>
                <button class="secondary-button" type="button" data-audio-command="tempo-up" title="Faster">+</button>
              </div>
            `}
          </div>
          ${practiceMode ? `
            <div class="hymn-audio-practice">
              <label>
                <span>Loop section</span>
                <select data-audio-command="loop-section">
                  <option value="">Full hymn</option>
                  ${sections.map((section, index) => `
                    <option value="${index}" ${playerState.loopSectionIndex === index ? "selected" : ""}>${escapeHtml(section.label)}</option>
                  `).join("")}
                </select>
              </label>
              <label class="practice-loop-toggle">
                <input type="checkbox" data-audio-command="practice-loop" ${playerState.practiceLoop ? "checked" : ""}>
                <span>Loop selected section</span>
              </label>
              ${currentSection ? `<p class="muted">Now practicing: <strong>${escapeHtml(currentSection.label)}</strong></p>` : ""}
            </div>
          ` : `<p class="muted hymn-audio-hint">${currentSection ? `Current section: ${escapeHtml(currentSection.label)}` : "Use Next Verse to follow the hymn while audio plays."}</p>`}
        ` : `
          <p class="muted hymn-audio-empty">Upload an MP3 recording or MIDI file to practice with this hymn on your device.</p>
        `}
      </section>
    `;
  }

  function renderUploadModal(songTitle, existingMeta) {
    return `
      <div class="modal-backdrop" data-audio-command="close-upload">
        <div class="modal hymn-audio-modal" role="dialog" aria-modal="true" aria-label="Upload hymn audio">
          <div class="song-header">
            <div>
              <h2>${existingMeta ? "Replace Hymn Audio" : "Add Hymn Audio"}</h2>
              <p class="muted">${escapeHtml(songTitle || "Hymn")}</p>
            </div>
            <button class="secondary-button" type="button" data-audio-command="close-upload">Close</button>
          </div>
          <p class="muted">Attach an MP3, WAV, M4A, or MIDI (.mid) file for this hymn. Audio stays on this device for offline practice.</p>
          <div class="import-zone hymn-audio-dropzone" data-audio-command="pick-file">
            <strong>Choose an audio file</strong>
            <span>Maximum size: 25 MB</span>
            <button class="action-button" type="button" data-audio-command="pick-file">Browse Files</button>
          </div>
          ${existingMeta ? `<p class="muted">Current file: ${escapeHtml(existingMeta.fileName)} (${escapeHtml(existingMeta.kind.toUpperCase())})</p>` : ""}
        </div>
      </div>
    `;
  }

  function ensureFileInput() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.className = "hidden";
      fileInput.accept = ".mp3,.wav,.m4a,.mid,.midi,audio/mpeg,audio/wav,audio/mp4,audio/midi,audio/x-midi";
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (file) call("onUploadFile", file);
      });
      document.body.appendChild(fileInput);
    }
    return fileInput;
  }

  function openUploadModal(songTitle, existingMeta) {
    if (!modalRoot) return;
    modalRoot.innerHTML = renderUploadModal(songTitle, existingMeta);
    bindUploadModal();
  }

  function closeUploadModal() {
    if (modalRoot) modalRoot.innerHTML = "";
  }

  function bindUploadModal() {
    if (!modalRoot) return;
    modalRoot.querySelectorAll("[data-audio-command]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        const command = element.dataset.audioCommand;
        if (command === "close-upload") {
          closeUploadModal();
          return;
        }
        if (command === "pick-file") {
          ensureFileInput().click();
        }
      });
    });
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeUploadModal();
      });
    }
  }

  function bindDock(root, handlers) {
    if (!root) return;
    root.querySelectorAll("[data-audio-command]").forEach((element) => {
      const command = element.dataset.audioCommand;
      if (command === "volume") {
        element.addEventListener("input", () => handlers.setVolume(Number(element.value) / 100));
        return;
      }
      if (command === "loop-section") {
        element.addEventListener("change", () => {
          handlers.setLoopSection(element.value === "" ? null : Number(element.value));
        });
        return;
      }
      if (command === "practice-loop") {
        element.addEventListener("change", () => handlers.setPracticeLoop(element.checked));
        return;
      }
      element.addEventListener("click", () => {
        if (command === "toggle-play") handlers.togglePlay();
        if (command === "next-verse") handlers.nextVerse();
        if (command === "tempo-up") handlers.stepTempo(1);
        if (command === "tempo-down") handlers.stepTempo(-1);
        if (command === "upload-audio" || command === "replace-audio") handlers.openUpload();
        if (command === "remove-audio") handlers.removeAudio();
      });
    });
  }

  function updateDock(root, state, song, meta, practiceMode) {
    if (!root) return;
    root.innerHTML = renderPlayerDock(state, song, meta, practiceMode);
    bindDock(root, call("getHandlers") || {});
  }

  window.CISHymnAudioUI = {
    configure,
    renderPlayerDock,
    renderUploadModal,
    openUploadModal,
    closeUploadModal,
    bindDock,
    updateDock,
    formatTime,
  };
})();
