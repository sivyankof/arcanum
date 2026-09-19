// Общий клиент App Store Connect API (JWT ES256) для scripts/asc_status.js и scripts/asc_sync.js.
// Ключ и идентификаторы — те же, что в submit-профиле eas.json; файл .p8 лежит вне репозитория.
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const KEY_ID = 'V55RK5Z8R9';
const ISSUER = 'e719c52a-3121-47eb-8d2a-768a1843d1c0';
const APP_ID = '6805994267';
const KEY_PATH = 'C:/Users/Artem/Documents/keys/AuthKey_V55RK5Z8R9.p8';
// язык store-listing.md → локаль ASC (основной язык витрины — en-US, решение 29.08)
const LOCALE = { en: 'en-US', ru: 'ru', es: 'es-MX', pt: 'pt-BR' };

let pem = null;
function token() {
  pem = pem || fs.readFileSync(KEY_PATH, 'utf8');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const p = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const s = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key: pem, dsaEncoding: 'ieee-p1363' });
  return `${h}.${p}.${s.toString('base64url')}`;
}

/** Сырой запрос: не бросает на 4xx/5xx, отдаёт {status, body, json}.
 *  raw — запрос на чужой URL (загрузка частей кадра по uploadOperations) без заголовка авторизации. */
function request(method, url, { body, headers, raw } = {}) {
  const u = new URL(url.startsWith('http') ? url : 'https://api.appstoreconnect.apple.com' + url);
  const h = { ...(headers || {}) };
  if (!raw) h.Authorization = `Bearer ${token()}`;
  let data = null;
  if (body !== undefined && body !== null) {
    data = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    if (!Buffer.isBuffer(body)) h['Content-Type'] = 'application/json';
    h['Content-Length'] = data.length;
  }
  return new Promise((resolve, reject) => {
    const r = https.request({ method, host: u.host, path: u.pathname + u.search, headers: h }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch { /* не JSON */ }
        resolve({ status: res.statusCode, body: buf, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

/** Запрос, который бросает на ошибке с телом ответа — для записи, где молчаливый отказ опасен. */
async function api(method, url, body, opts = {}) {
  const r = await request(method, url, { body, ...opts });
  if (r.status >= 400) throw new Error(`${method} ${url.split('?')[0]} → ${r.status}: ${r.body.slice(0, 1500)}`);
  return r.json;
}

module.exports = { APP_ID, LOCALE, token, request, api };
