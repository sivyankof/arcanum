/* Скриншоты изменённых экранов выпуска 1.0.1 для сверки с макетом (спека 74, пункт 6а):
   «Учёба» с кнопкой звука, «Настройки» (строки темы и музыки), открытый пикер темы
   с тремя пунктами — в обеих темах.

   Запуск (dev-сервер поднят заново с --clear):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_74.js

   Кадры кладутся в docs/screenshots/74/<кадр>-<тема>.png, 390×844, deviceScaleFactor 2.
   Сид — общий scripts/lib/seed72.js. Не снимать на мутированном коде. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { seed } = require('./lib/seed72');

const BASE = 'http://localhost:8081';
const OUT = path.resolve(__dirname, '../docs/screenshots/74');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  · ${name}.png`);
  };
  const open = async (route, theme) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), seed({ themeMode: theme }));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
  };

  for (const theme of ['dark', 'light']) {
    console.log(`\n=== тема ${theme} ===`);
    await open('/', theme);
    await shot(`home-${theme}`);

    await open('/settings', theme);
    await shot(`settings-${theme}`);

    await page.getByText('Тема', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(800);
    await shot(`theme-picker-${theme}`);
  }

  await browser.close();
  if (errors.length) console.log(`\nОшибки консоли: ${errors.join(' | ')}`);
  console.log(`\nГотово: кадры в ${OUT}`);
})();
