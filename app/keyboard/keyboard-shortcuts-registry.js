(function () {
  "use strict";

  const CATEGORIES = {
    global: "Global",
    bible: "Bible",
    hymns: "Hymns",
    media: "Media",
    "service-mode": "Service Mode",
    obs: "OBS",
    emergency: "Emergency",
    queue: "Queue",
  };

  /**
   * defaultBinding uses a compact chord format:
   * - mod = Meta on macOS, Control elsewhere
   * - shift, alt, ctrl, meta modifiers
   * - key token: space, enter, escape, f1, arrowright, bracketleft, etc.
   * - single letters: a-z
   */
  const ACTIONS = [
    {
      id: "global-search",
      category: "global",
      label: "Open global search",
      description: "Jump to hymn search across all languages.",
      defaultBinding: "mod+k",
      scope: "global",
      legacy: false,
    },
    {
      id: "open-bible-live",
      category: "bible",
      label: "Open Bible Live",
      description: "Open the Live Bible Projection workspace.",
      defaultBinding: "alt+b",
      scope: "global",
      legacy: true,
    },
    {
      id: "open-hymn-search",
      category: "global",
      label: "Open hymn search",
      description: "Open the hymn search page.",
      defaultBinding: "mod+shift+h",
      scope: "global",
    },
    {
      id: "focus-search-field",
      category: "global",
      label: "Focus current search field",
      description: "Focus the active search or reference input.",
      defaultBinding: "/",
      scope: "global",
    },
    {
      id: "open-help",
      category: "global",
      label: "Open Help Centre",
      description: "Open the Help Centre.",
      defaultBinding: "f1",
      scope: "global",
      legacy: true,
    },
    {
      id: "open-emergency-help",
      category: "emergency",
      label: "Open Emergency Help",
      description: "Open large-button emergency recovery tools.",
      defaultBinding: "mod+shift+e",
      scope: "global",
    },
    {
      id: "open-queue",
      category: "queue",
      label: "Open hymn queue",
      description: "Open presenter controls with the hymn queue.",
      defaultBinding: "mod+shift+q",
      scope: "global",
    },
    {
      id: "load-preview",
      category: "hymns",
      label: "Load selected item into Preview",
      description: "Load the highlighted hymn, search result, or Bible reference into Preview.",
      defaultBinding: "enter",
      scope: "selection",
    },
    {
      id: "hymn-send-preview-live",
      category: "hymns",
      label: "Send Preview Live",
      description: "Commit prepared Preview content to Live output.",
      defaultBinding: "mod+enter",
      scope: "live",
    },
    {
      id: "hymn-take-next",
      category: "queue",
      label: "Take Next Live",
      description: "Take the prepared Next hymn Live.",
      defaultBinding: "shift+bracketright",
      scope: "live",
      legacy: true,
    },
    {
      id: "hymn-restore-previous",
      category: "queue",
      label: "Restore previous hymn",
      description: "Restore the previous Live hymn from history.",
      defaultBinding: "shift+bracketleft",
      scope: "live",
      legacy: true,
    },
    {
      id: "presenter-next",
      category: "hymns",
      label: "Next stanza or verse",
      description: "Advance to the next slide, stanza, or verse.",
      defaultBinding: "space",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "presenter-prev",
      category: "hymns",
      label: "Previous stanza or verse",
      description: "Go back to the previous slide, stanza, or verse.",
      defaultBinding: "shift+space",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "presenter-next-alt",
      category: "hymns",
      label: "Next stanza (arrow)",
      description: "Alternate next-slide shortcut.",
      defaultBinding: "arrowright",
      scope: "presenter",
      legacy: true,
      aliasOf: "presenter-next",
    },
    {
      id: "presenter-prev-alt",
      category: "hymns",
      label: "Previous stanza (arrow)",
      description: "Alternate previous-slide shortcut.",
      defaultBinding: "arrowleft",
      scope: "presenter",
      legacy: true,
      aliasOf: "presenter-prev",
    },
    {
      id: "presenter-next-page",
      category: "hymns",
      label: "Next stanza (Page Down)",
      description: "Alternate next-slide shortcut.",
      defaultBinding: "pagedown",
      scope: "presenter",
      legacy: true,
      aliasOf: "presenter-next",
    },
    {
      id: "presenter-prev-page",
      category: "hymns",
      label: "Previous stanza (Page Up)",
      description: "Alternate previous-slide shortcut.",
      defaultBinding: "pageup",
      scope: "presenter",
      legacy: true,
      aliasOf: "presenter-prev",
    },
    {
      id: "show-chorus",
      category: "hymns",
      label: "Show chorus",
      description: "Jump to the chorus or refrain slide.",
      defaultBinding: "g",
      scope: "presenter",
    },
    {
      id: "hymn-set-next",
      category: "queue",
      label: "Set selected hymn as Next",
      description: "Queue the selected hymn as Next without changing Live.",
      defaultBinding: "alt+n",
      scope: "selection",
    },
    {
      id: "emergency-clear",
      category: "emergency",
      label: "Clear",
      description: "Return from emergency screens to lyrics.",
      defaultBinding: "c",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "emergency-logo",
      category: "emergency",
      label: "Show Logo",
      description: "Show the congregation logo screen.",
      defaultBinding: "l",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "emergency-black",
      category: "emergency",
      label: "Blackout",
      description: "Black out congregation outputs.",
      defaultBinding: "b",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "emergency-white",
      category: "emergency",
      label: "White screen",
      description: "Show a white congregation screen.",
      defaultBinding: "w",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "presenter-close-alt",
      category: "service-mode",
      label: "Close presenter (H)",
      description: "Legacy shortcut to close presenter output.",
      defaultBinding: "h",
      scope: "presenter",
      legacy: true,
      aliasOf: "close-presenter",
    },
    {
      id: "emergency-restore",
      category: "emergency",
      label: "Restore",
      description: "Restore previous Live content or clear emergency overlay.",
      defaultBinding: "r",
      scope: "presenter",
    },
    {
      id: "presenter-pause",
      category: "media",
      label: "Pause or resume display",
      description: "Freeze or resume the congregation display.",
      defaultBinding: "p",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "media-toggle",
      category: "media",
      label: "Start or pause selected media",
      description: "Toggle hymn audio playback when audio is loaded.",
      defaultBinding: "m",
      scope: "media",
    },
    {
      id: "bible-next-verse",
      category: "bible",
      label: "Next Bible verse",
      description: "Advance to the next verse in Bible Live.",
      defaultBinding: "alt+arrowright",
      scope: "bible-live",
      legacy: true,
    },
    {
      id: "bible-prev-verse",
      category: "bible",
      label: "Previous Bible verse",
      description: "Go to the previous verse in Bible Live.",
      defaultBinding: "alt+arrowleft",
      scope: "bible-live",
      legacy: true,
    },
    {
      id: "bible-send-live",
      category: "bible",
      label: "Send Bible Preview Live",
      description: "Send prepared scripture from Preview to Live.",
      defaultBinding: "shift+l",
      scope: "bible-live",
      legacy: true,
    },
    {
      id: "camera-send-live",
      category: "obs",
      label: "Send camera Live",
      description: "Send the selected camera source Live.",
      defaultBinding: "v",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "camera-next",
      category: "obs",
      label: "Next camera",
      description: "Cycle to the next saved camera source.",
      defaultBinding: "n",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "presenter-fullscreen",
      category: "service-mode",
      label: "Toggle presenter fullscreen",
      description: "Enter or exit fullscreen presenter output.",
      defaultBinding: "f",
      scope: "presenter",
      legacy: true,
    },
    {
      id: "close-presenter",
      category: "service-mode",
      label: "Close presenter",
      description: "Close presenter output controls.",
      defaultBinding: "escape",
      scope: "presenter",
      legacy: true,
    },
  ];

  const FIELD_TYPING_ALLOWED = {
    globalSearchInput: ["load-preview"],
    bibleLiveReferenceInput: ["load-preview"],
    builderSearchInput: [],
    indexSearchInput: ["load-preview"],
    homeSearchInput: ["load-preview"],
  };

  function normalizeKeyToken(key) {
    const raw = String(key || "").toLowerCase();
    const map = {
      " ": "space",
      arrowup: "arrowup",
      arrowdown: "arrowdown",
      arrowleft: "arrowleft",
      arrowright: "arrowright",
      pagedown: "pagedown",
      pageup: "pageup",
      "[": "bracketleft",
      "]": "bracketright",
      "/": "slash",
    };
    if (map[raw]) return map[raw];
    if (raw.length === 1) return raw;
    return raw.replace(/^key/, "");
  }

  function parseBinding(binding) {
    const parts = String(binding || "").toLowerCase().split("+").filter(Boolean);
    const parsed = {
      ctrl: false,
      meta: false,
      alt: false,
      shift: false,
      mod: false,
      key: "",
    };
    parts.forEach((part) => {
      if (part === "mod") parsed.mod = true;
      else if (part === "ctrl" || part === "control") parsed.ctrl = true;
      else if (part === "meta" || part === "cmd" || part === "command") parsed.meta = true;
      else if (part === "alt" || part === "option") parsed.alt = true;
      else if (part === "shift") parsed.shift = true;
      else parsed.key = normalizeKeyToken(part);
    });
    return parsed;
  }

  function formatBinding(binding, platform) {
    const parsed = parseBinding(binding);
    const isMac = platform === "darwin" || platform === "mac";
    const tokens = [];
    if (parsed.mod) tokens.push(isMac ? "⌘" : "Ctrl");
    if (parsed.ctrl) tokens.push("Ctrl");
    if (parsed.meta) tokens.push(isMac ? "⌘" : "Win");
    if (parsed.alt) tokens.push(isMac ? "⌥" : "Alt");
    if (parsed.shift) tokens.push(isMac ? "⇧" : "Shift");
    const keyLabel = {
      space: "Space",
      enter: "Enter",
      escape: "Esc",
      bracketleft: "[",
      bracketright: "]",
      arrowleft: "←",
      arrowright: "→",
      arrowup: "↑",
      arrowdown: "↓",
      slash: "/",
    };
    tokens.push(keyLabel[parsed.key] || parsed.key.toUpperCase());
    return tokens.join(isMac ? "" : "+");
  }

  function eventMatchesBinding(event, binding, platform) {
    const parsed = parseBinding(binding);
    const isMac = platform === "darwin" || platform === "mac";
    const modPressed = isMac ? event.metaKey : event.ctrlKey;
    const wantsMod = parsed.mod;
    const key = normalizeKeyToken(event.key);

    if (Boolean(parsed.shift) !== event.shiftKey) return false;
    if (Boolean(parsed.alt) !== event.altKey) return false;
    if (wantsMod && !modPressed) return false;
    if (!wantsMod && modPressed && !parsed.meta && !parsed.ctrl) return false;
    if (parsed.ctrl && !event.ctrlKey) return false;
    if (parsed.meta && !event.metaKey) return false;
    if (parsed.key !== key) return false;
    return true;
  }

  function getActionMap(bindings) {
    const map = new Map();
    ACTIONS.forEach((action) => {
      const binding = bindings?.[action.id] || action.defaultBinding;
      if (!binding) return;
      const existing = map.get(binding);
      if (existing && existing !== action.id && !action.aliasOf) {
        map.set(binding, { conflict: true, ids: [existing, action.id] });
      } else if (!action.aliasOf) {
        map.set(binding, action.id);
      }
      if (action.aliasOf) {
        map.set(binding, action.aliasOf);
      }
    });
    return map;
  }

  function detectConflicts(bindings) {
    const byBinding = new Map();
    const conflicts = [];
    ACTIONS.forEach((action) => {
      const binding = bindings?.[action.id] || action.defaultBinding;
      if (!binding || action.aliasOf) return;
      const list = byBinding.get(binding) || [];
      list.push(action.id);
      byBinding.set(binding, list);
    });
    byBinding.forEach((ids, binding) => {
      if (ids.length > 1) conflicts.push({ binding, actionIds: ids });
    });
    return conflicts;
  }

  function getAction(id) {
    return ACTIONS.find((item) => item.id === id) || null;
  }

  function listByCategory() {
    const grouped = {};
    Object.keys(CATEGORIES).forEach((key) => { grouped[key] = []; });
    ACTIONS.forEach((action) => {
      if (action.aliasOf) return;
      grouped[action.category]?.push(action);
    });
    return grouped;
  }

  window.CISKeyboardShortcutsRegistry = {
    CATEGORIES,
    ACTIONS,
    FIELD_TYPING_ALLOWED,
    parseBinding,
    formatBinding,
    eventMatchesBinding,
    getActionMap,
    detectConflicts,
    getAction,
    listByCategory,
    normalizeKeyToken,
  };
})();
