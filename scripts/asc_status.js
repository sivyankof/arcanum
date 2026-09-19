// Статус заявки в App Store Connect без входа в веб (только чтение, ASC API).
// Запуск: node scripts/asc_status.js
const { APP_ID, request } = require('./lib/asc');

(async () => {
  const paths = [
    `/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,appVersionState,createdDate,releaseType`,
    `/v1/apps/${APP_ID}/reviewSubmissions?limit=5`,
    `/v1/apps/${APP_ID}/subscriptionGroups`,
    // обработка залитых сборок: PROCESSING → VALID (только VALID выбирается в версии)
    `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=3&fields[builds]=version,processingState,uploadedDate`,
  ];
  for (const p of paths) {
    const r = await request('GET', p);
    console.log('###', p, r.status);
    try { console.log(JSON.stringify(JSON.parse(r.body), null, 1).slice(0, 6000)); } catch { console.log(r.body.slice(0, 2000)); }
  }
})();
