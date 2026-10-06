// D3 släktträd för HELA klanen (data/unified.json, ~5 600 personer efter
// deduplicering av 6 537 bokposter + familjens 68).
//
// Prestanda: hela datat indexeras en gång (js/unified.js), men bara den
// SYNLIGA delen av trädet byggs som d3.hierarchy och renderas i SVG vid varje
// ändring. En nod har barn i hierarkin endast om den är utfälld; breda
// syskonskaror visas i sidor om PAGE st med en "+N till"-nod. På så vis ligger
// normalt bara några hundra noder i DOM, oavsett datamängd.
(function () {
  const NODE_W = 176;
  const NODE_H = 72;
  const DX = 210; // vertikalt avstånd mellan generationer
  const DY = 196; // horisontellt avstånd mellan syskon
  const PAGE = 12; // max antal syskon som visas innan "+N till"
  const MORE_W = 120;
  const MORE_H = 34;

  let svg, gZoom, gTree, zoomBehavior, treeLayout, hroot;
  let built = false;
  let U; // Unified.idx

  const expanded = new Set();
  const shown = new Map(); // id -> antal barn som visas
  const forced = new Map(); // id -> Set(barn som måste visas, t.ex. sökträff)
  let foundId = null;

  // ------------------------------------------------------------ hjälpare
  function rec(id) {
    return U.byId[id];
  }
  function kidsOf(id) {
    return U.kids[id] || [];
  }

  function confidenceClass(r) {
    return 'confidence-' + (r.confidence || 'documented');
  }
  function highlightClass(r) {
    return r.highlight ? 'highlight-' + r.highlight : '';
  }
  function nodeClass(r) {
    return ['node-box', confidenceClass(r), highlightClass(r), r.kind === 'group' ? 'is-group' : '', r.id === foundId ? 'is-found' : '']
      .filter(Boolean)
      .join(' ');
  }

  function nodeLabelLines(r) {
    const lines = [];
    if (r.kind === 'group') {
      lines.push({ text: I18n.dt(r.pinyin), cls: 'n-pinyin' });
      lines.push({ text: I18n.dt(r.western), cls: 'n-western' });
      lines.push({ text: I18n.t('loose_branches', { n: r.fragments }), cls: 'n-gen' });
      return lines;
    }
    const gapNode = r.confidence === 'gap' && !r.hanzi; // "10 generationer" o.d.
    if (r.western) {
      const mark = r.western_generated ? ' †' : '';
      lines.push({ text: (gapNode ? I18n.dt(r.western) : r.western) + mark, cls: 'n-pinyin' });
    }
    if (r.hanzi) lines.push({ text: r.hanzi, cls: 'n-hanzi' });
    if (r.pinyin) lines.push({ text: gapNode ? I18n.dt(r.pinyin) : r.pinyin, cls: 'n-western' });
    const g = Unified.genText(r);
    if (g) lines.push({ text: g, cls: 'n-gen' });
    if (r.spouse) {
      const s = r.spouse;
      lines.push({ text: I18n.t('spouse_prefix') + [s.western, s.hanzi, s.pinyin].filter(Boolean).join(' '), cls: 'n-western' });
    }
    return lines.slice(0, 5);
  }

  // ungefärlig textbredd i px (kinesiska tecken är ungefär dubbelt så breda)
  function textWidth(s, w) {
    let n = 0;
    for (const ch of s) n += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? w * 1.85 : w;
    return n;
  }

  function elbow(s, t) {
    const sh = s.data.more ? MORE_H : NODE_H;
    const th = t.data.more ? MORE_H : NODE_H;
    const midY = (s.y + t.y) / 2;
    return `M${s.x},${s.y + sh / 2} V${midY} H${t.x} V${t.y - th / 2}`;
  }

  function linkClass(d) {
    if (d.target.data.more) return 'tree-link link-more';
    const r = rec(d.target.data.id);
    return 'tree-link' + (r && r.link && r.link !== 'source' && r.link !== 'family' ? ' link-' + r.link : '');
  }

  // --------------------------------------------------- synlig projektion
  function visibleTree(id) {
    const node = { id };
    const all = kidsOf(id);
    if (!expanded.has(id) || !all.length) return node;
    const n = shown.get(id) || (rec(all[0]).kind === 'group' ? all.length : PAGE);
    const f = forced.get(id);
    const list = all.filter((k, i) => i < n || (f && f.has(k)));
    node.children = list.map(visibleTree);
    const rest = all.length - list.length;
    if (rest > 0) node.children.push({ id: id + '::more', more: rest, parent: id });
    return node;
  }

  function expandSubtree(id, depth) {
    const st = [[id, 0]];
    let count = 0;
    while (st.length) {
      const [x, d] = st.pop();
      const ks = kidsOf(x);
      if (!ks.length || d >= depth) continue;
      expanded.add(x);
      shown.set(x, Math.max(shown.get(x) || PAGE, depth === Infinity ? ks.length : PAGE));
      ks.forEach((k) => st.push([k, d + 1]));
      count += ks.length;
    }
    return count;
  }

  // maxGen: fäll bara ut familjens personer i generationer FÖRE maxGen
  // (t.ex. mammas generation: hon och hennes syskon syns, men hopfällda).
  function initialExpansion(maxGen) {
    expanded.clear();
    shown.clear();
    forced.clear();
    // familjens gren (som tidigare) + alla dess förfäder; klanens övriga
    // grenar ligger hopfällda med "+N"-knappar
    U.list.forEach((r) => {
      const genOk = maxGen == null || (r.family_generation != null && r.family_generation < maxGen);
      if (r.family_id && kidsOf(r.id).length && genOk) {
        Unified.ancestors(r.id).forEach((a) => expanded.add(a.id));
      }
    });
    // familjens barn ska synas även om syskonskaran är stor
    U.list.forEach((r) => {
      if (r.family_id && r.parent_id) {
        const idx = kidsOf(r.parent_id).indexOf(r.id);
        if (idx >= PAGE) {
          if (!forced.has(r.parent_id)) forced.set(r.parent_id, new Set());
          forced.get(r.parent_id).add(r.id);
        }
      }
    });
  }

  function toggle(id) {
    if (expanded.has(id)) {
      expanded.delete(id);
      shown.delete(id);
    } else {
      expanded.add(id);
    }
    foundId = id;
    render();
    if (expanded.has(id)) requestAnimationFrame(() => keepInView(id));
  }

  function showInfo(id) {
    foundId = id;
    gTree.selectAll('g.node-box').attr('class', (n) => nodeClass(rec(n.data.id)));
    Unified.openDrawer(id, { from: 'tree' });
  }

  // Efter utfällning: flytta vyn så att noden och dess nya barn syns, om de hamnat utanför.
  function keepInView(id) {
    const n = currentNode(id);
    if (!n || !n.children) return;
    const t = d3.zoomTransform(svg.node());
    const stage = document.querySelector('.tree-stage');
    const xs = n.children.map((c) => c.x);
    const left = t.applyX(Math.min(...xs) - NODE_W / 2);
    const right = t.applyX(Math.max(...xs) + NODE_W / 2);
    const top = t.applyY(n.y - NODE_H / 2);
    const bottom = t.applyY(n.children[0].y + NODE_H / 2);
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (left >= 0 && right <= W && top >= 0 && bottom <= H) return;
    let dx = 0;
    let dy = 0;
    if (right - left <= W) {
      if (left < 0) dx = -left + 20;
      else if (right > W) dx = W - right - 20;
    } else {
      dx = W / 2 - t.applyX(n.x);
    }
    if (bottom > H) dy = H - bottom - 30;
    if (top + dy < 0) dy = -top + 20;
    svg.transition().duration(400).call(zoomBehavior.translateBy, dx / t.k, dy / t.k);
  }

  // ------------------------------------------------------------ render
  function render(opts) {
    opts = opts || {};
    hroot = d3.hierarchy(visibleTree(U.rootId), (d) => d.children);
    treeLayout(hroot);
    const nodes = hroot.descendants();
    const links = hroot.links();
    const animate = nodes.length < 700 && !opts.instant;

    const linkSel = gTree.select('.links').selectAll('path.tree-link').data(links, (d) => d.target.data.id);
    linkSel.join(
      (enter) => enter.append('path').attr('class', linkClass).attr('d', (d) => elbow(d.source, d.target)),
      (update) => {
        (animate ? update.transition().duration(250) : update).attr('d', (d) => elbow(d.source, d.target));
        return update.attr('class', linkClass);
      },
      (exit) => exit.remove()
    );

    // --- personer/grupper
    const personNodes = nodes.filter((d) => !d.data.more);
    const nodeSel = gTree.select('.nodes').selectAll('g.node-box').data(personNodes, (d) => d.data.id);
    nodeSel.exit().remove();

    const nodeEnter = nodeSel
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x - NODE_W / 2},${d.y - NODE_H / 2})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        // Klick på personen: fäll ut/ihop om den har barn, annars visa detaljer
        if (kidsOf(d.data.id).length) toggle(d.data.id);
        else showInfo(d.data.id);
      });
    nodeEnter.append('title').text((d) => Unified.displayName(rec(d.data.id)));
    nodeEnter.append('rect').attr('width', NODE_W).attr('height', NODE_H);
    nodeEnter.each(function (d) {
      const g = d3.select(this);
      const lines = nodeLabelLines(rec(d.data.id));
      const startY = NODE_H / 2 - ((lines.length - 1) * 12) / 2 + 4;
      lines.forEach((line, i) => {
        g.append('text')
          .attr('class', line.cls)
          .attr('x', NODE_W / 2)
          .attr('y', startY + i * 13)
          .attr('text-anchor', 'middle')
          .text(line.text.length > 24 ? line.text.slice(0, 23) + '…' : line.text);
      });
    });

    const nodeMerge = nodeEnter.merge(nodeSel);
    (animate ? nodeMerge.transition().duration(250) : nodeMerge).attr(
      'transform',
      (d) => `translate(${d.x - NODE_W / 2},${d.y - NODE_H / 2})`
    );
    nodeMerge.attr('class', (d) => nodeClass(rec(d.data.id)));

    // Knappar på noden:
    //  ⓘ (övre högra hörnet)      – detaljer i informationspanelen
    //  "▾ 3 barn" / "▴ Fäll ihop" – under noden, samma som att klicka på personen
    //  "Hela grenen (N)"          – fäller ut alla ättlingar (max 400, annars 3 generationer)
    nodeMerge.each(function (d) {
      const g = d3.select(this);
      g.selectAll('.n-controls').remove();
      const id = d.data.id;
      const ks = kidsOf(id);
      const ctl = g.append('g').attr('class', 'n-controls');

      const info = ctl.append('g').attr('class', 'n-info').attr('transform', `translate(${NODE_W - 1},1)`);
      info.append('circle').attr('r', 7.5);
      info.append('text').attr('text-anchor', 'middle').attr('dy', 4).text('i');
      info.append('title').text(I18n.t('info_title'));
      info.on('click', (event) => {
        event.stopPropagation();
        showInfo(id);
      });

      if (!ks.length) return;
      const isOpen = expanded.has(id);
      const desc = U.size[id] - 1;
      const showAll = !isOpen && desc > ks.length;
      const mainLabel = isOpen ? I18n.t('collapse') : I18n.t('children_pill', { n: ks.length });
      const mainW = Math.max(58, textWidth(mainLabel, 6.4) + 16);
      const allLabel = I18n.t('whole_branch', { n: desc });
      const allW = textWidth(allLabel, 6) + 16;
      const total = mainW + (showAll ? allW + 6 : 0);
      let x = NODE_W / 2 - total / 2;

      const main = ctl.append('g').attr('class', 'n-pill n-pill-main' + (isOpen ? ' is-open' : '')).attr('transform', `translate(${x},${NODE_H - 3})`);
      main.append('rect').attr('width', mainW).attr('height', 20).attr('rx', 10);
      main.append('text').attr('x', mainW / 2).attr('y', 14).attr('text-anchor', 'middle').text(mainLabel);
      main.append('title').text(isOpen ? I18n.t('collapse_title') : I18n.t('children_title', { k: ks.length, n: desc }));
      main.on('click', (event) => {
        event.stopPropagation();
        toggle(id);
      });

      if (showAll) {
        x += mainW + 6;
        const all = ctl.append('g').attr('class', 'n-pill n-pill-all').attr('transform', `translate(${x},${NODE_H - 3})`);
        all.append('rect').attr('width', allW).attr('height', 20).attr('rx', 10);
        all.append('text').attr('x', allW / 2).attr('y', 14).attr('text-anchor', 'middle').text(allLabel);
        all.append('title').text(I18n.t(desc <= 400 ? 'whole_branch_title' : 'whole_branch_title_big', { n: desc }));
        all.on('click', (event) => {
          event.stopPropagation();
          expandSubtree(id, desc <= 400 ? Infinity : 3);
          foundId = id;
          render();
          requestAnimationFrame(() => centerOn(id, Math.min(d3.zoomTransform(svg.node()).k, 0.7)));
        });
      }
    });

    // --- "+N till"-noder
    const moreNodes = nodes.filter((d) => d.data.more);
    const moreSel = gTree.select('.nodes').selectAll('g.node-more').data(moreNodes, (d) => d.data.id);
    moreSel.exit().remove();
    const moreEnter = moreSel
      .enter()
      .append('g')
      .attr('class', 'node-more')
      .on('click', (event, d) => {
        event.stopPropagation();
        const p = d.data.parent;
        shown.set(p, (shown.get(p) || PAGE) + PAGE * 2);
        render();
      });
    moreEnter.append('rect').attr('width', MORE_W).attr('height', MORE_H).attr('rx', MORE_H / 2);
    moreEnter.append('text').attr('x', MORE_W / 2).attr('y', MORE_H / 2 + 4).attr('text-anchor', 'middle');
    const moreMerge = moreEnter.merge(moreSel);
    moreMerge.attr('transform', (d) => `translate(${d.x - MORE_W / 2},${d.y - MORE_H / 2})`);
    moreMerge.select('text').text((d) => I18n.t('more_siblings', { n: d.data.more }));
    moreMerge.select('title').remove();
    moreMerge.append('title').text((d) => I18n.t('more_siblings_title', { k: Math.min(PAGE * 2, d.data.more), n: d.data.more }));
  }

  function currentNode(id) {
    return hroot ? hroot.descendants().find((d) => d.data.id === id) : null;
  }

  function centerOn(id, scale) {
    const n = currentNode(id);
    if (!n) return;
    const stage = document.querySelector('.tree-stage');
    const k = scale || Math.max(0.8, d3.zoomTransform(svg.node()).k);
    const tx = stage.clientWidth / 2 - n.x * k;
    const ty = stage.clientHeight / 3 - n.y * k;
    svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  function fitToScreen() {
    const stage = document.querySelector('.tree-stage');
    const bounds = gTree.node().getBBox();
    const fullW = stage.clientWidth;
    const fullH = stage.clientHeight;
    if (!fullW || !fullH) return;
    const w = bounds.width || 1;
    const h = bounds.height || 1;
    // 60 px luft upptill (ty nedan) och lika mycket nedtill, så att understa raden syns helt
    const scale = Math.max(0.15, Math.min(0.9, 0.9 * Math.min(fullW / w, (fullH - 120) / h)));
    const tx = fullW / 2 - (bounds.x + w / 2) * scale;
    const ty = 60 - bounds.y * scale;
    svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  // Fäll ut vägen till en person (och eventuellt dess gren), zooma dit.
  function reveal(id, opts) {
    opts = opts || {};
    if (!rec(id)) return;
    const chain = Unified.ancestors(id);
    for (let i = 0; i < chain.length - 1; i++) {
      const p = chain[i].id;
      const c = chain[i + 1].id;
      expanded.add(p);
      const pos = kidsOf(p).indexOf(c);
      if (pos >= (shown.get(p) || PAGE)) {
        if (!forced.has(p)) forced.set(p, new Set());
        forced.get(p).add(c);
      }
    }
    if (opts.expandSubtree) expandSubtree(id, opts.expandSubtree);
    foundId = id;
    render();
    requestAnimationFrame(() => centerOn(id, opts.expandSubtree ? 0.6 : 0.9));
    if (opts.openDrawer) Unified.openDrawer(id, { from: 'tree' });
    else if (!opts.expandSubtree) Unified.closeDrawer();
  }

  // ------------------------------------------------------------ sökning
  function initSearch() {
    const input = document.getElementById('tree-search-input');
    const results = document.getElementById('tree-search-results');
    if (!input) return;
    let hits = [];
    function run() {
      const q = input.value;
      hits = Unified.search(q, 30);
      if (!q.trim()) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }
      results.hidden = false;
      if (!hits.length) {
        results.innerHTML = `<p class="cl-note">${I18n.t('no_hits')}</p>`;
        return;
      }
      results.innerHTML = hits
        .map((id) => {
          const r = rec(id);
          const p = r.parent_id ? rec(r.parent_id) : null;
          const ctx = [Unified.genText(r), p && p.kind !== 'group' ? I18n.t('search_father', { name: p.hanzi || p.western || '' }) : (p ? I18n.t('search_link_unknown') : '')]
            .filter(Boolean)
            .join(' · ');
          return `<button class="cl-search-hit" data-goto="${Unified.esc(id)}"><span>${Unified.esc(Unified.displayName(r))}</span><span class="cl-count">${Unified.esc(ctx)}</span></button>`;
        })
        .join('');
      results.querySelectorAll('[data-goto]').forEach((b) =>
        b.addEventListener('click', () => {
          results.hidden = true;
          reveal(b.dataset.goto, { openDrawer: true });
        })
      );
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', () => input.value.trim() && run());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && hits.length) {
        results.hidden = true;
        reveal(hits[0], { openDrawer: true });
      } else if (e.key === 'Escape') {
        results.hidden = true;
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tree-search-wrap')) results.hidden = true;
    });
  }

  // ------------------------------------------------------------ init
  function initTree() {
    if (built) return;
    built = true;
    U = Unified.build(App.state.unified);
    Unified.setRevealHandler(reveal);

    treeLayout = d3.tree().nodeSize([DY, DX]).separation((a, b) => (a.parent === b.parent ? 1 : 1.15));

    svg = d3.select('#tree-svg');
    gZoom = svg.append('g').attr('class', 'zoom-root');
    gTree = gZoom.append('g').attr('class', 'tree-root');
    gTree.append('g').attr('class', 'links');
    gTree.append('g').attr('class', 'nodes');

    zoomBehavior = d3.zoom().scaleExtent([0.05, 2.5]).on('zoom', (event) => {
      gZoom.attr('transform', event.transform);
    });
    svg.call(zoomBehavior).on('dblclick.zoom', null);

    initialExpansion();
    render({ instant: true });
    requestAnimationFrame(fitToScreen);

    document.getElementById('zoomIn').addEventListener('click', () => svg.transition().call(zoomBehavior.scaleBy, 1.3));
    document.getElementById('zoomOut').addEventListener('click', () => svg.transition().call(zoomBehavior.scaleBy, 0.75));
    document.getElementById('zoomReset').addEventListener('click', fitToScreen);
    const mamma = U.list.find((r) => r.highlight === 'mamma');
    const toMammaBtn = document.getElementById('expandToMamma');
    if (!mamma || mamma.family_generation == null) toMammaBtn.hidden = true;
    toMammaBtn.addEventListener('click', () => {
      foundId = mamma.id;
      initialExpansion(mamma.family_generation);
      render();
      requestAnimationFrame(fitToScreen);
    });
    document.getElementById('expandAll').addEventListener('click', () => {
      foundId = null;
      initialExpansion();
      render();
      requestAnimationFrame(fitToScreen);
    });
    initSearch();

    const stats = document.getElementById('tree-stats');
    if (stats) {
      const persons = U.list.filter((r) => r.kind !== 'group').length;
      stats.textContent = I18n.dt(`${persons} personer`);
    }

    // djuplänk: #person=<id>
    const m = location.hash.match(/person=([\w-]+)/);
    if (m && rec(m[1])) setTimeout(() => reveal(m[1], { openDrawer: true }), 300);
  }

  window.addEventListener('dataready', initTree);
  // nytt språk: bygg om nodernas texter (de skapas bara när en nod dyker upp)
  window.addEventListener('langchange', () => {
    if (!built) return;
    gTree.select('.nodes').selectAll('*').remove();
    render({ instant: true });
    const inp = document.getElementById('tree-search-input');
    if (inp && inp.value.trim() && !document.getElementById('tree-search-results').hidden) inp.dispatchEvent(new Event('input'));
  });

  window.addEventListener('viewchange', (e) => {
    if (e.detail === 'tree' && built && !hroot) render();
  });

  window.Tree = { reveal };
})();
