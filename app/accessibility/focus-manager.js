(function () {
  "use strict";

  let lastFocusedElement = null;
  let trapCleanup = null;

  function isFocusable(element) {
    if (!element || element.disabled) return false;
    const tag = (element.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return true;
    if (element.tabIndex >= 0) return true;
    return false;
  }

  function getFocusableElements(root) {
    if (!root) return [];
    return [...root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function rememberFocus(element) {
    if (element && isFocusable(element)) lastFocusedElement = element;
    else if (document.activeElement) lastFocusedElement = document.activeElement;
  }

  function restoreFocus() {
    if (lastFocusedElement?.isConnected && isFocusable(lastFocusedElement)) {
      lastFocusedElement.focus();
      return true;
    }
    return false;
  }

  function releaseTrap() {
    if (typeof trapCleanup === "function") trapCleanup();
    trapCleanup = null;
  }

  function trapFocus(container) {
    releaseTrap();
    if (!container) return;
    const focusables = getFocusableElements(container);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first) first.focus();

    function onKeyDown(event) {
      if (event.key !== "Tab") return;
      const items = getFocusableElements(container);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    container.addEventListener("keydown", onKeyDown);
    trapCleanup = () => container.removeEventListener("keydown", onKeyDown);
  }

  function announce(message, priority) {
    const root = document.getElementById("a11yAnnounce");
    if (!root) return;
    root.setAttribute("aria-live", priority === "assertive" ? "assertive" : "polite");
    root.textContent = "";
    window.setTimeout(() => {
      root.textContent = String(message || "");
    }, 10);
  }

  window.CISFocusManager = {
    rememberFocus,
    restoreFocus,
    trapFocus,
    releaseTrap,
    announce,
    getFocusableElements,
    isFocusable,
  };
})();
