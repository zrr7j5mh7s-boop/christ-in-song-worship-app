(function () {
  "use strict";

  const TEMPO_STEPS = [0.75, 0.85, 1, 1.1, 1.2, 1.3];

  function midiToFreq(midi) {
    return 440 * (2 ** ((midi - 69) / 12));
  }

  function buildSectionRanges(song) {
    const sections = song.sections || [];
    const slides = song.slides || [];
    return sections.map((section, index) => {
      const matchingSlides = slides
        .map((slide, slideIndex) => ({ slide, slideIndex }))
        .filter(({ slide }) => slide.label === section.label && slide.kind === section.kind);
      const startSlide = matchingSlides.length ? matchingSlides[0].slideIndex : 0;
      const endSlide = matchingSlides.length ? matchingSlides[matchingSlides.length - 1].slideIndex : startSlide;
      return {
        index,
        label: section.label,
        kind: section.kind,
        startSlide,
        endSlide,
        startTime: 0,
        endTime: 0,
      };
    });
  }

  function applySectionTimings(ranges, duration) {
    if (!ranges.length || !duration) return ranges;
    const slice = duration / ranges.length;
    return ranges.map((section, index) => ({
      ...section,
      startTime: index * slice,
      endTime: index === ranges.length - 1 ? duration : (index + 1) * slice,
    }));
  }

  function createPlayer() {
    let audioContext = null;
    let gainNode = null;
    let mediaElement = null;
    let mediaSource = null;
    let objectUrl = "";
    let kind = "";
    let duration = 0;
    let playing = false;
    let volume = 0.85;
    let tempo = 1;
    let practiceLoop = false;
    let loopSectionIndex = null;
    let currentSectionIndex = 0;
    let sectionRanges = [];
    let midiTimers = [];
    let midiNotes = [];
    let midiStartAt = 0;
    let midiPausedAt = 0;
    let activeOscillators = [];
    let meta = null;
    let song = null;
    let onTimeUpdate = null;
    let onStateChange = null;
    let onSectionChange = null;
    let onEnded = null;
    let rafId = 0;

    function emitState() {
      if (typeof onStateChange === "function") onStateChange(getState());
    }

    function ensureContext() {
      if (!audioContext) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error("Web Audio is not available in this browser.");
        audioContext = new Ctx();
        gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        gainNode.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") {
        return audioContext.resume();
      }
      return Promise.resolve();
    }

    function revokeUrl() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = "";
      }
    }

    function clearMidiTimers() {
      midiTimers.forEach((id) => window.clearTimeout(id));
      midiTimers = [];
      activeOscillators.forEach((item) => {
        try {
          item.osc.stop();
          item.osc.disconnect();
          item.gain.disconnect();
        } catch (_error) {
          /* noop */
        }
      });
      activeOscillators = [];
    }

    function stopPlayback() {
      playing = false;
      if (mediaElement) {
        mediaElement.pause();
        mediaElement.currentTime = 0;
      }
      clearMidiTimers();
      midiPausedAt = 0;
      cancelAnimationFrame(rafId);
      emitState();
    }

    function getActiveSection() {
      if (loopSectionIndex !== null && sectionRanges[loopSectionIndex]) {
        return sectionRanges[loopSectionIndex];
      }
      return sectionRanges[currentSectionIndex] || null;
    }

    function seekToSection(section, autoplay = false) {
      if (!section || !mediaElement) return;
      mediaElement.currentTime = Math.max(0, section.startTime || 0);
      if (autoplay && !playing) play().catch(() => {});
      if (typeof onTimeUpdate === "function") {
        onTimeUpdate(mediaElement.currentTime, duration);
      }
    }

    function enforceSectionLoop() {
      const section = getActiveSection();
      if (!practiceLoop || !section || kind !== "mp3" || !mediaElement) return;
      const endTime = section.endTime || duration;
      if (mediaElement.currentTime >= endTime - 0.05) {
        mediaElement.currentTime = section.startTime || 0;
      }
    }

    function setSectionIndex(index, notify = true) {
      if (!sectionRanges.length) return;
      const safe = Math.max(0, Math.min(sectionRanges.length - 1, index));
      currentSectionIndex = safe;
      const section = sectionRanges[safe];
      if (kind === "mp3" && mediaElement && section) {
        seekToSection(section);
      }
      if (notify && typeof onSectionChange === "function") {
        onSectionChange(section);
      }
      emitState();
    }

    function nextVerse() {
      if (!sectionRanges.length) return null;
      const next = currentSectionIndex >= sectionRanges.length - 1 ? 0 : currentSectionIndex + 1;
      setSectionIndex(next);
      return sectionRanges[next];
    }

    function scheduleMidiPlayback(offsetSeconds = 0) {
      clearMidiTimers();
      if (!audioContext || !midiNotes.length) return;
      const section = practiceLoop ? getActiveSection() : null;
      const sectionStart = section && section.startTime ? section.startTime : 0;
      const sectionEnd = section && section.endTime ? section.endTime : duration;
      const playFrom = Math.max(sectionStart, offsetSeconds || sectionStart);
      midiStartAt = performance.now() - ((playFrom - sectionStart) * 1000) / tempo;

      midiNotes.forEach((note) => {
        if (note.time < sectionStart || note.time >= sectionEnd) return;
        const noteStart = note.time / tempo;
        const noteDuration = Math.max(0.08, note.duration / tempo);
        if (playFrom && noteStart < playFrom) return;
        const delayMs = Math.max(0, (noteStart - playFrom) * 1000);
        const timerId = window.setTimeout(() => {
          if (!playing) return;
          const osc = audioContext.createOscillator();
          const noteGain = audioContext.createGain();
          osc.type = "triangle";
          osc.frequency.value = midiToFreq(note.midi);
          noteGain.gain.value = 0.0001;
          osc.connect(noteGain);
          noteGain.connect(gainNode);
          const now = audioContext.currentTime;
          noteGain.gain.exponentialRampToValueAtTime(Math.min(0.22, note.velocity * 0.35), now + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration);
          osc.start(now);
          osc.stop(now + noteDuration + 0.02);
          activeOscillators.push({ osc, gain: noteGain });
        }, delayMs);
        midiTimers.push(timerId);
      });

      const totalMs = practiceLoop && section
        ? ((sectionEnd - playFrom) / tempo) * 1000
        : ((duration - playFrom) / tempo) * 1000;
      const endTimer = window.setTimeout(() => {
        if (!playing) return;
        if (practiceLoop) {
          const restartAt = section ? section.startTime : 0;
          scheduleMidiPlayback(restartAt);
          return;
        }
        playing = false;
        emitState();
        if (typeof onEnded === "function") onEnded();
      }, Math.max(0, totalMs));
      midiTimers.push(endTimer);
    }

    function tickMediaTime() {
      if (!playing || kind !== "mp3" || !mediaElement) return;
      enforceSectionLoop();
      if (typeof onTimeUpdate === "function") {
        onTimeUpdate(mediaElement.currentTime, duration);
      }
      rafId = requestAnimationFrame(tickMediaTime);
    }

    async function load({ blob, meta: nextMeta, song: nextSong }) {
      stopPlayback();
      revokeUrl();
      meta = nextMeta;
      song = nextSong;
      kind = nextMeta.kind;
      sectionRanges = buildSectionRanges(nextSong || { sections: [], slides: [] });
      currentSectionIndex = 0;
      loopSectionIndex = null;
      practiceLoop = false;

      await ensureContext();

      if (kind === "midi") {
        mediaElement = null;
        if (mediaSource) {
          try { mediaSource.disconnect(); } catch (_error) { /* noop */ }
          mediaSource = null;
        }
        if (typeof window.Midi === "undefined") {
          throw new Error("MIDI tools failed to load. Refresh the app and try again.");
        }
        const buffer = await blob.arrayBuffer();
        const midi = new window.Midi(buffer);
        midiNotes = [];
        midi.tracks.forEach((track) => {
          track.notes.forEach((note) => {
            midiNotes.push({
              midi: note.midi,
              time: note.time,
              duration: note.duration,
              velocity: note.velocity,
            });
          });
        });
        duration = midi.duration || 0;
        sectionRanges = applySectionTimings(sectionRanges, duration);
        return getState();
      }

      objectUrl = URL.createObjectURL(blob);
      if (!mediaElement) {
        mediaElement = new Audio();
        mediaElement.preload = "auto";
        mediaElement.addEventListener("ended", () => {
          if (practiceLoop) {
            const section = getActiveSection();
            mediaElement.currentTime = section && section.startTime ? section.startTime : 0;
            mediaElement.play().catch(() => {});
            return;
          }
          playing = false;
          emitState();
          if (typeof onEnded === "function") onEnded();
        });
        mediaElement.addEventListener("timeupdate", () => {
          enforceSectionLoop();
          if (typeof onTimeUpdate === "function") {
            onTimeUpdate(mediaElement.currentTime, mediaElement.duration || duration);
          }
        });
      }
      mediaElement.src = objectUrl;
      mediaElement.playbackRate = tempo;
      await new Promise((resolve, reject) => {
        mediaElement.onloadedmetadata = () => resolve();
        mediaElement.onerror = () => reject(new Error("This audio file could not be loaded."));
      });
      duration = mediaElement.duration || nextMeta.duration || 0;
      sectionRanges = applySectionTimings(sectionRanges, duration);
      if (!mediaSource) {
        mediaSource = audioContext.createMediaElementSource(mediaElement);
        mediaSource.connect(gainNode);
      }
      return getState();
    }

    async function play() {
      await ensureContext();
      if (kind === "midi") {
        playing = true;
        scheduleMidiPlayback(midiPausedAt || 0);
        midiPausedAt = 0;
        emitState();
        return;
      }
      if (!mediaElement) return;
      mediaElement.playbackRate = tempo;
      await mediaElement.play();
      playing = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tickMediaTime);
      emitState();
    }

    function pause() {
      if (!playing) return;
      playing = false;
      if (kind === "midi") {
        midiPausedAt = ((performance.now() - midiStartAt) / 1000) * tempo;
        clearMidiTimers();
      } else if (mediaElement) {
        mediaElement.pause();
      }
      cancelAnimationFrame(rafId);
      emitState();
    }

    function togglePlay() {
      if (playing) pause();
      else play().catch(() => emitState());
    }

    function setVolume(value) {
      volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (gainNode) gainNode.gain.value = volume;
      emitState();
    }

    function setTempo(value) {
      tempo = Math.max(0.5, Math.min(1.5, Number(value) || 1));
      if (mediaElement) mediaElement.playbackRate = tempo;
      emitState();
    }

    function stepTempo(delta) {
      const currentIndex = TEMPO_STEPS.findIndex((step) => Math.abs(step - tempo) < 0.001);
      const baseIndex = currentIndex >= 0 ? currentIndex : TEMPO_STEPS.indexOf(1);
      const nextIndex = Math.max(0, Math.min(TEMPO_STEPS.length - 1, baseIndex + delta));
      setTempo(TEMPO_STEPS[nextIndex]);
    }

    function setPracticeLoop(enabled) {
      practiceLoop = !!enabled;
      emitState();
    }

    function setLoopSection(index) {
      if (index === null || index === undefined || index === "") {
        loopSectionIndex = null;
        practiceLoop = false;
      } else {
        loopSectionIndex = Number(index);
        practiceLoop = true;
        setSectionIndex(loopSectionIndex, true);
        const section = sectionRanges[loopSectionIndex];
        if (kind === "mp3" && section) seekToSection(section);
        if (kind === "midi" && playing) {
          clearMidiTimers();
          scheduleMidiPlayback(section ? section.startTime : 0);
        }
      }
      emitState();
    }

    function getState() {
      return {
        loaded: !!meta,
        kind,
        playing,
        volume,
        tempo,
        duration,
        practiceLoop,
        loopSectionIndex,
        currentSectionIndex,
        sectionRanges,
        fileName: meta ? meta.fileName : "",
        meta,
      };
    }

    function destroy() {
      stopPlayback();
      revokeUrl();
      if (mediaElement) {
        mediaElement.src = "";
        mediaElement = null;
      }
      if (mediaSource) {
        try { mediaSource.disconnect(); } catch (_error) { /* noop */ }
        mediaSource = null;
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
        gainNode = null;
      }
      meta = null;
      song = null;
      sectionRanges = [];
    }

    return {
      load,
      play,
      pause,
      togglePlay,
      stop: stopPlayback,
      setVolume,
      setTempo,
      stepTempo,
      setPracticeLoop,
      setLoopSection,
      nextVerse,
      setSectionIndex,
      getState,
      destroy,
      set onTimeUpdate(cb) { onTimeUpdate = cb; },
      set onStateChange(cb) { onStateChange = cb; },
      set onSectionChange(cb) { onSectionChange = cb; },
      set onEnded(cb) { onEnded = cb; },
      TEMPO_STEPS,
    };
  }

  window.CISHymnAudioPlayer = {
    createPlayer,
    buildSectionRanges,
    applySectionTimings,
    TEMPO_STEPS,
  };
})();
