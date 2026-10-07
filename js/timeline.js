// Tidslinjen: parallella spår (makthavare, krig, klanen, utvandring, familjen,
// generationer) längs en gemensam tidsaxel. Vyn går att dra åt alla håll och
// zooma i tid. Listläget visar samma händelser som kort i årsordning.
(function () {
  const MIN_YEAR = 940;
  const MAX_YEAR = 2040;
  const MIN_SPAN = 6; // år över hela bredden, mest inzoomat
  const MAX_SPAN = MAX_YEAR - MIN_YEAR;
  const AXIS_H = 34;
  const MINI_H = 30;
  const LANE_HEAD = 26;
  const ROW_H = 28;
  const LANE_PAD = 10;
  const BAR_H = 18;
  const GEN_H = 74;
  const LABEL_MAX = 250; // px, längre titlar kortas (hela titeln visas i kortet)
  const YEARS_PER_GEN = 28.75; // 1237 (generation 1) → ca. 1782 (generation 20), som i släktträdet
  const GEN_START = 1237;
  const NOW = new Date().getFullYear();

  const LANES = [
    { id: 'rulers', rows: 3 },
    { id: 'history' },
    { id: 'clan' },
    { id: 'migration' },
    { id: 'family' },
    { id: 'generations' },
  ];

  const S = {
    mode: 'chart',
    start: MIN_YEAR,
    span: MAX_SPAN,
    ty: 0,
    hidden: new Set(),
    selected: null,
    items: [],
    gens: [],
    contentH: 0,
    W: 0,
    H: 0,
    ready: false,
    touched: false,
  };

  const esc = (s) => (window.Unified ? Unified.esc(s) : String(s == null ? '' : s));
  const T = (k, v) => I18n.t(k, v);
  const D = (s) => I18n.dt(s);

  try {
    const saved = JSON.parse(localStorage.getItem('yeung-tl-hidden') || '[]');
    saved.forEach((x) => S.hidden.add(x));
    if (localStorage.getItem('yeung-tl-mode') === 'list') S.mode = 'list';
  } catch (e) {
    /* privat läge e.d. */
  }
  function remember() {
    try {
      localStorage.setItem('yeung-tl-hidden', JSON.stringify([...S.hidden]));
      localStorage.setItem('yeung-tl-mode', S.mode);
    } catch (e) {
      /* ingen lagring */
    }
  }

  // ------------------------------------------------------------------ text
  let ctx2d = null;
  function textW(s, size) {
    if (!ctx2d) ctx2d = document.createElement('canvas').getContext('2d');
    ctx2d.font = `${size || 13}px ${getComputedStyle(document.body).fontFamily}`;
    return ctx2d.measureText(s).width;
  }
  function fit(s, max, size) {
    if (textW(s, size) <= max) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (textW(s.slice(0, mid) + '…', size) <= max) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? s.slice(0, lo).trimEnd() + '…' : '';
  }
  const yearsLabel = (it) => {
    const end = it.ongoing ? T('tl_today') : it.end;
    return end != null && end !== it.year ? `${it.year}–${end}` : String(it.year);
  };

  // ------------------------------------------------------------------ data
  function prepare() {
    S.items = (App.state.timeline || []).map((it) => ({
      ...it,
      track: it.track || 'clan',
      endYear: it.ongoing ? NOW : it.end,
      from: it.draw_from || it.year,
    }));
    // berättelser med årtal (data/stories.json) läggs in i sina spår
    const st = App.state.stories || { themes: [], stories: [] };
    const themeTitle = {};
    st.themes.forEach((t) => (themeTitle[t.id] = t.title));
    st.stories
      .filter((x) => x.timeline && x.year != null)
      .forEach((x) =>
        S.items.push({
          id: 'story_' + x.id,
          story: x.id,
          track: x.timeline,
          year: x.year,
          end: x.end,
          endYear: x.end,
          from: x.year,
          approx: x.approx,
          era: themeTitle[x.theme] || '',
          title: x.title,
          text: x.text,
          persons: x.persons,
          place_id: x.place_id,
          sources: x.sources,
        })
      );
    // Generationer ur släktträdet (uppskattade år)
    const counts = {};
    (App.state.unified || []).forEach((r) => {
      const g = r.generation;
      if (typeof g === 'number' && g >= 1) counts[g] = (counts[g] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    S.gens = Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b)
      .map((g) => {
        const from = Math.round(GEN_START + (g - 1) * YEARS_PER_GEN);
        return { id: 'gen_' + g, g, n: counts[g], from, to: Math.round(from + YEARS_PER_GEN), rel: Math.sqrt(counts[g] / max) };
      });
  }

  // ------------------------------------------------------------------ skala
  const px = (y) => ((y - S.start) / S.span) * S.W;
  const yearAt = (x) => S.start + (x / S.W) * S.span;
  function clampView() {
    S.span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, S.span));
    const pad = S.span * 0.04;
    S.start = Math.max(MIN_YEAR - pad, Math.min(MAX_YEAR - S.span + pad, S.start));
    const viewH = S.H - AXIS_H - MINI_H;
    S.ty = Math.max(Math.min(0, viewH - S.contentH - 16), Math.min(0, S.ty));
  }
  function zoomAt(factor, x) {
    const anchor = yearAt(x);
    const ns = Math.max(MIN_SPAN, Math.min(MAX_SPAN, S.span / factor));
    S.start = anchor - (x / S.W) * ns;
    S.span = ns;
    schedule();
  }
  function zoomTo(a, b) {
    const pad = Math.max(3, (b - a) * 0.15);
    S.span = Math.max(MIN_SPAN, b - a + pad * 2);
    S.start = a - pad;
    schedule();
  }

  // ------------------------------------------------------------------ layout
  // Packar händelserna i rader så att etiketterna inte krockar. Beror bara på
  // zoomnivån (inte på panoreringen), så raderna ligger still när man drar i sidled.
  function layout() {
    const k = S.W / S.span;
    const lanes = [];
    let y = 0;
    LANES.forEach((lane) => {
      if (S.hidden.has(lane.id)) return;
      const L = { id: lane.id, y, items: [] };
      if (lane.id === 'generations') {
        L.h = LANE_HEAD + GEN_H;
      } else {
        const its = S.items.filter((i) => i.track === lane.id).sort((a, b) => a.from - b.from || (b.endYear || 0) - (a.endYear || 0));
        const rowsEnd = [];
        its.forEach((it) => {
          const title = lane.rows && it.row ? `${D(it.era)}: ${D(it.title)}` : D(it.title);
          const label = fit(title, LABEL_MAX);
          const lw = textW(label);
          const a = (it.from - MIN_YEAR) * k;
          const worldRight = (MAX_YEAR - MIN_YEAR) * k;
          let b;
          let left = a;
          const span = it.endYear != null && it.endYear > it.from;
          it._flip = false;
          if (span) {
            const w = (it.endYear - it.from) * k;
            it._inside = w >= lw + 16;
            b = it._inside ? a + w : a + w + 8 + lw;
            if (!it._inside && b > worldRight) {
              // nära slutet av tiden: etiketten till vänster om stapeln
              it._flip = true;
              left = a - 8 - lw;
              b = a + w;
            }
          } else {
            left = a - 7;
            b = a + 12 + lw;
            if (b > worldRight) {
              it._flip = true;
              left = a - 12 - lw;
              b = a + 7;
            }
          }
          if (lane.rows && span) {
            // makthavarna ligger i fasta rader: etiketten får plats inne i stapeln eller kortas
            const w = (it.endYear - it.from) * k;
            it._label = w >= 30 ? fit(title, w - 14) : '';
            it._inside = true;
            b = a + w;
          } else {
            it._label = label;
          }
          it._span = span;
          let row;
          if (lane.rows) {
            row = it.row || 0;
          } else {
            row = rowsEnd.findIndex((end) => end + 10 <= left);
            if (row < 0) row = rowsEnd.length;
          }
          rowsEnd[row] = Math.max(rowsEnd[row] || -Infinity, b);
          it._row = row;
          L.items.push(it);
        });
        const rows = lane.rows || Math.max(1, rowsEnd.length);
        L.rows = rows;
        L.h = LANE_HEAD + rows * ROW_H + LANE_PAD;
      }
      lanes.push(L);
      y += L.h;
    });
    S.lanes = lanes;
    S.contentH = y;
  }

  // ------------------------------------------------------------------ ritning
  function ticks() {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
    const per = S.W / S.span;
    const step = steps.find((s) => s * per >= 72) || 500;
    const out = [];
    for (let y = Math.ceil(S.start / step) * step; y <= S.start + S.span; y += step) out.push(y);
    return out;
  }

  let frame = 0;
  let dirtyLayout = true;
  let lastSpan = null;
  function schedule(relayout) {
    if (relayout) dirtyLayout = true;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw() {
    frame = 0;
    if (!S.ready || S.mode !== 'chart') return;
    const stage = document.getElementById('tl-stage');
    const svg = document.getElementById('tl-svg');
    S.W = stage.clientWidth;
    S.H = stage.clientHeight;
    if (!S.W || !S.H) return;
    if (dirtyLayout || lastSpan !== S.span || S.lastW !== S.W) {
      S.span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, S.span));
      layout();
      dirtyLayout = false;
      lastSpan = S.span;
      S.lastW = S.W;
    }
    clampView();
    const W = S.W;
    const H = S.H;
    const top = AXIS_H + S.ty;
    const vis = (a, b) => px(b) >= -40 && px(a) <= W + 40;
    let h = '';

    // dynastibakgrund över hela höjden
    h += `<g class="tl-bg">`;
    S.items
      .filter((i) => i.track === 'rulers' && (i.row || 0) === 0)
      .forEach((it, n) => {
        if (!vis(it.from, it.endYear)) return;
        const x1 = px(it.from);
        const x2 = px(it.endYear);
        h += `<rect class="tl-era-bg ${n % 2 ? 'odd' : 'even'}" x="${x1}" y="${AXIS_H}" width="${Math.max(0, x2 - x1)}" height="${H - AXIS_H - MINI_H}"/>`;
      });
    h += `</g>`;

    // rutnät
    const tk = ticks();
    h += `<g class="tl-grid">${tk.map((y) => `<line x1="${px(y)}" x2="${px(y)}" y1="${AXIS_H}" y2="${H - MINI_H}"/>`).join('')}</g>`;

    // spåren
    h += `<g class="tl-content" transform="translate(0,${top})">`;
    S.lanes.forEach((L, li) => {
      h += `<g class="tl-lane lane-${L.id}" transform="translate(0,${L.y})">`;
      h += `<rect class="tl-lane-bg ${li % 2 ? 'odd' : 'even'}" x="0" y="0" width="${W}" height="${L.h}"/>`;
      h += `<line class="tl-lane-sep" x1="0" x2="${W}" y1="${L.h}" y2="${L.h}"/>`;
      if (L.id === 'generations') {
        const base = LANE_HEAD + GEN_H - 12;
        S.gens.forEach((g) => {
          if (!vis(g.from, g.to)) return;
          const x1 = px(g.from) + 1;
          const w = Math.max(1, px(g.to) - px(g.from) - 2);
          const bh = 6 + (GEN_H - 30) * g.rel;
          const sel = S.selected === g.id ? ' is-selected' : '';
          h += `<g class="tl-ev tl-gen${sel}" data-id="${g.id}"><rect x="${x1}" y="${base - bh}" width="${w}" height="${bh}" rx="2"/>`;
          if (w >= 22) h += `<text x="${x1 + w / 2}" y="${base + 11}" text-anchor="middle">${g.g}</text>`;
          h += `</g>`;
        });
      } else {
        L.items.forEach((it) => {
          const yRow = LANE_HEAD + it._row * ROW_H + ROW_H / 2;
          const sel = S.selected === it.id ? ' is-selected' : '';
          const x1 = px(it.from);
          if (it._span) {
            const x2 = px(it.endYear);
            const extra = it._inside ? 0 : 8 + textW(it._label);
            if (x2 + (it._flip ? 0 : extra) < -40 || x1 - (it._flip ? extra : 0) > W + 40) return;
            const alt = L.id === 'rulers' ? ` alt${(S.items.filter((o) => o.track === 'rulers' && (o.row || 0) === (it.row || 0) && o.from < it.from).length) % 2}` : '';
            h += `<g class="tl-ev tl-span${alt}${sel}${it.approx ? ' is-approx' : ''}" data-id="${esc(it.id)}">`;
            h += `<rect x="${x1}" y="${yRow - BAR_H / 2}" width="${Math.max(2, x2 - x1)}" height="${BAR_H}" rx="4"/>`;
            if (it.ongoing) h += `<path class="tl-ongoing" d="M${x2} ${yRow - BAR_H / 2} l7 ${BAR_H / 2} l-7 ${BAR_H / 2}z"/>`;
            if (it._inside) {
              // etiketten följer med in i bild när stapeln börjar till vänster om kanten
              const lx = Math.min(Math.max(x1, 4) + 7, x2 - 7 - textW(it._label));
              h += `<text class="tl-label in" x="${Math.max(x1 + 7, lx)}" y="${yRow + 4.5}">${esc(it._label)}</text>`;
            } else if (it._flip) {
              h += `<text class="tl-label" x="${x1 - 7}" y="${yRow + 4.5}" text-anchor="end">${esc(it._label)}</text>`;
            } else {
              h += `<text class="tl-label" x="${x2 + (it.ongoing ? 14 : 7)}" y="${yRow + 4.5}">${esc(it._label)}</text>`;
            }
            h += `</g>`;
          } else {
            const lw = textW(it._label);
            const hx = it._flip ? x1 - 12 - lw : x1 - 8;
            if (hx + lw + 20 < -20 || hx > W + 20) return;
            h += `<g class="tl-ev tl-point${sel}${it.approx ? ' is-approx' : ''}" data-id="${esc(it.id)}">`;
            h += `<rect class="tl-hit" x="${hx}" y="${yRow - 12}" width="${20 + lw}" height="24" rx="6"/>`;
            h += `<circle cx="${x1}" cy="${yRow}" r="5.5"/>`;
            h += it._flip
              ? `<text class="tl-label" x="${x1 - 11}" y="${yRow + 4.5}" text-anchor="end">${esc(it._label)}</text>`
              : `<text class="tl-label" x="${x1 + 11}" y="${yRow + 4.5}">${esc(it._label)}</text>`;
            h += `</g>`;
          }
        });
      }
      h += `</g>`;
    });
    h += `</g>`;

    // spårens rubriker – ligger kvar vid vänsterkanten
    h += `<g class="tl-heads" transform="translate(0,${top})">`;
    S.lanes.forEach((L) => {
      const label = T('tl_lane_' + L.id);
      const w = textW(label, 12) + 22;
      h += `<g class="tl-head lane-${L.id}" transform="translate(8,${L.y + 5})"><rect width="${w}" height="18" rx="9"/><circle cx="10" cy="9" r="3.5"/><text x="18" y="13">${esc(label)}</text></g>`;
    });
    h += `</g>`;

    // idag
    if (vis(NOW, NOW))
      h += `<g class="tl-now"><line x1="${px(NOW)}" x2="${px(NOW)}" y1="${AXIS_H}" y2="${H - MINI_H}"/><text class="tl-now-label" x="${px(NOW) - 5}" y="${H - MINI_H - 7}" text-anchor="end">${esc(T('tl_today'))} ${NOW}</text></g>`;

    // tidsaxeln (fast upptill)
    h += `<g class="tl-axis"><rect x="0" y="0" width="${W}" height="${AXIS_H}"/>`;
    h += tk.map((y) => `<line x1="${px(y)}" x2="${px(y)}" y1="${AXIS_H - 7}" y2="${AXIS_H}"/><text x="${px(y)}" y="${AXIS_H - 12}" text-anchor="middle">${y}</text>`).join('');
    h += `<line class="tl-axis-line" x1="0" x2="${W}" y1="${AXIS_H}" y2="${AXIS_H}"/></g>`;

    // översiktsremsa (fast nedtill)
    const mk = (y) => ((y - MIN_YEAR) / MAX_SPAN) * W;
    const my = H - MINI_H;
    h += `<g class="tl-mini" transform="translate(0,${my})"><rect class="tl-mini-bg" x="0" y="0" width="${W}" height="${MINI_H}"/>`;
    S.items
      .filter((i) => i.track === 'rulers' && (i.row || 0) === 0)
      .forEach((it, n) => {
        h += `<rect class="tl-mini-era ${n % 2 ? 'odd' : 'even'}" x="${mk(it.from)}" y="8" width="${Math.max(1, mk(it.endYear) - mk(it.from))}" height="${MINI_H - 16}"/>`;
      });
    S.items.forEach((it) => {
      if (it.track === 'rulers' || S.hidden.has(it.track)) return;
      h += `<line class="tl-mini-tick lane-${it.track}" x1="${mk(it.year)}" x2="${mk(it.year)}" y1="6" y2="${MINI_H - 6}"/>`;
    });
    [1000, 1200, 1400, 1600, 1800, 2000].forEach((y) => (h += `<text class="tl-mini-year" x="${mk(y) + 3}" y="${MINI_H - 4}">${y}</text>`));
    const wx1 = Math.max(0, mk(S.start));
    const wx2 = Math.min(W, mk(S.start + S.span));
    h += `<rect class="tl-mini-win" x="${wx1}" y="2" width="${Math.max(6, wx2 - wx1)}" height="${MINI_H - 4}" rx="4"/></g>`;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = h;
  }

  // ------------------------------------------------------------------ kortet
  function findItem(id) {
    if (id && id.startsWith('gen_')) return S.gens.find((g) => g.id === id);
    return S.items.find((i) => i.id === id);
  }
  function openCard(id) {
    const card = document.getElementById('tl-card');
    const it = findItem(id);
    if (!it) return closeCard();
    S.selected = id;
    let html = `<button class="tl-card-close" type="button" aria-label="${esc(T('tl_close'))}" title="${esc(T('tl_close'))}">×</button>`;
    if (it.g) {
      html += `<div class="tl-card-lane lane-generations">${esc(T('tl_lane_generations'))}</div>`;
      html += `<div class="timeline-year">${esc(T('tl_gen_years', { from: String(it.from), to: String(it.to) }))}<span class="approx-tag">${esc(T('approx'))}</span></div>`;
      html += `<h3>${esc(T('tl_gen_title', { g: String(it.g) }))}</h3>`;
      html += `<p>${esc(T('tl_gen_text', { n: it.n, g: String(it.g) }))}</p>`;
      if (it.g >= 21) html += `<p class="tl-card-note">${esc(T('tl_gen_note'))}</p>`;
      html += `<div class="tl-card-actions"><button type="button" class="tl-zoomto">${esc(T('tl_zoom_to'))}</button></div>`;
      card.dataset.from = it.from;
      card.dataset.to = it.to;
    } else {
      const place = it.place_id && App.state.placesById[it.place_id];
      html += `<div class="tl-card-lane lane-${esc(it.track)}">${esc(T('tl_lane_' + it.track))} · ${esc(D(it.era))}</div>`;
      html += `<div class="timeline-year">${esc(yearsLabel(it))}${it.approx ? `<span class="approx-tag">${esc(T('approx'))}</span>` : ''}</div>`;
      html += `<h3>${esc(D(it.title))}</h3>`;
      html += `<p>${esc(D(it.text))}</p>`;
      const people = (it.persons || [])
        .map((pid) => {
          const r = window.Unified && Unified.idx.byId[pid];
          return r ? `<button class="timeline-person-link" data-person="${esc(pid)}">${esc(Unified.displayName(r))}</button>` : '';
        })
        .join('');
      if (people) html += `<div class="timeline-people"><span class="timeline-people-label">${esc(T('tl_in_tree'))}</span>${people}</div>`;
      if (it.general) html += `<p class="tl-card-note">${esc(T('tl_general'))}</p>`;
      if (it.sources) html += `<p class="tl-card-note">${esc(T('st_source', { refs: it.sources.map((x) => T('st_vol', { vol: String(x.vol), pages: String(x.pages) })).join('; ') }))}</p>`;
      if (/†/.test(D(it.text) + D(it.title))) html += `<p class="tl-card-note">${esc(T('tl_namenote'))}</p>`;
      html += `<div class="tl-card-actions"><button type="button" class="tl-zoomto">${esc(T('tl_zoom_to'))}</button>`;
      if (it.story) html += `<button type="button" class="tl-zoomto tl-story-link" data-story="${esc(it.story)}">📖 ${esc(T('st_read'))}</button>`;
      if (place) html += `<button class="timeline-place-link" data-place="${esc(it.place_id)}">📍 ${esc(D(place.name).split(' – ')[0])} — ${esc(T('tl_on_map'))}</button>`;
      html += `</div>`;
      card.dataset.from = it.from;
      card.dataset.to = it.endYear != null ? it.endYear : it.year;
    }
    card.innerHTML = html;
    card.hidden = false;
    card.querySelector('.tl-card-close').addEventListener('click', closeCard);
    card.querySelector('.tl-zoomto').addEventListener('click', () => {
      const a = Number(card.dataset.from);
      const b = Number(card.dataset.to);
      if (b - a < 10) zoomTo(a - 25, b + 25);
      else zoomTo(a, b);
      revealSelected();
    });
    card.querySelectorAll('[data-person]').forEach((b) => b.addEventListener('click', () => Unified.showPerson(b.dataset.person)));
    card.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => Unified.showPlace(b.dataset.place)));
    card.querySelectorAll('[data-story]').forEach((b) => b.addEventListener('click', () => Stories.show(b.dataset.story)));
    schedule();
  }
  function closeCard() {
    S.selected = null;
    const card = document.getElementById('tl-card');
    card.hidden = true;
    card.innerHTML = '';
    schedule();
  }
  // Flytta vyn i höjdled så att den valda händelsen syns.
  function revealSelected() {
    requestAnimationFrame(() => {
      draw();
      const it = findItem(S.selected);
      if (!it) return;
      const L = S.lanes.find((l) => l.id === (it.g ? 'generations' : it.track));
      if (!L) return;
      const y = L.y + (it.g ? LANE_HEAD : LANE_HEAD + it._row * ROW_H);
      const viewH = S.H - AXIS_H - MINI_H;
      if (y + S.ty < 0 || y + S.ty > viewH - 40) S.ty = -(y - 40);
      schedule();
    });
  }

  // ------------------------------------------------------------------ interaktion
  function initInteraction() {
    const stage = document.getElementById('tl-stage');
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let miniDrag = false;

    const local = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const inMini = (p) => p.y >= S.H - MINI_H;
    const centerMini = (p) => {
      const y = MIN_YEAR + (p.x / S.W) * MAX_SPAN;
      S.start = y - S.span / 2;
      schedule();
    };
    const hideHint = () => {
      if (S.touched) return;
      S.touched = true;
      document.getElementById('tl-hint').classList.add('is-gone');
    };

    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tl-card')) return;
      if (e.button !== undefined && e.button !== 0) return;
      const p = local(e);
      hideHint();
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1 && inMini(p)) {
        miniDrag = true;
        centerMini(p);
        return;
      }
      if (pointers.size === 1) {
        drag = { x: p.x, y: p.y, start: S.start, ty: S.ty, moved: 0, target: e.target };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.abs(a.x - b.x) || 1, mid: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, span: S.span, start: S.start, ty: S.ty };
        drag = null;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (miniDrag) return centerMini(p);
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.max(10, Math.abs(a.x - b.x));
        const mid = (a.x + b.x) / 2;
        const anchorYear = pinch.start + (pinch.mid / S.W) * pinch.span;
        S.span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, pinch.span * (pinch.d / d)));
        S.start = anchorYear - (mid / S.W) * S.span;
        S.ty = pinch.ty + ((a.y + b.y) / 2 - pinch.midY);
        schedule();
        return;
      }
      if (drag) {
        const dx = p.x - drag.x;
        const dy = p.y - drag.y;
        drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
        if (drag.moved > 3) stage.classList.add('is-dragging');
        S.start = drag.start - (dx / S.W) * S.span;
        S.ty = drag.ty + dy;
        schedule();
      }
    });
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      stage.classList.remove('is-dragging');
      if (miniDrag) {
        miniDrag = false;
        return;
      }
      if (drag && drag.moved <= 4 && e.type === 'pointerup') {
        const ev = drag.target.closest && drag.target.closest('.tl-ev');
        if (ev) openCard(ev.dataset.id);
        else if (S.selected) closeCard();
      }
      drag = null;
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        const p = [...pointers.values()][0];
        drag = { x: p.x, y: p.y, start: S.start, ty: S.ty, moved: 99, target: stage };
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    stage.addEventListener(
      'wheel',
      (e) => {
        if (e.target.closest('.tl-card')) return;
        e.preventDefault();
        hideHint();
        const p = local(e);
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? S.H : 1;
        const dx = e.deltaX * unit;
        const dy = e.deltaY * unit;
        if (e.ctrlKey || e.metaKey) {
          zoomAt(Math.exp(-dy * 0.01), p.x); // nyp på styrplatta
        } else if (e.shiftKey) {
          S.ty -= dy || dx;
          schedule();
        } else if (Math.abs(dx) > Math.abs(dy)) {
          S.start += (dx / S.W) * S.span;
          schedule();
        } else {
          zoomAt(Math.exp(-dy * 0.0022), p.x);
        }
      },
      { passive: false }
    );

    stage.addEventListener('dblclick', (e) => {
      if (e.target.closest('.tl-card') || e.target.closest('.tl-ev')) return;
      zoomAt(2, local(e).x);
    });

    stage.addEventListener('keydown', (e) => {
      if (e.target.closest('.tl-card')) return;
      const step = S.span * 0.1;
      const k = e.key;
      if (k === 'ArrowLeft') S.start -= step;
      else if (k === 'ArrowRight') S.start += step;
      else if (k === 'ArrowUp') S.ty += 60;
      else if (k === 'ArrowDown') S.ty -= 60;
      else if (k === '+' || k === '=') return zoomAt(1.5, S.W / 2), e.preventDefault();
      else if (k === '-' || k === '_') return zoomAt(1 / 1.5, S.W / 2), e.preventDefault();
      else if (k === '0') return resetView(), e.preventDefault();
      else if (k === 'Escape') return closeCard();
      else return;
      e.preventDefault();
      schedule();
    });

    document.getElementById('tlZoomIn').addEventListener('click', () => zoomAt(1.6, S.W / 2));
    document.getElementById('tlZoomOut').addEventListener('click', () => zoomAt(1 / 1.6, S.W / 2));
    document.getElementById('tlReset').addEventListener('click', resetView);
    document.querySelectorAll('[data-tl-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.tlMode)));
    window.addEventListener('resize', () => schedule(true));
    window.addEventListener('viewchange', (e) => e.detail === 'timeline' && schedule(true));
    window.addEventListener('themechange', () => schedule());
  }

  function resetView() {
    S.start = MIN_YEAR;
    S.span = MAX_SPAN;
    S.ty = 0;
    schedule();
  }

  // ------------------------------------------------------------------ spårväljare och läge
  function renderLaneToggles() {
    const box = document.getElementById('tl-lane-toggles');
    box.innerHTML = LANES.map(
      (l) =>
        `<button type="button" class="tl-lane-toggle lane-${l.id}${S.hidden.has(l.id) ? '' : ' is-on'}" data-lane="${l.id}" aria-pressed="${S.hidden.has(l.id) ? 'false' : 'true'}"><span class="dot"></span>${esc(T('tl_lane_' + l.id))}</button>`
    ).join('');
    box.querySelectorAll('[data-lane]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.lane;
        if (S.hidden.has(id)) S.hidden.delete(id);
        else if (S.hidden.size < LANES.length - 1) S.hidden.add(id);
        remember();
        renderLaneToggles();
        schedule(true);
      })
    );
  }

  function setMode(mode) {
    S.mode = mode;
    remember();
    document.querySelectorAll('[data-tl-mode]').forEach((b) => {
      const on = b.dataset.tlMode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.getElementById('tl-stage').hidden = mode !== 'chart';
    document.getElementById('tl-list').hidden = mode !== 'list';
    document.querySelectorAll('[data-tl-chart-only]').forEach((el) => (el.hidden = mode !== 'chart'));
    if (mode === 'chart') schedule(true);
  }

  // ------------------------------------------------------------------ listläget
  function renderList() {
    const track = document.getElementById('timeline-track');
    const items = [...S.items].sort((a, b) => a.year - b.year || (a.track === 'rulers' ? -1 : 1));
    track.innerHTML = items
      .map((item) => {
        const place = App.state.placesById[item.place_id];
        const placeBtn = place
          ? `<button class="timeline-place-link" data-place="${esc(item.place_id)}">📍 ${esc(D(place.name).split(' – ')[0])} — ${esc(T('tl_on_map'))}</button>`
          : '';
        const people = (item.persons || [])
          .map((id) => {
            const r = window.Unified && Unified.idx.byId[id];
            return r ? `<button class="timeline-person-link" data-person="${esc(id)}">${esc(Unified.displayName(r))}</button>` : '';
          })
          .join('');
        const peopleHtml = people ? `<div class="timeline-people"><span class="timeline-people-label">${esc(T('tl_in_tree'))}</span>${people}</div>` : '';
        return `
        <div class="timeline-item lane-${esc(item.track)}">
          <div class="timeline-card">
            <div class="timeline-era"><span class="tl-list-lane">${esc(T('tl_lane_' + item.track))}</span> · ${esc(D(item.era))}</div>
            <div class="timeline-year">${esc(yearsLabel(item))}${item.approx ? `<span class="approx-tag">${esc(T('approx'))}</span>` : ''}</div>
            <h3>${esc(D(item.title))}</h3>
            <p>${esc(D(item.text))}</p>
            ${peopleHtml}
            ${item.general ? `<p class="tl-card-note">${esc(T('tl_general'))}</p>` : ''}
            ${placeBtn}
          </div>
        </div>`;
      })
      .join('');
    track.querySelectorAll('.timeline-place-link').forEach((btn) => btn.addEventListener('click', () => Unified.showPlace(btn.dataset.place)));
    track.querySelectorAll('.timeline-person-link').forEach((btn) => btn.addEventListener('click', () => Unified.showPerson(btn.dataset.person)));
  }

  function renderHint() {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    document.getElementById('tl-hint').textContent = T(touch ? 'tl_hint_touch' : 'tl_hint');
  }

  // ------------------------------------------------------------------ start
  let inited = false;
  function render() {
    if (window.Unified && App.state.unified) Unified.build(App.state.unified);
    prepare();
    S.ready = true;
    if (!inited) {
      inited = true;
      initInteraction();
    }
    renderLaneToggles();
    renderList();
    renderHint();
    setMode(S.mode);
    if (S.selected) openCard(S.selected);
    schedule(true);
  }

  // Zooma till en händelse och öppna dess kort (t.ex. från Berättelser).
  function focus(id) {
    if (S.mode !== 'chart') setMode('chart');
    const it = findItem(id);
    if (!it) return;
    S.hidden.delete(it.track);
    renderLaneToggles();
    const a = it.from;
    const b = it.endYear != null ? it.endYear : it.year;
    if (b - a < 10) zoomTo(a - 25, b + 25);
    else zoomTo(a, b);
    dirtyLayout = true;
    openCard(id);
    revealSelected();
  }

  window.Timeline = { zoomTo, openCard, focus, state: S };
  window.addEventListener('dataready', render);
  window.addEventListener('langchange', () => App.state.timeline.length && render());
})();
