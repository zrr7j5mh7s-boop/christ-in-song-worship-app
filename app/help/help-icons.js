(function () {
  "use strict";

  const ICONS = {
    "start-here": `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3l8 4v6c0 5-3.5 9.2-8 10-4.5-.8-8-5-8-10V7l8-4zm0 2.2L6 8.1v4.9c0 3.8 2.6 7.1 6 7.9 3.4-.8 6-4.1 6-7.9V8.1l-6-2.9zM11 8h2v6h-2V8zm0 8h2v2h-2v-2z"/></svg>`,
    "worship-service": `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2zm12-8l4 3-4 3V8z"/></svg>`,
    bible: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h9a3 3 0 013 3v14l-3-2-3 2-3-2-3 2V7a3 3 0 013-3zm0 2v12.5l1-.67 3 2 3-2 3 2 1-.67V7a1 1 0 00-1-1H6zm2 2h7v2H8V8zm0 4h7v2H8v-2z"/></svg>`,
    hymns: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c4.4 0 8 2.7 8 6v8H4V9c0-3.3 3.6-6 8-6zm0 2c-3 0-5.5 1.6-5.5 4v6h11V9c0-2.4-2.5-4-5.5-4zm-3 5h6v2H9V10zm0 4h4v2H9v-2z"/></svg>`,
    obs: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 7h16v10H4V7zm2 2v6h12V9H6zm2 2h8v2H8v-2zm10-6h2v2h-2V5zM4 5h2v2H4V5zm14 12h2v2h-2v-2zM4 17h2v2H4v-2z"/></svg>`,
    media: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2zm14 3l4 2v4l-4 2v-8z"/></svg>`,
    shortcuts: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h2v2H7V5zm8 0h2v2h-2V5zM5 7h2v2H5V7zm12 0h2v2h-2V7zM7 9h10v2H7V9zm-2 2h2v2H5v-2zm12 0h2v2h-2v-2zM7 13h10v2H7v-2zm-2 2h2v2H5v-2zm12 0h2v2h-2v-2zM9 17h6v2H9v-2z"/></svg>`,
    troubleshooting: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2h2v2h-2V2zm-4.2 2.4l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zM15.2 4.4l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zM4 11h2v2H4v-2zm14 0h2v2h-2v-2zM6.8 15.2l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zm10.4 0l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zM11 18h2v4h-2v-4z"/></svg>`,
    emergency: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10h2v5h-2v-5zm0 7h2v2h-2v-2z"/></svg>`,
    training: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l3 6 6 .9-4.5 4.4 1.1 6.5L12 17l-5.6 2.8 1.1-6.5L3 8.9 9 8l3-6zm0 4.2L10.2 9H7.3l2.3 2.2-.6 3.4L12 13.3l2.9 1.3-.6-3.4 2.3-2.2h-2.9L12 6.2z"/></svg>`,
    backup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a7 7 0 00-7 7v3H3v8h18v-8h-2v-3a7 7 0 00-7-7zm0 2a5 5 0 015 5v3H7V10a5 5 0 015-5zm-5 9h10v4H7v-4z"/></svg>`,
    about: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 110 16 8 8 0 010-16zm-1 4h2v2h-2V8zm0 4h2v6h-2v-6z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 4a6 6 0 104.47 10.04l4.25 4.25 1.41-1.41-4.25-4.25A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z"/></svg>`,
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3l9 8h-3v10h-5v-6H11v6H6V11H3l9-8z"/></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h12v16l-6-4-6 4V4z"/></svg>`,
    diagnostics: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 13h2v-2H3v2zm4 0h14v-2H7v2zm-4 4h2v-2H3v2zm4 0h14v-2H7v2zM3 5h2V3H3v2zm4 0h14V3H7v2z"/></svg>`,
    glossary: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H9l-4 3V5a1 1 0 011-1zm2 3v2h10V7H7zm0 4v2h7v-2H7z"/></svg>`,
    faq: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    checklist: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4h14v2H7V4zm0 5h14v2H7V9zm0 5h14v2H7v-2zm-6-9h2v2H1V5zm0 5h2v2H1v-2zm0 5h2v2H1v-2z"/></svg>`,
  };

  function renderIcon(name, className) {
    const svg = ICONS[name] || ICONS.about;
    return `<span class="help-icon ${className || ""}" aria-hidden="true">${svg}</span>`;
  }

  window.CISHelpIcons = { ICONS, renderIcon };
})();
