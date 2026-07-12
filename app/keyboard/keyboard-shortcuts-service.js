(function () {
  "use strict";

  const registry = () => window.CISKeyboardShortcutsRegistry;
  const listeners = new Set();

  let bindings = {};
  let platform = "web";
  let actionHandler = null;
  let contextProvider = null;

  function configure(options) {
    if (options?.bindings) bindings = { ...options.bindings };
    if (options?.platform) platform = options.platform;
    if (typeof options?.onAction === "function") actionHandler = options.onAction;
    if (typeof options?.getContext === "function") contextProvider = options.getContext;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    listeners.forEach((fn) => fn(getState()));
  }

  function getBindings() {
    const merged = {};
    (registry()?.ACTIONS || []).forEach((action) => {
      if (action.aliasOf) return;
      merged[action.id] = bindings[action.id] || action.defaultBinding || "";
    });
    return merged;
  }

  function getState() {
    const current = getBindings();
    return {
      bindings: current,
      conflicts: registry()?.detectConflicts(current) || [],
      platform,
    };
  }

  function setBinding(actionId, binding) {
    const action = registry()?.getAction(actionId);
    if (!action || action.aliasOf) return { ok: false, message: "Unknown shortcut." };
    const normalized = String(binding || "").trim().toLowerCase();
    if (!normalized) {
      delete bindings[actionId];
    } else {
      bindings[actionId] = normalized;
    }
    const conflicts = registry()?.detectConflicts(getBindings()) || [];
    notify();
    return { ok: true, conflicts };
  }

  function resetBindings() {
    bindings = {};
    notify();
    return getState();
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = (target.tagName || "").toUpperCase();
    if (target.isContentEditable) return true;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      const type = (target.type || "text").toLowerCase();
      if (["button", "submit", "reset", "checkbox", "radio", "range", "color", "file"].includes(type)) return false;
      return true;
    }
    if (target.closest?.(".modal, [role='dialog']")) return true;
    return false;
  }

  function fieldAllowsAction(target, actionId) {
    const id = target?.id || "";
    const allowed = registry()?.FIELD_TYPING_ALLOWED?.[id] || [];
    return allowed.includes(actionId);
  }

  function scopeAllows(action, context) {
    const scope = action.scope || "global";
    if (scope === "global") return true;
    if (scope === "presenter") return Boolean(context.presenterActive || context.emergencyMode);
    if (scope === "live") return Boolean(context.presenterActive || context.emergencyMode || context.bibleLive);
    if (scope === "bible-live") return Boolean(context.bibleLive);
    if (scope === "selection") return Boolean(context.hasSelection || context.searchView || context.indexView);
    if (scope === "media") return Boolean(context.mediaLoaded);
    return true;
  }

  function resolveAction(event, context) {
    const reg = registry();
    if (!reg) return null;
    const currentBindings = getBindings();
    for (const action of reg.ACTIONS) {
      if (action.aliasOf) continue;
      const binding = currentBindings[action.id];
      if (!binding) continue;
      if (!reg.eventMatchesBinding(event, binding, platform)) continue;
      if (!scopeAllows(action, context)) continue;
      return action;
    }
    return null;
  }

  function handleEvent(event) {
    if (!actionHandler || !contextProvider) return false;
    const context = contextProvider() || {};
    if (context.disabled) return false;

    const typing = isTypingTarget(event.target);
    const action = resolveAction(event, context);
    if (!action) return false;

    if (typing && !action.allowWhileTyping && !fieldAllowsAction(event.target, action.id)) {
      return false;
    }

    const result = actionHandler(action.id, event, context);
    if (result?.handled) {
      if (result.preventDefault !== false) event.preventDefault();
      notify();
    }
    return Boolean(result?.handled);
  }

  function formatActionBinding(actionId) {
    const action = registry()?.getAction(actionId);
    if (!action) return "";
    const binding = getBindings()[actionId] || action.defaultBinding;
    return registry()?.formatBinding(binding, platform) || binding;
  }

  function searchActions(query) {
    const q = String(query || "").trim().toLowerCase();
    return (registry()?.ACTIONS || [])
      .filter((action) => !action.aliasOf)
      .filter((action) => {
        if (!q) return true;
        const binding = getBindings()[action.id] || action.defaultBinding || "";
        const formatted = registry()?.formatBinding(binding, platform) || "";
        return (
          action.label.toLowerCase().includes(q)
          || action.description.toLowerCase().includes(q)
          || action.id.includes(q)
          || binding.includes(q)
          || formatted.toLowerCase().includes(q)
          || (registry()?.CATEGORIES?.[action.category] || "").toLowerCase().includes(q)
        );
      });
  }

  window.CISKeyboardShortcutsService = {
    configure,
    subscribe,
    getState,
    getBindings,
    setBinding,
    resetBindings,
    handleEvent,
    isTypingTarget,
    formatActionBinding,
    searchActions,
  };
})();
