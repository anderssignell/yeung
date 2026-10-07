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
    const [unified, timeline, places, customs, placesExt, contributions, config, stories] = await Promise.all([
      get('unified.json'),
      get('timeline.json'),
      get('places.json'),
      get('customs.json'),
      get('places_extended.json').catch(() => ({ places: [] })),
      get('contributions.json').catch(() => ({ items: [] })), // godkända bidrag (tools/import_contributions.py)
      get('config.json').catch(() => null), // bidragsmottagaren (build_public.py)
      get('stories.json').catch(() => ({ themes: [], stories: [] })), // berättelser ur släktboken
    ]);
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

  return { state, drawerCtl: null };
})();
