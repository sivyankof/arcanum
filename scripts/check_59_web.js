/* Прокликивание строк «Имя» и «Дата рождения» в настройках (задача 59, пункт 6б процесса).

   Запуск (dev-сервер поднят заново с --clear):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_59_web.js

   ⚠️ Сценарий сначала прогоняется на СЛОМАННОМ коде и обязан покраснеть (правило проекта):
   снятые строки настроек роняют группы 1–4, снятый эффект TextPrompt — проверку «отмена
   не оставляет чужой текст».
   ⚠️ Заголовок DatePicker выводится ЗАГЛАВНЫМИ («ДАТА РОЖДЕНИЯ»), а getByText с exact:false
   регистронезависим — поэтому после открытия пикера строку настройки по имени больше
   не ищем, а сверяем текст всего экрана. */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8081';

const seed = (profile) =>
  JSON.stringify({
    state: {
      themeMode: 'dark',
      lang: 'ru',
      installSeed: 12345,
      profile,
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

const FULL = { onboarded: true, name: 'Артём', birthDate: '1990-05-14', birthArcanaId: 'moon' };
const EMPTY = { onboarded: true };

let pass = 0;
const fails = [];
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  const warns = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const open = async (route, state) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
  };
  /** Переход по маршруту БЕЗ пересева: состояние уже лежит в localStorage и переживает
   *  навигацию — так проверяется, что правка из настроек доехала до профиля.
   *  ⚠️ Табом до профиля не дойти: «Настройки» — экран стека, таб-бара на нём нет,
   *  а текст «Профиль» на нём принадлежит невидимой подписи кнопки «назад». */
  const go = async (route) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
  };
  const tap = async (text, { exact = false } = {}) => {
    await page.getByText(text, { exact }).first().click({ force: true, timeout: 8000 });
    await page.waitForTimeout(700);
  };
  const body = () => page.locator('body').innerText();
  /** Единственное текстовое поле на экране — поле TextPrompt (у настроек своих input нет). */
  const input = () => page.locator('input[type="text"], input:not([type])').first();

  console.log('\n=== 1. Строки на месте и показывают значения ===');
  await open('/settings', seed(FULL));
  let b = await body();
  check('строка «Имя» есть', b.includes('Имя'), b.slice(0, 120));
  check('значение строки — имя из профиля', b.includes('Артём'));
  check('строка «Дата рождения» есть', b.includes('Дата рождения'));
  check('значение строки — дата из профиля', b.includes('1990'), b.slice(0, 200));

  console.log('\n=== 2. Пустой профиль: заглушки вместо значений ===');
  await open('/settings', seed(EMPTY));
  b = await body();
  check('имени нет → «Не указано»', b.includes('Не указано'));
  check('даты нет → «Указать»', b.includes('Указать'));

  console.log('\n=== 3. Диалог имени: сохранение ===');
  await open('/settings', seed(FULL));
  await tap('Имя', { exact: true });
  b = await body();
  check('диалог открылся: есть «Сохранить»', b.includes('Сохранить'));
  check('диалог открылся: есть «Отмена»', b.includes('Отмена'));
  await input().fill('Мария');
  await tap('Сохранить');
  b = await body();
  check('строка показывает новое имя', b.includes('Мария'), b.slice(0, 200));
  check('прежнего имени в строке нет', !b.includes('Артём'));

  console.log('\n=== 4. Имя доехало до заголовка профиля ===');
  await go('/profile');
  b = await body();
  check('заголовок профиля — новое имя', b.includes('Мария'), b.slice(0, 120));

  console.log('\n=== 5. Отмена ничего не меняет и не оставляет чужой текст ===');
  await open('/settings', seed({ ...FULL, name: 'Мария' }));
  await tap('Имя', { exact: true });
  await input().fill('Черновик');
  await tap('Отмена');
  b = await body();
  check('после «Отмены» имя прежнее', b.includes('Мария') && !b.includes('Черновик'));
  await tap('Имя', { exact: true });
  const reopened = await input().inputValue();
  check('повторное открытие показывает сохранённое имя, а не черновик', reopened === 'Мария', reopened);
  await tap('Отмена');

  console.log('\n=== 6. Пустое имя убирает его отовсюду ===');
  await tap('Имя', { exact: true });
  await input().fill('   ');
  await tap('Сохранить');
  b = await body();
  check('строка показывает «Не указано»', b.includes('Не указано'), b.slice(0, 200));
  await go('/profile');
  b = await body();
  check('заголовок профиля вернулся к «Профиль»', b.includes('Профиль') && !b.includes('Мария'));

  console.log('\n=== 7. Смена уже заданной даты рождения ===');
  await open('/settings', seed(FULL));
  await tap('Дата рождения');
  b = await body();
  check('пикер открылся (есть «Готово»)', b.includes('Готово'), b.slice(0, 160));
  await tap('1994', { exact: true });
  await tap('Готово');
  b = await body();
  check('строка показывает новый год', b.includes('1994'), b.slice(0, 200));
  check('прежнего года в строке нет', !b.includes('1990'));

  console.log('\n=== 8. Аркан рождения пересчитан ===');
  const arcana = await page.evaluate(() => {
    const raw = localStorage.getItem('arcanum-app');
    return raw ? JSON.parse(raw).state.profile.birthArcanaId : null;
  });
  check('birthArcanaId сменился с moon', arcana && arcana !== 'moon', String(arcana));

  console.log('\n=== Консоль ===');
  const realErrors = errors.filter((e) => !/DevTools|source map|Download the React/i.test(e));
  check('красных ошибок нет', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  console.log(`  warnings: ${warns.length}`);
  [...new Set(warns)].slice(0, 6).forEach((w) => console.log(`    · ${w.slice(0, 140)}`));

  console.log(`\nИтог: ${pass} прошло, ${fails.length} упало (из ${pass + fails.length})`);
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
