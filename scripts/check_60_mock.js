/* Приёмка задачи 60 — дорисовки `docs/design-reference.html` по итогам аудита 56 (пункты 1–8)
 * и по задаче 59 (пункт 9 — две строки вместо одной); задача 72 (пункты 10–12) — новая
 * структура приложения: «Учёба» первой вкладкой, «Карта дня» и игра «Угадай карту» отдельными
 * экранами-стеками, «Практика» вместо «Расклады» в таб-баре.
 *
 * Проверяет САМ макет, а не приложение: открывает файл в Chromium, ходит по всем вью и
 * сверяет то, что перечислено в `docs/prompts/56-mockup-tails.md` (60) и в спеке 72.
 *
 * Запуск (playwright в проекте не установлен, берётся из кэша npx — см. AGENTS.md):
 *   NODE_PATH=<путь к node_modules с playwright> node scripts/check_60_mock.js
 *   --mutate <1..12>  — испортить макет В ПАМЯТИ и убедиться, что проверка N краснеет
 *                       (правило проекта: зелёный с первого раза — искать ошибку в проверке).
 */
const path = require('path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, '..', 'docs', 'design-reference.html');

/** Вью вне группы (tabs) — таб-бара быть не должно. */
const STACK = ['v-detail', 'v-lesson', 'v-trainer', 'v-moon', 'v-moonspread', 'v-daily', 'v-fragment',
               'v-settings', 'v-about', 'v-paywall', 'v-spread3', 'v-spread10'];
/** Вью табов — таб-бар виден, подсвечен свой таб. */
const TABS = ['v-home', 'v-course', 'v-cards', 'v-spreads', 'v-profile'];

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
      if (m === 9) {
        const rows = [...document.querySelectorAll('#v-settings .prow')];
        const date = rows.find((r) => r.textContent.includes('Дата рождения'));
        date.querySelector('.pl').textContent = 'Имя и дата рождения';
        rows.find((r) => r.textContent.trim().startsWith('Имя')).remove();
      }
      if (m === 8) {
        [...document.querySelectorAll('#v-settings .pl')]
          .find((x) => x.textContent.trim() === 'Импорт из файла').closest('.prow').remove();
      }
      // задача 72: регрессия — таб-бар снова зовёт первую вкладку «Сегодня» (проверка 12)
      if (m === 10) {
        document.querySelector('#nav [data-v="v-home"] small').textContent = 'Сегодня';
      }
      // задача 72: регрессия — один из новых экранов пропал (проверка 10). Проверка 1 тоже
      // ходит по v-fragment (он есть в STACK) РАНЬШЕ проверки 10 — прятать элемент сразу
      // нельзя, иначе show('v-fragment') упадёт на null раньше, чем мы доберёмся до нужной
      // проверки. Прячем только со ВТОРОГО обращения к id: первое — та самая навигация
      // проверки 1, второе — собственный getElementById проверки 10.
      if (m === 11) {
        const orig = document.getElementById.bind(document);
        let hits = 0;
        document.getElementById = (id) => {
          if (id === 'v-fragment') { hits += 1; if (hits > 1) return null; }
          return orig(id);
        };
      }
      // задача 72: регрессия — «лунный день» вернулся в текст макета (проверка 11)
      if (m === 12) {
        document.body.insertAdjacentHTML('beforeend', '<span style="display:none">лунный день</span>');
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

  // 9. имя и дата рождения — ДВЕ строки (задача 59: у строки настройки справа одно значение;
  //    product-spec §5 переписан под две, макет обязан идти следом)
  check(9, 'настройки: «Имя» и «Дата рождения» двумя строками',
    idx('Имя') > -1 && idx('Дата рождения') === idx('Имя') + 1
      && !order.some((x) => x.includes('Имя и дата')),
    order.join(' · '));

  // 10. новые экраны задачи 72 на месте (главный «Учёба», карта дня, игра «Угадай карту»)
  const missing = await page.evaluate(() =>
    ['v-home', 'v-daily', 'v-fragment'].filter((id) => !document.getElementById(id)));
  check(10, 'экраны v-home/v-daily/v-fragment существуют', missing.length === 0,
    `нет: ${missing.join(', ') || '—'}`);

  // 11. лунный день считается (logic-spec §6), но задачей 72 снят с интерфейса целиком
  const lunarDay = await page.evaluate(() => document.documentElement.innerHTML.includes('лунный день'));
  check(11, 'в макете нигде нет «лунный день»', !lunarDay);

  // 12. таб-бар: «Учёба»/«Практика» вместо «Сегодня»/«Расклады» (задача 72)
  const navLabels = (await page.locator('#nav > div small').allInnerTexts()).map((s) => s.trim());
  check(12, 'таб-бар: подписи «Учёба, Курс, Карты, Практика, Профиль»',
    navLabels.join(', ') === 'Учёба, Курс, Карты, Практика, Профиль', navLabels.join(', '));

  await browser.close();

  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? '✓' : '✗'} ${r.n}. ${r.title}${r.ok ? '' : `\n     ${r.detail}`}`);
  }
  console.log(`\n${results.length - bad} из ${results.length} зелёных${mutation ? ` (мутация ${mutation})` : ''}`);
  process.exit(bad ? 1 : 0);
})();
