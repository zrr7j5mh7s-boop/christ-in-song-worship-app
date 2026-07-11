(function () {
  "use strict";

  const catalogModule = window.CISI18nCatalog || {};
  const storeModule = window.CISI18nStore || {};
  const CATALOG = catalogModule.CATALOG || { en: {} };
  const LOCALE_META = catalogModule.LOCALE_META || { en: { label: "English", nativeLabel: "English", flag: "🇬🇧" } };
  const DEFAULT_LOCALE = catalogModule.DEFAULT_LOCALE || "en";
  const SUPPORTED_LOCALES = catalogModule.SUPPORTED_LOCALES || Object.keys(CATALOG);
  const listeners = [];

  let locale = storeModule.loadLocale ? storeModule.loadLocale(SUPPORTED_LOCALES) : DEFAULT_LOCALE;
  if (!CATALOG[locale]) locale = DEFAULT_LOCALE;

  function interpolate(text, params) {
    if (!params || typeof text !== "string") return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
    ));
  }

  function lookup(key, code) {
    const pack = CATALOG[code];
    if (pack && pack[key]) return pack[key];
    const fallback = CATALOG[DEFAULT_LOCALE];
    if (fallback && fallback[key]) return fallback[key];
    return key;
  }

  function t(key, params) {
    return interpolate(lookup(key, locale), params);
  }

  function has(key) {
    const pack = CATALOG[locale] || {};
    const fallback = CATALOG[DEFAULT_LOCALE] || {};
    return Boolean(pack[key] || fallback[key]);
  }

  function getLocale() {
    return locale;
  }

  function getLocaleMeta(code) {
    return LOCALE_META[code] || { label: code, nativeLabel: code, flag: "🌐" };
  }

  function setLocale(code, options = {}) {
    const next = SUPPORTED_LOCALES.includes(code) ? code : DEFAULT_LOCALE;
    if (next === locale && !options.force) return locale;
    locale = next;
    if (storeModule.saveLocale) storeModule.saveLocale(locale);
    document.documentElement.lang = locale;
    listeners.forEach((fn) => {
      try { fn(locale); } catch (_error) { /* ignore listener errors */ }
    });
    return locale;
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  function configure(options) {
    if (options.locale && SUPPORTED_LOCALES.includes(options.locale)) {
      setLocale(options.locale, { force: true });
    }
  }

  document.documentElement.lang = locale;

  window.CISI18n = {
    t,
    has,
    getLocale,
    setLocale,
    getLocaleMeta,
    onChange,
    configure,
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    LOCALE_META,
  };
})();
