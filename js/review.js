// Granskningssidan (review.html): Anders läser, godkänner och avvisar bidrag.
//
// data/review-key.json innehåller Anders privata nyckel och mottagarens
// adminnyckel, låsta med adminlösenfrasen (PBKDF2-SHA256 + AES-GCM), samt
// mottagarens adress förseglad till den publika nyckeln. Allt låses upp här i
// webbläsaren. Sidan innehåller själv inga uppgifter och sparar inget.
(function () {
  const MIN_PASSPHRASE = 16;
  const MAX_NOTE = 1000; // mottagaren sparar högst 1000 tecken (krypterad kommentar)
  const TYPE_LABEL = { correction: 'Rättelse', more: 'Mer om personen', relative: 'Ny släkting', photo: 'Foto eller dokument', other: 'Annat' };
  const STATUS_LABEL = { new: 'Ny', pending: 'Väntar', approved: 'Godkänd', rejected: 'Avvisad' };
  const LANG_LABEL = { sv: 'svenska', en: 'engelska', zh: 'kinesiska' };
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const v = () => '?v=' + (window.SITE_VERSION || Date.now());
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (id) => document.getElementById(id);

  document.documentElement.setAttribute('data-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  let keyFile = null;
  let session = null; // { priv, pub, admin, endpoint }
  let items = []; // { meta, payload, note, images: [{ name, url, blob }] , error }

  async function unlock(passphrase) {
    const lock = keyFile.lock;
    const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    const kek = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SealBox.unb64(lock.salt), iterations: lock.iterations, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    let secret;
    try {
      secret = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: SealBox.unb64(lock.iv) }, kek, SealBox.unb64(lock.wrapped))));
    } catch (e) {
      return null;
    }
    const jwk = Object.assign({}, secret.private_jwk);
    delete jwk.key_ops;
    const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const rec = keyFile.receiver ? await SealBox.openJSON(priv, SealBox.unb64(keyFile.receiver)) : {};
    return { priv, pub: keyFile.public_jwk, admin: secret.admin_token, endpoint: (rec.endpoint || '').replace(/\/$/, '') };
  }

  function api(path, opts = {}) {
    return fetch(session.endpoint + path, {
      ...opts,
      headers: { Authorization: 'Bearer ' + session.admin, ...(opts.headers || {}) },
    }).then((r) => {
      if (!r.ok) throw new Error('Mottagaren svarade ' + r.status);
      return r;
    });
  }

  async function openNote(note) {
    if (!note) return '';
    try {
      return (await SealBox.openJSON(session.priv, SealBox.unb64(note))).text || '';
    } catch (e) {
      return '(kunde inte läsa kommentaren)';
    }
  }

  async function load() {
    $('rv-status').textContent = 'Hämtar bidrag …';
    items.forEach((it) => (it.images || []).forEach((im) => URL.revokeObjectURL(im.url)));
    items = [];
    if (!session.endpoint) {
      $('rv-status').textContent = 'Mottagaren är inte inställd än (adressen saknas i secrets/receiver.json). Inga bidrag kan tas emot förrän den är på plats.';
      render();
      return;
    }
    const list = (await (await api('/list')).json()).items;
    let n = 0;
    for (const meta of list) {
      // Mottagaren märker nya bidrag "pending"; utan granskningsdatum är de ogranskade.
      if (meta.status === 'pending' && !meta.updated) meta.status = 'new';
      const it = { meta, note: await openNote(meta.note), images: [] };
      try {
        const blob = new Uint8Array(await (await api('/item/' + meta.id)).arrayBuffer());
        it.payload = await SealBox.openJSON(session.priv, blob);
        it.images = (it.payload.images || []).map((im) => {
          const b = new Blob([SealBox.unb64(im.data)], { type: im.type || 'image/jpeg' });
          return { name: im.name, width: im.width, height: im.height, blob: b, url: URL.createObjectURL(b) };
        });
      } catch (e) {
        it.error = 'Kunde inte öppnas: ' + e.message;
      }
      items.push(it);
      $('rv-status').textContent = `Hämtar bidrag … ${++n} av ${list.length}`;
    }
    render();
  }

  function fmt(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' });
  }

  function subjectLink(s) {
    if (!s) return 'Inget särskilt (allmänt bidrag)';
    const href = 'index.html#' + (s.kind === 'place' ? 'place=' : 'person=') + encodeURIComponent(s.id);
    return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(s.label || s.id)}</a> <span style="color:var(--color-text-faint)">(${s.kind === 'place' ? 'plats' : 'person'}, ${esc(s.id)})</span>`;
  }

  function card(it) {
    const m = it.meta;
    const p = it.payload || {};
    const head = `<div class="rv-meta"><span class="rv-pill s-${esc(m.status)}">${STATUS_LABEL[m.status] || esc(m.status)}</span>
      <span>Inkom ${esc(fmt(m.received))}</span>${p.type ? `<span class="rv-pill">${esc(TYPE_LABEL[p.type] || p.type)}</span>` : ''}
      ${p.lang ? `<span>Skrivet på ${esc(LANG_LABEL[p.lang] || p.lang)}</span>` : ''}<span>${Math.round(m.size / 1024)} kB</span>
      ${m.updated ? `<span>Granskat ${esc(fmt(m.updated))}</span>` : ''}<span style="color:var(--color-text-faint)">${esc(m.id)}</span></div>`;
    if (it.error) return `<div class="rv-card" data-id="${esc(m.id)}" data-status="${esc(m.status)}">${head}<p class="rv-err">${esc(it.error)}</p></div>`;
    const dl = [
      ['Gäller', subjectLink(p.subject)],
      ['Namn', esc(p.name) || '<em>inte angivet</em>'],
      ['Kontakt', esc(p.contact) || '<em>inte angivet</em>'],
      ['Relation', esc(p.relation) || '<em>inte angivet</em>'],
    ];
    if (it.images.length) dl.push(['Samtycke', p.consent ? 'Ja – personerna på bilden går med på att den visas för släkten' : '<strong>Nej / inte ikryssat</strong>']);
    return `<div class="rv-card" data-id="${esc(m.id)}" data-status="${esc(m.status)}">${head}
      ${p.text ? `<p class="rv-text">${esc(p.text)}</p>` : ''}
      <dl class="rv-dl">${dl.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>
      ${it.images.length ? `<div class="rv-imgs">${it.images.map((im) => `<a href="${im.url}" target="_blank" rel="noopener" title="${im.width}×${im.height}"><img src="${im.url}" alt=""></a>`).join('')}</div>` : ''}
      <div class="rv-actions">
        <textarea placeholder="Din kommentar (syns bara här)" aria-label="Kommentar">${esc(it.note)}</textarea>
        <button class="rv-btn" data-set="approved">Godkänn</button>
        <button class="rv-btn" data-set="rejected">Avvisa</button>
        <button class="rv-btn" data-set="pending">Vänta</button>
        <button class="rv-btn" data-delete>Radera</button>
        <span class="rv-saved"></span>
      </div></div>`;
  }

  function render() {
    const f = $('rv-filter').value;
    const shown = items.filter((it) => f === 'all' || it.meta.status === f);
    const count = (s) => items.filter((it) => it.meta.status === s).length;
    if (session.endpoint) {
      $('rv-status').textContent = items.length
        ? `${items.length} bidrag: ${count('new')} nya, ${count('pending')} väntar, ${count('approved')} godkända, ${count('rejected')} avvisade.`
        : 'Inga bidrag än.';
    }
    $('rv-list').innerHTML = shown.map(card).join('');
  }

  async function setStatus(cardEl, status) {
    const it = items.find((x) => x.meta.id === cardEl.dataset.id);
    const text = cardEl.querySelector('textarea').value.trim();
    const saved = cardEl.querySelector('.rv-saved');
    saved.textContent = 'Sparar …';
    try {
      const note = text ? SealBox.b64(await SealBox.sealJSON(session.pub, { text })) : '';
      if (note.length > MAX_NOTE) {
        saved.textContent = 'Kommentaren är för lång – korta ner den (ungefär 400 tecken räcker).';
        return;
      }
      await api('/status/' + it.meta.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }) });
      Object.assign(it.meta, { status, updated: new Date().toISOString(), note });
      it.note = text;
      render();
      const el = document.querySelector(`.rv-card[data-id="${it.meta.id}"] .rv-saved`);
      if (el) el.textContent = 'Sparat: ' + STATUS_LABEL[status];
    } catch (e) {
      saved.textContent = 'Kunde inte spara: ' + e.message;
    }
  }

  // ---------------------------------------------------------- export (zip utan komprimering)
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const crc = crc32(f.data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8-namn
      local.setUint32(14, crc, true);
      local.setUint32(18, f.data.length, true);
      local.setUint32(22, f.data.length, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, f.data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, f.data.length, true);
      cen.setUint32(24, f.data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + f.data.length;
    }
    const size = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  async function exportApproved() {
    const approved = items.filter((it) => it.meta.status === 'approved' && it.payload);
    if (!approved.length) return alert('Det finns inga godkända bidrag att exportera.');
    const files = [];
    const out = [];
    for (const it of approved) {
      const imgs = [];
      for (const im of it.images) {
        const name = `images/${it.meta.id}-${im.name}`;
        files.push({ name, data: new Uint8Array(await im.blob.arrayBuffer()) });
        imgs.push({ file: name, width: im.width, height: im.height });
      }
      const sub = Object.assign({}, it.payload, { images: imgs });
      out.push({ id: it.meta.id, received: it.meta.received, status: it.meta.status, reviewed: it.meta.updated, review_note: it.note || '', submission: sub });
    }
    files.unshift({ name: 'approved.json', data: enc.encode(JSON.stringify({ exported: new Date().toISOString(), items: out }, null, 2)) });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zip(files));
    a.download = `godkanda-bidrag-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  // ---------------------------------------------------------- start
  $('rv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('rv-error');
    const btn = $('rv-submit');
    const pass = $('rv-pass').value.trim();
    err.hidden = true;
    if (pass.length < MIN_PASSPHRASE) {
      err.textContent = `Adminlösenfrasen är minst ${MIN_PASSPHRASE} tecken.`;
      err.hidden = false;
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Låser upp …';
    try {
      if (!keyFile) {
        const r = await fetch('data/review-key.json' + v(), { cache: 'no-store' });
        if (!r.ok) throw new Error('Granskningsnyckeln saknas på sajten.');
        keyFile = await r.json();
      }
      session = await unlock(pass);
      if (!session) {
        err.textContent = 'Fel lösenfras.';
        err.hidden = false;
        return;
      }
      $('rv-lock').remove();
      $('rv-main').hidden = false;
      await load();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      if (session) $('rv-status').textContent = 'Fel: ' + ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lås upp';
    }
  });
  $('rv-filter').addEventListener('change', render);
  $('rv-reload').addEventListener('click', () => load().catch((e) => ($('rv-status').textContent = 'Fel: ' + e.message)));
  $('rv-export').addEventListener('click', exportApproved);
  $('rv-list').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-delete]');
    if (del) {
      const cardEl = del.closest('.rv-card');
      if (!confirm('Radera bidraget för gott hos mottagaren? Det går inte att ångra.')) return;
      try {
        await api('/item/' + cardEl.dataset.id, { method: 'DELETE' });
        items = items.filter((x) => x.meta.id !== cardEl.dataset.id);
        render();
      } catch (ex) {
        cardEl.querySelector('.rv-saved').textContent = 'Kunde inte radera: ' + ex.message;
      }
      return;
    }
    const b = e.target.closest('[data-set]');
    if (b) setStatus(b.closest('.rv-card'), b.dataset.set);
  });
})();
