(function () {
  "use strict";

  let recognition = null;
  let listening = false;
  let adapters = {};
  const recentDetections = new Set();

  function configure(options) {
    adapters = {
      onSuggestion: options?.onSuggestion || null,
      getSettings: options?.getSettings || (() => ({})),
    };
  }

  function isSupported() {
    return typeof window !== "undefined"
      && (window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function parseSpokenReference(text) {
    if (!window.CISBibleReferenceParser) return null;
    const spoken = String(text || "").toLowerCase();
    const patterns = [
      /(?:turn to|read|open)\s+([a-z0-9\s]+?)\s+chapter\s+(\d+)\s+verse\s+(\d+)/i,
      /([a-z0-9\s]+?)\s+chapter\s+(\d+)\s+verses?\s+(\d+)\s+through\s+(\d+)/i,
      /([a-z0-9\s]+?)\s+(\d+):(\d+)/i,
      /([a-z0-9\s]+?)\s+(\d+)\s+(\d+)/i,
    ];

    for (let i = 0; i < patterns.length; i += 1) {
      const match = spoken.match(patterns[i]);
      if (!match) continue;
      if (match.length === 4 && patterns[i] === patterns[0]) {
        return window.CISBibleReferenceParser.parseReference(`${match[1]} ${match[2]}:${match[3]}`);
      }
      if (match.length === 5 && patterns[i] === patterns[1]) {
        return window.CISBibleReferenceParser.parseReference(`${match[1]} ${match[2]}:${match[3]}-${match[4]}`);
      }
      if (match.length === 4) {
        return window.CISBibleReferenceParser.parseReference(`${match[1]} ${match[2]}:${match[3]}`);
      }
    }
    return null;
  }

  function confidenceLabel(score) {
    if (score >= 0.82) return "High";
    if (score >= 0.55) return "Medium";
    return "Low";
  }

  function start(options) {
    if (!isSupported()) {
      return { ok: false, message: "Speech recognition is not available in this browser." };
    }
    const settings = adapters.getSettings() || {};
    if (!settings.enableSpeechDetection) {
      return { ok: false, message: "Speech-assisted detection is disabled in settings." };
    }

    stop();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = options?.language || settings.speechLanguage || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last || !last[0]) return;
      const transcript = last[0].transcript || "";
      const confidence = last[0].confidence || 0.6;
      const parsed = parseSpokenReference(transcript);
      if (!parsed || !parsed.ok || !parsed.parsed) return;
      if (confidence < 0.45) return;
      const label = parsed.parsed.referenceLabel;
      if (recentDetections.has(label)) return;
      recentDetections.add(label);
      const suggestion = {
        reference: label,
        referenceInput: parsed.parsed.referenceInput || label,
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        transcript,
      };
      if (typeof adapters.onSuggestion === "function") adapters.onSuggestion(suggestion);
      if (window.CISBibleProjectionService) {
        window.CISBibleProjectionService.setSpeechSuggestion(suggestion);
      }
    };

    recognition.onerror = (event) => {
      listening = false;
      if (event.error === "not-allowed") {
        if (typeof adapters.onSuggestion === "function") {
          adapters.onSuggestion({ error: "Microphone permission denied." });
        }
      }
    };

    recognition.onend = () => {
      if (listening) {
        try { recognition.start(); } catch (_error) { listening = false; }
      }
    };

    try {
      recognition.start();
      listening = true;
      return { ok: true, message: "Listening for Bible references…" };
    } catch (error) {
      listening = false;
      return { ok: false, message: error?.message || "Could not start speech recognition." };
    }
  }

  function stop() {
    listening = false;
    if (recognition) {
      try { recognition.stop(); } catch (_error) {}
      recognition = null;
    }
    recentDetections.clear();
    return { ok: true, message: "Speech detection stopped." };
  }

  function getState() {
    return { listening, supported: isSupported() };
  }

  window.CISBibleSpeechService = {
    configure,
    isSupported,
    start,
    stop,
    getState,
    parseSpokenReference,
    confidenceLabel,
  };
})();
