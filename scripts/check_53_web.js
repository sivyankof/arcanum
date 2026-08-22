/* Веб-проверка гейтов Premium (задача 53а, пункт 6а/6б процесса).
   Проверяет таблицу гейтов спеки docs/specs/53-premium.md целиком.
   Запуск: NODE_PATH=<кэш npx> node check-53.js [каталог-скриншотов]
   Сид: goto → evaluate → reload (addInitScript срабатывает на каждой навигации, урок 39).
   installSeed НЕ 0 — нулевой это признак свежей установки, onRehydrateStorage затирает язык (урок 47). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'docs/screenshots/53';
const BASE = 'http://localhost:8081';
const TODAY = new Date().toISOString().slice(0, 10);

const NONE = { active: false, source: 'none', until: null };
const DEV = { active: true, source: 'dev', until: null };

// пройден весь курс: все узлы done → в premium-модуле «текущего» узла нет.
// Для проверки узла «текущий внутри premium-модуля» проходим ровно М1–М2 (10 уроков).
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const progress = (ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));

// колода тренажёра = карты пройденных уроков (М1 карт не разбирает, М2 даёт ровно эти восемь);
// чтобы карты были «к повторению», ставим due в прошлом
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot'];
const dueSrs = () => Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }]));

function seed(extra = {}) {
  return JSON.stringify({
    state: {
      themeMode: 'dark',
      lang: 'ru',
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём' },
      premium: NONE,
      lessonsProgress: progress(M12),
      srs: {},
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      spreadsHistory: [],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 11,
  });
}

let pass = 0;
const fails = [];
const notes = [];
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

  /** Ставит состояние и открывает путь. Возвращает фактический href после оседания роутера. */
  async function open(route, state) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const w = await page.evaluate(() => window.innerWidth);
    if (w !== 390) throw new Error(`вьюпорт ${w}, не 390 — снимок недостоверен (урок 16)`);
    return page.url().replace(BASE, '');
  }
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
  const shotFull = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true });
  const onPaywall = async () => (await page.locator('text=Arcanum Premium').count()) > 0 && page.url().includes('/paywall');

  console.log('\n=== 1. Гейты маршрутов прямой ссылкой ===');
  let href = await open('/lesson/m3l1', seed());
  check('/lesson/m3l1 без права → пейвол', await onPaywall(), `фактически ${href}`);
  await shot('gate-lesson-paywall-dark');

  href = await open('/lesson/m3l1', seed({ premium: DEV }));
  check('/lesson/m3l1 С правом → урок открыт', !href.includes('/paywall') && href.includes('m3l1'), `фактически ${href}`);

  href = await open('/lesson/m1l1', seed());
  check('/lesson/m1l1 (free-модуль) без права → урок открыт', !href.includes('/paywall'), `фактически ${href}`);

  href = await open('/spreads/celtic-cross', seed());
  check('/spreads/celtic-cross без права → пейвол', await onPaywall(), `фактически ${href}`);

  href = await open('/spreads/celtic-cross', seed({ premium: DEV }));
  check('/spreads/celtic-cross С правом → расклад открыт', !href.includes('/paywall'), `фактически ${href}`);

  href = await open('/spreads/three-card', seed());
  check('/spreads/three-card (free) без права → расклад открыт', !href.includes('/paywall'), `фактически ${href}`);

  console.log('\n=== 2. Лунный гейт проверяется ПЕРВЫМ ===');
  href = await open('/spreads/full-moon', seed({ devMoonOpen: false }));
  check('/spreads/full-moon ВНЕ окна → назад в список (не пейвол)', !href.includes('/paywall'), `фактически ${href}`);

  href = await open('/spreads/full-moon', seed({ devMoonOpen: true }));
  check('/spreads/full-moon В окне без права → пейвол', await onPaywall(), `фактически ${href}`);

  href = await open('/spreads/full-moon', seed({ devMoonOpen: true, premium: DEV }));
  check('/spreads/full-moon В окне С правом → расклад открыт', !href.includes('/paywall'), `фактически ${href}`);

  href = await open('/spreads/new-moon', seed({ devMoonOpen: true }));
  check('/spreads/new-moon (free) в окне без права → расклад открыт', !href.includes('/paywall'), `фактически ${href}`);

  console.log('\n=== 3. Сохранённый premium-расклад из дневника (решение 5: не отбираем сделанного) ===');
  const saved = [{ ts: 1755000000000, date: '2026-08-12', spreadId: 'celtic-cross',
    cards: ['fool','magician','empress','emperor','lovers','chariot','strength','hermit','justice','moon'].map((c) => ({ cardId: c, reversed: false })) }];
  href = await open('/spread/1755000000000', seed({ spreadsHistory: saved }));
  check('сохранённый Кельтский крест без права открывается на просмотр', !href.includes('/paywall'), `фактически ${href}`);
  await shot('gate-saved-spread-dark');

  console.log('\n=== 4. Курс: шапка premium-модуля и узел «текущий» ===');
  await open('/course', seed());
  const badges = await page.locator('text=ПРЕМИУМ').count();
  check('на курсе видны плашки «ПРЕМИУМ»', badges > 0, `найдено ${badges}`);
  const chip = await page.locator('text=✦ ПРЕМИУМ').count();
  check('узел «текущий» в М3 несёт чип «✦ ПРЕМИУМ»', chip > 0, `найдено ${chip}`);
  const startChip = await page.locator('text=НАЧАТЬ УРОК').count();
  check('чипа «НАЧАТЬ УРОК» на запертом узле нет', startChip === 0, `найдено ${startChip}`);
  await shotFull('course-locked-dark');

  // ⚠️ Чип — СОСЕД нажимаемой области узла, а не её содержимое (так было и у «НАЧАТЬ УРОК»):
  // клик по тексту чипа не нажимает ничего. Нажимаем сам узел: chipWrap.top = -53 относительно
  // узла, узел NODE_SIZE = 76 → центр узла на 53 + 38 = 91 px ниже верха чипа, по той же оси X.
  const chipBox = await page.locator('text=✦ ПРЕМИУМ').first().boundingBox();
  await page.mouse.click(chipBox.x + chipBox.width / 2, chipBox.y + 91);
  await page.waitForTimeout(1200);
  check('тап по узлу «текущий» в premium-модуле → пейвол', await onPaywall(), `фактически ${page.url().replace(BASE, '')}`);

  // шапка premium-модуля нажимается (открытая — нет)
  await open('/course', seed());
  const m3 = page.locator('text=МОДУЛЬ 3 ИЗ 6').first();
  await m3.scrollIntoViewIfNeeded();
  await m3.click({ force: true });
  await page.waitForTimeout(1200);
  check('тап по шапке premium-модуля → пейвол', await onPaywall(), `фактически ${page.url().replace(BASE, '')}`);

  await open('/course', seed({ premium: DEV }));
  const chipOn = await page.locator('text=✦ ПРЕМИУМ').count();
  const startOn = await page.locator('text=НАЧАТЬ УРОК').count();
  check('с правом: чип снова «НАЧАТЬ УРОК», премиум-чипа нет', chipOn === 0 && startOn > 0, `премиум ${chipOn}, начать ${startOn}`);
  await shotFull('course-premium-on-dark');

  console.log('\n=== 5. Расклады: список ===');
  await open('/spreads', seed({ devMoonOpen: true }));
  await shotFull('spreads-locked-dark');
  const spBadges = await page.locator('text=ПРЕМИУМ').count();
  check('в списке раскладов есть плашки «ПРЕМИУМ»', spBadges >= 7, `найдено ${spBadges} (ожидалось ≥7 премиум-раскладов)`);
  await page.locator('text=Кельтский крест').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('тап по premium-карточке списка → пейвол', await onPaywall(), `фактически ${page.url().replace(BASE, '')}`);

  console.log('\n=== 6. Луна: панель полнолуния ===');
  await open('/moon', seed({ devMoonOpen: true }));
  await shotFull('moon-locked-dark');
  const moonBadge = await page.locator('text=ПРЕМИУМ').count();
  check('на экране луны у полнолуния плашка «ПРЕМИУМ»', moonBadge > 0, `найдено ${moonBadge}`);

  console.log('\n=== 7. Тренажёр: лимит 10 карт в день ===');
  href = await open('/review', seed({ srs: dueSrs(), reviewDay: { date: TODAY, newCount: 0, doneCount: 10 } }));
  const resultPanel = await page.locator('text=Ещё').count();
  check('вход при исчерпанном лимите → сразу панель результата (сессия не строится)', resultPanel > 0, `«Ещё» найдено ${resultPanel}`);
  const moreLk = await page.locator('text=✦ ПРЕМИУМ').count();
  check('«Ещё N» несёт плашку «✦ ПРЕМИУМ»', moreLk > 0, `найдено ${moreLk}`);
  await shotFull('review-limit-dark');
  await page.locator('text=Ещё').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('тап по «Ещё N» при лимите → пейвол', await onPaywall(), `фактически ${page.url().replace(BASE, '')}`);

  href = await open('/review', seed({ srs: dueSrs(), reviewDay: { date: TODAY, newCount: 0, doneCount: 10 }, premium: DEV }));
  const cardShown = await page.locator('text=Ещё').count();
  check('с правом лимита нет: при doneCount 10 сессия строится', cardShown === 0, `панель результата показана (${cardShown})`);
  await shotFull('review-premium-on-dark');

  href = await open('/review', seed({ srs: dueSrs(), reviewDay: { date: '2026-01-01', newCount: 0, doneCount: 10 } }));
  const yday = await page.locator('text=Ещё').count();
  check('вчерашний doneCount не считается — сессия строится', yday === 0, `панель результата показана (${yday})`);

  console.log('\n=== 8. Настройки: строка Premium ===');
  await open('/settings', seed());
  const rowBuy = await page.locator('text=Оформить ›').count();
  check('строка «Arcanum Premium» показывает «Оформить ›»', rowBuy > 0);
  await shot('settings-premium-dark');
  await page.locator('text=Arcanum Premium').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('тап по строке настроек → пейвол', await onPaywall(), `фактически ${page.url().replace(BASE, '')}`);

  await open('/settings', seed({ premium: DEV }));
  const rowOn = await page.locator('text=Активна ›').count();
  check('с правом строка показывает «Активна ›»', rowOn > 0);

  console.log('\n=== 9. Пейвол: юридические ссылки и «Восстановить покупки» ===');
  await open('/paywall', seed());
  await page.locator('text=Условия').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('ссылка «Условия» ведёт на «О приложении»', page.url().includes('/about'), `фактически ${page.url().replace(BASE, '')}`);
  const terms = await page.locator('text=Условия подписки').count();
  check('на «О приложении» есть раздел «Условия подписки»', terms > 0);
  await shotFull('about-terms-dark');

  await open('/paywall', seed());
  await page.locator('text=Восстановить покупки').first().click({ force: true });
  await page.waitForTimeout(1000);
  check('«Восстановить покупки» → диалог «Пока недоступно»', (await page.locator('text=Пока недоступно').count()) > 0);
  await shot('paywall-dialog-dark');

  console.log('\n=== 10. Светлая тема ===');
  await open('/course', seed({ themeMode: 'light' }));
  await shotFull('course-locked-light');
  await open('/spreads', seed({ themeMode: 'light', devMoonOpen: true }));
  await shotFull('spreads-locked-light');
  await open('/review', seed({ themeMode: 'light', srs: dueSrs(), reviewDay: { date: TODAY, newCount: 0, doneCount: 10 } }));
  await shotFull('review-limit-light');
  await open('/moon', seed({ themeMode: 'light', devMoonOpen: true }));
  await shotFull('moon-locked-light');
  await open('/settings', seed({ themeMode: 'light' }));
  await shot('settings-premium-light');
  console.log('  ✓ снимки светлой темы сняты');

  console.log('\n=== ИТОГ ===');
  console.log(`пройдено ${pass}, упало ${fails.length} (из ${pass + fails.length})`);
  if (fails.length) console.log('УПАЛО:\n  - ' + fails.join('\n  - '));
  if (notes.length) console.log('заметки:\n  - ' + notes.join('\n  - '));
  const realErrors = consoleErrors.filter((e) => !/pointerEvents is deprecated/.test(e));
  console.log(`\nошибок в консоли: ${realErrors.length}`);
  if (realErrors.length) console.log(realErrors.slice(0, 10).join('\n'));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('СЦЕНАРИЙ УПАЛ:', e.message);
  process.exit(2);
});
