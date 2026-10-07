// Gemensamt index, sökning och informationspanel för den sammanslagna
// personlistan (data/unified.json = family.json + clan.json, deduplicerad).
// Används av både "Släktträd" (js/tree.js) och "Hela klanen" (js/clan.js).
window.Unified = (function () {
  const T = (k, v) => I18n.t(k, v);
  const HEIR_KEYS = { no_heir: 'heir_no_heir', adopted_out: 'heir_adopted_out', adopted_in: 'heir_adopted_in' };
  const CONF_KEYS = ['confirmed', 'direct', 'documented', 'uncertain', 'gap'];
  const LINK_KEYS = ['reconstructed', 'ambiguous', 'gap', 'family'];
  const confLabel = (c) => (CONF_KEYS.includes(c) ? T('conf_' + c) : '');
  const linkLabel = (l) => (LINK_KEYS.includes(l) ? T('link_' + l) : '');
  const branchLabel = (b) => (b === 'eldest' || b === 'second' ? T('branch_' + b) : '');
  const relLabel = (r) => (['wife', 'daughter', 'abroad', 'mention'].includes(r) ? T('rel_' + r) : r);
  const BRANCH_SHORT = { eldest: '長房', second: '次房' };

  const idx = { byId: {}, kids: {}, size: {}, list: [], rootId: null, searchKeys: [] };
  let ready = false;

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fold(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function build(records) {
    if (ready) return idx;
    idx.list = records;
    records.forEach((r) => {
      idx.byId[r.id] = r;
      idx.kids[r.id] = [];
    });
    records.forEach((r) => {
      if (r.parent_id && idx.byId[r.parent_id]) idx.kids[r.parent_id].push(r.id);
      else if (!r.parent_id) idx.rootId = r.id;
    });
    // subträdsstorlek (iterativt, efterordning)
    const order = [];
    const stack = [idx.rootId];
    while (stack.length) {
      const id = stack.pop();
      order.push(id);
      idx.kids[id].forEach((k) => stack.push(k));
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      let s = 1;
      idx.kids[id].forEach((k) => (s += idx.size[k]));
      idx.size[id] = s;
    }
    // grupp-noder: största fragment först (generationsgrupperna behåller sin ordning 1→22, okänd sist)
    records.forEach((r) => {
      if (r.kind === 'group' && !idx.kids[r.id].every((k) => idx.byId[k].kind === 'group')) {
        idx.kids[r.id].sort((a, b) => idx.size[b] - idx.size[a]);
      }
    });
    // sökindex (inkl. alias-namn)
    records.forEach((r) => {
      if (r.kind === 'group') return;
      const parts = [r.pinyin, r.western, r.hanzi, r.book_hanzi, r.book_pinyin];
      (r.aliases || []).forEach((a) => parts.push(a.pinyin, a.hanzi, a.western));
      idx.searchKeys.push({ id: r.id, text: fold(parts.filter(Boolean).join(' | ')), raw: parts.filter(Boolean).join(' | ') });
    });
    ready = true;
    return idx;
  }

  function isPerson(r) {
    return r && r.kind !== 'group';
  }

  function ancestors(id) {
    const chain = [];
    let cur = idx.byId[id];
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? idx.byId[cur.parent_id] : null;
    }
    return chain;
  }

  function displayName(r) {
    if (!r) return '';
    if (r.kind === 'group') return I18n.dt(r.pinyin);
    if (r.confidence === 'gap' && !r.hanzi) return [I18n.dt(r.western), I18n.dt(r.pinyin)].filter(Boolean).join(' · ');
    return [r.western, r.hanzi].filter(Boolean).join(' ') || r.pinyin || '—';
  }

  function search(q, limit) {
    q = (q || '').trim();
    if (!q) return [];
    const fq = fold(q);
    const hits = [];
    for (const k of idx.searchKeys) {
      if (k.text.includes(fq) || k.raw.includes(q)) {
        hits.push(k.id);
      }
    }
    // exakt träff på hanzi eller namnets början först, sedan familjens gren, sedan större grenar
    const score = (id) => {
      const r = idx.byId[id];
      let s = 0;
      if (r.hanzi && (r.hanzi === q || r.hanzi.replace(/公$/, '') === q)) s -= 100;
      if (fold(r.pinyin).startsWith(fq) || fold(r.western).startsWith(fq)) s -= 20;
      if (r.family_id) s -= 10;
      return s - Math.min(idx.size[id], 50) / 10;
    };
    hits.sort((a, b) => score(a) - score(b));
    return hits.slice(0, limit || 40);
  }

  function genText(r) {
    if (r.generation == null) return I18n.dt(r.approx_year) || '';
    let t = T(r.generation_estimated ? 'gen_short_est' : 'gen_short', { g: r.generation });
    if (r.approx_year) t += ' · ' + I18n.dt(r.approx_year);
    if (r.branch) t += ' · ' + BRANCH_SHORT[r.branch];
    return t;
  }

  function sourceText(vols, pages) {
    vols = vols || [];
    pages = pages || [];
    if (!vols.length) return '';
    return vols
      .map((v, i) => {
        const p = pages[i];
        const n = String(parseInt(v.replace('vol', ''), 10));
        return p != null ? T('src_ref', { v: n, p }) : T('src_vol', { v: n });
      })
      .join(', ');
  }

  function spouseList(sp) {
    return (sp || [])
      .map((s) => {
        if (typeof s === 'string') return esc(s);
        const name = [s.cantonese, s.hanzi ? `<span class="zh">${esc(s.hanzi)}</span>` : '', s.pinyin ? '(' + esc(s.pinyin) + ')' : '']
          .filter(Boolean)
          .join(' ');
        return name + (s.note ? ' — ' + esc(s.note) : '');
      })
      .join('<br>');
  }

  // platser kopplade till personer (data/places_extended.json)
  let placesOf = null;
  function personPlaces(id) {
    if (!placesOf) {
      placesOf = {};
      const ext = (window.App && App.state.placesExt && App.state.placesExt.places) || [];
      ext.forEach((pl) =>
        pl.persons.forEach((l) => {
          (placesOf[l.id] = placesOf[l.id] || []).push({ place: pl, rel: l.rel, snippet: l.snippet, vol: l.vol, page: l.page });
        })
      );
    }
    return placesOf[id] || [];
  }

  function showPerson(id) {
    closeDrawer();
    document.querySelector('.tab-btn[data-view="tree"]').click();
    requestAnimationFrame(() => onReveal && onReveal(id, { openDrawer: true }));
  }
  function showPlace(id) {
    closeDrawer();
    document.querySelector('.tab-btn[data-view="map"]').click();
    setTimeout(() => window.dispatchEvent(new CustomEvent('focusplace', { detail: id })), 60);
  }

  // ------------------------------------------------------------------ drawer
  let onReveal = null; // sätts av tree.js
  function setRevealHandler(fn) {
    onReveal = fn;
  }

  function openDrawer(id, opts) {
    opts = opts || {};
    lastDrawer = { id, opts };
    const r = idx.byId[id];
    if (!r) return;
    const content = document.getElementById('drawer-content');
    let html = '';

    // brödsmulor
    const chain = ancestors(id);
    if (chain.length > 1) {
      const shown = chain.length > 8 ? [chain[0], null].concat(chain.slice(-6)) : chain;
      html += '<div class="cl-breadcrumb">' +
        shown
          .map((a, i) => {
            if (!a) return '<span class="cl-crumb-current">…</span>';
            const last = i === shown.length - 1;
            const name = a.kind === 'group' ? I18n.dt(a.pinyin) : a.hanzi || (a.confidence === 'gap' ? I18n.dt(a.western) : a.western) || a.pinyin;
            return last
              ? `<span class="cl-crumb-current">${esc(name)}</span>`
              : `<button class="cl-crumb" data-goto="${esc(a.id)}">${esc(name)}</button>`;
          })
          .join('<span class="cl-crumb-sep">›</span>') + '</div>';
    }

    if (r.kind === 'group') {
      html += `<span class="d-badge confidence-gap">${confLabel('gap')}</span>`;
      html += `<p class="d-pinyin">${esc(r.id === 'grp_unplaced' ? T('grp_unplaced_title') : I18n.dt(r.pinyin))}</p>`;
      html += `<p class="d-western">${esc(T('grp_people_in', { people: I18n.dt(r.western), n: r.fragments }))}</p>`;
      if (r.note) html += `<p class="d-note">${esc(I18n.dt(r.note))}</p>`;
    } else {
      const conf = r.confidence || 'documented';
      if (r.highlight) html += `<span class="d-badge highlight">${r.highlight === 'mamma' ? T('badge_mamma') : T('badge_you')}</span> `;
      html += `<span class="d-badge confidence-${esc(conf)}">${confLabel(conf)}</span> `;
      if (r.link && linkLabel(r.link)) html += `<span class="d-badge link-${esc(r.link)}">${linkLabel(r.link)}</span>`;
      if (r.hanzi) html += `<div class="d-hanzi zh">${esc(r.hanzi)}</div>`;
      const gapNode = r.confidence === 'gap' && !r.hanzi;
      if (r.western) {
        html += `<p class="d-pinyin">${esc(gapNode ? I18n.dt(r.western) : r.western)}${r.western_generated ? ` <span class="d-generated-tag">${T('generated_tag')}</span>` : ''}</p>`;
      }
      if (r.pinyin) html += `<p class="d-western">${esc(gapNode ? I18n.dt(r.pinyin) : r.pinyin + ' (Pinyin)')}</p>`;
      if (r.generation != null) {
        let g = T(r.generation_estimated ? 'gen_long_est' : 'gen_long', { g: r.generation });
        if (r.approx_year) g += ' · ' + I18n.dt(r.approx_year);
        html += `<p class="d-generation">${esc(g)}</p>`;
      } else if (r.approx_year) {
        html += `<p class="d-generation">${esc(I18n.dt(r.approx_year))}</p>`;
      }
      if (r.years) html += `<p class="d-years">${esc(I18n.dt(r.years))}</p>`;
      if (r.private) html += `<p class="d-note d-caveat">${T('private_note')}</p>`;

      const badges = [];
      if (r.branch) badges.push(`<span class="cl-badge">${branchLabel(r.branch)}</span>`);
      if (r.heir_status) badges.push(`<span class="cl-badge cl-badge-heir">${HEIR_KEYS[r.heir_status] ? T(HEIR_KEYS[r.heir_status]) : esc(r.heir_status)}</span>`);
      if (badges.length) html += `<div class="cl-badges">${badges.join('')}</div>`;

      if (r.generation_estimated) {
        html += `<p class="d-note d-caveat">${T('est_gen_note')}</p>`;
      } else if (r.gen_mismatch) {
        const n = Math.abs(r.gen_mismatch);
        const diff = T(r.gen_mismatch > 0 ? 'gen_too_few' : 'gen_too_many', { n });
        html += `<p class="d-note d-caveat">${esc(T('gen_mismatch', { g: r.generation, diff }))}</p>`;
      }
      if (r.book_hanzi) {
        html += `<div class="d-section-label">${T('sec_book_name')}</div><p class="d-note"><span class="zh">${esc(r.book_hanzi)}</span>${r.book_pinyin ? ' (' + esc(r.book_pinyin) + ')' : ''} ${T('same_person')}</p>`;
      }
      if (r.father_hanzi || r.father_pinyin) {
        html += `<div class="d-section-label">${T('sec_father')}</div><p class="d-note">${esc([r.father_cantonese, r.father_hanzi, r.father_pinyin ? '(' + r.father_pinyin + ')' : ''].filter(Boolean).join(' '))}</p>`;
      }
      if (r.birth_order_note) html += `<div class="d-section-label">${T('sec_birth_order')}</div><p class="d-note">${esc(r.birth_order_note)}</p>`;
      if (r.spouse) {
        const s = r.spouse;
        html += `<div class="d-section-label">${T('sec_married')}</div><p class="d-spouse">${[esc(s.western), s.hanzi ? `<span class="zh">${esc(s.hanzi)}</span>` : '', s.pinyin ? '(' + esc(s.pinyin) + ')' : '', s.years ? '(' + esc(I18n.dt(s.years)) + ')' : ''].filter(Boolean).join(' ')}</p>`;
      }
      if (r.spouse2) {
        const s = r.spouse2;
        html += `<div class="d-section-label">${T('sec_also_married')}</div><p class="d-spouse">${[esc(s.western), s.hanzi ? `<span class="zh">${esc(s.hanzi)}</span>` : '', s.pinyin ? '(' + esc(s.pinyin) + ')' : ''].filter(Boolean).join(' ')}</p>`;
      }
      if (r.spouses && r.spouses.length) {
        html += `<div class="d-section-label">${T('sec_spouses')}</div><p class="d-note">${spouseList(r.spouses)}</p>`;
      }
      if (r.note) html += `<div class="d-section-label">${T('sec_note')}</div><p class="d-note">${esc(I18n.dt(r.note))}</p>`;
      if (r.notes) html += `<div class="d-section-label">${T('sec_source_note')}</div><p class="d-note">${esc(r.notes)}</p>`;
      const src = sourceText(r.source_volumes, r.source_pages);
      if (src) html += `<div class="d-section-label">${T('sec_source')}</div><p class="d-note">七修北山楊氏族譜 (1857), ${esc(src)}</p>`;
      const pls = personPlaces(id);
      if (pls.length) {
        html += `<div class="d-section-label">${T('sec_places')}</div><div class="d-places">` +
          pls
            .map(
              (x) =>
                `<button class="d-place" data-place="${esc(x.place.id)}" title="${esc(x.snippet || '')}"><strong>${esc(I18n.dt(x.place.name).split(' – ')[0])}</strong> · ${esc(relLabel(x.rel))}</button>` +
                (x.snippet ? `<p class="d-note d-place-quote">”${esc(x.snippet)}” <span class="d-alias-reason">(${esc(sourceText([x.vol], [x.page]))})</span></p>` : '')
            )
            .join('') +
          '</div>';
      }
      if (r.link_note) {
        html += `<div class="d-section-label">${T('sec_link')}</div><p class="d-note">${esc(I18n.dt(r.link_note))}</p>`;
      }
      if (r.aliases && r.aliases.length) {
        html += `<div class="d-section-label">${T('sec_aliases')}</div>`;
        html += r.aliases
          .map(
            (a) =>
              `<p class="d-note"><strong class="zh">${esc(a.hanzi || '')}</strong> ${esc(a.pinyin || '')} · ${esc(sourceText(a.source_volumes, a.source_pages))}` +
              (a.notes ? `<br><em>${esc(a.notes)}</em>` : '') +
              (a.spouses && a.spouses.length ? `<br>${T('alias_spouses')} ${spouseList(a.spouses)}` : '') +
              `<br><span class="d-alias-reason">${esc(I18n.dt(a.reason || ''))}</span></p>`
          )
          .join('');
      }
    }

    // barn
    const kids = idx.kids[id] || [];
    if (kids.length) {
      html += `<div class="d-section-label">${r.kind === 'group' ? T('sec_contents') : T('sec_children')} (${I18n.num(kids.length)})</div><div class="cl-children">`;
      html += kids
        .slice(0, 200)
        .map((k) => {
          const c = idx.byId[k];
          const n = idx.size[k] - 1;
          return `<button class="cl-child-row" data-goto="${esc(k)}"><span class="cl-child-name">${esc(displayName(c))}</span>${n > 0 ? `<span class="cl-count">${T('descendants', { n })}</span>` : ''}</button>`;
        })
        .join('');
      if (kids.length > 200) html += `<p class="cl-note">${T('and_more', { n: kids.length - 200 })}</p>`;
      html += '</div>';
    } else if (isPerson(r)) {
      html += `<p class="cl-note">${T('no_children')}</p>`;
    }

    // åtgärder
    const actions = [];
    if (opts.from !== 'tree') actions.push(`<button class="d-action" data-act="reveal">${T('show_in_tree')}</button>`);
    const desc = idx.size[id] - 1;
    if (desc > 0 && opts.from === 'tree') {
      actions.push(
        desc <= 400
          ? `<button class="d-action" data-act="expand">${T('expand_desc', { n: desc })}</button>`
          : `<button class="d-action" data-act="expand">${T('expand_three')}</button>`
      );
    }
    if (actions.length) html += `<div class="d-actions">${actions.join('')}</div>`;
    // berättelser om personen (js/stories.js)
    if (window.Stories && isPerson(r)) html += Stories.drawerHtml(id);
    // bidrag från släkten + "Föreslå ändring" (js/contribute.js)
    if (window.Contribute && isPerson(r)) html += Contribute.drawerHtml(r);

    content.innerHTML = html;
    content.scrollTop = 0;
    document.getElementById('detail-drawer').scrollTop = 0;
    document.getElementById('detail-drawer').classList.add('is-open');
    document.getElementById('drawerScrim').classList.add('is-open');

    content.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.goto;
        if (opts.from === 'tree' && onReveal) onReveal(target, { openDrawer: true });
        else openDrawer(target, opts);
      });
    });
    content.querySelectorAll('[data-place]').forEach((btn) => btn.addEventListener('click', () => showPlace(btn.dataset.place)));
    content.querySelectorAll('[data-story]').forEach((btn) =>
      btn.addEventListener('click', () => {
        closeDrawer();
        Stories.show(btn.dataset.story);
      })
    );
    if (window.Contribute) Contribute.hydrate(content);
    content.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!onReveal) return;
        if (btn.dataset.act === 'reveal') {
          closeDrawer();
          document.querySelector('.tab-btn[data-view="tree"]').click();
          requestAnimationFrame(() => onReveal(id, { openDrawer: false }));
        } else if (btn.dataset.act === 'expand') {
          onReveal(id, { expandSubtree: desc <= 400 ? Infinity : 3 });
        }
      });
    });
  }

  // nytt språk: rita om panelen om den är öppen
  let lastDrawer = null;
  window.addEventListener('langchange', () => {
    if (lastDrawer && document.getElementById('detail-drawer').classList.contains('is-open')) {
      const keep = document.getElementById('detail-drawer').scrollTop;
      openDrawer(lastDrawer.id, lastDrawer.opts);
      document.getElementById('detail-drawer').scrollTop = keep;
    }
  });

  function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('is-open');
    document.getElementById('drawerScrim').classList.remove('is-open');
  }

  return {
    build,
    idx,
    search,
    ancestors,
    displayName,
    genText,
    openDrawer,
    closeDrawer,
    setRevealHandler,
    showPerson,
    showPlace,
    personPlaces,
    esc,
    fold,
    BRANCH_SHORT,
  };
})();
