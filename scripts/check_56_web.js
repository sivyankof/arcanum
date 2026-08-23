/* Прокликивание интерактива (задача 56, пункт 6б процесса) — один полный проход по приложению.
   Отличие от shoot_56.js: тот снимает статичные кадры, этот ЖМЁТ и проверяет реакцию.

   Запуск (dev-сервер поднят заново с --clear):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_56_web.js

   ⚠️ Карта дня качается ±6 px бесконечно — обычный .click() ждёт неподвижности и падает
   по таймауту 30 с; для неё force: true (правило AGENTS.md).
   ⚠️ Сценарий сначала прогоняется на СЛОМАННОМ коде и обязан покраснеть. */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8081';
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot'];

const seed = (extra = {}) =>
  JSON.stringify({
    state: {
      themeMode: 'dark', lang: 'ru', installSeed: 12345,
      profile: { onboarded: true, name: 'Артём', birthDate: '1990-05-14', birthArcanaId: 'justice' },
      premium: { active: false, source: 'none', until: null },
      lessonsProgress: Object.fromEntries(M12.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }])),
      srs: Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }])),
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      history: [], spreadsHistory: [], xp: 400, streak: 5,
      ...extra,
    },
    version: 11,
  });

let pass = 0;
const fails = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fails.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  const warns = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const open = async (route, state = seed()) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    return page.url().replace(BASE, '');
  };
  const tap = async (text, { exact = false, ...opts } = {}) => {
    const el = page.getByText(text, { exact }).first();
    await el.click({ force: true, timeout: 8000, ...opts });
    await page.waitForTimeout(900);
  };
  const body = () => page.locator('body').innerText();
  /** Ждёт появления текста на экране до 6 с — вместо фиксированной паузы. */
  const waitForText = async (text, ms = 6000) => {
    const upper = text.toUpperCase();
    for (let t = 0; t < ms; t += 400) {
      if ((await body()).toUpperCase().includes(upper)) return true;
      await page.waitForTimeout(400);
    }
    return false;
  };

  console.log('\n=== 1. Пять табов ===');
  await open('/');
  // ⚠️ маркер «Карты» — «ИЗУЧЕНО», а не плейсхолдер поиска: placeholder живёт в атрибуте input
  // и в innerText не попадает, поэтому первая редакция сценария падала на исправном экране
  for (const [label, marker] of [['Курс', 'МОДУЛЬ'], ['Карты', 'ИЗУЧЕНО'], ['Расклады', 'ПРАКТИКА'], ['Профиль', 'ВАШ ПУТЬ'], ['Сегодня', 'КАРТА ДНЯ']]) {
    // ⚠️ по табам кликаем ТОЧНЫМ совпадением: getByText(..., {exact:false}) регистронезависим
    // и на экране «Курс» первым ловил слово «карт» в подписи модуля, а не таб внизу —
    // url при этом не менялся, и падал следующий по списку таб
    await tap(label, { exact: true });
    // ⚠️ ждём МАРКЕР, а не фиксированную паузу: сетка 78 карт с изображениями отрисовывается
    // заметно дольше остальных экранов, и на паузе 900 мс исправный таб «Карты» выглядел сломанным
    // (url уже /cards, а в DOM ещё предыдущий экран)
    const ok = await waitForText(marker);
    check(`таб «${label}» открывает свой экран`, ok, `нет «${marker}» за 6 с`);
  }

  console.log('\n=== 2. Справочник: фильтры и переход на карту ===');
  await open('/cards');
  for (const [chip, expected] of [['Старшие', 22], ['Жезлы', 14], ['Кубки', 14], ['Все', 78]]) {
    await tap(chip);
    const b = await body();
    check(`фильтр «${chip}»`, b.includes(String(expected)), `не видно числа ${expected}`);
  }
  await tap('Дурак');
  check('тап по карте открывает её страницу', page.url().includes('/card/'), `url ${page.url().replace(BASE, '')}`);

  console.log('\n=== 3. Карта: вкладки сфер ===');
  for (const t of ['Любовь', 'Работа', 'Здоровье', 'Общее']) {
    await tap(t);
    check(`вкладка «${t}»`, (await body()).length > 200);
  }

  console.log('\n=== 4. Урок ===');
  await open('/lesson/m1l1');
  check('урок открылся', (await body()).toUpperCase().includes('УРОК'));

  console.log('\n=== 5. Тренажёр ===');
  await open('/review');
  check('тренажёр открылся', (await body()).includes('Тренажёр'));

  console.log('\n=== 6. Расклад «Три карты» до раскладки ===');
  await open('/spreads/three-card');
  check('экран расклада открылся', (await body()).toUpperCase().includes('РАЗЛОЖИТЬ'));
  await tap('РАЗЛОЖИТЬ');
  const afterDeal = await body();
  check('после «Разложить» появились позиции', /ПРОШЛОЕ|НАСТОЯЩЕЕ|БУДУЩЕЕ/i.test(afterDeal), afterDeal.slice(0, 80));

  console.log('\n=== 7. Гейт Premium ===');
  await open('/spreads/celtic-cross');
  check('премиум-расклад без права уводит на пейвол', page.url().includes('/paywall'), `url ${page.url().replace(BASE, '')}`);

  console.log('\n=== 8. Смена темы и языка ===');
  await open('/settings');
  // ⚠️ тема — ТУМБЛЕР одним тапом по строке (settings.tsx: onPress меняет dark↔light), а не пикер.
  // Первая редакция тапала строку, а потом ещё раз по значению «Светлая» — и возвращала тёмную,
  // из-за чего исправный экран выглядел сломанным
  await tap('Тема');
  check('тема переключилась на светлую одним тапом', (await body()).includes('Светлая'));
  await tap('Тема');
  check('повторный тап возвращает тёмную', (await body()).includes('Тёмная'));
  await tap('Язык');
  await page.waitForTimeout(700);
  await tap('English');
  const en = await body();
  check('язык переключился на английский', /Settings|Theme|Language/i.test(en), en.slice(0, 80));

  console.log('\n=== Консоль ===');
  const realErrors = errors.filter((e) => !/DevTools|source map|Download the React/i.test(e));
  check('красных ошибок нет', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  console.log(`  warnings: ${warns.length}`);
  [...new Set(warns)].slice(0, 8).forEach((w) => console.log(`    · ${w.slice(0, 140)}`));

  console.log(`\nИтог: ${pass} прошло, ${fails.length} упало (из ${pass + fails.length})`);
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
