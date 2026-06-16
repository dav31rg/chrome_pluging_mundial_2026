/* =====================================================
   Dark Mode + Mundial 2026 Extension — popup.js
   ===================================================== */

'use strict';

const API_BASE       = 'https://www.thesportsdb.com/api/v1/json/3';
const WORLD_CUP_ID    = '4429';
const WORLD_CUP_SEASON = '2026';
const FAVORITE_KEY    = 'mundial_favoriteTeam';

/* ── State ──────────────────────────────────────────── */
const state = {
  currentMatchType: 'today',
  currentChromeTab: null,
  storageKey:       null,
  favoriteTeam:     null,
};

/* ── Boot ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {

  /* ── DOM refs ────────────────────────────────────── */
  const tabBtns         = document.querySelectorAll('.tab-btn');
  const tabThemeEl      = document.getElementById('tab-theme');
  const tabFutbolEl     = document.getElementById('tab-futbol');

  // Theme tab
  const toggleEl        = document.getElementById('dark-toggle');
  const modeIconEl      = document.getElementById('mode-icon');
  const modeTextEl      = document.getElementById('mode-text');
  const modeSubEl       = document.getElementById('mode-sub');
  const headerIconEl    = document.getElementById('header-icon');
  const siteNameEl      = document.getElementById('site-name');
  const toggleCardEl    = document.getElementById('toggle-card');
  const unsupportedEl   = document.getElementById('unsupported');

  // Mundial 2026 tab
  const teamSearchInput   = document.getElementById('team-search');
  const searchBtn         = document.getElementById('search-btn');
  const favoriteBadgeEl   = document.getElementById('favorite-badge');
  const favoriteNameEl    = document.getElementById('favorite-name');
  const favoriteClearBtn  = document.getElementById('favorite-clear');
  const matchesContainer  = document.getElementById('matches-container');
  const subTabBtns        = document.querySelectorAll('.sub-tab');

  /* ── Tab switching ───────────────────────────────── */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      tabThemeEl.classList.toggle('hidden',  target !== 'theme');
      tabFutbolEl.classList.toggle('hidden', target !== 'futbol');
    });
  });

  /* ── Dark Mode logic ─────────────────────────────── */
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentChromeTab = tab;

    if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
      showUnsupported();
    } else {
      const url = new URL(tab.url);
      state.storageKey = `darkMode_${url.origin}`;
      siteNameEl.textContent = url.hostname;

      const stored = await chrome.storage.local.get(state.storageKey);
      renderThemeUI(stored[state.storageKey] ?? false);
    }
  } catch (err) {
    console.error('[DarkModeExt]', err);
    siteNameEl.textContent = 'Error al cargar';
  }

  toggleEl.addEventListener('change', async () => {
    const newValue = toggleEl.checked;
    if (!state.storageKey || !state.currentChromeTab) return;

    await chrome.storage.local.set({ [state.storageKey]: newValue });

    try {
      await chrome.tabs.sendMessage(state.currentChromeTab.id, {
        action: 'setDarkMode', value: newValue,
      });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: state.currentChromeTab.id },
        files: ['content.js'],
      });
      await chrome.tabs.sendMessage(state.currentChromeTab.id, {
        action: 'setDarkMode', value: newValue,
      });
    }

    renderThemeUI(newValue);
  });

  /* ── Mundial 2026 logic ───────────────────────────── */
  const storedFavorite = await chrome.storage.local.get(FAVORITE_KEY);
  state.favoriteTeam = storedFavorite[FAVORITE_KEY] ?? null;
  renderFavoriteUI();

  searchBtn.addEventListener('click', saveFavoriteTeam);
  teamSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveFavoriteTeam();
  });
  favoriteClearBtn.addEventListener('click', async () => {
    state.favoriteTeam = null;
    await chrome.storage.local.remove(FAVORITE_KEY);
    renderFavoriteUI();
    await loadActiveSubTab();
  });

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      subTabBtns.forEach(b => b.classList.toggle('active', b === btn));
      state.currentMatchType = btn.dataset.type;
      await loadActiveSubTab();
    });
  });

  await loadActiveSubTab();

  /* ─────────────────────────────────────────────────
     Mundial 2026 helpers
     ───────────────────────────────────────────────── */

  async function saveFavoriteTeam() {
    const name = teamSearchInput.value.trim();
    if (!name) return;
    state.favoriteTeam = name;
    await chrome.storage.local.set({ [FAVORITE_KEY]: name });
    teamSearchInput.value = '';
    renderFavoriteUI();
    await loadActiveSubTab();
  }

  function renderFavoriteUI() {
    if (state.favoriteTeam) {
      favoriteNameEl.textContent = state.favoriteTeam;
      favoriteBadgeEl.classList.remove('hidden');
    } else {
      favoriteBadgeEl.classList.add('hidden');
    }
  }

  async function loadActiveSubTab() {
    if (state.currentMatchType === 'groups') {
      await loadGroups();
    } else {
      await loadMatches(state.currentMatchType);
    }
  }

  async function loadMatches(type) {
    setMatchesHTML(loadingHTML());

    try {
      let events = [];
      if (type === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        const res   = await fetch(
          `${API_BASE}/eventsday.php?d=${today}&l=${WORLD_CUP_ID}`
        );
        const data  = await res.json();
        events = data.events ?? [];
      } else {
        const res  = await fetch(`${API_BASE}/eventsnextleague.php?id=${WORLD_CUP_ID}`);
        const data = await res.json();
        events = data.events ?? [];
      }

      if (!events || events.length === 0) {
        const msg = type === 'today'
          ? 'No hay partidos del Mundial hoy'
          : 'No hay próximos partidos programados';
        setMatchesHTML(emptyHTML('📅', msg));
        return;
      }

      const list = events.slice(0, 12);
      setMatchesHTML(
        `<div class="matches-list">${list.map(ev => matchCardHTML(ev)).join('')}</div>`
      );
    } catch {
      setMatchesHTML(emptyHTML('❌', 'Error al cargar los partidos.'));
    }
  }

  async function loadGroups() {
    setMatchesHTML(loadingHTML());

    try {
      const res  = await fetch(
        `${API_BASE}/lookuptable.php?l=${WORLD_CUP_ID}&s=${WORLD_CUP_SEASON}`
      );
      const data  = await res.json();
      const table = data.table ?? [];

      if (table.length === 0) {
        setMatchesHTML(emptyHTML('📊', 'La tabla de grupos no está disponible todavía.'));
        return;
      }

      const groups = new Map();
      for (const row of table) {
        const groupName = row.strGroup ?? 'Grupo';
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(row);
      }

      const sortedGroupNames = [...groups.keys()].sort();
      const html = sortedGroupNames.map(name => groupTableHTML(name, groups.get(name))).join('');
      setMatchesHTML(`<div class="groups-list">${html}</div>`);
    } catch {
      setMatchesHTML(emptyHTML('❌', 'Error al cargar la tabla de grupos.'));
    }
  }

  function groupTableHTML(groupName, rows) {
    const sorted = [...rows].sort((a, b) => Number(a.intRank) - Number(b.intRank));
    const rowsHTML = sorted.map(r => {
      const isFav = isFavoriteTeam(r.strTeam);
      return `
        <div class="group-row${isFav ? ' team-highlight' : ''}">
          <span class="group-rank">${esc(r.intRank)}</span>
          <span class="group-team">${isFav ? '★ ' : ''}${esc(r.strTeam)}</span>
          <span class="group-stat">${esc(r.intPlayed)}</span>
          <span class="group-stat">${esc(r.intGoalDifference)}</span>
          <span class="group-points">${esc(r.intPoints)}</span>
        </div>`;
    }).join('');

    return `
      <div class="group-block">
        <div class="group-title">${esc(groupName)}</div>
        <div class="group-header">
          <span class="group-rank">#</span>
          <span class="group-team">Equipo</span>
          <span class="group-stat">PJ</span>
          <span class="group-stat">DG</span>
          <span class="group-points">Pts</span>
        </div>
        ${rowsHTML}
      </div>`;
  }

  function isFavoriteTeam(name) {
    if (!state.favoriteTeam || !name) return false;
    return name.toLowerCase().includes(state.favoriteTeam.toLowerCase());
  }

  function matchCardHTML(ev) {
    const home      = ev.strHomeTeam  ?? '';
    const away      = ev.strAwayTeam  ?? '';
    const homeScore = ev.intHomeScore;
    const awayScore = ev.intAwayScore;
    const date      = fmtDate(ev.dateEvent);
    const time      = (ev.strTime ?? '').slice(0, 5);
    const group     = ev.strGroup ? `Grupo ${ev.strGroup}` : (ev.strLeague ?? '');
    const status    = ev.strStatus ?? '';

    const isHome = isFavoriteTeam(home);
    const isAway = isFavoriteTeam(away);

    const hasScore = homeScore !== null && homeScore !== undefined && homeScore !== '';
    const scoreEl  = hasScore
      ? `<span class="score">${esc(homeScore)} – ${esc(awayScore)}</span>`
      : `<span class="score vs">vs</span>`;

    const lStatus = status.toLowerCase();
    let badgeEl = '';
    if (lStatus.includes('finish') || lStatus === 'ft' || lStatus.includes('aet')) {
      badgeEl = `<span class="badge badge-fin">FIN</span>`;
    } else if (lStatus.includes('progress') || lStatus.includes('live') || lStatus === 'ht') {
      badgeEl = `<span class="badge badge-live">EN VIVO</span>`;
    } else {
      badgeEl = time ? `<span class="badge badge-time">${esc(time)}</span>` : '';
    }

    return `
      <div class="match-card">
        <div class="match-teams">
          <span class="team-name${isHome ? ' team-highlight' : ''}">${isHome ? '★ ' : ''}${esc(home)}</span>
          ${scoreEl}
          <span class="team-name away${isAway ? ' team-highlight' : ''}">${isAway ? '★ ' : ''}${esc(away)}</span>
        </div>
        <div class="match-meta">
          <span class="match-league" title="${esc(group)}">${esc(group)}</span>
          <span class="match-date-status">${date}${badgeEl}</span>
        </div>
      </div>`;
  }

  /* ─────────────────────────────────────────────────
     Theme helpers
     ───────────────────────────────────────────────── */

  function renderThemeUI(isDark) {
    toggleEl.checked = isDark;
    document.body.classList.toggle('dark-theme', isDark);

    if (isDark) {
      headerIconEl.textContent = '🌙';
      modeIconEl.textContent   = '🌙';
      modeTextEl.textContent   = 'Modo Oscuro';
      modeSubEl.textContent    = 'Haz clic para desactivar';
    } else {
      headerIconEl.textContent = '☀️';
      modeIconEl.textContent   = '☀️';
      modeTextEl.textContent   = 'Modo Claro';
      modeSubEl.textContent    = 'Haz clic para activar modo oscuro';
    }
  }

  function showUnsupported() {
    toggleCardEl.classList.add('hidden');
    unsupportedEl.classList.remove('hidden');
    siteNameEl.textContent = 'Página no compatible';
  }

  /* ─────────────────────────────────────────────────
     Utilities
     ───────────────────────────────────────────────── */

  function setMatchesHTML(html) { matchesContainer.innerHTML = html; }

  function loadingHTML() {
    return `<div class="loading-state"><div class="spinner"></div><span>Cargando…</span></div>`;
  }

  function emptyHTML(icon, msg) {
    return `<div class="empty-state"><span>${icon}</span><p>${msg}</p></div>`;
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(`${dateStr}T12:00:00`)
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
