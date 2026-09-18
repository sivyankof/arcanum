/* Скриншоты и баннеры витрины (спека 63) — снимаются БЕЗ телефона.
   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_63.js [--store google|apple] [--lang ru,en,es,pt] [--only home,course]

   Как устроено: приложение снимается как есть (390×844 @3× = 1170×2532, PNG в памяти) и кладётся
   с подписью на холст магазина шаблоном docs/store/frame.html → JPEG q92 (у JPEG нет альфы, которую
   запрещают оба магазина). Google — 1080×1920 (9:16: наш 390×844 = 2.16:1 не проходит правило
   «длинная сторона ≤ 2× короткой»), Apple — 1290×2796. Баннер — docs/store/feature.html → PNG,
   альфу снимает scripts/store_assets.py feature.

   ⚠️ Часы браузера пришпилены (page.clock.install): кадры воспроизводимы, дата в шапке и календарь
   не плывут. Сегодняшняя запись дневника считается от ЛОКАЛЬНОЙ даты этих часов: todayDraw() ищет
   localDateISO(), а UTC-срез toISOString() в аудите 56 оставил карту дня закрытой.
   ⚠️ У каждого кадра маркеры (имя карты на языке кадра из cards.json, заголовок из i18n.ts, видимый
   <img> карты): нет маркера — FAIL с именем кадра, пустой кадр в набор не идёт (урок 56).
   ⚠️ Карты на кадрах — только вне списка наготы (правила Play к графике витрины): проверяется по
   ТОМУ, что реально может попасть в кадр/сессию (REAL_DECK), а не только по константам кадров.
   ⚠️ Шрифты и кадр передаются шаблону data-URI: file://-страница не грузит file://-шрифты без флага.
   ⚠️ Сид — форма scripts/shoot_56.js (урок 54: сид не сочинять).
   ⚠️ Таб-бар перед съёмкой получает нижний safe-area inset (fixTabBarSafeArea) — на вебе он
   прижат к самой кромке вьюпорта. Это НЕ чинит обрезанные подписи вкладок (первая правка ревью
   63/1 лечила именно кромку и не помогла): контейнер подписи сам высотой ровно 10 px при
   font-size 10 px и line-height:normal, а реальная строка Manrope в 10 px занимает ~13.5 px —
   overflow:hidden контейнера режет нижние ~3.5 px глифов независимо от отступа снизу. Вторым
   проходом та же функция снимает это ограничение с самих подписей (fixTabBarLabels) и
   самопроверяется: overflow обязан перестать быть hidden, высота — превысить кегль, найденных
   подписей на экране с таб-баром — ровно пять; иначе кадр падает в failed с причиной, а не
   снимается обрезанным (находка ревью 63/1, вторая часть).
   ⚠️ --only принимает список id через запятую; незнакомый id роняет прогон с его именем и
   списком допустимых, а не тихо снимает ноль кадров (находка ревью 63/6). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const STORE = opt('--store', 'google');
const LANGS = opt('--lang', 'ru,en,es,pt').split(',');
// AGENTS.md обещает список через запятую («--only id,…») — до находки ревью 63/6 код понимал
// только одиночное строгое равенство, и опечатка/незнакомый id тихо пропускали ВСЕ кадры
// («кадров снято: 0, не снято: 0», код выхода 0 — нулевая работа под видом успеха). Валидация
// списка — ниже, сразу после объявления SCREENS (там же известен список допустимых id).
const ONLY_IDS = opt('--only', '').split(',').map((s) => s.trim()).filter(Boolean);
const CANVAS = { google: { w: 1080, h: 1920 }, apple: { w: 1290, h: 2796 } }[STORE];
if (!CANVAS) throw new Error(`неизвестный магазин ${STORE}`);

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8081';
const OUT = path.join(ROOT, 'docs/store', STORE);
const FEATURE_OUT = path.join(ROOT, 'docs/store/feature');
const CLOCK = '2026-09-18T10:00:00'; // пятница; новолуние 11.09 позади, полнолуние 26.09 впереди
const TODAY = '2026-09-18';

const captions = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/store/captions.json'), 'utf8'));
// форма файлов — как в src/lib/content.ts: `.cards`, `.spreads`, `.modules`; name/keywords — по языкам
const cards = require('../content/cards.json').cards;
const spreads = require('../content/spreads.json').spreads;
const modules = require('../content/course.json').modules;
const I18N = fs.readFileSync(path.join(ROOT, 'src/lib/i18n.ts'), 'utf8');
// themeHex/hexToRgb — общий scripts/lib/seed72.js (правка финального ревью, находка F12):
// раньше эта пара жила только здесь копией, теперь ей пользуется и check_72_web.js
const { themeHex, hexToRgb } = require('./lib/seed72');
// фон градиента ScreenBg — цвет темы, а не хардкод (находка ревью 63/5: доказать нужно ИМЕННО
// применение светлой темы, а не только видимость карты дня, которая видна в обеих темах)
const LIGHT_BG_RGB = hexToRgb(themeHex('lightTheme', 'bg'));

const NUDITY = ['star', 'sun', 'lovers', 'devil', 'judgement', 'world'];
const DAY_CARD = 'magician';
// «Луна» ушла из набора вместе с кадром лунного календаря (спека 72, задача 15) — карта детали
// не должна нести лунную/«нагую» тематику; «Отшельник» ни то ни другое (страж наготы ниже остаётся)
const DETAIL_CARD = 'hermit';
const SPREAD_CARDS = ['empress', 'chariot', 'strength'];
// Только семь карт без наготы, годных лечь на кадр витрины (порядок случаен, любая из семи
// допустима). РЕАЛЬНАЯ колода тренажёра шире — см. REAL_DECK ниже (находка ревью 63/3).
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'chariot'];
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const M12_SET = new Set(M12);
const ALL_LANGS = ['ru', 'en', 'es', 'pt']; // канонический порядок языков — как в i18n.ts

// id-ы уроков модуля 1 — из ИСТОЧНИКА (course.json), а не литералом рядом с M12: кадр «Учёба»
// (спека 72) сеет «модуль 1 пройден целиком, модуль 2 нет» отдельно от «M12 пройден» (курс/тренажёр),
// поэтому нужен собственный список, который не разъедется, если в модуле 1 изменится число уроков.
const MODULE1_IDS = modules[0].lessons.map((l) => l.id);
/** Карта id уроков → «пройден» для точечных сидов кадров (герой «Учёбы», викторина). */
const doneMap = (ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));

/** Колода тренажёра строится ВО ВРЕМЯ ИСПОЛНЕНИЯ из карт пройденных уроков (learnedCardIds
 *  в src/lib/courseProgress.ts), а не из DECK — урок «Повторение» модуля 2 (m2l5) тащит карты
 *  модуля целиком, и среди них — lovers (список наготы), которой в DECK нет. Пересчитываем
 *  то же множество здесь на сиде M12 (первоисточник — сид, как и modulePct ниже); TS-модуль
 *  в голый node-скрипт не импортируем (см. i18nText выше). Находка ревью 63/3. */
const REAL_DECK = new Set();
for (const m of modules) for (const l of m.lessons) if (M12_SET.has(l.id)) l.cards.forEach((c) => REAL_DECK.add(c));

/** SRS-сид тренажёра (единственный источник — используется в seed() ниже, дублировать нельзя):
 *  карты DECK — «просрочены» (due в прошлом, попадают в сессию как повторение, как раньше).
 *  Карты из REAL_DECK, которых в DECK нет (сейчас — только lovers), — из списка наготы: на них
 *  сеется due ДАЛЕКО в будущем. Карта остаётся в колоде (deckOrder её видит, «8 карт» — правда),
 *  но не попадает в сессию НИ новой (запись в srs уже есть), НИ просроченной (due не наступил) —
 *  buildSession/reviewSummary (src/lib/review.ts) фильтруют ровно по этому due. Это исключение,
 *  а не маскировка карты. */
const FUTURE_DUE = '2099-01-01';
const SRS_SEED = Object.fromEntries(
  [...REAL_DECK].map((id) => [
    id,
    { reps: 2, intervalDays: 3, ease: 2.5, due: NUDITY.includes(id) ? FUTURE_DUE : '2026-01-01' },
  ]),
);
/** Реально ли карта может попасть в сессию при сиде выше — та же формула, что у
 *  buildSession/reviewSummary: свежая (записи в SRS_SEED нет) или уже просрочена (due наступил).
 *  Гвард наготы ниже проверяет по НЕЙ, а не по константам кадров — иначе он слеп к тому, что
 *  тренажёр берёт колоду из прогресса курса (находка ревью 63/3, вторая половина). */
const entersSession = (id) => {
  const s = SRS_SEED[id];
  return !s || s.due <= TODAY;
};

for (const id of [DAY_CARD, DETAIL_CARD, ...SPREAD_CARDS, ...DECK, ...[...REAL_DECK].filter(entersSession)]) {
  if (NUDITY.includes(id)) throw new Error(`карта ${id} из списка наготы — в витрину нельзя`);
  if (!cards.find((c) => c.id === id)) throw new Error(`карты ${id} нет в колоде`);
}
// то же самое для раскладов и модуля курса, которых спрашивают маркеры check() ниже: переименуют
// расклад или пересоберут курс — тут упадёт со внятной причиной, а не «Cannot read properties of
// undefined» посреди прогона (находка ревью 63/4 — там не было списка, крах ронял весь скрипт)
const SPREAD_IDS = ['three-card'];
for (const id of SPREAD_IDS) {
  if (!spreads.find((sp) => sp.id === id)) throw new Error(`расклада «${id}» нет в spreads.json`);
}
const COURSE_MODULE_INDEX = 0; // кадр «Курс» показывает модуль 1 (пройден целиком) — см. экран course
if (!modules[COURSE_MODULE_INDEX]) throw new Error(`нет модуля с индексом ${COURSE_MODULE_INDEX} в course.json`);

// кадр «Викторина» (спека 72, задача 15): первый вопрос урока m1l2 — та же проверка «есть ли
// то, что спрашивают маркеры», что у SPREAD_IDS/модуля курса выше, а не молчаливое падение
// на undefined посреди прогона
const QUIZ_LESSON = modules[0].lessons.find((l) => l.id === 'm1l2');
if (!QUIZ_LESSON) throw new Error('нет урока m1l2 в course.json (нужен кадру «Викторина»)');
const QUIZ0 = QUIZ_LESSON.quiz && QUIZ_LESSON.quiz[0];
if (!QUIZ0) throw new Error('в уроке m1l2 нет ни одного вопроса викторины');

/** Строка i18n для языка: файл режется на языковые блоки по `  <lang>: {`, внутри блока —
 *  первый `key: "…"` после `      <section>: {`. Маркеры берутся из исходника, не из памяти. */
function i18nText(lang, section, key) {
  const starts = ALL_LANGS.map((l) => I18N.search(new RegExp(`^  ${l}: \\{`, 'm')));
  if (starts.some((s) => s < 0)) throw new Error('не нашёл языковые блоки i18n.ts');
  const i = ALL_LANGS.indexOf(lang);
  const chunk = I18N.slice(starts[i], i + 1 < ALL_LANGS.length ? starts[i + 1] : undefined);
  const sec = chunk.search(new RegExp(`^      ${section}: \\{`, 'm'));
  if (sec < 0) throw new Error(`секции ${section} нет в блоке ${lang}`);
  const m = chunk.slice(sec).match(new RegExp(`\\b${key}: "([^"]+)"`));
  if (!m) throw new Error(`ключа ${section}.${key} нет в блоке ${lang}`);
  return m[1];
}
/** Подстановка `{{ключ}}` в шаблон i18n (`home.lessonOf` и родня) — сырой текст берётся
 *  i18nText'ом, значения свои, без i18next: скрипту нужна ровно одна собранная строка на кадр. */
function fillTemplate(tmpl, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)), tmpl);
}
const cardName = (id, lang) => cards.find((c) => c.id === id).name[lang];
const spreadName = (id, lang) => spreads.find((s) => s.id === id).name[lang];
// прогресс модуля курса для кадра «Курс» — та же формула, что moduleProgress() в
// src/lib/courseProgress.ts (не импортируем TS-модуль в голый node-скрипт, см. i18nText выше:
// здесь принят тот же приём «читать из первоисточника», только первоисточник — сид, а не файл;
// M12_SET объявлен выше, вместе с DECK/REAL_DECK)
const modulePct = (mod, doneIds) => {
  const total = mod.lessons.length;
  const done = mod.lessons.filter((l) => doneIds.has(l.id)).length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
};
const COURSE_PCT = modulePct(modules[COURSE_MODULE_INDEX], M12_SET);
// сквозной номер урока по курсу для героя «Учёбы» (home.lessonOf): та же формула, что
// nextLessonSummary() в src/lib/courseProgress.ts — модуль 1 (MODULE1_IDS.length уроков) пройден
// целиком ⇒ следующий урок первый в модуле 2, его номер — сразу после последнего урока модуля 1
const TOTAL_LESSONS = modules.reduce((n, m) => n + m.lessons.length, 0);
const HOME_HERO = { m: 2, n: MODULE1_IDS.length + 1, total: TOTAL_LESSONS };

/** Дневник: сегодня (по пришпиленным часам) — Маг, четыре прошлых дня — серия 5 (форма shoot_56). */
const JOURNAL = ['magician', 'high-priestess', 'empress', 'high-priestess', 'chariot'].map((cardId, i) => ({
  date: `2026-09-${String(18 - i).padStart(2, '0')}`,
  cardId,
  reversed: false,
  ...(i === 1 ? { note: 'Разговор прошёл мягче, чем ждала', outcome: 'yes' } : {}),
}));
const SAVED_SPREAD = { ts: 1758100000000, date: '2026-09-17', spreadId: 'three-card',
  cards: SPREAD_CARDS.map((cardId) => ({ cardId, reversed: false })) };

function seed(lang, extra = {}) {
  return JSON.stringify({
    state: {
      themeMode: 'dark',
      lang,
      installSeed: 12345,
      lastDrawDate: TODAY,
      profile: { onboarded: true, name: 'Артём', birthDate: '1990-05-14', birthArcanaId: 'justice' },
      premium: { active: false, source: 'none', until: null },
      lessonsProgress: Object.fromEntries(M12.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }])),
      srs: SRS_SEED,
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      history: JOURNAL,
      spreadsHistory: [SAVED_SPREAD],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 11,
  });
}

/** Кадры: route, extra сида, prepare (тапы до кадра, получает lang), check (маркеры; возвращает
 *  список проблем). Порядок — как в captions.json (проверяется ниже) и в спеке 72 §8: home, course,
 *  quiz, fragment, trainer, detail, spread, home-light. Кадры «Карта дня» и «Лунный календарь»
 *  ушли из набора вместе с ними самими с первого экрана (спека 72, задача 15) — новый первый
 *  экран учебный, поэтому первый кадр витрины теперь «Учёба». */
const SCREENS = [
  { id: 'home', route: '/', extra: { lessonsProgress: doneMap(MODULE1_IDS) },
    // герой показывает СЛЕДУЮЩИЙ урок (модуль 1 пройден целиком ⇒ первый урок модуля 2) —
    // маркер не «есть текст „5"» (эту цифру дала бы и серия дней, seed streak:5), а точная строка
    // оверлайна героя, собранная из сырого шаблона home.lessonOf (находка при написании кадра)
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      if (!t.includes(i18nText(lang, 'home', 'title'))) problems.push('нет заголовка «Учёба»');
      const hero = fillTemplate(i18nText(lang, 'home', 'lessonOf'), HOME_HERO);
      if (!t.includes(hero)) problems.push(`нет оверлайна героя «${hero}» (модуль 1 пройден ⇒ урок ${HOME_HERO.n})`);
      return problems;
    } },
  { id: 'course', route: '/course',
    // экран сам автоскроллит к ТЕКУЩЕМУ уроку (первый непройденный — «дырка» lessonStates),
    // а в сиде это модуль 3: витрине такой кадр не годится (все узлы заперты, прогресса не
    // видно, хвост модуля 2 обрезан сверху — находка ревью 63/4). Возвращаем скролл к началу,
    // чтобы в кадр попал пройденный модуль 1 с прогрессом.
    prepare: async (page) => {
      await page.evaluate(() => {
        const scroller = [...document.querySelectorAll('div')].find(
          (el) => el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY),
        );
        if (!scroller) throw new Error('не нашёл скролл-контейнер курса');
        // scrollTo({behavior:'instant'}) на этом узле всё равно доигрывает CSS scroll-behavior:
        // smooth (замерено — плавный откат от старой позиции к 0 растянут почти на 1.5с), поэтому
        // снимаем smooth явно и двигаем свойством scrollTop — оно применяется мгновенно
        scroller.style.scrollBehavior = 'auto';
        scroller.scrollTop = 0;
      });
      await page.waitForTimeout(300);
    },
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      const m1 = modules[COURSE_MODULE_INDEX].title[lang];
      if (!t.includes(m1)) problems.push(`нет заголовка модуля 1 «${m1}»`);
      // признак пройденности: без lessonsProgress модуль 1 показал бы 0%, а не COURSE_PCT —
      // маркер обязан упасть на сломанном состоянии (проверено мутацией, см. отчёт задачи)
      if (!t.includes(`${COURSE_PCT}%`)) problems.push(`нет отметки прогресса модуля 1 (ожидали ${COURSE_PCT}%)`);
      return problems;
    } },
  { id: 'quiz', route: '/lesson/m1l2', extra: { lessonsProgress: doneMap(['m1l1']) },
    // варианты перемешиваются Math.random'ом при каждой загрузке экрана (src/lib/lesson.ts,
    // shuffleOptions) — заранее известного индекса верного варианта нет, только его ТЕКСТ
    // (options[correct][lang], у вопроса m1l2/quiz[0] это «56»/«78»/«22» на всех языках).
    // Доходим до вопроса тем же кликом, что и у остальных «далее»-шагов (без карточных шагов —
    // у m1l2 cards: []), ищем текст ответа на экране, а не считаем страницы теории заранее.
    prepare: async (page, lang) => {
      const answerText = QUIZ0.options[QUIZ0.correct][lang];
      const nextLabel = i18nText(lang, 'lesson', 'next');
      let reached = false;
      for (let i = 0; i < 8; i++) {
        if (await page.getByText(answerText, { exact: true }).count()) { reached = true; break; }
        await page.getByText(nextLabel, { exact: true }).first().click({ force: true });
        await page.waitForTimeout(300);
      }
      if (!reached) throw new Error(`не дошли до вопроса викторины m1l2 за 8 тапов «${nextLabel}»`);
      await page.getByText(answerText, { exact: true }).first().click({ force: true });
      await page.waitForTimeout(500);
    },
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      if (!t.includes(QUIZ0.q[lang])) problems.push('нет текста вопроса викторины m1l2');
      // «Верно.» рисуется ТОЛЬКО когда выбранный вариант совпал с correct (app/lesson/[id].tsx) —
      // косвенное, но точное доказательство подсветки верного варианта на кадре
      if (!t.includes(i18nText(lang, 'lesson', 'explainRight'))) problems.push('нет отметки «верно» — на кадре не выбран верный вариант');
      return problems;
    } },
  { id: 'fragment', route: '/fragment',
    // сессия и карта случайны (Math.random в buildFragmentSession) — форма кадра не зависит от
    // того, какая карта выпала: фрагменты размечены «без фигур» (спека 72 §10), поэтому наготы
    // тут не бывает ни при какой карте, и страж NUDITY выше по файлу сюда не нужен
    check: async (page, lang) => {
      const problems = [];
      const lines = (await text(page)).split('\n').map((s) => s.trim()).filter(Boolean);
      const qMarker = i18nText(lang, 'game', 'question');
      const qIdx = lines.indexOf(qMarker);
      const options = qIdx >= 0 ? lines.slice(qIdx + 1, qIdx + 5) : [];
      if (options.length !== 4) problems.push(`вариантов ${options.length} вместо 4 (маркер «${qMarker}» ${qIdx >= 0 ? 'найден' : 'не найден'})`);
      // :visible прямо в селекторе (не проверкой видимости ПЕРВОГО найденного) — на странице
      // может быть скрытый нулевой по площади элемент раньше настоящего фрагмента в DOM-порядке
      // (та же ловушка, что у тренажёра — правило AGENTS.md)
      if (!(await visible(page, 'img[src*="cards/"]:visible'))) problems.push('нет фрагмента карты');
      return problems;
    } },
  { id: 'trainer', route: '/review',
    prepare: async (page) => {
      // переворачиваем карточку: оборот — значение и четыре оценки
      // ⚠️ без ведущего слэша: unstable_path директории кодирует «/» как %2F и только слэш
      // перед именем файла остаётся буквальным («…%2Fcards/magician.jpg») — «/cards/» не встречается
      // ⚠️ на странице ДВЕ картинки «cards/»: скрытый префетч карты дня (0×0, не в разметке
      // тренажёра) и сама грань FlipCard — :visible отсекает нулевую по площади (урок 43/44)
      await page.locator('img[src*="cards/"]:visible').first().click({ force: true });
      await page.waitForTimeout(1100);
    },
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      if (!t.includes(i18nText(lang, 'review', 'title'))) problems.push('нет заголовка тренажёра');
      // Доказательство переворота — три кнопки оценки: они рисуются ТОЛЬКО после ответа
      // (`{revealed && (...)}` в app/review.tsx), а НЕ первое ключевое слово — оно нарисовано
      // на ОБЕИХ гранях FlipCard в направлении toMeaning (KeywordChips есть уже на лицевой
      // стороне, ReviewFlashcard/CardBack), и маркер был зелёным примерно в половине прогонов
      // БЕЗ тапа по карточке (находка ревью 63/2). Заголовок панели «ЗНАЧЕНИЕ» сюда НЕ годится
      // тем же способом: подсказка «ВСПОМНИТЕ ЗНАЧЕНИЕ · НАЖМИТЕ» ДО ответа (направление
      // toMeaning) уже содержит слово «ЗНАЧЕНИЕ»/«MEANING» как подстроку — с ним маркер был бы
      // зелёным раньше времени ровно в тех же случаях, которые правит эта находка. Тексты
      // оценок — существующим чтецом i18n.ts, не хардкодом.
      for (const key of ['gradeForgot', 'gradeGood', 'gradeEasy']) {
        if (!t.includes(i18nText(lang, 'review', key))) problems.push(`нет кнопки оценки «${key}»`);
      }
      return problems;
    } },
  { id: 'detail', route: `/card/${DETAIL_CARD}`,
    check: async (page, lang) => [
      ...(await visible(page, `img[src*="/${DETAIL_CARD}"]`) ? [] : ['нет скана карты']),
      ...((await text(page)).includes(cardName(DETAIL_CARD, lang)) ? [] : [`нет имени «${cardName(DETAIL_CARD, lang)}»`]),
    ] },
  { id: 'spread', route: `/spread/${SAVED_SPREAD.ts}`,
    check: async (page, lang) => {
      const missing = [];
      for (const id of SPREAD_CARDS) if (!(await visible(page, `img[src*="/${id}"]`))) missing.push(`карта ${id} не открыта`);
      if (!(await text(page)).includes(spreadName('three-card', lang))) missing.push('нет названия расклада');
      return missing;
    } },
  { id: 'home-light', route: '/', extra: { lessonsProgress: doneMap(MODULE1_IDS), themeMode: 'light' },
    check: async (page, lang) => {
      const problems = [];
      if (!(await text(page)).includes(i18nText(lang, 'home', 'title'))) problems.push('нет заголовка «Учёба»');
      // маркер самой темы (находка ревью 63/5): содержимое экрана видно в ОБЕИХ темах, поэтому
      // само наличие текста не доказывает, что применилась именно светлая — смотрим цвет фона
      // ScreenBg напрямую (градиент несёт lightTheme.bg из theme.ts третьей остановкой)
      const hasLightBg = await page.evaluate((rgb) => {
        const W = window.innerWidth, H = window.innerHeight;
        return [...document.querySelectorAll('div')].some((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < W - 4 || r.height < H - 4) return false;
          return getComputedStyle(el).backgroundImage.includes(rgb);
        });
      }, LIGHT_BG_RGB);
      if (!hasLightBg) problems.push(`фон не светлой темы (нет ${LIGHT_BG_RGB} в градиенте на весь экран)`);
      return problems;
    } },
];
const SCREEN_IDS = SCREENS.map((s) => s.id);
// Находка ревью 63/6: неизвестный --only обязан ронять прогон с именем экрана и списком
// допустимых, а не молча снять ноль кадров под кодом выхода 0.
for (const id of ONLY_IDS) {
  if (!SCREEN_IDS.includes(id)) {
    throw new Error(`--only: неизвестный экран «${id}», допустимые: ${SCREEN_IDS.join(', ')}`);
  }
}
if (Object.keys(captions.screens).join() !== SCREENS.map((s) => s.id).join()) {
  throw new Error('порядок экранов в captions.json не совпадает со списком SCREENS');
}
// полнота подписей на старте (находка ревью 63/4): без этой проверки неполный captions.json
// молча кладёт на холст undefined вместо заголовка/подписи — и это не поймает даже глаз на
// скриншоте языка, для которого пара действительно нашлась
for (const s of SCREENS) {
  for (const lang of ALL_LANGS) {
    const pair = captions.screens[s.id]?.[lang];
    const ok = Array.isArray(pair) && pair.length === 2 && pair.every((x) => typeof x === 'string' && x.trim());
    if (!ok) throw new Error(`captions.json: нет пары «заголовок/подпись» для экрана «${s.id}», язык «${lang}»`);
  }
}
for (const lang of ALL_LANGS) {
  if (typeof captions.tagline?.[lang] !== 'string' || !captions.tagline[lang].trim()) {
    throw new Error(`captions.json: нет tagline для языка «${lang}»`);
  }
}

const text = (page) => page.locator('body').innerText();
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const fontFace = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${fs.readFileSync(file).toString('base64')}) format('truetype');}`;
const FONTS = [
  fontFace('Cormorant Garamond', 600, path.join(ROOT, 'node_modules/@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf')),
  fontFace('Manrope', 500, path.join(ROOT, 'node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf')),
].join('\n');
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');

/** Таб-бар на вебе не получает нижний safe-area inset (на устройстве ~34 px поднимает бар над
 *  кромкой экрана — системная зона под жест/индикатор). Без него подписи вкладок срезаются
 *  нижней кромкой вьюпорта. Контейнер ищем по геометрии (прижат к низу вьюпорта, во всю ширину,
 *  высота 20–150 px — по факту 48–49), а не по классу/тексту: атомарные классы RN Web у него
 *  безымянные и меняются от сборки к сборке; `querySelectorAll('*')` возвращает элементы в
 *  порядке документа, поэтому первое совпадение — самый ВНЕШНИЙ (сам таб-бар), а не один из
 *  его внутренних слоёв фона. На экранах без таб-бара (карта, расклад, тренажёр, луна)
 *  подходящего элемента нет — функция молча ничего не делает (проверено на всех четырёх).
 *  `!important` обязателен: без него инлайн-правило `height`, выставленное один раз, при
 *  следующем ререндере RN Web перезатирается атомарным классом той же специфичности —
 *  замерено 26.08.
 *
 *  Второй, независимый дефект — сама подпись, а не кромка вьюпорта (находка ревью 63/1,
 *  первая правка выше её не лечит): контейнер подписи высотой ровно 10 px при font-size 10 px
 *  и line-height:normal, а реальная строка Manrope в 10 px занимает ~13.5 px — «Расклады» читается
 *  как «Расклалы», у «Профиль» отрезан хвост «ь». Подписи ищем ВНУТРИ уже найденного bar по
 *  ФАКТИЧЕСКОМУ тексту вкладки для языка кадра (labels, из i18n.ts через i18nText), а не по
 *  классу (тот же довод, что выше) и не по всей странице: на экране «Курс» тем же текстом
 *  «Курс» может быть заголовок, и без ограничения поиска контейнером таб-бара это была бы
 *  вторая находка, а не одна. */
const TAB_BAR_INSET = 34; // типичный safe-area inset снизу на iPhone с Home Indicator
const TAB_LABEL_LINE_HEIGHT = 1.35; // при этом реальная высота строки Manrope 10px ≈ 13.5px — измерено 26.08
async function fixTabBarSafeArea(page, lang) {
  const labels = ['learn', 'course', 'cards', 'practice', 'profile'].map((key) => i18nText(lang, 'tabs', key));
  const r = await page.evaluate(({ inset, labels, lineHeight }) => {
    const W = window.innerWidth, H = window.innerHeight;
    const bar = [...document.querySelectorAll('*')].find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.bottom >= H - 2 && rect.width >= W - 4 && rect.height > 20 && rect.height < 150;
    });
    if (!bar) return { hasBar: false };
    const h = bar.getBoundingClientRect().height;
    bar.style.setProperty('height', `${h + inset}px`, 'important');
    bar.style.setProperty('padding-bottom', `${inset}px`, 'important');
    bar.style.setProperty('box-sizing', 'border-box', 'important');

    // подписи — листовые узлы ВНУТРИ бара с точным текстом вкладки на языке кадра
    const found = [...bar.querySelectorAll('*')].filter(
      (el) => el.children.length === 0 && labels.includes((el.textContent || '').trim()),
    );
    for (const el of found) {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('line-height', String(lineHeight), 'important');
    }
    // самопроверка в том же evaluate — без второго похода в браузер
    const checked = found.map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || '').trim(),
        overflow: cs.overflow,
        heightPx: el.getBoundingClientRect().height,
        fontPx: parseFloat(cs.fontSize),
      };
    });
    return { hasBar: true, foundCount: found.length, checked };
  }, { inset: TAB_BAR_INSET, labels, lineHeight: TAB_LABEL_LINE_HEIGHT });

  if (!r.hasBar) return; // экран без таб-бара — молча ничего не делаем
  // На экране с таб-баром подписей РОВНО пять (today/course/cards/spreads/profile) — молчаливое
  // «не нашли» недопустимо (находка ревью 63/1): расхождение в числе кадр не снимает, а роняет.
  if (r.foundCount !== 5) {
    throw new Error(`подписей вкладок найдено ${r.foundCount} вместо 5 (искали: ${labels.join(' / ')})`);
  }
  for (const c of r.checked) {
    if (c.overflow === 'hidden' || !(c.heightPx > c.fontPx)) {
      throw new Error(
        `подпись «${c.text}» всё ещё обрезана контейнером (overflow=${c.overflow}, высота ${c.heightPx.toFixed(1)}px ≤ кегль ${c.fontPx}px)`,
      );
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  const app = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await app.clock.install({ time: CLOCK });
  await app.clock.resume();
  const errors = [];
  app.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const frame = await browser.newPage({ viewport: { width: CANVAS.w, height: CANVAS.h }, deviceScaleFactor: 1 });
  await frame.goto(fileUrl(path.join(ROOT, 'docs/store/frame.html')));
  await frame.addStyleTag({ content: FONTS });
  await frame.evaluate(() => document.fonts.ready);

  const failed = [];
  let shots = 0;
  for (const lang of LANGS) {
    fs.mkdirSync(path.join(OUT, lang), { recursive: true });
    for (const [n, s] of SCREENS.entries()) {
      if (ONLY_IDS.length && !ONLY_IDS.includes(s.id)) continue;
      const tag = `${lang}/${s.id}`;
      // Один try на ВЕСЬ кадр — от перехода до записи файла на диск. Раньше защита стояла только
      // вокруг prepare()/check() (находка ревью 63/4, повторилась дважды на разных стадиях): падение
      // навигации, сида или самой съёмки/компоновки уходило мимо failed во внешний `.catch`, роняя
      // process.exit(2) и обрывая прогон по остальным языкам без указания, где именно и для кого
      // упало. Стадия называется явно в сообщении — это единственное, что меняется по ходу try.
      let stage = 'goto';
      try {
        await app.goto(`${BASE}${s.route}`, { waitUntil: 'domcontentloaded' });
        stage = 'сид';
        await app.evaluate((v) => localStorage.setItem('arcanum-app', v), seed(lang, s.extra));
        await app.reload({ waitUntil: 'networkidle' });
        await app.waitForTimeout(1800);
        if ((await app.evaluate(() => window.innerWidth)) !== 390) throw new Error('вьюпорт не 390 — кадр недостоверен');
        stage = 'safe-area';
        await fixTabBarSafeArea(app, lang);
        stage = 'prepare';
        if (s.prepare) await s.prepare(app, lang);
        stage = 'check';
        const problems = await s.check(app, lang);
        if (problems.length) {
          failed.push(`${tag}: ${problems.join('; ')} (url ${app.url().replace(BASE, '')})`);
          console.log(`  ✗ ${tag}`);
          continue;
        }
        stage = 'съёмка';
        const raw = await app.screenshot({ type: 'png' });
        const [title, sub] = captions.screens[s.id][lang];
        stage = 'компоновка';
        await frame.evaluate((a) => window.compose(a), {
          w: CANVAS.w, h: CANVAS.h, img: `data:image/png;base64,${raw.toString('base64')}`, title, sub,
        });
        await frame.waitForTimeout(150);
        const file = path.join(OUT, lang, `${String(n + 1).padStart(2, '0')}-${s.id}.jpg`);
        await frame.screenshot({ path: file, type: 'jpeg', quality: 92 });
        shots++;
        console.log(`  ✓ ${tag} → ${path.relative(ROOT, file)}`);
      } catch (e) {
        failed.push(`${tag}: ИСКЛЮЧЕНИЕ на стадии «${stage}»: ${e.message} (url ${app.url().replace(BASE, '')})`);
        console.log(`  ✗ ${tag}`);
      }
    }
  }

  if (!ONLY_IDS.length && STORE === 'google') {
    fs.mkdirSync(FEATURE_OUT, { recursive: true });
    const icon = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'assets/images/icon.png')).toString('base64')}`;
    const banner = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    await banner.goto(fileUrl(path.join(ROOT, 'docs/store/feature.html')));
    await banner.addStyleTag({ content: FONTS });
    await banner.evaluate(() => document.fonts.ready);
    for (const lang of LANGS) {
      await banner.evaluate((a) => window.render(a), { title: 'Arcanum', tagline: captions.tagline[lang], icon });
      await banner.waitForTimeout(150);
      await banner.screenshot({ path: path.join(FEATURE_OUT, `${lang}.png`), type: 'png' });
      console.log(`  ✓ баннер ${lang}`);
    }
  }

  console.log(`\nкадров снято: ${shots}, не снято: ${failed.length}`);
  failed.forEach((f) => console.log(`  ✗ ${f}`));
  if (errors.length) console.log(`ошибок страницы: ${errors.length}\n  ${errors.slice(0, 5).join('\n  ')}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('СЦЕНАРИЙ УПАЛ:', e.message);
  process.exit(2);
});
