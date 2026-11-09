/* Веб-проверка выпуска 1.0.1 (спека 74, пункт 6а/6б): кнопка звука на «Учёбе», строка музыки
   в настройках, тема «Как в системе», отсутствие строки «Оценить приложение» на вебе.

   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_74_web.js

   ⚠️ Красный прогон обязателен — четыре мутации по очереди, каждая на свежем dev-сервере:
     1) убрать `right={<MusicToggle />}` из app/(tabs)/index.tsx → роняет проверки 1;
     2) дефолт `musicOn: false` в src/store/useApp.ts → роняет проверки 2 (и следом 3–4);
     3) `resolveMode` в src/theme/resolveMode.ts игнорирует схему устройства → роняет проверки 5;
     4) `rateUrlFor` отдаёт адрес на вебе → роняет проверку 7.
   Сид — общий scripts/lib/seed72.js (version 12 без settings.musicOn: миграция 12 → 13
   обязана дозаполнить поле). Фон экрана читается как computed backgroundColor самого большого
   элемента во весь вьюпорт, цвета — из theme.ts через themeRgb. */
const { chromium } = require('playwright');
const { seed, themeRgb } = require('./lib/seed72');

const BASE = 'http://localhost:8081';
const DARK_BG = themeRgb('darkTheme', 'bg');
const LIGHT_BG = themeRgb('lightTheme', 'bg');

let pass = 0;
let total = 0;
const fails = [];
function check(name, ok, detail) {
  total++;
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

(async () => {
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
  }
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('arcanum-app')));
  const toggle = () => page.locator('[data-testid="music-toggle"]:visible').first();
  // нет кнопки — null, а не таймаут на 30 с: сценарий обязан дойти до итога на сломанном коде
  const checked = () => toggle().getAttribute('aria-checked', { timeout: 2000 }).catch(() => null);
  const body = () => page.locator('body').innerText();
  /** Фон экрана: computed backgroundColor элементов шириной с экран и высотой от 700 px (под шапкой стека корень экрана 390×780; фон rgb(242,242,242) — постоянная подложка навигатора). */
  const screenBg = () =>
    page.evaluate(() => {
      const hits = [];
      for (const el of document.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.width < 389 || r.height < 700) continue;
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') hits.push(bg);
      }
      return hits;
    });
  const openSettings = async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  };

  console.log('\n=== 1. Кнопка звука на «Учёбе» ===');
  await open('/', seed());
  const tg = toggle();
  const present = (await tg.count()) > 0;
  check('на «Учёбе» есть music-toggle', present);
  if (present) {
    const box = await tg.boundingBox();
    check('зона нажатия 44×44', Math.round(box.width) === 44 && Math.round(box.height) === 44, JSON.stringify(box));
  }
  const titleBox = await page.getByText('Учёба', { exact: true }).first().boundingBox();
  const titleCentre = titleBox ? titleBox.x + titleBox.width / 2 : -1;
  check('заголовок по центру экрана (±1 px)', Math.abs(titleCentre - 195) <= 1, `центр ${titleCentre}`);

  console.log('\n=== 2. Миграция 12 → 13 ===');
  const st2 = await stored();
  check('version === 13', st2.version === 13, `version ${st2.version}`);
  check('settings.musicOn === true', st2.state.settings && st2.state.settings.musicOn === true, JSON.stringify(st2.state.settings));
  check('консоль чиста после загрузки', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));

  console.log('\n=== 3. Клик по кнопке ===');
  if (present) {
    await tg.click({ force: true });
    await page.waitForTimeout(500);
  }
  const st3 = await stored();
  check('musicOn === false после клика', st3.state.settings.musicOn === false);
  check('aria-checked="false"', (await checked()) === 'false');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('после reload aria-checked="false"', (await checked()) === 'false');
  check('после reload musicOn === false', (await stored()).state.settings.musicOn === false);

  console.log('\n=== 4. Строка музыки в настройках ===');
  await openSettings();
  const row = page.locator('[data-testid="settings-music"]');
  check('строка музыки показывает «Выкл»', (await row.innerText()).includes('Выкл'), await row.innerText());
  await row.click({ force: true });
  await page.waitForTimeout(500);
  check('после клика строка показывает «Вкл»', (await row.innerText()).includes('Вкл'), await row.innerText());
  check('musicOn === true в сторе', (await stored()).state.settings.musicOn === true);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('на «Учёбе» aria-checked="true"', (await checked()) === 'true');

  console.log('\n=== 5. Тема «Как в системе» ===');
  await openSettings();
  await page.getByText('Тема', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(700);
  const b5 = await body();
  const opts = ['Тёмная', 'Светлая', 'Как в системе'].filter((o) => b5.includes(o));
  check('пикер темы: три пункта', opts.length === 3, opts.join(','));
  await page.getByText('Как в системе', { exact: true }).last().click({ force: true });
  await page.waitForTimeout(700);
  check('themeMode === system', (await stored()).state.themeMode === 'system');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(800);
  let bgs = await screenBg();
  check('system + light: фон светлой темы', bgs.includes(LIGHT_BG), `ждём ${LIGHT_BG}, есть ${[...new Set(bgs)]}`);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(800);
  bgs = await screenBg();
  check('system + dark: фон тёмной темы (без перезагрузки)', bgs.includes(DARK_BG), `ждём ${DARK_BG}, есть ${[...new Set(bgs)]}`);

  console.log('\n=== 6. Явная «Тёмная» не слушает систему ===');
  await open('/settings', seed({ themeMode: 'dark' }));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(800);
  bgs = await screenBg();
  check('dark + системная light: фон остаётся тёмным', bgs.includes(DARK_BG) && !bgs.includes(LIGHT_BG), `есть ${[...new Set(bgs)]}`);
  await page.emulateMedia({ colorScheme: 'dark' });

  console.log('\n=== 7. «Оценить приложение» ===');
  await openSettings();
  const b7 = await body();
  check('строки «Оценить приложение» на вебе нет', !b7.includes('Оценить приложение'));
  check('настройки действительно открыты', b7.includes('Фоновая музыка'));

  console.log('\n=== 8. Консоль ===');
  check('консоль без ошибок на всём проходе', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 400));

  await browser.close();
  console.log(`\nИтого: ${pass} из ${total}`);
  if (fails.length) {
    console.log(`Упало ${fails.length} из ${total}:`);
    fails.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
