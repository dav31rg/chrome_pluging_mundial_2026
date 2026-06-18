/* =====================================================
   Dark Mode + Fútbol Extension — popup.js
   ===================================================== */

'use strict';

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const RECENT_RESULTS_LEAGUE_ID = '4429';
const RECENT_RESULTS_LEAGUE_NAME = 'Mundial 2026';

/* ── State ──────────────────────────────────────────── */
const state = {
  currentTeamId:    null,
  currentTeamName:  null,
  currentMatchType: 'last',
  currentChromeTab: null,
  storageKey:       null,
  statsCache:       new Map(),
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

  // Football tab
  const teamSearchInput   = document.getElementById('team-search');
  const searchBtn         = document.getElementById('search-btn');
  const teamHeaderEl      = document.getElementById('team-header');
  const teamBadgeImg      = document.getElementById('team-badge-img');
  const teamDisplayName   = document.getElementById('team-display-name');
  const teamDisplayLeague = document.getElementById('team-display-league');
  const matchSubTabsEl    = document.getElementById('match-sub-tabs');
  const matchesContainer  = document.getElementById('matches-container');
  const recentLeagueEl    = document.getElementById('recent-results-league');
  const recentContainer   = document.getElementById('recent-results-container');
  const upcomingLeagueEl  = document.getElementById('upcoming-matches-league');
  const upcomingContainer = document.getElementById('upcoming-matches-container');
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

  /* ── Football logic ──────────────────────────────── */
  searchBtn.addEventListener('click', handleSearch);
  teamSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!state.currentTeamId) return;
      subTabBtns.forEach(b => b.classList.toggle('active', b === btn));
      state.currentMatchType = btn.dataset.type;
      await loadMatches(state.currentTeamId, state.currentMatchType);
    });
  });

  matchesContainer.addEventListener('click', handleMatchCardClick);
  recentContainer.addEventListener('click', handleMatchCardClick);
  upcomingContainer.addEventListener('click', handleMatchCardClick);
  matchesContainer.addEventListener('keydown', handleMatchCardKeydown);
  recentContainer.addEventListener('keydown', handleMatchCardKeydown);
  upcomingContainer.addEventListener('keydown', handleMatchCardKeydown);

  loadRecentResults();
  loadUpcomingMatches();

  /* ─────────────────────────────────────────────────
     Football helpers
     ───────────────────────────────────────────────── */

  async function handleSearch() {
    const query = teamSearchInput.value.trim();
    if (!query) return;

    setMatchesHTML(loadingHTML());

    try {
      const res  = await fetch(
        `${API_BASE}/searchteams.php?t=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (!data.teams || data.teams.length === 0) {
        teamHeaderEl.classList.add('hidden');
        matchSubTabsEl.classList.add('hidden');
        setMatchesHTML(emptyHTML('🔍',
          `No se encontró ningún equipo para <strong>${esc(query)}</strong>`));
        state.currentTeamId = null;
        return;
      }

      const team = data.teams[0];
      state.currentTeamId   = team.idTeam;
      state.currentTeamName = team.strTeam;

      // Update team header
      teamBadgeImg.src = team.strTeamBadge ? `${team.strTeamBadge}/preview` : '';
      teamBadgeImg.alt = team.strTeam;
      teamDisplayName.textContent   = team.strTeam;
      teamDisplayLeague.textContent = team.strLeague ?? '';
      teamHeaderEl.classList.remove('hidden');

      // Reset to "últimos" sub-tab
      state.currentMatchType = 'last';
      subTabBtns.forEach(b => b.classList.toggle('active', b.dataset.type === 'last'));
      matchSubTabsEl.classList.remove('hidden');

      await loadMatches(state.currentTeamId, 'last');
    } catch {
      setMatchesHTML(emptyHTML('❌', 'Error al conectar con la API. Intenta de nuevo.'));
    }
  }

  async function loadMatches(teamId, type) {
    setMatchesHTML(loadingHTML());
    const endpoint = type === 'last' ? 'eventslast' : 'eventsnext';

    try {
      const res  = await fetch(`${API_BASE}/${endpoint}.php?id=${teamId}`);
      const data = await res.json();

      // eventslast -> data.results  |  eventsnext -> data.events
      const events = data.results ?? data.events ?? [];

      if (!events || events.length === 0) {
        const msg = type === 'last'
          ? 'No hay partidos recientes disponibles'
          : 'No hay próximos partidos programados';
        setMatchesHTML(emptyHTML('📅', msg));
        return;
      }

      const list = events.slice(0, 8);
      setMatchesHTML(
        `<div class="matches-list">${list.map(ev => matchCardHTML(ev)).join('')}</div>`
      );
    } catch {
      setMatchesHTML(emptyHTML('❌', 'Error al cargar los partidos.'));
    }
  }

  async function loadRecentResults() {
    recentLeagueEl.textContent = RECENT_RESULTS_LEAGUE_NAME;
    setRecentResultsHTML(loadingHTML('Cargando resultados...'));

    try {
      const res = await fetch(
        `${API_BASE}/eventsday.php?d=${today}&l=${RECENT_RESULTS_LEAGUE_ID}`
      );

      // const res   = await fetch(
      //   `${API_BASE}/eventsday.php?d=${today}&l=${WORLD_CUP_ID}`
      // );


      const data = await res.json();
      console.log(data);
      const events = data.events ?? [];

      if (!events || events.length === 0) {
        setRecentResultsHTML(emptyHTML('📅', 'No hay resultados recientes disponibles'));
        return;
      }

      setRecentResultsHTML(
        `<div class="matches-list recent-results-list">${
          events.slice(0, 8).map(ev => matchCardHTML(ev)).join('')
        }</div>`
      );
    } catch {
      setRecentResultsHTML(emptyHTML('❌', 'Error al cargar resultados recientes.'));
    }
  }

  async function loadUpcomingMatches() {
    upcomingLeagueEl.textContent = RECENT_RESULTS_LEAGUE_NAME;
    setUpcomingMatchesHTML(loadingHTML('Cargando partidos...'));

    try {
      const res = await fetch(
        `${API_BASE}/eventsnextleague.php?id=${RECENT_RESULTS_LEAGUE_ID}`
      );
      const data = await res.json();
      const events = data.events ?? [];

      if (!events || events.length === 0) {
        setUpcomingMatchesHTML(emptyHTML('📅', 'No hay próximos partidos disponibles'));
        return;
      }

      setUpcomingMatchesHTML(
        `<div class="matches-list upcoming-matches-list">${
          events.slice(0, 8).map(ev => matchCardHTML(ev)).join('')
        }</div>`
      );
    } catch {
      setUpcomingMatchesHTML(emptyHTML('❌', 'Error al cargar próximos partidos.'));
    }
  }

  function matchCardHTML(ev) {
    const home      = ev.strHomeTeam  ?? '';
    const away      = ev.strAwayTeam  ?? '';
    const homeScore = ev.intHomeScore;
    const awayScore = ev.intAwayScore;
    const date      = fmtDate(ev.dateEvent);
    const time      = (ev.strTime ?? '').slice(0, 5);
    const league    = ev.strLeague ?? '';
    const status    = ev.strStatus ?? '';

    const tName  = (state.currentTeamName ?? '').toLowerCase();
    const isHome = tName && home.toLowerCase().includes(tName);
    const isAway = tName && away.toLowerCase().includes(tName);

    const hasScore = homeScore !== null && homeScore !== undefined && homeScore !== ''
      && awayScore !== null && awayScore !== undefined && awayScore !== '';
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
      <div class="match-card" data-event-id="${esc(ev.idEvent)}" role="button" tabindex="0">
        <div class="match-teams">
          <span class="team-name${isHome ? ' team-highlight' : ''}">${esc(home)}</span>
          ${scoreEl}
          <span class="team-name away${isAway ? ' team-highlight' : ''}">${esc(away)}</span>
        </div>
        <div class="match-meta">
          <span class="match-league" title="${esc(league)}">${esc(league)}</span>
          <span class="match-date-status">${date}${badgeEl}</span>
        </div>
        <div class="match-stats hidden"></div>
      </div>`;
  }

  async function handleMatchCardClick(event) {
    const card = event.target.closest('.match-card');
    if (!card) return;

    const eventId = card.dataset.eventId;
    const statsEl = card.querySelector('.match-stats');
    if (!eventId || !statsEl) return;

    const isOpen = !statsEl.classList.contains('hidden');
    if (isOpen) {
      statsEl.classList.add('hidden');
      return;
    }

    statsEl.classList.remove('hidden');

    if (state.statsCache.has(eventId)) {
      statsEl.innerHTML = state.statsCache.get(eventId);
      return;
    }

    statsEl.innerHTML = statsLoadingHTML();

    try {
      const res = await fetch(`${API_BASE}/lookupeventstats.php?id=${eventId}`);
      const data = await res.json();
      const html = eventStatsHTML(data.eventstats ?? []);
      state.statsCache.set(eventId, html);
      statsEl.innerHTML = html;
    } catch {
      statsEl.innerHTML = statsEmptyHTML('Error al cargar estadísticas.');
    }
  }

  function handleMatchCardKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.target.closest('.match-card')) return;

    event.preventDefault();
    handleMatchCardClick(event);
  }

  function eventStatsHTML(stats) {
    if (!stats || stats.length === 0) {
      return statsEmptyHTML('No hay estadísticas disponibles.');
    }

    return `
      <div class="stats-list">
        ${stats.slice(0, 8).map(stat => `
          <div class="stat-row">
            <span>${esc(stat.intHome)}</span>
            <span>${esc(formatStatName(stat.strStat))}</span>
            <span>${esc(stat.intAway)}</span>
          </div>
        `).join('')}
      </div>`;
  }

  function statsLoadingHTML() {
    return `<div class="stats-state"><div class="mini-spinner"></div><span>Cargando estadísticas...</span></div>`;
  }

  function statsEmptyHTML(message) {
    return `<div class="stats-state"><span>${esc(message)}</span></div>`;
  }

  function formatStatName(name) {
    return String(name ?? '')
      .replace(/insidebox/i, 'inside box')
      .replace(/outsidebox/i, 'outside box');
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
  function setRecentResultsHTML(html) { recentContainer.innerHTML = html; }
  function setUpcomingMatchesHTML(html) { upcomingContainer.innerHTML = html; }

  function loadingHTML(text = 'Cargando...') {
    return `<div class="loading-state"><div class="spinner"></div><span>${esc(text)}</span></div>`;
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
