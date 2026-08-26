/* Скриншоты и баннеры витрины (спека 63) — снимаются БЕЗ телефона.
   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/shoot_63.js [--store google|apple] [--lang ru,en,es,pt] [--only today]

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
   ⚠️ Карты на кадрах — только вне списка наготы (правила Play к графике витрины): проверяется списком.
   ⚠️ Шрифты и кадр передаются шаблону data-URI: file://-страница не грузит file://-шрифты без флага.
   ⚠️ Сид — форма scripts/shoot_56.js (урок 54: сид не сочинять). */
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
const ONLY = opt('--only', '');
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

const NUDITY = ['star', 'sun', 'lovers', 'devil', 'judgement', 'world'];
const DAY_CARD = 'magician';
const DETAIL_CARD = 'moon';
const SPREAD_CARDS = ['empress', 'chariot', 'strength'];
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'chariot'];
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const ALL_LANGS = ['ru', 'en', 'es', 'pt']; // канонический порядок языков — как в i18n.ts
for (const id of [DAY_CARD, DETAIL_CARD, ...SPREAD_CARDS, ...DECK]) {
  if (NUDITY.includes(id)) throw new Error(`карта ${id} из списка наготы — в витрину нельзя`);
  if (!cards.find((c) => c.id === id)) throw new Error(`карты ${id} нет в колоде`);
}
// то же самое для раскладов и модуля курса, которых спрашивают маркеры check() ниже: переименуют
// расклад или пересоберут курс — тут упадёт со внятной причиной, а не «Cannot read properties of
// undefined» посреди прогона (находка ревью 63/4 — там не было списка, крах ронял весь скрипт)
const SPREAD_IDS = ['three-card', 'full-moon'];
for (const id of SPREAD_IDS) {
  if (!spreads.find((sp) => sp.id === id)) throw new Error(`расклада «${id}» нет в spreads.json`);
}
const COURSE_MODULE_INDEX = 0; // кадр «Курс» показывает модуль 1 (пройден целиком) — см. экран course
if (!modules[COURSE_MODULE_INDEX]) throw new Error(`нет модуля с индексом ${COURSE_MODULE_INDEX} в course.json`);

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
const cardName = (id, lang) => cards.find((c) => c.id === id).name[lang];
const spreadName = (id, lang) => spreads.find((s) => s.id === id).name[lang];
// прогресс модуля курса для кадра «Курс» — та же формула, что moduleProgress() в
// src/lib/courseProgress.ts (не импортируем TS-модуль в голый node-скрипт, см. i18nText выше:
// здесь принят тот же приём «читать из первоисточника», только первоисточник — сид, а не файл)
const M12_SET = new Set(M12);
const modulePct = (mod, doneIds) => {
  const total = mod.lessons.length;
  const done = mod.lessons.filter((l) => doneIds.has(l.id)).length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
};
const COURSE_PCT = modulePct(modules[COURSE_MODULE_INDEX], M12_SET);

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
      srs: Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }])),
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

/** Кадры: route, extra сида, prepare (тапы до кадра), check (маркеры; возвращает список проблем). */
const SCREENS = [
  { id: 'today', route: '/',
    // имя карты на «Сегодня» рисуется капсом самим экраном (index.tsx: .toUpperCase()), а не CSS —
    // сверяем без учёта регистра, как это уже сделано в shoot_56.js для той же самой капс-вёрстки
    check: async (page, lang) => [
      ...(await visible(page, `img[src*="/${DAY_CARD}"]`) ? [] : ['нет лица карты дня (рубашка?)']),
      ...((await text(page)).toUpperCase().includes(cardName(DAY_CARD, lang).toUpperCase()) ? [] : [`нет имени «${cardName(DAY_CARD, lang)}»`]),
    ] },
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
      // какая карта выпала — узнаём по src видимой картинки, ключевое слово оборота — из cards.json
      const src = await page.evaluate(() => {
        const im = [...document.querySelectorAll('img[src*="cards/"]')].find((el) => el.offsetParent !== null);
        return im ? im.getAttribute('src') : '';
      });
      const id = DECK.find((d) => src.includes(`/${d}`));
      if (!id) problems.push('не видно карты тренажёра');
      else if (!t.includes(cards.find((c) => c.id === id).keywords[lang][0])) problems.push('оборот карточки не открыт (нет ключевого слова)');
      return problems;
    } },
  { id: 'moon', route: '/moon',
    check: async (page, lang) => {
      const t = await text(page);
      const problems = [];
      if (!t.includes(i18nText(lang, 'moon', 'title'))) problems.push('нет заголовка календаря');
      if (!t.includes(spreadName('full-moon', lang))) problems.push('нет панели расклада полнолуния');
      return problems;
    } },
  { id: 'today-light', route: '/', extra: { themeMode: 'light' },
    check: async (page, lang) => (await visible(page, `img[src*="/${DAY_CARD}"]`)) ? [] : ['нет лица карты дня'] },
];
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
      if (ONLY && s.id !== ONLY) continue;
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
        stage = 'prepare';
        if (s.prepare) await s.prepare(app);
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

  if (!ONLY && STORE === 'google') {
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
