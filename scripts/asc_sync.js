// Заливка витрины App Store Connect из docs/store-listing.md и docs/store/apple/ через ASC API
// (без браузера; задача 72, сабмит №3). Веб нужен только для треда App Review и кнопок отправки.
//   node scripts/asc_sync.js diff          — расхождения ASC ↔ документ (только чтение)
//   node scripts/asc_sync.js text          — записать описание/промо/ключевые слова, название и
//                                            подзаголовок, Review Notes, вторичную категорию Reference
//   node scripts/asc_sync.js shots [en,ru] — перезалить кадры 6,9″ (APP_IPHONE_67) из docs/store/apple/<lang>/
//   node scripts/asc_sync.js verify        — сверить кадры в ASC с локальными по имени, порядку и md5
//   node scripts/asc_sync.js build <N>     — выбрать сборку N (1.0.0) в версии
// Версия — VERSION ниже; после каждой записи — повторное чтение и сверка.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { APP_ID, LOCALE, api } = require('./lib/asc');
const { parseListing, reviewNotes } = require('./lib/storeListing');

const VERSION = '1.0';
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'docs/store/apple');
const SHOT_TYPE = 'APP_IPHONE_67'; // слот 6,7/6,9″ — принимает 1290×2796 (спека 63)
const SECONDARY = 'REFERENCE'; // решение 18.09, задача 72
const get = (u) => api('GET', u);
const patch = (u, b) => api('PATCH', u, b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function doc() {
  const md = fs.readFileSync(path.join(ROOT, 'docs/store-listing.md'), 'utf8');
  const fields = {};
  for (const f of parseListing(md)) (fields[f.lang] ||= {})[f.field] = f.text;
  return { fields, notes: reviewNotes(md) };
}

async function ctx() {
  const vers = await get(`/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const ver = vers.data.find((v) => v.attributes.versionString === VERSION);
  if (!ver) throw new Error(`версия ${VERSION} не найдена`);
  const vlocs = (await get(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`)).data;
  const infos = (await get(`/v1/apps/${APP_ID}/appInfos?include=primaryCategory,secondaryCategory`)).data;
  const info = infos.find((i) => i.attributes.appStoreState !== 'READY_FOR_SALE') || infos[0];
  const ilocs = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations?limit=50`)).data;
  const review = (await get(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data;
  const build = (await get(`/v1/appStoreVersions/${ver.id}/build`)).data;
  return { ver, vlocs, info, ilocs, review, build };
}

/** Список правок «ASC → документ». Пустой список = витрина совпадает с документом. */
function plan(c, d) {
  const out = [];
  for (const [lang, loc] of Object.entries(LOCALE)) {
    const f = d.fields[lang];
    const vl = c.vlocs.find((x) => x.attributes.locale === loc);
    const il = c.ilocs.find((x) => x.attributes.locale === loc);
    if (!vl || !il) { out.push({ kind: 'MISSING', loc }); continue; }
    const diff = (have, want) => Object.fromEntries(Object.entries(want).filter(([k, v]) => have[k] !== v));
    const va = diff(vl.attributes, { description: f['полное описание'], keywords: f['ключевые слова iOS'], promotionalText: f['промо-текст iOS'] });
    if (Object.keys(va).length) out.push({ kind: 'appStoreVersionLocalizations', id: vl.id, loc, attributes: va, before: vl.attributes });
    const ia = diff(il.attributes, { name: f['название'], subtitle: f['подзаголовок iOS'] });
    if (Object.keys(ia).length) out.push({ kind: 'appInfoLocalizations', id: il.id, loc, attributes: ia, before: il.attributes });
  }
  if (c.review.attributes.notes !== d.notes) out.push({ kind: 'appStoreReviewDetails', id: c.review.id, attributes: { notes: d.notes }, before: c.review.attributes });
  const sec = c.info.relationships.secondaryCategory.data;
  if (!sec || sec.id !== SECONDARY) out.push({ kind: 'secondaryCategory', id: c.info.id, before: { id: sec && sec.id } });
  return out;
}

const short = (s) => {
  if (typeof s !== 'string') return String(s);
  const n = [...s].length;
  return n > 90 ? `${s.slice(0, 90).replace(/\n/g, '⏎')}… (${n})` : s;
};

async function textCmd(write) {
  const d = doc();
  const c = await ctx();
  console.log(`версия ${VERSION}: ${c.ver.attributes.appStoreState}, сборка: ${c.build ? c.build.attributes.version : '—'}`);
  console.log(`категории: ${c.info.relationships.primaryCategory.data?.id} / ${c.info.relationships.secondaryCategory.data?.id}`);
  const ch = plan(c, d);
  for (const x of ch) {
    console.log(`\n[${x.kind}] ${x.loc || ''}`);
    for (const k of Object.keys(x.attributes || {})) console.log(`  ${k}:\n    было:  ${short(x.before[k])}\n    стало: ${short(x.attributes[k])}`);
    if (x.kind === 'secondaryCategory') console.log(`  было: ${x.before.id} → ${SECONDARY}`);
  }
  if (!ch.length) console.log('\nрасхождений нет');
  if (!write) return;
  for (const x of ch) {
    if (x.kind === 'MISSING') throw new Error(`нет локали ${x.loc} — завести в ASC руками`);
    if (x.kind === 'secondaryCategory') {
      await patch(`/v1/appInfos/${x.id}`, { data: { type: 'appInfos', id: x.id, relationships: { secondaryCategory: { data: { type: 'appCategories', id: SECONDARY } } } } });
    } else {
      await patch(`/v1/${x.kind}/${x.id}`, { data: { type: x.kind, id: x.id, attributes: x.attributes } });
    }
    console.log('записано:', x.kind, x.loc || '');
  }
  const left = plan(await ctx(), d);
  console.log(`\nповторная сверка после записи — расхождений: ${left.length}`);
  if (left.length) process.exitCode = 1;
}

async function shotSet(c, loc) {
  const vl = c.vlocs.find((x) => x.attributes.locale === loc);
  const sets = (await get(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets?limit=50`)).data;
  const set = sets.find((s) => s.attributes.screenshotDisplayType === SHOT_TYPE);
  if (!set) throw new Error(`${loc}: нет набора ${SHOT_TYPE}`);
  return set;
}

const localShots = (lang) => fs.readdirSync(path.join(SHOTS, lang)).filter((f) => f.endsWith('.jpg')).sort();

async function shotsCmd(langs) {
  const c = await ctx();
  for (const lang of langs) {
    const set = await shotSet(c, LOCALE[lang]);
    const files = localShots(lang);
    if (!files.length || files.length > 10) throw new Error(`${lang}: кадров ${files.length}, допустимо 1–10`);
    // в наборе не больше 10 кадров — старые удаляются ДО заливки
    for (const o of (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data) await api('DELETE', `/v1/appScreenshots/${o.id}`);
    const ids = [];
    for (const f of files) {
      const buf = fs.readFileSync(path.join(SHOTS, lang, f));
      const created = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
      for (const op of created.attributes.uploadOperations) {
        const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
        await api(op.method, op.url, buf.subarray(op.offset, op.offset + op.length), { headers, raw: true });
      }
      await patch(`/v1/appScreenshots/${created.id}`, { data: { type: 'appScreenshots', id: created.id, attributes: { uploaded: true, sourceFileChecksum: md5(buf) } } });
      ids.push(created.id);
    }
    // порядок витрины = порядок в отношении набора, а не порядок завершения закачек
    await patch(`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: 'appScreenshots', id })) });
    for (let i = 0; i < 40; i++) {
      const shots = (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`)).data;
      if (shots.every((s) => ['COMPLETE', 'FAILED'].includes(s.attributes.assetDeliveryState?.state))) break;
      await sleep(3000);
    }
  }
  await verifyCmd(langs);
}

async function verifyCmd(langs) {
  const c = await ctx();
  let bad = 0;
  for (const lang of langs) {
    const loc = LOCALE[lang];
    const shots = (await get(`/v1/appScreenshotSets/${(await shotSet(c, loc)).id}/appScreenshots?limit=50`)).data;
    const files = localShots(lang);
    const names = shots.map((s) => s.attributes.fileName);
    const wrongSum = shots.filter((s) => !files.includes(s.attributes.fileName)
      || s.attributes.sourceFileChecksum !== md5(fs.readFileSync(path.join(SHOTS, lang, s.attributes.fileName))));
    const notReady = shots.filter((s) => s.attributes.assetDeliveryState?.state !== 'COMPLETE');
    const ok = JSON.stringify(names) === JSON.stringify(files) && !wrongSum.length && !notReady.length;
    if (!ok) bad++;
    console.log(`${loc}: ${ok ? 'OK' : 'ПРОБЛЕМА'} — ${names.length} кадров, порядок ${JSON.stringify(names) === JSON.stringify(files) ? 'совпал' : 'НЕ совпал'}, md5 не совпал: ${wrongSum.length}, не обработано: ${notReady.length}`);
  }
  if (bad) process.exitCode = 1;
}

async function buildCmd(n) {
  const b = (await get(`/v1/builds?filter[app]=${APP_ID}&filter[version]=${n}&filter[preReleaseVersion.version]=1.0.0`)).data[0];
  if (!b) throw new Error(`сборка ${n} не найдена`);
  console.log(`сборка ${n}: ${b.attributes.processingState}, usesNonExemptEncryption=${b.attributes.usesNonExemptEncryption}, expired=${b.attributes.expired}`);
  if (b.attributes.processingState !== 'VALID') throw new Error('сборка ещё не обработана — выбрать можно только VALID');
  const c = await ctx();
  await patch(`/v1/appStoreVersions/${c.ver.id}/relationships/build`, { data: { type: 'builds', id: b.id } });
  const after = (await get(`/v1/appStoreVersions/${c.ver.id}/build`)).data;
  console.log(`в версии ${VERSION} теперь сборка ${after.attributes.version} — ${after.id === b.id ? 'OK' : 'НЕ ТА'}`);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  const langs = arg ? arg.split(',') : Object.keys(LOCALE);
  if (cmd === 'diff') await textCmd(false);
  else if (cmd === 'text') await textCmd(true);
  else if (cmd === 'shots') await shotsCmd(langs);
  else if (cmd === 'verify') await verifyCmd(langs);
  else if (cmd === 'build') await buildCmd(arg);
  else console.log('команды: diff | text | shots [langs] | verify [langs] | build <N>');
})().catch((e) => { console.error(e.message); process.exit(1); });
