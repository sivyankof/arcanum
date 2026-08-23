/* Веб-проверка тренажёра после переноса формулы подсказки в reviewPrompt (задача 55, пункт 6б).
   Правка рефакторная — поведение экрана обязано остаться прежним, и проверяется именно оно:
   рубашка направления toCard прячет имя карты под «···», а лицо toMeaning имя показывает.

   Запуск (рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_55_web.js [каталог-скриншотов]

   Сид: goto → evaluate → reload (addInitScript срабатывает на каждой навигации, урок 39);
   installSeed НЕ 0 (нулевой — признак свежей установки, onRehydrateStorage затирает язык).
   Форма сида взята из scripts/check_53_web.js — сочинять её нельзя (урок 9 сессии веб-проверок).

   ⚠️ Направление карточки (toMeaning/toCard) выпадает случайно у ПОВТОРЯЕМЫХ карт (buildSession,
   rng = Math.random), поэтому сценарий не гадает: он открывает экран несколько раз и разбирает
   то, что выпало, пока не увидит оба направления. Новые карты всегда toMeaning — колода
   сидируется просроченными состояниями, иначе toCard не выпал бы вовсе. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'docs/screenshots/55';
const BASE = 'http://localhost:8081';

// карты уроков М2 (М1 карт не разбирает) — те же восемь, что в сценарии 53
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot'];
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
// русские имена этих карт — ищем их в подсказке рубашки (маска обязана их убрать).
// ⚠️ Сравнение в ВЕРХНЕМ регистре: плашка имени на экране набрана капсом («МАГ»), и первый
// прогон 23.08 покраснел не на коде, а на этой мелочи — проверка не находила ни одного имени
// и объявляла экран пустым
const RU_NAMES = ['Дурак', 'Маг', 'Верховная Жрица', 'Императрица', 'Император', 'Иерофант', 'Влюблённые', 'Колесница'].map(
  (n) => n.toUpperCase(),
);

const dueSrs = () =>
  Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }]));

const seed = (extra = {}) =>
  JSON.stringify({
    state: {
      themeMode: 'dark',
      lang: 'ru',
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём' },
      premium: { active: false, source: 'none', until: null },
      lessonsProgress: Object.fromEntries(M12.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }])),
      srs: dueSrs(),
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      spreadsHistory: [],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 11,
  });

let pass = 0;
const fails = [];
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  async function open(route, state) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const w = await page.evaluate(() => window.innerWidth);
    if (w !== 390) throw new Error(`вьюпорт ${w}, не 390 — снимок недостоверен`);
    return page.url().replace(BASE, '');
  }
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

  console.log('\n=== Тренажёр: подсказка и маска (спека 55) ===');
  const href = await open('/review', seed());
  check('/review открывается', href.includes('/review'), `фактически ${href}`);

  // разбираем до 12 открытий: у повторяемых карт направление случайное
  let sawToCard = false;
  let sawToMeaning = false;
  let leaked = null;
  let emptyHint = null;
  let sawToCardShot = false;
  let sawToMeaningShot = false;
  for (let i = 0; i < 12 && !(sawToCard && sawToMeaning); i++) {
    if (i > 0) await open('/review', seed());
    const body = await page.locator('body').innerText();
    const upper = body.toUpperCase();
    const shownName = RU_NAMES.find((n) => upper.includes(n));
    if (body.includes('···')) {
      // рубашка toCard: маска на месте, имени карты в тексте быть не должно
      sawToCard = true;
      if (shownName) leaked = shownName;
      if (!sawToCardShot) {
        await shot('review-tocard-dark');
        sawToCardShot = true;
      }
    } else if (shownName) {
      // лицо toMeaning: имя карты показано, маски нет
      sawToMeaning = true;
      if (!sawToMeaningShot) {
        await shot('review-tomeaning-dark');
        sawToMeaningShot = true;
      }
    } else {
      emptyHint = body.slice(0, 120);
    }
  }

  check('направление toCard встретилось (рубашка с маской «···»)', sawToCard);
  check('направление toMeaning встретилось (лицо с названием карты)', sawToMeaning);
  check('на рубашке toCard имени карты нет — маска работает', sawToCard && !leaked, leaked ? `видно «${leaked}»` : '');
  check('экран всегда показывает карточку (не пустое состояние)', emptyHint === null, emptyHint || '');

  // светлая тема — тот же экран
  await open('/review', seed({ themeMode: 'light' }));
  await shot('review-light');
  const lightBody = await page.locator('body').innerText();
  check('светлая тема: карточка на месте', lightBody.length > 40);

  console.log('\n=== Консоль ===');
  const real = consoleErrors.filter((e) => !/Download the React DevTools|source map/i.test(e));
  check('красных ошибок в консоли нет', real.length === 0, real.slice(0, 3).join(' | '));

  console.log(`\nИтог: ${pass} прошло, ${fails.length} упало (из ${pass + fails.length})`);
  if (fails.length) fails.forEach((f) => console.log(`  ✗ ${f}`));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
