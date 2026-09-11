// Статус заявки в App Store Connect без входа в веб (только чтение, ASC API, JWT ES256).
// Ключ и идентификаторы — те же, что в submit-профиле eas.json. Запуск: node scripts/asc_status.js
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const KEY_ID = 'V55RK5Z8R9';
const ISSUER = 'e719c52a-3121-47eb-8d2a-768a1843d1c0';
const APP_ID = '6805994267';
const pem = fs.readFileSync('C:/Users/Artem/Documents/keys/AuthKey_V55RK5Z8R9.p8', 'utf8');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
const payload = b64({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key: pem, dsaEncoding: 'ieee-p1363' });
const token = `${header}.${payload}.${sig.toString('base64url')}`;

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ host: 'api.appstoreconnect.apple.com', path, headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  const paths = [
    `/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,appVersionState,createdDate,releaseType`,
    `/v1/apps/${APP_ID}/reviewSubmissions?limit=5`,
    `/v1/apps/${APP_ID}/subscriptionGroups`,
  ];
  for (const p of paths) {
    const r = await get(p);
    console.log('###', p, r.status);
    try { console.log(JSON.stringify(JSON.parse(r.body), null, 1).slice(0, 6000)); } catch { console.log(r.body.slice(0, 2000)); }
  }
})();
