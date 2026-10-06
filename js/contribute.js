// Bidrag från släkten: formuläret "Föreslå ändring / Bidra" och visningen av
// godkända bidrag ("Från släkten") i personpanelen.
//
// Formuläret öppnas i sidan. Allt (text + bilder) krypteras i webbläsaren med
// Anders publika granskningsnyckel (js/sealbox.js) innan det skickas till
// mottagaren (receiver/). Mottagarens adress och insändningsnyckel ligger i den
// krypterade data/config.json.enc, så bara den som låst upp sajten kan skicka.
//
// Godkända bidrag läggs in med tools/import_contributions.py och ligger i
// data/contributions.json (krypterad) och media/*.jpg (krypterade).
window.Contribute = (function () {
  const MAX_IMAGES = 5;
  const MAX_FILE = 10 * 1024 * 1024;
  const MAX_SIDE = 2000;
  const JPEG_QUALITY = 0.85;
  const MAX_TOTAL = 60 * 1024 * 1024;
  const TYPES = ['correction', 'more', 'relative', 'photo', 'other'];

  const T = (k, v) => I18n.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const config = () => (App.state.config && App.state.config.contribute) || null;
  const items = () => (App.state.contributions && App.state.contributions.items) || [];

  // ------------------------------------------------------------ bilder
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode'));
      };
      img.src = url;
    });
  }
  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close && bmp.close() };
      } catch (e) {
        /* t.ex. HEIC i en webbläsare som inte kan createImageBitmap – prova <img> */
      }
    }
    return loadImage(file);
  }
  // Förminska till högst 2000 px och spara som JPEG. Att rita om bilden på en
  // canvas tar bort all EXIF-information, även GPS-position.
  async function shrink(file) {
    const im = await decode(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(im.w, im.h));
    const w = Math.max(1, Math.round(im.w * scale));
    const h = Math.max(1, Math.round(im.h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // genomskinliga PNG får vit bakgrund
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(im.src, 0, 0, w, h);
    im.done();
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('encode');
    return { blob, w, h, url: URL.createObjectURL(blob) };
  }

  // ------------------------------------------------------------ formuläret
  let modal = null;

  function subjectLabel(subject) {
    if (!subject) return '';
    if (subject.kind === 'person' && window.Unified && Unified.idx.byId[subject.id]) return Unified.displayName(Unified.idx.byId[subject.id]);
    if (subject.kind === 'place' && App.state.placesById[subject.id]) return I18n.dt(App.state.placesById[subject.id].name);
    return subject.label || subject.id;
  }

  function open(subject) {
    close();
    const st = { subject: subject || null, images: [], busy: false };
    modal = document.createElement('div');
    modal.className = 'cf-overlay';
    modal.innerHTML = `
      <form class="cf-card" novalidate>
        <button type="button" class="drawer-close cf-x" data-act="cancel" data-i18n-attr="aria-label:close">×</button>
        <div class="cf-body">
          <h2 data-i18n="cf_heading"></h2>
          <p class="cf-intro" data-i18n="cf_intro"></p>
          <p class="cf-notopen" data-i18n="cf_not_open" ${config() && config().endpoint ? 'hidden' : ''}></p>
          <div class="cf-about" hidden><span class="cf-label" data-i18n="cf_about"></span> <strong class="cf-about-name"></strong>
            <button type="button" class="cf-link" data-act="unlink" data-i18n="cf_about_remove"></button></div>
          <fieldset class="cf-types"><legend class="cf-label" data-i18n="cf_type"></legend>
            ${TYPES.map((t, i) => `<label class="cf-chip"><input type="radio" name="type" value="${t}" ${i === 0 ? 'checked' : ''}> <span data-i18n="cf_type_${t}"></span></label>`).join('')}
          </fieldset>
          <label class="cf-label" for="cf-text" data-i18n="cf_text"></label>
          <textarea id="cf-text" name="text" rows="6" maxlength="20000" data-i18n-attr="placeholder:cf_text_ph"></textarea>
          <div class="cf-row">
            <div><label class="cf-label" for="cf-name" data-i18n="cf_name"></label><input id="cf-name" name="name" maxlength="200" autocomplete="name"></div>
            <div><label class="cf-label" for="cf-contact" data-i18n="cf_contact"></label><input id="cf-contact" name="contact" maxlength="200" data-i18n-attr="placeholder:cf_contact_ph"></div>
          </div>
          <label class="cf-label" for="cf-relation" data-i18n="cf_relation"></label>
          <input id="cf-relation" name="relation" maxlength="300" data-i18n-attr="placeholder:cf_relation_ph">
          <span class="cf-label" data-i18n="cf_images"></span>
          <div class="cf-images"></div>
          <label class="cf-file"><input type="file" accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif" multiple hidden><span data-i18n="cf_add_images"></span></label>
          <p class="cf-small" data-i18n="cf_privacy_note"></p>
          <label class="cf-consent" hidden><input type="checkbox" name="consent"> <span data-i18n="cf_consent"></span></label>
          <p class="cf-error" role="alert" hidden></p>
          <div class="cf-buttons">
            <button type="button" class="cf-secondary" data-act="cancel" data-i18n="cf_cancel"></button>
            <button type="submit" class="cf-primary" data-i18n="cf_send"></button>
          </div>
        </div>
        <div class="cf-done" hidden>
          <div class="lock-mark zh" aria-hidden="true">楊</div>
          <h2 data-i18n="cf_thanks_title"></h2>
          <p data-i18n="cf_thanks"></p>
          <div class="cf-buttons">
            <button type="button" class="cf-secondary" data-act="again" data-i18n="cf_another"></button>
            <button type="button" class="cf-primary" data-act="cancel" data-i18n="close"></button>
          </div>
        </div>
      </form>`;
    document.body.appendChild(modal);
    document.body.classList.add('cf-open');
    const form = modal.querySelector('form');
    const err = modal.querySelector('.cf-error');
    const fileInput = modal.querySelector('input[type=file]');
    const imgWrap = modal.querySelector('.cf-images');
    const consent = modal.querySelector('.cf-consent');
    const val = (sel) => form.querySelector(sel).value.trim();

    const showError = (msg) => {
      err.textContent = msg;
      err.hidden = !msg;
    };
    const renderAbout = () => {
      const a = modal.querySelector('.cf-about');
      a.hidden = !st.subject;
      if (st.subject) a.querySelector('.cf-about-name').textContent = subjectLabel(st.subject);
    };
    const renderImages = () => {
      imgWrap.innerHTML = st.images
        .map((im, i) => `<figure class="cf-thumb-edit"><img src="${im.url}" alt=""><button type="button" data-remove="${i}" class="cf-link">${esc(T('cf_remove'))}</button></figure>`)
        .join('');
      consent.hidden = !st.images.length;
      modal.querySelector('.cf-file').hidden = st.images.length >= MAX_IMAGES;
    };
    const relabel = () => {
      I18n.apply(modal);
      renderAbout();
      renderImages();
    };
    modal._relabel = relabel;
    window.addEventListener('langchange', relabel);
    relabel();
    if (st.subject && st.subject.kind === 'place') form.querySelector('input[value="other"]').checked = true;

    fileInput.addEventListener('change', async () => {
      showError('');
      const files = Array.from(fileInput.files || []);
      fileInput.value = '';
      for (const f of files) {
        if (st.images.length >= MAX_IMAGES) {
          showError(T('cf_err_too_many'));
          break;
        }
        if (f.size > MAX_FILE) {
          showError(T('cf_err_too_big', { name: f.name }));
          continue;
        }
        try {
          st.images.push(await shrink(f));
        } catch (e) {
          showError(T('cf_err_type', { name: f.name }));
        }
        renderImages();
      }
      if (st.images.some(() => true) && form.querySelector('input[name=type]:checked').value === 'correction' && !val('#cf-text')) {
        form.querySelector('input[value="photo"]').checked = true;
      }
    });

    modal.addEventListener('click', async (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        const [im] = st.images.splice(Number(rm.dataset.remove), 1);
        if (im) URL.revokeObjectURL(im.url);
        renderImages();
        return;
      }
      const act = e.target.closest('[data-act]');
      if (e.target === modal || (act && act.dataset.act === 'cancel')) {
        if (!st.busy) close();
      } else if (act && act.dataset.act === 'unlink') {
        st.subject = null;
        renderAbout();
      } else if (act && act.dataset.act === 'again') {
        const subj = st.subject;
        close();
        open(subj);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (st.busy) return;
      showError('');
      const text = val('#cf-text');
      if (!text && !st.images.length) return showError(T('cf_err_empty'));
      const cfg = config();
      if (!cfg || !cfg.endpoint || !cfg.public_key) return showError(T('cf_not_open'));
      const btn = form.querySelector('button[type=submit]');
      st.busy = true;
      btn.disabled = true;
      btn.textContent = T('cf_sending');
      try {
        const images = [];
        for (let i = 0; i < st.images.length; i++) {
          const im = st.images[i];
          images.push({ name: `${i + 1}.jpg`, type: 'image/jpeg', width: im.w, height: im.h, data: SealBox.b64(new Uint8Array(await im.blob.arrayBuffer())) });
        }
        const payload = {
          v: 1,
          created: new Date().toISOString(),
          lang: I18n.lang,
          type: form.querySelector('input[name=type]:checked').value,
          subject: st.subject ? { kind: st.subject.kind, id: st.subject.id, label: subjectLabel(st.subject) } : null,
          text,
          name: val('#cf-name'),
          contact: val('#cf-contact'),
          relation: val('#cf-relation'),
          consent: images.length ? form.querySelector('input[name=consent]').checked : null,
          site_version: window.SITE_VERSION || null,
          images,
        };
        const sealed = await SealBox.sealJSON(cfg.public_key, payload);
        if (sealed.length > MAX_TOTAL) throw Object.assign(new Error('size'), { msg: T('cf_err_too_big', { name: '' }) });
        const r = await fetch(cfg.endpoint.replace(/\/$/, '') + '/submit', {
          method: 'POST',
          headers: { 'X-Submit-Token': cfg.submit_token, 'Content-Type': 'application/octet-stream' },
          body: sealed,
        });
        if (r.status === 429) throw Object.assign(new Error('rate'), { msg: T('cf_err_rate') });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        st.images.forEach((im) => URL.revokeObjectURL(im.url));
        st.images = [];
        modal.querySelector('.cf-body').hidden = true;
        modal.querySelector('.cf-done').hidden = false;
      } catch (ex) {
        showError(ex.msg || T('cf_err_send'));
      } finally {
        st.busy = false;
        btn.disabled = false;
        btn.textContent = T('cf_send');
      }
    });
    setTimeout(() => form.querySelector('#cf-text').focus(), 30);
  }

  function close() {
    if (!modal) return;
    window.removeEventListener('langchange', modal._relabel);
    modal.querySelectorAll('.cf-thumb-edit img').forEach((img) => URL.revokeObjectURL(img.src));
    modal.remove();
    modal = null;
    document.body.classList.remove('cf-open');
  }

  // ------------------------------------------------------------ "Från släkten" i personpanelen
  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(I18n.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function drawerHtml(r) {
    let html = '';
    const mine = items().filter((c) => c.subject && c.subject.kind === 'person' && c.subject.id === r.id);
    if (mine.length) {
      html += `<div class="d-section-label">${esc(T('from_family'))}</div><div class="ff-list">`;
      html += mine
        .map((c) => {
          const who = [c.contributor && c.contributor.name ? c.contributor.name : T('from_family_anon'), c.contributor && c.contributor.relation ? `(${c.contributor.relation})` : '']
            .filter(Boolean)
            .join(' ');
          const imgs = (c.images || [])
            .map((im) => `<button class="ff-thumb" data-media="${esc(im.file)}" title="${esc(T('photo_open'))}" aria-label="${esc(T('photo_open'))}"><img alt=""></button>`)
            .join('');
          return `<div class="ff-item">${c.text ? `<p class="d-note">${esc(c.text).replace(/\n/g, '<br>')}</p>` : ''}${imgs ? `<div class="ff-thumbs">${imgs}</div>` : ''}<p class="ff-credit">— ${esc(who)}${c.date ? ', ' + esc(fmtDate(c.date)) : ''}</p></div>`;
        })
        .join('');
      html += '</div>';
    }
    html += `<div class="d-actions"><button class="d-action d-suggest" data-suggest-person="${esc(r.id)}">✎ ${esc(T('suggest_change'))}</button></div>`;
    return html;
  }

  const blobCache = new Map(); // media-sökväg -> Promise<objectURL>
  function mediaUrl(path) {
    if (!blobCache.has(path)) blobCache.set(path, SiteLock.fetchBlob(path, 'image/jpeg').then((b) => URL.createObjectURL(b)));
    return blobCache.get(path);
  }
  function hydrate(root) {
    root.querySelectorAll('.ff-thumb[data-media]').forEach((b) => {
      mediaUrl(b.dataset.media)
        .then((u) => (b.querySelector('img').src = u))
        .catch(() => (b.hidden = true));
    });
  }

  function lightbox(path) {
    const box = document.createElement('div');
    box.className = 'ff-lightbox';
    box.innerHTML = `<button class="drawer-close" aria-label="${esc(T('close'))}">×</button><img alt="">`;
    document.body.appendChild(box);
    mediaUrl(path).then((u) => (box.querySelector('img').src = u));
    const shut = () => {
      box.remove();
      window.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        shut();
      }
    };
    box.addEventListener('click', shut);
    window.addEventListener('keydown', onKey, true);
  }

  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-suggest-person]');
    if (p) return open({ kind: 'person', id: p.dataset.suggestPerson });
    const pl = e.target.closest('[data-suggest-place]');
    if (pl) return open({ kind: 'place', id: pl.dataset.suggestPlace });
    const th = e.target.closest('.ff-thumb[data-media]');
    if (th) return lightbox(th.dataset.media);
    if (e.target.closest('#contributeBtn')) open(null);
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && modal && !document.querySelector('.ff-lightbox')) {
        e.stopPropagation();
        close();
      }
    },
    true
  );
  window.addEventListener('dataready', () => {
    const b = document.getElementById('contributeBtn');
    if (b) b.hidden = false;
  });

  return { open, close, drawerHtml, hydrate };
})();
