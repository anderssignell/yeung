// Lösenordsskydd för sajten.
//
// All data (data/*.enc) är krypterad med AES-GCM. Nyckeln till datat ligger i
// data/lock.json, i sin tur krypterad med en nyckel som räknas fram ur
// lösenordet (PBKDF2-SHA256). Utan rätt lösenord går datat inte att läsa,
// varken på sajten eller i det publika GitHub-repot.
//
// Saknas data/lock.json (t.ex. vid lokal utveckling) läses de okrypterade
// .json-filerna direkt.
window.SiteLock = (function () {
  const STORE_KEY = 'yeung-site-key';
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let dataKey = null; // CryptoKey, eller null i okrypterat läge
  let plain = false;
  let lock = null;

  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const v = () => (window.SITE_VERSION ? '?v=' + window.SITE_VERSION : '?v=' + Date.now());

  function store(get, set) {
    try {
      return get();
    } catch (e) {
      return set;
    }
  }

  async function importKey(raw) {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['decrypt']);
  }

  async function checkKey(key) {
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(lock.check_iv) }, key, b64(lock.check));
      return dec.decode(pt) === 'yeung-ok';
    } catch (e) {
      return false;
    }
  }

  async function keyFromPassword(password) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    const kek = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(lock.salt), iterations: lock.iterations, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    try {
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(lock.wrap_iv) }, kek, b64(lock.wrapped));
      return { key: await importKey(raw), raw };
    } catch (e) {
      return null; // fel lösenord
    }
  }

  function showForm() {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'lock-screen';
      wrap.innerHTML = `
        <form class="lock-card" autocomplete="on">
          <div class="lock-mark zh" aria-hidden="true">楊</div>
          <h1>Beishan Yang</h1>
          <p class="lock-lead">Familjens släktsajt är skyddad med lösenord. Fråga Anders om du behöver det.</p>
          <label for="lock-password">Lösenord</label>
          <input id="lock-password" name="password" type="password" autocomplete="current-password" required autofocus>
          <label class="lock-remember"><input id="lock-remember" type="checkbox" checked> Kom ihåg mig på den här enheten</label>
          <button type="submit" id="lock-submit">Lås upp</button>
          <p class="lock-error" id="lock-error" role="alert" hidden></p>
        </form>`;
      document.body.appendChild(wrap);
      document.body.classList.add('is-locked');
      const form = wrap.querySelector('form');
      const input = wrap.querySelector('#lock-password');
      const err = wrap.querySelector('#lock-error');
      const btn = wrap.querySelector('#lock-submit');
      input.focus();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.hidden = true;
        btn.disabled = true;
        btn.textContent = 'Låser upp …';
        const res = await keyFromPassword(input.value);
        btn.disabled = false;
        btn.textContent = 'Lås upp';
        if (!res) {
          err.textContent = 'Fel lösenord. Kontrollera stora och små bokstäver och försök igen.';
          err.hidden = false;
          input.select();
          return;
        }
        const remember = wrap.querySelector('#lock-remember').checked;
        const saved = toB64(res.raw);
        store(() => (remember ? localStorage : sessionStorage).setItem(STORE_KEY, saved));
        wrap.remove();
        document.body.classList.remove('is-locked');
        resolve(res.key);
      });
    });
  }

  // Körs före all dataladdning. Löses när sajten är upplåst.
  async function unlock() {
    const r = await fetch('data/lock.json' + v(), { cache: 'no-store' });
    if (!r.ok) {
      plain = true;
      return;
    }
    lock = await r.json();
    const saved = store(() => localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY), null);
    if (saved) {
      const key = await importKey(b64(saved)).catch(() => null);
      if (key && (await checkKey(key))) {
        dataKey = key;
        return;
      }
      forget();
    }
    dataKey = await showForm();
  }

  async function fetchJSON(name) {
    if (plain) return fetch('data/' + name + v(), { cache: 'no-store' }).then((r) => r.json());
    const buf = new Uint8Array(await fetch('data/' + name + '.enc' + v(), { cache: 'no-store' }).then((r) => r.arrayBuffer()));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, dataKey, buf.slice(12));
    return JSON.parse(dec.decode(pt));
  }

  function forget() {
    store(() => {
      localStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(STORE_KEY);
    });
  }

  function lockNow() {
    forget();
    location.reload();
  }

  return { unlock, fetchJSON, lockNow, isEncrypted: () => !plain };
})();
