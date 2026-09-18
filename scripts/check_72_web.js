/* Веб-проверка учебного главного экрана и игры «Угадай карту» (спека 72, пункт 6б процесса).
   Проверяет критерии приёмки спеки: четыре состояния героя «Учёба», строку «Карта дня» и её
   перенос на отдельный экран, таб-бар с новыми подписями, уход строки луны с главного экрана
   (и полное отсутствие «лунного дня» в интерфейсе), игру «Угадай карту по фрагменту», гард
   онбординга на новых маршрутах и имя магазина на пейволе.

   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_72_web.js [каталог-скриншотов]

   ⚠️ Красный прогон обязателен (задача 14, шаг 2) — три мутации по очереди:
     1) убрать `<Stack.Screen name="daily" …/>` из-под гарда онбординга в app/_layout.tsx →
        роняет проверки раздела 10 (прямой заход на /daily до онбординга остаётся на /daily);
     2) в `onHero` подставить '/lesson/m1l1' константой вместо `summary.lesson!.id` →
        роняет проверки раздела 3 (сид «пройден m1» ведёт не в m2l1, а снова в m1l1);
     3) вернуть на «Учёбу» `MoonRow` с текстом лунного дня →
        роняет проверки раздела 8 (regexp «лунный день» находит совпадение на «/»).
   Числа факта — в отчёте docs/screenshots/… нет, отчёт задачи — .superpowers/sdd/72-learning-home/task-14-report.md.

   ⚠️ Оба маршрута /daily и /fragment — КОРНЕВЫЕ экраны стека (сиблинги `(tabs)`), поэтому при
   переходе на них таб «Учёба» (`(tabs)/index`) остаётся смонтированным ПОД ними: элементы
   скрытого экрана лежат в DOM, но не видны и не должны попадать под клик. Обычный (не forced)
   `.click()` Playwright делает hit-test и сам находит только видимый элемент — поэтому клики по
   вариантам игры и по строкам идут БЕЗ `force: true` (в отличие от качающейся карты дня, для
   которой `force: true` обязателен по правилу AGENTS.md). «Назад» — везде `page.goBack()`
   (реальная история браузера), а не клик по подписи кнопки: подпись кнопки «назад» текстом
   совпадает с подписью вкладки в таб-баре, и текстовый локатор мог бы поймать НЕвидимый узел.
   ⚠️ Варианты игры не имеют testID — они находятся по border: элемент с `cursor: pointer`
   (Pressable) И собственной рамкой (borderTopWidth > 0) — сочетание, уникальное для карточки
   варианта на этом экране (у текстового потомка cursor наследуется, но рамки у него нет; у
   кнопок без рамки, вроде «ДАЛЕЕ», cursor есть, а рамки нет). Цвета рамки — accent-независимые
   токены темы (dark): success #63ab89 = rgb(99,171,137), danger #e07a6a = rgb(224,122,106).
   ⚠️ XP за верный ответ начисляется СРАЗУ в `onPick` (см. src/lib/fragmentGame.ts, gainFragmentXp),
   а не по завершении анимации счётчика ResultPanel — поэтому дельту XP можно читать из
   localStorage сразу после последнего «ДАЛЕЕ», без ожидания подсчёта «+N XP» на экране.
   ⚠️ Сид — форма scripts/check_62_web.js, версия персиста 12 (SCHEMA_VERSION, спека 72 её
   не поднимает): `premium` несёt `plan`/`willRenew` (задача 53б). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'docs/screenshots/72';
const BASE = 'http://localhost:8081';

const SUCCESS_RGB = 'rgb(99, 171, 137)'; // t.success тёмной темы
const DANGER_RGB = 'rgb(224, 122, 106)'; // t.danger тёмной темы

const PREMIUM_NONE = { active: false, source: 'none', until: null, plan: null, willRenew: false };
const PREMIUM_DEV = { active: true, source: 'dev', until: null, plan: null, willRenew: false };
const progress = (ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));
const M1 = ['m1l1', 'm1l2', 'm1l3', 'm1l4'];
const M12 = [...M1, 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const M3 = ['m3l1', 'm3l2', 'm3l3', 'm3l4', 'm3l5', 'm3l6'];
const M4 = ['m4l1', 'm4l2', 'm4l3', 'm4l4', 'm4l5', 'm4l6', 'm4l7', 'm4l8'];
const M5 = ['m5l1', 'm5l2', 'm5l3', 'm5l4'];
const M6 = ['m6l1', 'm6l2', 'm6l3', 'm6l4'];
const ALL32 = [...M12, ...M3, ...M4, ...M5, ...M6];

function seed(extra = {}) {
  return JSON.stringify({
    state: {
      themeMode: 'dark',
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const consoleErrors = [];
  const warns = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  /** Ставит состояние и открывает путь (goto → evaluate → reload, урок 39). Возвращает
   *  путь после оседания роутера (гард мог увести на онбординг). */
  async function open(route, state = seed()) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1300);
    const w = await page.evaluate(() => window.innerWidth);
    if (w !== 390) throw new Error(`вьюпорт ${w}, не 390 — снимок недостоверен (урок 16)`);
    return page.url().replace(BASE, '');
  }
  const body = () => page.locator('body').innerText();
  const here = () => page.url().replace(BASE, '');
  /** Клик по тексту БЕЗ force: скрытый экран под текущим (см. заголовок файла) не пройдёт
   *  hit-test, и на нём click завис бы по таймауту — то есть ошибка сценария, а не тихий промах. */
  const tap = async (text, opts = {}) => {
    await page.getByText(text, { exact: true }).first().click({ timeout: 8000, ...opts });
    await page.waitForTimeout(700);
  };
  const xpNow = async () => {
    const raw = await page.evaluate(() => localStorage.getItem('arcanum-app'));
    return JSON.parse(raw).state.xp;
  };

  console.log('\n=== 1. Онбординг: свежий стор ===');
  let href = await open('/', seed({ profile: { onboarded: false } }));
  check('свежий стор → онбординг', href === '/onboarding', `фактически ${href}`);
  let b = await body();
  check('шаг 1: нет «рожд»', !/рожд/i.test(b), b.slice(0, 200));
  check('шаг 1: нет «birth»', !/birth/i.test(b));
  // две точки прогресса — .dot эталона: 6×6, radius 3 (активная — 18×6)
  const dots1 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div')).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.borderRadius === '3px' && cs.height === '6px' && (cs.width === '6px' || cs.width === '18px');
    }).length,
  );
  check('шаг 1: ровно 2 точки прогресса', dots1 === 2, `найдено ${dots1}`);
  await tap('НАЧАТЬ ОБУЧЕНИЕ');
  b = await body();
  check('шаг 2: «Как устроен курс» на месте', b.includes('Как устроен курс'));
  check('шаг 2: нет «рожд»', !/рожд/i.test(b), b.slice(0, 200));
  check('шаг 2: нет «birth»', !/birth/i.test(b));
  await tap('К ПЕРВОМУ УРОКУ');
  href = here();
  b = await body();
  check('CTA шага 2 приводит на «Учёбу»', href === '/' && b.includes('Учёба'), `путь ${href}`);

  console.log('\n=== 2. Герой: состояние start ===');
  href = await open('/', seed());
  b = await body();
  check('overline «МОДУЛЬ 1 · УРОК 1 ИЗ 32»', b.includes('МОДУЛЬ 1 · УРОК 1 ИЗ 32'));
  check('заголовок «Учёба»', b.includes('Учёба'));
  check('CTA «НАЧАТЬ УРОК»', b.includes('НАЧАТЬ УРОК'));
  await tap('НАЧАТЬ УРОК');
  check('start: CTA ведёт на /lesson/m1l1', here() === '/lesson/m1l1', `фактически ${here()}`);

  console.log('\n=== 3. Герой: состояние continue (пройден М1) ===');
  href = await open('/', seed({ lessonsProgress: progress(M1) }));
  b = await body();
  check('overline «УРОК 5 ИЗ 32»', b.includes('УРОК 5 ИЗ 32'), b.slice(0, 260));
  check('CTA «ПРОДОЛЖИТЬ КУРС»', b.includes('ПРОДОЛЖИТЬ КУРС'));
  await tap('ПРОДОЛЖИТЬ КУРС');
  check('continue: CTA ведёт на /lesson/m2l1', here() === '/lesson/m2l1', `фактически ${here()}`);

  console.log('\n=== 4. Герой: состояние locked (пройдены М1+М2, модуль 3 — premium) ===');
  href = await open('/', seed({ lessonsProgress: progress(M12) }));
  b = await body();
  check('locked: CTA «ОТКРЫТЬ PREMIUM»', b.includes('ОТКРЫТЬ PREMIUM'));
  await tap('ОТКРЫТЬ PREMIUM');
  check('locked без права → /paywall', here().startsWith('/paywall'), `фактически ${here()}`);

  href = await open('/', seed({ lessonsProgress: progress(M12), premium: PREMIUM_DEV }));
  b = await body();
  check('locked с правом: CTA снова «ПРОДОЛЖИТЬ КУРС»', b.includes('ПРОДОЛЖИТЬ КУРС'));
  await tap('ПРОДОЛЖИТЬ КУРС');
  check('locked с правом → /lesson/m3l1', here() === '/lesson/m3l1', `фактически ${here()}`);

  console.log('\n=== 5. Герой: состояние done (курс пройден) ===');
  href = await open('/', seed({ lessonsProgress: progress(ALL32) }));
  b = await body();
  check('done: «Курс пройден»', b.includes('Курс пройден'));
  check('done: CTA «К ТРЕНАЖЁРУ»', b.includes('К ТРЕНАЖЁРУ'));
  await tap('К ТРЕНАЖЁРУ');
  check('done: CTA ведёт на /review', here() === '/review', `фактически ${here()}`);

  console.log('\n=== 6. Строка «Карта дня» → /daily → карта → назад → назад ===');
  href = await open('/', seed());
  b = await body();
  check('на «Учёбе» строка «Карта дня» есть', b.includes('Карта дня'));
  await tap('Карта дня');
  check('строка ведёт на /daily', here() === '/daily', `фактически ${here()}`);
  b = await body();
  check('на /daily нет «лун» (до открытия)', !/лун/i.test(b), b.slice(0, 200));
  // карта дня качается ±6px бесконечно (правило AGENTS.md) — тут force обязателен
  await page.getByText('НАЖМИ, ЧТОБЫ ПЕРЕВЕРНУТЬ', { exact: true }).first().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(1300);
  b = await body();
  const drawnName = (() => {
    const lines = b.split('\n').map((s) => s.trim()).filter(Boolean);
    const i = lines.findIndex((l) => l === 'ЗНАЧЕНИЕ КАРТЫ');
    return i > 0 ? lines[i - 2] : null; // строка перед подстрочником «N · … АРКАН» — имя карты
  })();
  check('после тапа появилось имя карты', !!drawnName, b.slice(0, 200));
  check('после тапа нет «лун»', !/лун/i.test(b));
  check('«ИЗУЧИТЬ КАРТУ →» на месте', b.includes('ИЗУЧИТЬ КАРТУ →'));
  await tap('ИЗУЧИТЬ КАРТУ →');
  check('ведёт на страницу карты', here().startsWith('/card/'), `фактически ${here()}`);
  await page.goBack();
  await page.waitForTimeout(800);
  check('назад со страницы карты → /daily', here() === '/daily', `фактически ${here()}`);
  await page.goBack();
  await page.waitForTimeout(800);
  check('назад с /daily → /', here() === '/', `фактически ${here()}`);
  b = await body();
  // drawnName взят с /daily, где имя набрано ЗАГЛАВНЫМИ (.toUpperCase() в коде экрана); строка
  // DailyCardRow на «Учёбе» показывает то же имя обычным регистром — сравниваем без учёта регистра
  check('строка на «Учёбе» больше не «Карта дня» по умолчанию, а с именем карты',
    !!drawnName && b.toUpperCase().includes(drawnName), `искали «${drawnName}» в: ${b.slice(0, 260)}`);

  console.log('\n=== 7. Таб-бар: подписи (только сама панель, не весь экран — R7) ===');
  const tabbar = await page.locator('[role="tablist"]').innerText();
  check('пять подписей ровно те', tabbar === 'Учёба\nКурс\nКарты\nПрактика\nПрофиль', JSON.stringify(tabbar));
  check('в таб-баре нет «Сегодня»', !tabbar.includes('Сегодня'));
  check('в таб-баре «Расклады» не встречается как подпись', !tabbar.includes('Расклады'));

  console.log('\n=== 8. «Практика»: луна без лунного дня, входы ===');
  const MOON_RE = /лунный день|lunar day|día lunar|dia lunar/i;
  for (const lang of ['ru', 'en', 'es', 'pt']) {
    for (const route of ['/', '/spreads', '/moon', '/daily']) {
      await open(route, seed({ lang }));
      const t = await body();
      check(`${lang} ${route}: нет «лунного дня» в тексте`, !MOON_RE.test(t));
    }
  }
  href = await open('/spreads', seed());
  b = await body();
  check('на «Практике» строка луны есть (☽)', b.includes('☽'));
  await page.locator('text=☽').first().click();
  await page.waitForTimeout(800);
  check('строка луны → /moon', here() === '/moon', `фактически ${here()}`);
  await page.goBack();
  await page.waitForTimeout(800);
  check('назад с /moon → /spreads', here() === '/spreads', `фактически ${here()}`);
  await tap('Карта дня');
  check('«Карта дня» в ленте раскладов → /daily', here() === '/daily', `фактически ${here()}`);

  console.log('\n=== 9. Игра «Угадай карту по фрагменту» ===');
  href = await open('/', seed());
  check('с «Учёбы» есть вход в игру', (await body()).includes('Угадай карту'));
  await tap('Угадай карту');
  check('вход с «Учёбы» → /fragment', here().startsWith('/fragment'), `фактически ${here()}`);

  const xpBefore = await xpNow();
  let rightCount = 0;
  let sessionOk = true;
  for (let i = 0; i < 10; i++) {
    const t = await body();
    const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
    const qIdx = lines.findIndex((l) => l === 'Какая это карта?');
    const options = qIdx === -1 ? [] : lines.slice(qIdx + 1, qIdx + 5);
    if (options.length !== 4) {
      check(`вопрос ${i + 1}: показаны 4 варианта`, false, `нашли ${options.length}: ${JSON.stringify(options)}`);
      sessionOk = false;
      break;
    }
    await page.getByText(options[0], { exact: true }).first().click({ timeout: 8000 });
    await page.waitForTimeout(450);
    const styles = await page.evaluate((opts) => {
      const all = Array.from(document.querySelectorAll('div'));
      return all
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.cursor === 'pointer' && parseFloat(cs.borderTopWidth) > 0 && opts.includes((el.innerText || '').trim());
        })
        .map((el) => getComputedStyle(el).borderTopColor);
    }, options);
    const successCount = styles.filter((c) => c === SUCCESS_RGB).length;
    const dangerCount = styles.filter((c) => c === DANGER_RGB).length;
    check(`вопрос ${i + 1}: ровно один вариант с рамкой success`, successCount === 1, `success=${successCount} danger=${dangerCount} стили=${JSON.stringify(styles)}`);
    if (dangerCount === 0) rightCount++;
    await tap('ДАЛЕЕ');
  }
  if (sessionOk) {
    await page.waitForTimeout(500);
    const finalBody = await body();
    const m = finalBody.match(/ВЕРНО (\d+) ИЗ (\d+)/);
    check('итог «ВЕРНО N ИЗ 10» на месте', !!m, finalBody.slice(0, 200));
    if (m) {
      check('N в итоге совпадает с числом верных кликов', Number(m[1]) === rightCount, `итог ${m[1]}, по кликам ${rightCount}`);
      check('total в итоге — 10', Number(m[2]) === 10, m[2]);
    }
    const xpAfter = await xpNow();
    check('XP вырос ровно на число верных ответов', xpAfter - xpBefore === rightCount, `было ${xpBefore}, стало ${xpAfter}, верных ${rightCount}`);

    await tap('Ещё раз');
    const afterAgain = await body();
    check('«Ещё раз» даёт новую сессию со счётчика «1 / 10»', afterAgain.includes('1 / 10'), afterAgain.slice(0, 120));
  } else {
    check('итог игры пропущен из-за сбоя выше', false, 'сессия прервана');
  }

  href = await open('/spreads', seed());
  await tap('Угадай карту');
  check('вход с «Практики» → /fragment', here().startsWith('/fragment'), `фактически ${here()}`);
  await page.goBack();
  await page.waitForTimeout(800);
  check('назад из игры (вход с «Практики») → /spreads', here() === '/spreads', `фактически ${here()}`);

  console.log('\n=== 10. Гард онбординга на новых маршрутах ===');
  href = await open('/daily', seed({ profile: { onboarded: false } }));
  check('прямой заход на /daily до онбординга → онбординг', href === '/onboarding', `фактически ${href}`);
  href = await open('/fragment', seed({ profile: { onboarded: false } }));
  check('прямой заход на /fragment до онбординга → онбординг', href === '/onboarding', `фактически ${href}`);

  console.log('\n=== 11. Пейвол: имя магазина без двойного упоминания ===');
  href = await open('/paywall', seed());
  b = await body();
  const storeMatches = (b.match(/App Store \/ Google Play/g) || []).length;
  check('«App Store / Google Play» встречается ровно один раз', storeMatches === 1, `найдено ${storeMatches}`);
  const bareAppStore = (b.match(/App Store(?! \/ Google Play)/g) || []).length;
  const bareGooglePlay = (b.match(/(?<!App Store \/ )Google Play/g) || []).length;
  check('нет отдельного упоминания «App Store» вне общей строки', bareAppStore === 0, `найдено ${bareAppStore}`);
  check('нет отдельного упоминания «Google Play» вне общей строки', bareGooglePlay === 0, `найдено ${bareGooglePlay}`);

  console.log('\n=== 12. Консоль ===');
  const realErrors = consoleErrors.filter((e) => !/pointerEvents is deprecated/.test(e));
  check('красных ошибок в консоли нет', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));
  console.log(`  warnings: ${warns.length}`);
  [...new Set(warns)].slice(0, 8).forEach((w) => console.log(`    · ${w.slice(0, 140)}`));

  console.log('\n=== ИТОГ ===');
  console.log(`пройдено ${pass}, упало ${fails.length} (из ${pass + fails.length})`);
  if (fails.length) console.log('УПАЛО:\n  - ' + fails.join('\n  - '));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('СЦЕНАРИЙ УПАЛ:', e.message);
  process.exit(2);
});
