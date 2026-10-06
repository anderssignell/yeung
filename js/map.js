(function () {
  // Kartläge:
  //  'auto'    – försök med OpenFreeMaps kartbilder; svarar de inte inom
  //              ONLINE_TIMEOUT_MS används den inbyggda reservkartan.
  //  'offline' – bara den inbyggda reservkartan (data/basemap.json), inga
  //              anrop utanför sajten. Tänkt för fastlandskina (steg 2).
  const MAP_MODE = 'auto';
  const ONLINE_TIMEOUT_MS = 3000;

  let map, built = false;
  let markersAdded = false;
  let fitted = false;
  let layersReady = false;
  const migrationOrder = ['nanxiong', 'beishan', 'haitan', 'beishan', 'hongkong', 'sweden'];

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  const T = (k, v) => I18n.t(k, v);
  const relLabel = (r) => (['wife', 'daughter', 'abroad', 'mention'].includes(r) ? T('rel_' + r) : r);
  const nameOf = (place) => I18n.dt(place.name);
  const LAYERS = { family: true, villages: true, abroad: true };
  let pendingFocus = null;
  let activePopup = null;
  let activePlace = null;
  const markerLabels = []; // { el, place, short } – byter text vid språkbyte
  const esc = (s) => (window.Unified ? Unified.esc(s) : String(s == null ? '' : s));

  function extPlaces() {
    return (App.state.placesExt && App.state.placesExt.places) || [];
  }
  function layerOf(place) {
    if (!place.persons) return 'family';
    return place.kind === 'abroad' ? 'abroad' : 'villages';
  }
  function countsText(place) {
    const c = place.counts || {};
    const parts = [];
    if (c.wife) parts.push(T('count_wife', { n: c.wife }));
    if (c.daughter) parts.push(T('count_daughter', { n: c.daughter }));
    if (c.abroad) parts.push(T('count_abroad', { n: c.abroad }));
    if (c.mention) parts.push(T('count_mention', { n: c.mention }));
    return parts.join(' · ');
  }
  function personButton(l) {
    const r = window.Unified && Unified.idx.byId[l.id];
    if (!r) return '';
    return `<button class="pp-person" data-person="${esc(l.id)}" title="${esc(l.snippet || '')}">
      <span class="pp-name">${esc(Unified.displayName(r))}</span>
      <span class="pp-rel">${esc(relLabel(l.rel))}${r.generation ? ' · ' + esc(T(r.generation_estimated ? 'gen_short_est' : 'gen_short', { g: r.generation })) : ''}</span>
    </button>`;
  }

  function popupHtml(place) {
    let h = `<div class="popup-title">${esc(nameOf(place))}</div><p class="popup-desc">${esc(I18n.dt(place.description))}${place.approx ? `<br><span class="place-approx">${T('approx_pos')}</span>` : ''}</p>`;
    if (place.source_url) h += `<p class="popup-desc"><a href="${esc(place.source_url)}" target="_blank" rel="noopener">${T('source_china_daily')}</a></p>`;
    if (place.persons && place.persons.length) {
      h += `<p class="popup-counts">${esc(countsText(place))}</p>`;
      const order = { abroad: 0, wife: 1, daughter: 2, mention: 3 };
      const ls = place.persons.slice().sort((x, y) => (order[x.rel] - order[y.rel]));
      h += `<div class="pp-list">${ls.map(personButton).join('')}</div>`;
      h += `<p class="place-approx">${T('popup_click')}</p>`;
    }
    return h;
  }

  function cardHtml(p) {
    const n = p.persons ? p.persons.length : 0;
    return `<div class="place-card${p.lat == null ? ' no-coords' : ''}" data-place="${esc(p.id)}" tabindex="0">
      <h4>${esc(nameOf(p))}${n ? ` <span class="place-count">${n}</span>` : ''}</h4>
      <p>${esc(p.persons ? countsText(p) || I18n.dt(p.description) : I18n.dt(p.description))}</p>
      ${p.lat == null ? `<p class="place-approx">${T('unknown_pos')}</p>` : p.approx ? `<p class="place-approx">${T('approx_pos')}</p>` : ''}
    </div>`;
  }

  function renderList() {
    const list = document.getElementById('map-place-list');
    const ext = extPlaces();
    const villages = ext.filter((p) => p.kind !== 'abroad' && p.persons.length).sort((a, b) => b.persons.length - a.persons.length);
    const abroad = ext.filter((p) => p.kind === 'abroad');
    const toggle = (key, label) =>
      `<label class="map-layer-toggle"><input type="checkbox" id="layer-${key}" data-layer="${key}" ${LAYERS[key] ? 'checked' : ''}> ${label}</label>`;
    list.innerHTML =
      `<div class="map-layers">${toggle('family', T('layer_family'))}${toggle('villages', T('layer_villages'))}${toggle('abroad', T('layer_abroad'))}</div>` +
      `<h3 class="map-section">${T('map_sec_family')}</h3>` + App.state.places.map(cardHtml).join('') +
      `<h3 class="map-section">${T('map_sec_abroad')}</h3><p class="map-hint">${T('map_hint_abroad')}</p>` + abroad.map(cardHtml).join('') +
      `<h3 class="map-section">${T('map_sec_villages')}</h3><p class="map-hint">${T('map_hint_villages')}</p>` +
      villages.map(cardHtml).join('');
    list.querySelectorAll('.place-card').forEach((card) => {
      card.addEventListener('click', () => flyTo(card.dataset.place));
      card.addEventListener('keydown', (e) => e.key === 'Enter' && flyTo(card.dataset.place));
    });
    list.querySelectorAll('[data-layer]').forEach((cb) =>
      cb.addEventListener('change', () => {
        LAYERS[cb.dataset.layer] = cb.checked;
        applyLayers();
      })
    );
  }

  function applyLayers() {
    document.querySelectorAll('[data-maplayer]').forEach((el) => (el.hidden = !LAYERS[el.dataset.maplayer]));
    if (!map) return;
    if (map.getLayer('migration-path-line')) map.setLayoutProperty('migration-path-line', 'visibility', LAYERS.family ? 'visible' : 'none');
    if (map.getLayer('abroad-lines')) map.setLayoutProperty('abroad-lines', 'visibility', LAYERS.abroad ? 'visible' : 'none');
  }

  function flyTo(placeId) {
    const place = App.state.placesById[placeId];
    if (!place) return;
    if (!map || !layersReady) {
      pendingFocus = placeId;
      return;
    }
    document.querySelectorAll('.place-card').forEach((c) => c.classList.toggle('is-active', c.dataset.place === placeId));
    const card = document.querySelector(`.place-card[data-place="${placeId}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (place.lat == null) return;
    const lay = layerOf(place);
    if (!LAYERS[lay]) {
      LAYERS[lay] = true;
      const cb = document.getElementById('layer-' + lay);
      if (cb) cb.checked = true;
      applyLayers();
    }
    const zoom = place.kind === 'abroad' ? 4 : place.persons ? 10.5 : 5;
    map.flyTo({ center: [place.lng, place.lat], zoom, duration: 900 });
    if (activePopup) activePopup.remove();
    activePlace = place;
    activePopup = new maplibregl.Popup({ closeButton: true, offset: 16, maxWidth: '340px' })
      .setLngLat([place.lng, place.lat])
      .setHTML(popupHtml(place))
      .addTo(map);
  }

  function styleUrl() {
    return `https://tiles.openfreemap.org/styles/${isDark() ? 'dark' : 'positron'}`;
  }

  // Reservkarta utan extern server: land + landsgränser (Natural Earth 1:50m,
  // data/basemap.json) i sajtens egna färger. Används om kartservern inte
  // svarar eller blockeras (t.ex. i en förhandsvisning).
  let offline = false;
  let basemap = null;
  function token(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  async function offlineStyle() {
    if (!basemap) {
      const v = window.SITE_VERSION ? '?v=' + window.SITE_VERSION : '';
      basemap = await fetch('data/basemap.json' + v).then((r) => r.json());
    }
    const dark = isDark();
    return {
      version: 8,
      sources: {
        land: { type: 'geojson', data: basemap.land },
        borders: { type: 'geojson', data: basemap.borders },
      },
      layers: [
        { id: 'water', type: 'background', paint: { 'background-color': dark ? '#15222a' : '#dfe9ec' } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': token('--color-surface-2', dark ? '#201f1d' : '#fbfbf9') } },
        { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': token('--color-border', '#d4d1ca'), 'line-width': 0.8 } },
        { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': token('--color-text-faint', '#bab9b4'), 'line-width': 0.6, 'line-dasharray': [3, 2] } },
      ],
    };
  }
  // Ortnamn för reservkartan (den har inga egna etiketter). minZoom styr när
  // namnet visas, så att kartan inte blir rörig när man zoomat ut.
  // name: [svenska, engelska, kinesiska]
  const CONTEXT_LABELS = [
    { name: ['Kina', 'China', '中國'], lng: 104, lat: 34, kind: 'country', minZoom: 0 },
    { name: ['Mongoliet', 'Mongolia', '蒙古'], lng: 103, lat: 46.8, kind: 'country', minZoom: 1.5 },
    { name: ['Indien', 'India', '印度'], lng: 79, lat: 22, kind: 'country', minZoom: 1.5 },
    { name: ['Ryssland', 'Russia', '俄羅斯'], lng: 50, lat: 58, kind: 'country', minZoom: 1.5 },
    { name: ['Vietnam', 'Vietnam', '越南'], lng: 106.2, lat: 16.5, kind: 'country', minZoom: 3 },
    { name: ['Taiwan', 'Taiwan', '台灣'], lng: 121, lat: 23.7, kind: 'country', minZoom: 3.5 },
    { name: ['Norge', 'Norway', '挪威'], lng: 9.5, lat: 61.5, kind: 'country', minZoom: 2.5 },
    { name: ['Finland', 'Finland', '芬蘭'], lng: 26.5, lat: 63, kind: 'country', minZoom: 2.5 },
    { name: ['Sydkinesiska havet', 'South China Sea', '南海'], lng: 115, lat: 15, kind: 'sea', minZoom: 2.5 },
    { name: ['Östkinesiska havet', 'East China Sea', '東海'], lng: 125, lat: 28.5, kind: 'sea', minZoom: 3.5 },
    { name: ['Östersjön', 'Baltic Sea', '波羅的海'], lng: 19.3, lat: 57.3, kind: 'sea', minZoom: 3 },
    { name: ['Guangdong 廣東', 'Guangdong 廣東', '廣東'], lng: 112.4, lat: 24.2, kind: 'region', minZoom: 4 },
    { name: ['Fujian 福建', 'Fujian 福建', '福建'], lng: 117.8, lat: 26.4, kind: 'region', minZoom: 4 },
    { name: ['Jiangxi 江西', 'Jiangxi 江西', '江西'], lng: 115.6, lat: 27.6, kind: 'region', minZoom: 4 },
    { name: ['Guangxi 廣西', 'Guangxi 廣西', '廣西'], lng: 108.6, lat: 23.6, kind: 'region', minZoom: 4 },
    { name: ['Hunan 湖南', 'Hunan 湖南', '湖南'], lng: 111.7, lat: 27.4, kind: 'region', minZoom: 4.5 },
    { name: ['Guangzhou 廣州', 'Guangzhou 廣州', '廣州'], lng: 113.26, lat: 23.13, kind: 'city', minZoom: 5 },
    { name: ['Macao 澳門', 'Macao 澳門', '澳門'], lng: 113.54, lat: 22.19, kind: 'city', minZoom: 7 },
    { name: ['Fuzhou 福州', 'Fuzhou 福州', '福州'], lng: 119.3, lat: 26.07, kind: 'city', minZoom: 5 },
    { name: ['Shanghai 上海', 'Shanghai 上海', '上海'], lng: 121.47, lat: 31.23, kind: 'city', minZoom: 4 },
    { name: ['Peking 北京', 'Beijing 北京', '北京'], lng: 116.4, lat: 39.9, kind: 'city', minZoom: 3.5 },
    { name: ['Göteborg', 'Gothenburg', '哥德堡'], lng: 11.97, lat: 57.71, kind: 'city', minZoom: 5 },
  ];
  const labelName = (l) => l.name[{ sv: 0, en: 1, zh: 2 }[I18n.lang] || 0];
  function contextLabelHtml(l) {
    return l.kind === 'city' ? `<span class="ctx-dot"></span>${esc(labelName(l))}` : esc(labelName(l));
  }
  const LABEL_LEFT = new Set(['beishan']);
  const contextMarkers = [];
  function addContextLabels() {
    if (contextMarkers.length) return;
    CONTEXT_LABELS.forEach((l) => {
      const el = document.createElement('div');
      el.className = 'ctx-label ctx-' + l.kind;
      el.innerHTML = contextLabelHtml(l);
      const m = new maplibregl.Marker({ element: el, anchor: l.kind === 'city' ? 'left' : 'center', offset: l.kind === 'city' ? [-3, 0] : [0, 0] })
        .setLngLat([l.lng, l.lat])
        .addTo(map);
      contextMarkers.push({ m, el, minZoom: l.minZoom, label: l });
    });
    const update = () => {
      const z = map.getZoom();
      contextMarkers.forEach((c) => (c.el.hidden = z < c.minZoom));
    };
    map.on('zoom', update);
    update();
  }

  function showOfflineNote(key) {
    const note = document.querySelector('.map-hint');
    if (note && !document.getElementById('map-offline-note')) {
      note.insertAdjacentHTML('afterend', `<p class="map-hint" id="map-offline-note" data-i18n="${key}">${T(key)}</p>`);
    }
  }

  async function useOffline() {
    if (offline) return;
    offline = true;
    addContextLabels();
    map.setStyle(await offlineStyle(), { diff: false });
    map.once('style.load', addLayers);
    showOfflineNote('map_offline');
  }

  function addLayers() {
    const places = App.state.places;
    const placesById = App.state.placesById;

    // markers med namn (läggs bara till en gång – de överlever stilbyten)
    if (!markersAdded) places.forEach((place) => {
      const el = document.createElement('div');
      el.className = 'place-marker';
      // Beishan och Hongkong ligger nära varandra: Beishans namn skrivs till vänster
      const left = LABEL_LEFT.has(place.id);
      el.innerHTML = left
        ? `<span class="place-label"></span><span class="place-dot"></span>`
        : `<span class="place-dot"></span><span class="place-label"></span>`;
      markerLabels.push({ el, place, label: el.querySelector('.place-label'), short: (n) => n.split(' (')[0] });
      el.addEventListener('click', () => flyTo(place.id));
      new maplibregl.Marker({ element: el, anchor: left ? 'right' : 'left', offset: [left ? 9 : -9, 0] })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
    });
    if (!markersAdded) {
      const maxN = Math.max(1, ...extPlaces().map((p) => p.persons.length));
      extPlaces().forEach((place) => {
        if (place.lat == null) return;
        const el = document.createElement('div');
        const lay = layerOf(place);
        el.dataset.maplayer = lay;
        if (lay === 'abroad') {
          el.className = 'place-marker abroad-marker';
          el.innerHTML = `<span class="place-dot"></span><span class="place-label"></span>`;
        } else {
          const size = Math.round(10 + 26 * Math.sqrt(place.persons.length / maxN));
          el.className = 'village-marker';
          el.innerHTML = `<span class="village-dot" style="width:${size}px;height:${size}px"></span><span class="village-label"></span>`;
        }
        markerLabels.push({ el, place, label: el.querySelector('.place-label, .village-label'), short: (n) => n.split(' (')[0].split(' – ')[0] });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          flyTo(place.id);
        });
        new maplibregl.Marker({ element: el, anchor: lay === 'abroad' ? 'left' : 'center', offset: lay === 'abroad' ? [-9, 0] : [0, 0] })
          .setLngLat([place.lng, place.lat])
          .addTo(map);
      });
      // bynamn visas först när man zoomat in (annars krockar de)
      const upd = () => {
        document.querySelectorAll('.village-label').forEach((l) => (l.hidden = map.getZoom() < 9.5));
        document.getElementById('map').classList.toggle('map-far', map.getZoom() < 6);
      };
      map.on('zoom', upd);
      upd();
    }
    if (!markersAdded) relabelMarkers();
    markersAdded = true;

    // utvandringslinjer från Beishan
    const home = placesById['beishan'];
    const abroadLines = {
      type: 'FeatureCollection',
      features: extPlaces()
        .filter((p) => p.kind === 'abroad' && p.lat != null)
        .map((p) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[home.lng, home.lat], [p.lng, p.lat]] } })),
    };
    if (map.getSource('abroad')) map.getSource('abroad').setData(abroadLines);
    else {
      map.addSource('abroad', { type: 'geojson', data: abroadLines });
      map.addLayer({ id: 'abroad-lines', type: 'line', source: 'abroad', paint: { 'line-color': token('--color-primary', '#01696f'), 'line-width': 1.6, 'line-dasharray': [1, 2], 'line-opacity': 0.8 } });
    }

    // migration path line
    const coords = migrationOrder.map((id) => [placesById[id].lng, placesById[id].lat]);
    const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };

    if (map.getSource('migration-path')) {
      map.getSource('migration-path').setData(geojson);
    } else {
      map.addSource('migration-path', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'migration-path-line',
        type: 'line',
        source: 'migration-path',
        paint: { 'line-color': '#d19900', 'line-width': 2.5, 'line-dasharray': [2, 2] },
      });
    }

    // fit bounds
    const bounds = new maplibregl.LngLatBounds();
    places.forEach((p) => bounds.extend([p.lng, p.lat]));
    if (!fitted) map.fitBounds(bounds, { padding: 60, duration: 0 });
    fitted = true;
    layersReady = true;
    applyLayers();
    if (pendingFocus) {
      const f = pendingFocus;
      pendingFocus = null;
      setTimeout(() => flyTo(f), 50);
    }
  }

  function relabelMarkers() {
    markerLabels.forEach((m) => {
      const name = nameOf(m.place);
      m.label.textContent = m.short(name);
      m.el.title = name + (m.place.persons && m.place.persons.length ? ' – ' + countsText(m.place) : '');
    });
    contextMarkers.forEach((c) => (c.el.innerHTML = contextLabelHtml(c.label)));
  }

  // nytt språk: lista, markörer och öppen popup
  window.addEventListener('langchange', () => {
    if (!built) return;
    const active = document.querySelector('.place-card.is-active');
    renderList();
    if (active) {
      const card = document.querySelector(`.place-card[data-place="${active.dataset.place}"]`);
      if (card) card.classList.add('is-active');
    }
    relabelMarkers();
    if (activePopup && activePopup.isOpen() && activePlace) activePopup.setHTML(popupHtml(activePlace));
  });

  async function initMap() {
    if (built) return;
    built = true;
    const startOffline = MAP_MODE === 'offline';
    if (startOffline) {
      offline = true;
      showOfflineNote('map_offline_mode');
    }
    map = new maplibregl.Map({
      container: 'map',
      style: startOffline ? await offlineStyle() : styleUrl(),
      center: [110, 30],
      zoom: 2.2,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    let loaded = false;
    map.once('load', () => {
      loaded = true;
      if (startOffline) addContextLabels();
      if (startOffline || !offline) addLayers();
    });
    if (!startOffline) {
      map.on('error', () => {
        if (!loaded) useOffline();
      });
      // Kartservern kan vara blockerad utan att svara alls: vänta inte längre än så här.
      setTimeout(() => {
        if (!loaded && !offline) useOffline();
      }, ONLINE_TIMEOUT_MS);
    }

    renderList();

    window.addEventListener('themechange', async () => {
      map.setStyle(offline ? await offlineStyle() : styleUrl());
      map.once('style.load', addLayers);
    });
  }
  window.addEventListener('focusplace', (e) => flyTo(e.detail));

  // popup-knappar: visa personen i släktträdet
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.pp-person');
    if (b && window.Unified) Unified.showPerson(b.dataset.person);
  });

  window.addEventListener('dataready', () => {
    // Map must init only once visible/sized; init lazily on first tab view.
    document.querySelector('.tab-btn[data-view="map"]').addEventListener('click', () => {
      setTimeout(() => {
        if (!built) initMap();
        else if (map) map.resize();
      }, 30);
    });
  });
})();
