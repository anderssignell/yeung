// "Förseglade paket" för bidrag från släkten.
//
// Webbläsaren krypterar varje bidrag (text + bilder) med en slumpad AES-GCM-
// nyckel. Den nyckeln krypteras i sin tur med en nyckel som tas fram med ECDH
// (P-256) mellan en engångsnyckel och Anders publika granskningsnyckel. Bara
// den som har Anders privata nyckel (låst med hans adminlösenfras) kan öppna
// paketet; servern som tar emot det kan inte läsa något.
//
// Format (binärt):
//   "YSB1" | rubrikens längd (4 byte, big-endian) | rubrik (JSON) | chiffertext
//   rubrik = { v, kem, epk, salt, wiv, wk, iv }
// Samma format läses av tools/import_contributions.py.
window.SealBox = (function () {
  const MAGIC = [0x59, 0x53, 0x42, 0x31]; // "YSB1"
  const INFO = new TextEncoder().encode('yeung-sealbox-v1');
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function kek(privateKey, publicKey, salt, usage) {
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
    const base = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
  }

  // Kryptera bytes till mottagarens publika nyckel (JWK). Returnerar Uint8Array.
  async function seal(publicJwk, bytes) {
    const pub = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrapKey = await kek(eph.privateKey, pub, salt, 'encrypt');
    const contentKey = crypto.getRandomValues(new Uint8Array(32));
    const wiv = crypto.getRandomValues(new Uint8Array(12));
    const wk = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wiv }, wrapKey, contentKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ck = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ck, bytes));
    const header = enc.encode(
      JSON.stringify({
        v: 1,
        kem: 'ECDH-P256-HKDF-SHA256',
        epk: b64(await crypto.subtle.exportKey('raw', eph.publicKey)),
        salt: b64(salt),
        wiv: b64(wiv),
        wk: b64(wk),
        iv: b64(iv),
      })
    );
    const out = new Uint8Array(8 + header.length + ct.length);
    out.set(MAGIC, 0);
    new DataView(out.buffer).setUint32(4, header.length);
    out.set(header, 8);
    out.set(ct, 8 + header.length);
    return out;
  }

  // Öppna ett paket med den privata nyckeln (CryptoKey, ECDH, 'deriveBits').
  async function open(privateKey, blob) {
    const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
    if (MAGIC.some((m, i) => bytes[i] !== m)) throw new Error('Okänt format');
    const n = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4);
    const h = JSON.parse(dec.decode(bytes.subarray(8, 8 + n)));
    const epk = await crypto.subtle.importKey('raw', unb64(h.epk), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const wrapKey = await kek(privateKey, epk, unb64(h.salt), 'decrypt');
    const contentKey = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(h.wiv) }, wrapKey, unb64(h.wk));
    const ck = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(h.iv) }, ck, bytes.subarray(8 + n)));
  }

  const sealJSON = (publicJwk, obj) => seal(publicJwk, enc.encode(JSON.stringify(obj)));
  const openJSON = async (privateKey, blob) => JSON.parse(dec.decode(await open(privateKey, blob)));

  return { seal, open, sealJSON, openJSON, b64, unb64 };
})();
