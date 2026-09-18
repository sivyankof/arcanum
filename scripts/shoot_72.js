/* Скриншоты изменённых экранов задачи 72 для сверки с макетом (пункт 6а процесса):
   четыре состояния героя «Учёбы», «Карта дня» закрыта/открыта, «Практика», три кадра игры
   «Угадай карту» и два шага онбординга — в обеих темах.

   Запуск (dev-сервер поднят заново с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_72.js

   Кадры кладутся в docs/screenshots/72/<кадр>-<тема>.png, 390×844, deviceScaleFactor 2.
   ⚠️ Сид ставится goto → evaluate → reload на КАЖДЫЙ кадр (addInitScript срабатывает на каждой
   навигации, урок 39) — состояния героя и игры не переиспользуют друг друга.
   ⚠️ Игра случайна (Math.random внутри buildFragmentSession): для кадра «отвечено» и «итог»
   кликаем ПЕРВЫЙ показанный вариант — правильность ответа для скриншота не важна, важен факт,
   что рамка успеха/неудачи и итоговая панель отрисованы (форма — check_72_web.js). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8081';
const OUT = path.resolve(__dirname, '../docs/screenshots/72');

const PREMIUM_NONE = { active: false, source: 'none', until: null, plan: null, willRenew: false };
const progress = (ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));
const M1 = ['m1l1', 'm1l2', 'm1l3', 'm1l4'];
const M12 = [...M1, 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const M3 = ['m3l1', 'm3l2', 'm3l3', 'm3l4', 'm3l5', 'm3l6'];
const M4 = ['m4l1', 'm4l2', 'm4l3', 'm4l4', 'm4l5', 'm4l6', 'm4l7', 'm4l8'];
const M5 = ['m5l1', 'm5l2', 'm5l3', 'm5l4'];
const M6 = ['m6l1', 'm6l2', 'm6l3', 'm6l4'];
const ALL32 = [...M12, ...M3, ...M4, ...M5, ...M6];

function seed(themeMode, extra = {}) {
  return JSON.stringify({
    state: {
      themeMode,
      lang: 'ru',
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём' },
      premium: PREMIUM_NONE,
      lessonsProgress: {},
      srs: {},
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      history: [],
      spreadsHistory: [],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 12,
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const open = async (route, state) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
  };
  const body = () => page.locator('body').innerText();
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  · ${name}.png`);
  };
  /** Клик БЕЗ force — на этих кадрах ничего не качается, и скрытый экран под текущим
   *  (см. заголовок check_72_web.js) не пройдёт hit-test при случайной ошибке в сценарии. */
  const tap = async (text) => {
    await page.getByText(text, { exact: true }).first().click({ timeout: 8000 });
    await page.waitForTimeout(700);
  };
  const pickFirstOption = async () => {
    const lines = (await body()).split('\n').map((s) => s.trim()).filter(Boolean);
    const qIdx = lines.findIndex((l) => l === 'Какая это карта?');
    const options = lines.slice(qIdx + 1, qIdx + 5);
    await page.getByText(options[0], { exact: true }).first().click({ timeout: 8000 });
    await page.waitForTimeout(500);
  };

  /** Кадры: name → рендер (сид+действия), маркер — текст, обязанный быть на экране (кадр без
   *  маркера не снимается и называется в отчёте — правило shoot_56.js). */
  const FRAMES = [
    {
      name: 'home-start',
      marker: 'НАЧАТЬ УРОК',
      render: async (theme) => open('/', seed(theme)),
    },
    {
      name: 'home-continue',
      marker: 'ПРОДОЛЖИТЬ КУРС',
      render: async (theme) => open('/', seed(theme, { lessonsProgress: progress(M1) })),
    },
    {
      name: 'home-locked',
      marker: 'ОТКРЫТЬ PREMIUM',
      render: async (theme) => open('/', seed(theme, { lessonsProgress: progress(M12) })),
    },
    {
      name: 'home-done',
      marker: 'Курс пройден',
      render: async (theme) => open('/', seed(theme, { lessonsProgress: progress(ALL32) })),
    },
    {
      name: 'daily-closed',
      marker: 'НАЖМИ, ЧТОБЫ ПЕРЕВЕРНУТЬ',
      render: async (theme) => open('/daily', seed(theme)),
    },
    {
      name: 'daily-open',
      marker: 'ЗНАЧЕНИЕ КАРТЫ',
      render: async (theme) => {
        await open('/daily', seed(theme));
        // карта дня качается ±6px бесконечно (правило AGENTS.md) — force обязателен
        await page.getByText('НАЖМИ, ЧТОБЫ ПЕРЕВЕРНУТЬ', { exact: true }).first().click({ force: true, timeout: 8000 });
        await page.waitForTimeout(1300);
      },
    },
    {
      name: 'practice',
      marker: 'ПРАКТИКА',
      render: async (theme) => open('/spreads', seed(theme)),
    },
    {
      name: 'fragment-question',
      marker: 'Какая это карта?',
      render: async (theme) => open('/fragment', seed(theme)),
    },
    {
      name: 'fragment-answered',
      marker: 'ДАЛЕЕ',
      render: async (theme) => {
        await open('/fragment', seed(theme));
        await pickFirstOption();
      },
    },
    {
      name: 'fragment-result',
      marker: 'ВЕРНО',
      render: async (theme) => {
        await open('/fragment', seed(theme));
        for (let i = 0; i < 10; i++) {
          await pickFirstOption();
          await tap('ДАЛЕЕ');
        }
        await page.waitForTimeout(600);
      },
    },
    {
      name: 'onboarding-1',
      marker: 'НАЧАТЬ ОБУЧЕНИЕ',
      render: async (theme) => open('/onboarding', seed(theme, { profile: { onboarded: false } })),
    },
    {
      name: 'onboarding-2',
      marker: 'Как устроен курс',
      render: async (theme) => {
        await open('/onboarding', seed(theme, { profile: { onboarded: false } }));
        await tap('НАЧАТЬ ОБУЧЕНИЕ');
      },
    },
  ];

  const missing = [];
  for (const theme of ['dark', 'light']) {
    console.log(`\n=== тема ${theme} ===`);
    for (const f of FRAMES) {
      await f.render(theme);
      const b = await body();
      if (!b.includes(f.marker)) {
        missing.push(`${f.name}-${theme}: маркер «${f.marker}» не найден (url ${page.url().replace(BASE, '')})`);
        console.log(`  ✗ ${f.name}-${theme} — нет маркера «${f.marker}»`);
        continue;
      }
      await shot(`${f.name}-${theme}`);
    }
  }

  console.log(`\nснято кадров: ${FRAMES.length * 2 - missing.length} из ${FRAMES.length * 2}`);
  if (missing.length) {
    console.log('НЕ СНЯТО:');
    missing.forEach((m) => console.log(`  ✗ ${m}`));
  }

  await browser.close();
  console.log(`\nГотово: кадры в ${OUT}`);
  process.exit(missing.length ? 1 : 0);
})();
