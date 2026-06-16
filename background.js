/* =====================================================
   Dark Mode Toggle Extension — background.js
   Manifest V3 Service Worker
   ===================================================== */

'use strict';

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[DarkModeExt] Extension instalada correctamente.');
  }
});
