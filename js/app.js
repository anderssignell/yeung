// Shared app state: theme toggle, tab switching, data loading.
window.App = (function () {
  const state = {
    people: [],
    peopleById: {},
    timeline: [],
    places: [],
    placesById: {},
    customs: null,
    unified: null, // family.json + clan.json sammanslagna (data/build_unified.py)
  };

  async function loadData() {
    const get = (name) => window.SiteLock.fetchJSON(name);
    const [unified, timeline, places, customs, placesExt, contributions, config, stories, sources] = await Promise.all([
      get('unified.json'),
      get('timeline.json'),
      get('places.json'),
      get('customs.json'),
      get('places_extended.json').catch(() => ({ places: [] })),
      get('contributions.json').catch(() => ({ items: [] })), // godkända bidrag (tools/import_contributions.py)
      get('config.json').catch(() => null), // bidragsmottagaren (build_public.py)
      get('stories.json').catch(() => ({ themes: [], stories: [] })), // berättelser ur släktboken
      get('sources.json').catch(() => ({})), // länk till originalet (Harvard)
    ]);
    state.sources = sources;
    state.stories = stories;
    state.contributions = contributions;
    state.config = config;
    state.placesExt = placesExt; // grannbyar + utvandring ur släktboken (data/extract_places.py)
    state.unified = unified;
    state.people = unified.filter((p) => p.family_id); // familjens gren (bakåtkompatibelt)
    state.timeline = timeline;
    state.places = places;
    state.customs = customs;
    state.people.forEach((p) => (state.peopleById[p.family_id] = p));
    places.forEach((p) => (state.placesById[p.id] = p));
    placesExt.places.forEach((p) => (state.placesById[p.id] = state.placesById[p.id] || p));
    return state;
  }

  function initTheme() {
    const btn = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let current = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', current);
    btn.addEventListener('click', () => {
      current = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', current);
      window.dispatchEvent(new CustomEvent('themechange', { detail: current }));
    });
  }

  function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = {
      tree: document.getElementById('view-tree'),
      timeline: document.getElementById('view-timeline'),
      stories: document.getElementById('view-stories'),
      map: document.getElementById('view-map'),
      customs: document.getElementById('view-customs'),
      clan: document.getElementById('view-clan'),
    };
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        tabs.forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        Object.entries(panels).forEach(([key, el]) => {
          el.hidden = key !== view;
        });
        window.dispatchEvent(new CustomEvent('viewchange', { detail: view }));
      });
    });
  }

  function initDrawer() {
    const drawer = document.getElementById('detail-drawer');
    const scrim = document.getElementById('drawerScrim');
    const closeBtn = document.getElementById('drawerClose');
    function close() {
      drawer.classList.remove('is-open');
      scrim.classList.remove('is-open');
    }
    closeBtn.addEventListener('click', close);
    scrim.addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    return { close };
  }

  // "Granska bidrag" visas bara på enheter där granskningssidan har låsts upp (review.js sätter flaggan).
  function initAdminLink() {
    let admin = false;
    try {
      admin = !!localStorage.getItem('yeung-admin');
    } catch (e) {
      admin = false;
    }
    const link = document.getElementById('reviewLink');
    if (link) link.hidden = !admin;
  }

  async function boot() {
    I18n.init(); // språkval (js/i18n.js)
    initAdminLink();
    initTheme();
    initTabs();
    const drawerCtl = App.drawerCtl = initDrawer();
    await window.SiteLock.unlock(); // lösenord (js/lock.js)
    document.body.classList.remove('is-locked');
    await Promise.all([loadData(), I18n.onUnlocked()]);
    const lockBtn = document.getElementById('lockNow');
    if (lockBtn && window.SiteLock.isEncrypted()) {
      lockBtn.hidden = false;
      lockBtn.addEventListener('click', window.SiteLock.lockNow);
    }
    window.dispatchEvent(new CustomEvent('dataready'));
  }

  document.addEventListener('DOMContentLoaded', boot);

  // Länk till det digitaliserade originalet av släktboken (data/sources.json).
  function bookLink(cls) {
    const b = state.sources && state.sources.book;
    if (!b || !b.url) return '';
    const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return `<a class="book-link${cls ? ' ' + cls : ''}" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(I18n.t('book_original'))} ↗</a>`;
  }

  // Adress till en viss sida i originalet hos Harvard. vol = 1–10 (översättningens volym),
  // page = sidan i översättningen (= sidan i den nedladdade PDF-filen för volymen).
  function bookPageUrl(vol, page) {
    const b = state.sources && state.sources.book;
    vol = parseInt(String(vol).replace('vol', ''), 10);
    page = parseInt(page, 10);
    if (!b || !b.canvas_ids || !vol || !page || vol > b.vol_pages.length || page > b.vol_pages[vol - 1]) return '';
    let seq = page;
    for (let i = 0; i < vol - 1; i++) seq += b.vol_pages[i];
    const id = b.canvas_ids[seq - 1];
    return id ? b.viewer + encodeURIComponent(b.canvas_prefix + id) : '';
  }
  // Text som länkar till rätt sida i originalet (eller bara texten om sidan saknas).
  function refLink(text, vol, page) {
    const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const u = bookPageUrl(vol, page);
    return u ? `<a class="book-ref" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(I18n.t('book_page_title'))}">${esc(text)}</a>` : esc(text);
  }

  return { bookLink, bookPageUrl, refLink, state, drawerCtl: null };
})();
