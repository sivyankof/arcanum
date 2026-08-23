/* Приёмка задачи 60 — восемь дорисовок `docs/design-reference.html` по итогам аудита 56.
 *
 * Проверяет САМ макет, а не приложение: открывает файл в Chromium, ходит по всем вью и
 * сверяет то, что перечислено в `docs/prompts/56-mockup-tails.md`.
 *
 * Запуск (playwright в проекте не установлен, берётся из кэша npx — см. AGENTS.md):
 *   NODE_PATH=<путь к node_modules с playwright> node scripts/check_60_mock.js
 *   --mutate <1..8>  — испортить макет В ПАМЯТИ и убедиться, что проверка N краснеет
 *                      (правило проекта: зелёный с первого раза — искать ошибку в проверке).
 */
const path = require('path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, '..', 'docs', 'design-reference.html');

/** Вью вне группы (tabs) — таб-бара быть не должно. */
const STACK = ['v-detail', 'v-lesson', 'v-trainer', 'v-moon', 'v-moonspread',
               'v-settings', 'v-about', 'v-paywall', 'v-spread3', 'v-spread10'];
/** Вью табов — таб-бар виден, подсвечен свой таб. */
const TABS = ['v-today', 'v-course', 'v-cards', 'v-spreads', 'v-profile'];

const mutation = process.argv.includes('--mutate')
  ? Number(process.argv[process.argv.indexOf('--mutate') + 1])
  : 0;

const results = [];
const check = (n, title, ok, detail = '') => results.push({ n, title, ok, detail });

(async () => {
  // В облачном окружении бинарь Chromium лежит отдельно от версии playwright — путь берётся
  // из PW_CHROMIUM, если он задан (на машине Артёма переменной нет и работает штатный запуск).
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(FILE);

  if (mutation) {
    await page.evaluate((m) => {
      // ⚠️ STACK_VIEWS и TAB_OF объявлены через const и на window НЕ висят (в отличие от
      // function show) — порча делается обёрткой над самой show, а не подменой списков.
      if (m === 1) {
        const orig = window.show;
        window.show = (id) => { orig(id); document.getElementById('sc').classList.remove('notabs'); };
      }
      if (m === 2) {
        const orig = window.show;
        window.show = (id) => {
          orig(id);
          document.querySelectorAll('#nav>div').forEach((x, i) => x.classList.toggle('on', i === 0));
        };
      }
      if (m === 3) document.querySelector('#v-lesson .backbtn').remove();
      if (m === 4) document.querySelector('#v-spread3 .date').textContent = 'РАСКЛАД';
      if (m === 5) document.querySelector('#v-profile [onclick*="v-settings"]').remove();
      if (m === 6) {
        const rows = [...document.querySelectorAll('#v-settings .prow')];
        rows.find((r) => r.textContent.includes('Напоминания'))
          .after(rows.find((r) => r.textContent.includes('рефлексия')));
      }
      if (m === 7) {
        [...document.querySelectorAll('#v-settings .pv')]
          .find((x) => x.textContent.trim() === 'Вкл').style.color = 'var(--accent)';
      }
      if (m === 8) {
        [...document.querySelectorAll('#v-settings .pl')]
          .find((x) => x.textContent.trim() === 'Импорт из файла').closest('.prow').remove();
      }
    }, mutation);
  }

  const navVisible = async (id) => {
    await page.evaluate((v) => window.show(v), id);
    return page.locator('#nav').isVisible();
  };

  // 1. таб-бар прячется на экранах-стеках и остаётся на табах
  const stackBad = [];
  for (const id of STACK) if (await navVisible(id)) stackBad.push(id);
  const tabsBad = [];
  for (const id of TABS) if (!(await navVisible(id))) tabsBad.push(id);
  check(1, 'таб-бар скрыт на экранах-стеках и виден на табах',
    stackBad.length === 0 && tabsBad.length === 0,
    `лишний таб-бар: ${stackBad.join(', ') || '—'}; пропал на табах: ${tabsBad.join(', ') || '—'}`);

  // 2. активный таб совпадает с открытой вью
  const wrong = [];
  for (const id of TABS) {
    await page.evaluate((v) => window.show(v), id);
    const on = await page.locator('#nav>div.on').getAttribute('data-v');
    if (on !== id) wrong.push(`${id} → ${on}`);
  }
  check(2, 'подсвечен таб открытой вью', wrong.length === 0, wrong.join('; '));

  // 3. у урока есть кнопка «назад»
  await page.evaluate(() => window.show('v-lesson'));
  const back = page.locator('#v-lesson .backbtn');
  check(3, 'v-lesson: кнопка «назад» на месте',
    (await back.count()) === 1 && (await back.isVisible()),
    (await back.count()) ? (await back.innerText()).trim() : 'нет элемента');

  // 4. счётчик карт в overline у ОБОИХ раскладов
  const d3 = (await page.locator('#v-spread3 .date').innerText()).trim();
  const d10 = (await page.locator('#v-spread10 .date').innerText()).trim();
  check(4, 'overline раскладов со счётчиком карт',
    d3 === 'РАСКЛАД · 3 КАРТЫ' && d10 === 'РАСКЛАД · 10 КАРТ', `${d3} | ${d10}`);

  // 5. шестерёнка на профиле — элемент экрана; служебный переключатель темы вне телефона
  await page.evaluate(() => window.show('v-profile'));
  const gear = page.locator('#v-profile [onclick*="v-settings"]');
  const modeInside = await page.evaluate(() =>
    !!document.querySelector('#sc #modebtn') || !!document.querySelector('.sc .mode'));
  const modeInBar = await page.evaluate(() => !!document.querySelector('.demobar #modebtn'));
  check(5, 'профиль: шестерёнка есть, служебная кнопка темы вне экрана',
    (await gear.count()) === 1 && (await gear.isVisible()) && !modeInside && modeInBar,
    `шестерёнок ${await gear.count()}, кнопка темы внутри экрана: ${modeInside}, в демобаре: ${modeInBar}`);

  // 6. порядок строк настроек по product-spec §5
  await page.evaluate(() => window.show('v-settings'));
  const order = (await page.locator('#v-settings .prow .pl').allInnerTexts()).map((s) => s.trim());
  const idx = (s) => order.indexOf(s);
  check(6, 'настройки: «Вечерняя рефлексия» перед «Напоминаниями»',
    idx('Вечерняя рефлексия') > -1 && idx('Вечерняя рефлексия') < idx('Напоминания'),
    order.join(' · '));

  // 7. значение строки — muted 700 (design-system §«Строка настройки»), без ветки для «Вкл»
  const accented = await page.evaluate(() => {
    const toRgb = (c) => {
      const d = document.createElement('div');
      d.style.color = c; document.body.appendChild(d);
      const r = getComputedStyle(d).color; d.remove(); return r;
    };
    const want = toRgb(getComputedStyle(document.getElementById('sc'))
      .getPropertyValue('--muted').trim());
    return [...document.querySelectorAll('#v-settings .pv')]
      .filter((v) => v.textContent.trim() && getComputedStyle(v).color !== want)
      .map((v) => `${v.closest('.prow').querySelector('.pl').textContent.trim()} → ${getComputedStyle(v).color}`);
  });
  check(7, 'настройки: значение справа — muted, без акцента', accented.length === 0,
    accented.join('; '));

  // 8. экспорт и импорт — две строки с названиями из product-spec §5
  check(8, 'настройки: «Экспорт данных» и «Импорт из файла» двумя строками',
    idx('Экспорт данных') > -1 && idx('Импорт из файла') === idx('Экспорт данных') + 1
      && !order.some((x) => x.includes('Экспорт дневника')),
    order.join(' · '));

  await browser.close();

  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? '✓' : '✗'} ${r.n}. ${r.title}${r.ok ? '' : `\n     ${r.detail}`}`);
  }
  console.log(`\n${results.length - bad} из ${results.length} зелёных${mutation ? ` (мутация ${mutation})` : ''}`);
  process.exit(bad ? 1 : 0);
})();
