/* =====================================================
   Dark Mode Toggle Extension — content.js
   Runs at document_start on every http/https page.
   ===================================================== */

(function () {
  'use strict';

  const STYLE_ID    = '__dark_mode_ext__';
  const storageKey  = `darkMode_${location.origin}`;

  /* ── CSS ──────────────────────────────────────────── */

  const DARK_CSS = `
    html {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    img,
    video,
    picture,
    canvas,
    svg,
    iframe,
    [style*="background-image"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;

  /* ── Core helpers ─────────────────────────────────── */

  function injectDarkMode() {
    if (document.getElementById(STYLE_ID)) return;
    const style    = document.createElement('style');
    style.id       = STYLE_ID;
    style.textContent = DARK_CSS;
    // document.head may not exist yet at document_start
    (document.head || document.documentElement).appendChild(style);
  }

  function removeDarkMode() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  /* ── Apply on page load based on saved preference ─── */

  chrome.storage.local.get(storageKey, (result) => {
    if (result[storageKey]) {
      injectDarkMode();
    }
  });

  /* ── Listen for messages from the popup ──────────── */

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'setDarkMode') {
      if (message.value) {
        injectDarkMode();
      } else {
        removeDarkMode();
      }
      sendResponse({ success: true });
    }
    // Return true to keep the message channel open for async sendResponse
    return true;
  });
})();
