// Berättelser ur släktboken (data/stories.json): teman, kort med källhänvisning,
// länkar till släktträdet, kartan och tidslinjen. Berättelser med ett årtal och
// ett "timeline"-spår visas också på tidslinjen (js/timeline.js).
window.Stories = (function () {
  const S = { theme: 'all', data: { themes: [], stories: [] } };
  const esc = (s) => (window.Unified ? Unified.esc(s) : String(s == null ? '' : s));
  const T = (k, v) => I18n.t(k, v);
  const D = (s) => I18n.dt(s);

  function yearsLabel(st) {
    if (st.year == null) return '';
    const y = st.end != null && st.end !== st.year ? `${st.year}–${st.end}` : String(st.year);
    return y;
  }
  function sourceLine(st) {
    const refs = (st.sources || []).map((s) => T('st_vol', { vol: String(s.vol), pages: String(s.pages) })).join('; ');
    return refs ? T('st_source', { refs }) : '';
  }
  function themeTitle(id) {
    const th = S.data.themes.find((t) => t.id === id);
    return th ? D(th.title) : '';
  }

  function peopleButtons(st) {
    return (st.persons || [])
      .map((pid) => {
        const r = window.Unified && Unified.idx.byId[pid];
        return r ? `<button class="timeline-person-link" data-person="${esc(pid)}">${esc(Unified.displayName(r))}</button>` : '';
      })
      .join('');
  }

  function card(st) {
    const place = st.place_id && App.state.placesById[st.place_id];
    const people = peopleButtons(st);
    const yl = yearsLabel(st);
    return `
      <article class="story-card" id="story-${esc(st.id)}" data-story-id="${esc(st.id)}">
        <div class="story-meta">${esc(themeTitle(st.theme))}${yl ? ` · <span class="story-year">${esc(yl)}${st.approx ? ` <span class="approx-tag">${esc(T('approx'))}</span>` : ''}</span>` : ''}</div>
        <h3>${esc(D(st.title))}</h3>
        <p class="story-text">${esc(D(st.text))}</p>
        ${st.note ? `<p class="story-note">${esc(D(st.note))}</p>` : ''}
        ${people ? `<div class="timeline-people"><span class="timeline-people-label">${esc(T('tl_in_tree'))}</span>${people}</div>` : ''}
        <div class="story-actions">
          ${st.timeline && st.year != null ? `<button type="button" class="tl-zoomto" data-tl="${esc(st.id)}">${esc(T('st_on_timeline'))}</button>` : ''}
          ${place ? `<button class="timeline-place-link" data-place="${esc(st.place_id)}">📍 ${esc(D(place.name).split(' – ')[0])} — ${esc(T('tl_on_map'))}</button>` : ''}
        </div>
        <p class="story-source">${esc(sourceLine(st))}</p>
      </article>`;
  }

  function render() {
    S.data = App.state.stories || { themes: [], stories: [] };
    const nav = document.getElementById('stories-themes');
    const list = document.getElementById('stories-list');
    if (!nav || !list) return;
    const counts = {};
    S.data.stories.forEach((s) => (counts[s.theme] = (counts[s.theme] || 0) + 1));
    nav.innerHTML =
      `<button type="button" class="stories-theme${S.theme === 'all' ? ' is-active' : ''}" data-theme="all">${esc(T('st_all'))} <span>${S.data.stories.length}</span></button>` +
      S.data.themes
        .filter((th) => counts[th.id])
        .map((th) => `<button type="button" class="stories-theme${S.theme === th.id ? ' is-active' : ''}" data-theme="${esc(th.id)}">${esc(D(th.title))} <span>${counts[th.id]}</span></button>`)
        .join('');
    const themes = S.theme === 'all' ? S.data.themes : S.data.themes.filter((t) => t.id === S.theme);
    list.innerHTML = themes
      .map((th) => {
        const its = S.data.stories.filter((s) => s.theme === th.id);
        if (!its.length) return '';
        return `<section class="stories-section" id="theme-${esc(th.id)}">
          <h2>${esc(D(th.title))}</h2>
          ${th.intro ? `<p class="stories-section-intro">${esc(D(th.intro))}</p>` : ''}
          <div class="stories-grid">${its.map(card).join('')}</div>
        </section>`;
      })
      .join('');

    nav.querySelectorAll('[data-theme]').forEach((b) =>
      b.addEventListener('click', () => {
        S.theme = b.dataset.theme;
        render();
        document.getElementById('stories-scroll').scrollTop = 0;
      })
    );
    list.querySelectorAll('[data-person]').forEach((b) => b.addEventListener('click', () => Unified.showPerson(b.dataset.person)));
    list.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => Unified.showPlace(b.dataset.place)));
    list.querySelectorAll('[data-tl]').forEach((b) =>
      b.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-view="timeline"]').click();
        requestAnimationFrame(() => window.Timeline && Timeline.focus('story_' + b.dataset.tl));
      })
    );
  }

  // Öppna fliken och visa en berättelse (anropas från tidslinjen och släktträdet).
  function show(id) {
    const st = (S.data.stories || []).find((s) => s.id === id);
    if (!st) return;
    if (S.theme !== 'all' && S.theme !== st.theme) {
      S.theme = 'all';
      render();
    }
    document.querySelector('.tab-btn[data-view="stories"]').click();
    requestAnimationFrame(() => {
      const el = document.getElementById('story-' + id);
      if (!el) return;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.classList.remove('is-flash');
      void el.offsetWidth;
      el.classList.add('is-flash');
    });
  }

  // Lista över berättelser om en person, till personkortet i släktträdet.
  function drawerHtml(personId) {
    const its = (S.data.stories || []).filter((s) => (s.persons || []).includes(personId));
    if (!its.length) return '';
    return (
      `<div class="d-section-label">${esc(T('st_drawer'))}</div><div class="d-stories">` +
      its.map((s) => `<button class="d-story" data-story="${esc(s.id)}">📖 ${esc(D(s.title))}</button>`).join('') +
      '</div>'
    );
  }

  window.addEventListener('dataready', render);
  window.addEventListener('langchange', () => App.state.stories && render());
  return { show, drawerHtml, render, state: S };
})();
