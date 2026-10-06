// "Hela klanen" — kompletterande bläddringsvy över hela den sammanslagna
// datamängden (data/unified.json). Samma informationspanel som trädet
// (js/unified.js); varje person kan öppnas direkt i släktträdet.
(function () {
  let built = false;
  let U;

  function renderStats() {
    const persons = U.list.filter((r) => r.kind !== 'group');
    const aliases = persons.reduce((n, r) => n + (r.aliases ? r.aliases.length : 0), 0);
    const bookRecords = persons.filter((r) => r.id.startsWith('clan_')).length + aliases;
    const groups = U.list.filter((r) => r.kind === 'group').length;
    const unplaced = U.byId['grp_unplaced'] ? U.size['grp_unplaced'] - groups : 0;
    const connected = persons.length - unplaced;
    document.getElementById('clan-stats').textContent = I18n.t('clan_stats', { records: bookRecords, persons: persons.length, connected });
  }

  function renderBranchList() {
    const container = document.getElementById('clan-branches');
    // största sammanhängande grenar: Sìrú-gong + fragmenten utan känd koppling
    const tops = [U.rootId];
    U.list.forEach((r) => {
      if (r.parent_id && U.byId[r.parent_id] && U.byId[r.parent_id].kind === 'group' && r.kind !== 'group') tops.push(r.id);
    });
    tops.sort((a, b) => U.size[b] - U.size[a]);
    const shownTops = tops.filter((id) => U.size[id] >= 4).slice(0, 60);
    const smallCount = tops.length - shownTops.length;
    container.innerHTML = shownTops
      .map((id) => {
        const r = U.byId[id];
        const isRoot = id === U.rootId;
        const n = isRoot && U.byId['grp_unplaced'] ? U.size[id] - U.size['grp_unplaced'] - 1 : U.size[id] - 1;
        const up = I18n.t('link_up_unknown');
        const tag = isRoot ? I18n.t('clan_root_tag') : r.generation ? I18n.t(r.generation_estimated ? 'gen_short_est' : 'gen_short', { g: r.generation }) + ' · ' + up : up;
        return `<button class="cl-branch-card" data-goto="${Unified.esc(id)}">
          <span class="cl-branch-hanzi zh">${Unified.esc(r.hanzi || '')}</span>
          <span class="cl-branch-pinyin">${Unified.esc(r.western || r.pinyin || '')}</span>
          <span class="cl-branch-count">${I18n.t('descendants', { n })} · ${Unified.esc(tag)}</span>
        </button>`;
      })
      .join('');
    container.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => Unified.openDrawer(btn.dataset.goto, { from: 'clan' }));
    });
    document.getElementById('clan-more-note').textContent =
      smallCount > 0 ? I18n.t('clan_more', { n: smallCount }) : '';
  }

  function runSearch(q) {
    const resultsEl = document.getElementById('clan-search-results');
    if (!q.trim()) {
      resultsEl.innerHTML = '';
      resultsEl.hidden = true;
      return;
    }
    const hits = Unified.search(q, 40);
    resultsEl.hidden = false;
    if (!hits.length) {
      resultsEl.innerHTML = `<p class="cl-note">${I18n.t('no_hits')}</p>`;
      return;
    }
    resultsEl.innerHTML = hits
      .map((id) => {
        const r = U.byId[id];
        const n = U.size[id] - 1;
        return `<button class="cl-search-hit" data-goto="${Unified.esc(id)}">
          <span>${Unified.esc(Unified.displayName(r))}</span>
          ${n > 0 ? `<span class="cl-count">${I18n.t('descendants', { n })}</span>` : ''}
        </button>`;
      })
      .join('');
    resultsEl.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => Unified.openDrawer(btn.dataset.goto, { from: 'clan' }));
    });
  }

  function build() {
    if (built || !window.App.state.unified) return;
    U = Unified.build(window.App.state.unified);
    renderStats();
    renderBranchList();
    const input = document.getElementById('clan-search-input');
    input.addEventListener('input', () => runSearch(input.value));
    built = true;
  }

  window.addEventListener('dataready', build);
  window.addEventListener('langchange', () => {
    if (!built) return;
    renderStats();
    renderBranchList();
    runSearch(document.getElementById('clan-search-input').value);
  });
  window.addEventListener('viewchange', (e) => {
    if (e.detail === 'clan') build();
  });
})();
