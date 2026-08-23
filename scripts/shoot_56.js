/* Съёмка пар «экран приложения ↔ вью макета» для планового аудита (задача 56, пункт 6а).
   Правило бэклога: раз в ~5 задач сверять design-reference.html с реальным приложением.

   Запуск (рецепт AGENTS.md), dev-сервер должен быть поднят заново с --clear:
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_56.js [каталог] [фильтр-по-имени-пары]

   Что делает: для каждой пары снимает приложение (390×844, обе темы) и соответствующий вью
   макета (тот же кадр телефона, обе темы через data-mode на #sc). Складывает в docs/screenshots/56/
   как <pair>-app-<theme>.png и <pair>-mock-<theme>.png — рядом, чтобы читать глазами парами.

   ⚠️ Пиксель-в-пиксель макет и RN-web не сравниваются в принципе: разные движки шрифтов, макет
   отрисован в рамке 350×750, приложение — 390×844. Сверяется КОМПОЗИЦИЯ по чек-листу
   docs/ui-verification.md, а не диффом картинок.
   ⚠️ Сид ставится goto → evaluate → reload (addInitScript срабатывает на каждой навигации).
   ⚠️ Скрипт обязан падать, а не снимать пустоту: у каждой пары задан маркер — текст, который
   ОБЯЗАН быть на экране. Нет маркера — FAIL с именем пары (красный прогон 23.08: подменённый
   маршрут роняет ровно свою пару). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'docs/screenshots/56';
const ONLY = process.argv[3] || '';
const BASE = 'http://localhost:8081';
const MOCK = 'file:///' + path.resolve('docs/design-reference.html').replace(/\\/g, '/');

const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot'];
const TODAY = new Date().toISOString().slice(0, 10);

/** Записи дневника за текущий месяц: DailyDraw из src/lib/journal.ts
 *  ({date, cardId, reversed, note?, outcome?}); outcome — 'yes' | 'partly' | 'no'. */
const JOURNAL = (() => {
  // ⚠️ Повтор карты обязателен: MonthCard рисует «КАРТА МЕСЯЦА» только при topCount > 1
  // (осознанное решение — при одном выпадении подпись обещала бы закономерность, которой нет).
  // Сид из восьми РАЗНЫХ карт прятал половину карточки от аудита — находка 23.08
  const cards = ['high-priestess', 'empress', 'high-priestess', 'magician', 'high-priestess', 'lovers', 'chariot', 'hierophant'];
  const outcomes = ['yes', 'partly', 'no', 'yes', 'yes', undefined, 'partly', 'yes'];
  const notes = ['Разговор прошёл мягче, чем ждала', undefined, 'День вышел лёгким', undefined, undefined, undefined, 'Пришлось подождать', undefined];
  const day = Number(TODAY.slice(8, 10));
  return cards
    .map((cardId, i) => {
      const d = day - i;
      if (d < 1) return null;
      return {
        date: `${TODAY.slice(0, 8)}${String(d).padStart(2, '0')}`,
        cardId,
        reversed: i % 3 === 0,
        ...(notes[i] ? { note: notes[i] } : {}),
        ...(outcomes[i] ? { outcome: outcomes[i] } : {}),
      };
    })
    .filter(Boolean);
})();

/** Состояние приложения. Форма взята из scripts/check_53_web.js — сочинять сид нельзя. */
function seed(extra = {}) {
  return JSON.stringify({
    state: {
      themeMode: 'dark',
      lang: 'ru',
      installSeed: 12345,
      // ⚠️ birthArcanaId ОБЯЗАТЕЛЕН рядом с birthDate: карточку аркана рождения рисует
      // BirthArcanaCard по profile.birthArcanaId, а не по дате — сид только с датой давал
      // пустую плашку «Указать дату рождения» и прятал целый блок от аудита (находка 23.08).
      // Значение — birthArcanaId('1990-05-14') из src/lib/birthArcana.ts
      profile: { onboarded: true, name: 'Артём', birthDate: '1990-05-14', birthArcanaId: 'justice' },
      premium: { active: false, source: 'none', until: null },
      lessonsProgress: Object.fromEntries(M12.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }])),
      srs: Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }])),
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      // дневник наполнен: без записей блок «ДНЕВНИК» на профиле показывает пустое состояние,
      // и аудит его композиции не видит вовсе (находка 23.08 — сид решает, что попадёт в кадр)
      history: JOURNAL,
      spreadsHistory: [],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 11,
  });
}
const PREMIUM = { active: true, source: 'dev', until: null };

/** Пары. mock — id вью в макете; marker — текст, обязанный быть на экране приложения. */
const PAIRS = [
  { name: 'today',      route: '/',                        mock: 'v-today',     marker: 'КАРТА ДНЯ' },
  { name: 'course',     route: '/course',                  mock: 'v-course',    marker: 'Курс' },
  { name: 'cards',      route: '/cards',                   mock: 'v-cards',     marker: 'Карты' },
  { name: 'spreads',    route: '/spreads',                 mock: 'v-spreads',   marker: 'Расклады' },
  { name: 'profile',    route: '/profile',                 mock: 'v-profile',   marker: 'Профиль' },
  { name: 'detail',     route: '/card/fool',               mock: 'v-detail',    marker: 'Дурак' },
  { name: 'lesson',     route: '/lesson/m1l1',             mock: 'v-lesson',    marker: 'УРОК' },
  { name: 'trainer',    route: '/review',                  mock: 'v-trainer',   marker: 'Тренажёр' },
  { name: 'moon',       route: '/moon',                    mock: 'v-moon',      marker: 'ЛУНА' },
  { name: 'spread3',    route: '/spreads/three-card',      mock: 'v-spread3',   marker: 'РАЗЛОЖИТЬ' },
  { name: 'spread10',   route: '/spreads/celtic-cross',    mock: 'v-spread10',  marker: 'РАЗЛОЖИТЬ', extra: { premium: PREMIUM } },
  // ⚠️ devMoonOpen обязателен: вне окна события гейт уводит на список раскладов. Маркер здесь
  // ДОЛЖЕН быть уникален для целевого экрана — первая редакция искала «новолуния», а это слово
  // есть и в карточке списка, поэтому подменённый экран прошёл проверку незамеченным (находка
  // агента-сверщика 23.08). «РАЗЛОЖИТЬ» есть только на самом экране расклада
  // ⚠️ Снимается ПОЛНОЛУНИЕ, хотя макет v-moonspread рисует новолуние: devMoonOpen подставляет
  // «сейчас» = момент БЛИЖАЙШЕГО события (useDevMoonNow → nearestMoonEvent), а на 23.08.2026
  // ближайшее — полнолуние 28.08. Расклад новолуния при этом закрыт законно, и гейт уводит
  // на список. Композиция обоих лунных раскладов одна, сверять её можно на любом из них;
  // полнолуние premium — отсюда PREMIUM в сиде
  { name: 'moonspread', route: '/spreads/full-moon',       mock: 'v-moonspread', marker: 'РАЗЛОЖИТЬ',
    extra: { devMoonOpen: true, premium: PREMIUM } },
  { name: 'paywall',    route: '/paywall',                 mock: 'v-paywall',   marker: 'Premium' },
  { name: 'settings',   route: '/settings',                mock: 'v-settings',  marker: 'Настройки' },
  { name: 'about',      route: '/about',                   mock: 'v-about',     marker: 'О приложении' },
  { name: 'onboarding', route: '/onboarding',              mock: 'v-ob',        marker: 'Arcanum',
    extra: { profile: { onboarded: false } } },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const app = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mock = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
  const consoleErrors = [];
  app.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  app.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await mock.goto(MOCK, { waitUntil: 'networkidle' });

  const done = [];
  const failed = [];
  for (const p of PAIRS) {
    if (ONLY && !p.name.includes(ONLY)) continue;
    // ⚠️ пара засчитывается снятой, только если сняты ОБЕ темы: первый прогон 23.08 печатал
    // «✓ detail» рядом с «не снято: 2» — отчёт противоречил сам себе
    let shotBoth = 0;
    for (const theme of ['dark', 'light']) {
      // приложение
      await app.goto(`${BASE}${p.route}`, { waitUntil: 'domcontentloaded' });
      await app.evaluate((s) => localStorage.setItem('arcanum-app', s), seed({ themeMode: theme, ...(p.extra || {}) }));
      await app.reload({ waitUntil: 'networkidle' });
      await app.waitForTimeout(1600);
      const w = await app.evaluate(() => window.innerWidth);
      if (w !== 390) throw new Error(`вьюпорт ${w}, не 390 — снимок недостоверен`);
      const body = await app.locator('body').innerText();
      if (!body.toUpperCase().includes(p.marker.toUpperCase())) {
        failed.push(`${p.name}/${theme}: маркер «${p.marker}» не найден (url ${app.url().replace(BASE, '')})`);
        continue;
      }
      await app.screenshot({ path: path.join(OUT, `${p.name}-app-${theme}.png`) });

      // макет
      await mock.evaluate(
        ([id, th]) => {
          const sc = document.getElementById('sc');
          sc.dataset.mode = th;
          // eslint-disable-next-line no-undef
          show(id);
        },
        [p.mock, theme],
      );
      await mock.waitForTimeout(600);
      await mock.locator('#sc').screenshot({ path: path.join(OUT, `${p.name}-mock-${theme}.png`) });
      shotBoth++;
    }
    if (shotBoth === 2) {
      done.push(p.name);
      console.log(`  ✓ ${p.name}`);
    } else {
      console.log(`  ✗ ${p.name} — снято тем: ${shotBoth} из 2`);
    }
  }

  console.log(`\nснято пар: ${done.length}, не снято: ${failed.length}`);
  failed.forEach((f) => console.log(`  ✗ ${f}`));
  const real = consoleErrors.filter((e) => !/DevTools|source map/i.test(e));
  console.log(`ошибок в консоли приложения: ${real.length}`);
  real.slice(0, 10).forEach((e) => console.log(`  ! ${e.slice(0, 160)}`));

  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
