/* Скриншоты изменённого экрана для сверки с макетом (задача 59, пункт 6а процесса):
   «Настройки» с новыми строками, диалог имени и пикер даты — в обеих темах.

   Запуск (dev-сервер поднят заново с --clear):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_59.js

   Кадры кладутся в docs/screenshots/59/<кадр>-<тема>.png, 390×844, deviceScaleFactor 2. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8081';
const OUT = path.resolve(__dirname, '../docs/screenshots/59');

const seed = (themeMode) =>
  JSON.stringify({
    state: {
      themeMode,
      lang: 'ru',
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём', birthDate: '1990-05-14', birthArcanaId: 'moon' },
      premium: { active: false, source: 'none', until: null },
      lessonsProgress: {},
      srs: {},
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      history: [],
      spreadsHistory: [],
      xp: 400,
      streak: 5,
    },
    version: 11,
  });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  · ${name}.png`);
  };
  const tap = async (text, exact = false) => {
    await page.getByText(text, { exact }).first().click({ force: true, timeout: 8000 });
    await page.waitForTimeout(700);
  };

  for (const theme of ['dark', 'light']) {
    console.log(`\n=== тема ${theme} ===`);
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), seed(theme));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    await shot(`settings-top-${theme}`);

    // новые строки лежат ниже блока напоминаний — доводим их в кадр
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(600);
    await shot(`settings-rows-${theme}`);

    await tap('Имя', true);
    await shot(`name-dialog-${theme}`);
    await tap('Отмена');

    await tap('Дата рождения');
    await shot(`date-picker-${theme}`);
    await tap('Готово');
  }

  await browser.close();
  console.log(`\nГотово: кадры в ${OUT}`);
})();
