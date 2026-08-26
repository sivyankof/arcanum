/* Веб-проверка пейвола без магазина (задача 62, пункт 6б процесса).
   Проверяет: пять входов на пейвол (настройки, курс, расклады, тренажёр, луна) ведут на экран
   БЕЗ «₽», без кнопки «Оформить …» и без «Восстановить покупки», с панелью «скоро» и живыми
   ссылками «Условия»/«Конфиденциальность»; состояние Б («подписка активна», DEV) не изменилось;
   диалог «Управлять подпиской» не упоминает Expo Go; панель «скоро» есть и в светлой теме.

   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_62_web.js [каталог-скриншотов]

   ⚠️ Красный прогон обязателен: на коде 53а (до правки purchases.ts) сценарий обязан упасть по
   пяти проверкам на каждом из шести экранов «скоро» (₽, «Оформить», «Восстановить», soonTitle,
   soonSub) и на «Expo Go» в диалоге. Факт красного прогона на коммите 56a25af (код 53а):
   упало 31 из 58, все пять входов зелёные, ошибок в консоли 0.
   Зелёный с первого раза = ошибка в самой проверке (правило проекта).
   ⚠️ Часы браузера пришпилены к 27.08.2026 (page.clock.setFixedTime): ближайшее лунное
   событие — полнолуние 28.08 (premium), поэтому вход «луна» ведёт на пейвол в любой день
   прогона. На живых часах после ~5.09.2026 ближайшим стало бы новолуние (free), панель полнолуния
   закрылась бы законно и вход открыл бы не пейвол — та же дата-зависимость живёт в check_53 §6.
   Берётся именно setFixedTime, а не clock.install: install замораживает ещё и таймеры, а на
   фейковых таймерах RN-web не доводит анимации входа и переходы роутера — сценарию же нужна
   ровно подменённая дата.
   ⚠️ Маркеры строк берутся из src/lib/i18n.ts, а не из памяти (урок 28а): отсутствующий ключ
   даёт null и КРАСНУЮ проверку с текстом причины, а не падение сценария.
   ⚠️ Сид — форма scripts/check_53_web.js (урок 54: сид не сочинять). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'docs/screenshots/62';
const BASE = 'http://localhost:8081';
const CLOCK = new Date('2026-08-27T12:00:00');
const TODAY = '2026-08-27';

const I18N = fs.readFileSync(path.resolve('src/lib/i18n.ts'), 'utf8');
/** Русское значение ключа paywall.* — первое вхождение в файле (блок ru идёт первым). */
const ruKey = (key) => {
  const m = I18N.match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));
  return m ? m[1] : null;
};
const SOON_TITLE = ruKey('soonTitle');
const SOON_SUB = ruKey('soonSub');
const UNAVAILABLE_TEXT = ruKey('unavailableText');
const BENEFIT_1 = ruKey('b1');

const NONE = { active: false, source: 'none', until: null };
const DEV = { active: true, source: 'dev', until: null };
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const progress = (ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));
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
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Перехват внешних ссылок: window.open и клик по <a href> (форма check_54_web.js). */
async function armOpenSpy(page) {
  await page.evaluate(() => {
    window.__opened = [];
    if (!window.__spyArmed) {
      window.__spyArmed = true;
      window.open = (u) => { window.__opened.push(String(u)); return null; };
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (a) { window.__opened.push(a.href); e.preventDefault(); }
      }, true);
    }
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.clock.setFixedTime(CLOCK);
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  /** Ставит состояние и открывает путь (goto → evaluate → reload, урок 39). */
  async function open(route, state) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const w = await page.evaluate(() => window.innerWidth);
    if (w !== 390) throw new Error(`вьюпорт ${w}, не 390 — снимок недостоверен (урок 16)`);
    return page.url().replace(BASE, '');
  }
  const body = () => page.locator('body').innerText();
  const here = () => page.url().replace(BASE, '');
  const onPaywall = async () => page.url().includes('/paywall') && (await body()).includes('Arcanum Premium');
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

  /** Проверки экрана «скоро» — одни и те же для всех входов. */
  async function assertSoon(tag) {
    const text = await body();
    check(`${tag}: на пейволе нет «₽»`, !text.includes('₽'));
    check(`${tag}: нет кнопки «Оформить за …»`, !/Оформить за/.test(text));
    check(`${tag}: нет «Восстановить покупки»`, !text.includes('Восстановить покупки'));
    check(`${tag}: панель «скоро» — заголовок`, SOON_TITLE !== null && text.includes(SOON_TITLE),
      SOON_TITLE === null ? 'ключа paywall.soonTitle нет в i18n.ts' : '');
    check(`${tag}: панель «скоро» — вторая строка`, SOON_SUB !== null && text.includes(SOON_SUB),
      SOON_SUB === null ? 'ключа paywall.soonSub нет в i18n.ts' : '');
    check(`${tag}: строки «что даёт Premium» на месте`, BENEFIT_1 !== null && text.includes(BENEFIT_1));
    check(`${tag}: ссылки «Условия» и «Конфиденциальность»`, text.includes('Условия') && text.includes('Конфиденциальность'));
  }

  console.log('\n=== 1. Настройки → пейвол ===');
  await open('/settings', seed());
  await page.locator('text=Arcanum Premium').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('настройки: тап по строке → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('настройки');
  await shot('paywall-soon-dark');

  console.log('\n=== 2. Курс → пейвол (узел «текущий» в premium-модуле) ===');
  await open('/course', seed());
  // чип — СОСЕД нажимаемой области узла (урок 53а): центр узла на 91 px ниже верха чипа
  const chipBox = await page.locator('text=✦ ПРЕМИУМ').first().boundingBox();
  check('курс: чип «✦ ПРЕМИУМ» найден', chipBox !== null);
  if (chipBox) {
    await page.mouse.click(chipBox.x + chipBox.width / 2, chipBox.y + 91);
    await page.waitForTimeout(1200);
    check('курс: тап по узлу → пейвол', await onPaywall(), `фактически ${here()}`);
    await assertSoon('курс');
  }

  console.log('\n=== 3. Расклады → пейвол ===');
  await open('/spreads', seed());
  await page.locator('text=Кельтский крест').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('расклады: тап по premium-карточке → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('расклады');

  console.log('\n=== 4. Тренажёр (лимит исчерпан) → пейвол ===');
  await open('/review', seed({ srs: dueSrs(), reviewDay: { date: TODAY, newCount: 0, doneCount: 10 } }));
  await page.locator('text=Ещё').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('тренажёр: тап по «Ещё N» → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('тренажёр');

  console.log('\n=== 5. Луна (панель полнолуния в окне) → пейвол ===');
  await open('/moon', seed({ devMoonOpen: true }));
  await page.locator('text=Расклад полнолуния').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('луна: тап по панели полнолуния → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('луна');

  console.log('\n=== 6. Ссылки условий ведут на сайт ===');
  await open('/paywall', seed());
  await armOpenSpy(page);
  await page.getByText('Условия', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(600);
  let opened = await page.evaluate(() => window.__opened || []);
  check('«Условия» → terms.html', opened.some((u) => u.includes('/terms.html')), JSON.stringify(opened));
  await page.evaluate(() => { window.__opened = []; });
  await page.getByText('Конфиденциальность', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(600);
  opened = await page.evaluate(() => window.__opened || []);
  check('«Конфиденциальность» → privacy.html', opened.some((u) => u.includes('/privacy.html')), JSON.stringify(opened));

  console.log('\n=== 7. Состояние Б (DEV-право) не изменилось ===');
  await open('/paywall', seed({ premium: DEV }));
  let text = await body();
  check('Б: чип «✦ АКТИВНА»', text.includes('✦ АКТИВНА'));
  check('Б: панель «Подписка активна» + «DEV-режим»', text.includes('Подписка активна') && text.includes('DEV-режим'));
  check('Б: кнопка «Управлять подпиской»', text.includes('Управлять подпиской'));
  check('Б: «Восстановить покупки» на месте (как в макете #pwOn)', text.includes('Восстановить покупки'));
  check('Б: панели «скоро» нет', SOON_TITLE === null || !text.includes(SOON_TITLE));
  await shot('paywall-B-dark');
  await page.locator('text=Управлять подпиской').first().click({ force: true });
  await page.waitForTimeout(800);
  text = await body();
  check('Б: «Управлять» → диалог «Пока недоступно»', text.includes('Пока недоступно'));
  check('Б: диалог не упоминает Expo Go', !text.includes('Expo Go'));
  check('Б: текст диалога = paywall.unavailableText', UNAVAILABLE_TEXT !== null && text.includes(UNAVAILABLE_TEXT));
  await shot('paywall-dialog-dark');

  console.log('\n=== 8. Светлая тема ===');
  await open('/paywall', seed({ themeMode: 'light' }));
  await assertSoon('светлая');
  await shot('paywall-soon-light');

  console.log('\n=== ИТОГ ===');
  console.log(`пройдено ${pass}, упало ${fails.length} (из ${pass + fails.length})`);
  if (fails.length) console.log('УПАЛО:\n  - ' + fails.join('\n  - '));
  const realErrors = consoleErrors.filter((e) => !/pointerEvents is deprecated/.test(e));
  console.log(`\nошибок в консоли: ${realErrors.length}`);
  if (realErrors.length) console.log(realErrors.slice(0, 10).join('\n'));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('СЦЕНАРИЙ УПАЛ:', e.message);
  process.exit(2);
});
