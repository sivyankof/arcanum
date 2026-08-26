# Пейвол без магазина (62) — детальный план

> **Для исполнителя:** план идёт задача за задачей, шаги помечены `- [ ]`. Каждая задача
> заканчивается проверкой; коммит один на задачу (мелкая, идёт в `main`). Спека —
> `docs/specs/62-paywall-no-store.md`, читать вместе с планом и с разделом «Вердикт» ниже:
> три решения спеки уточнены сверкой с кодом 26.08. Шаг 0 процесса: `docs/lessons.md` §2
> (веб ≠ натив, платформенные файлы), §7 (i18n), §8 (тесты), §9 (веб-проверка), §12 (процесс).

**Цель:** пейвол никогда не показывает цену, которой не назвал магазин, и никогда не предлагает
нажать кнопку, которая не может купить; в сборке для закрытого теста экран честен без Expo Go.

**Архитектура:** источник правды — ответ `getOffers()`: пустой список ⇒ состояние «скоро»
(панель того же вида, что «подписка активна»), непустой ⇒ тарифы + CTA (вернётся в 53б).
Плейсхолдерные цены из кода удаляются целиком, платформенного файла `purchases.web.ts` в этой
задаче НЕТ (см. вердикт, Д4′). Экран различает три состояния предложений: `null` — ещё не
запрошены, `[]` — нет, непустой — есть.

**Стек:** Expo SDK 54, expo-router v6, react-i18next, jest-expo (пресет ios), Playwright из кэша npx.
Новых пакетов нет, `package.json`/`app.json` не трогаются.

**Ветка:** `main` (мелкая задача: ~40 строк кода + строки + сценарий).

## Вердикт по спеке 25.08 (сверка с кодом 26.08)

Все утверждения спеки о коде верны на 26.08 (`purchases.ts`, `paywall.tsx`, `premium.ts`,
`i18n.ts`, макет `v-paywall` — с 25.08 ни один из этих файлов не менялся, `git log` пуст).
Расхождений с кодом нет; есть три уточнения решений и ответы на два непроверенных места.

- **Д1′ — три состояния предложений, а не два.** Сейчас `useState<Offer[]>([])`: до ответа
  `getOffers()` список пуст, и ветка «предложений нет» показалась бы ПЕРВЫМ КАДРОМ даже в 53б,
  когда магазин ещё грузит витрину (мигание «скоро» → тарифы). Состояние «ещё не запрошено»
  ≠ «нет предложений» — тот же класс, что «нет данных» ≠ «нет совпадений» (урок 46).
  Решение: `Offer[] | null`, при `null` слот пустой (обёртка `FadeUp` смонтирована всегда, урок 39).
- **Д3′ — «Восстановить покупки» скрывается только в состоянии «скоро».** Спека формулировала
  «в этом состоянии не показываем» — план делает это буквально: ссылка живёт ВНУТРИ каждой ветки
  (как в макете: `.trlink` лежит внутри `#pwOff` и `#pwOn`), в ветке «скоро» она рендерится под
  `PURCHASES_AVAILABLE && …`. Так в 62 её нет, а в 53б при пустом ответе магазина она появится сама:
  восстановление не зависит от витрины, и паящий пользователь на новом телефоне без сети до
  витрины не должен терять «Восстановить» (дыра, которую Д1 спеки закрывал, а Д3 открывал).
- **Д4′ — платформенного файла `purchases.web.ts` в 62 нет, плейсхолдеры удаляются целиком.**
  Ответы на два непроверенных места спеки:
  1. *Metro и `.web.ts`* — механизм работает и подтверждён пересборкой в задаче 06б
     (`pushes.web.ts`, `backupIo.web.ts` подхватываются по суффиксу; проверять новый файл нужно
     перезапуском dev-сервера с `--clear`, не хот-релоадом). *Jest* — `preset: "jest-expo"` = пресет
     **ios** (`haste.defaultPlatform: 'ios'`, `platforms: ['ios','native']`): `import './purchases'`
     резолвится в `purchases.ts`, `.web.ts` игнорируется; проверить веб-версию можно только явным
     `import './purchases.web'` (так делал `pushBody.test.ts` до рефакторинга) либо вторым проектом
     jest (`jest-expo/universal` гонит все сьюты 4 раза — не окупается). То есть «jest на обе
     платформы» решаемо, но…
  2. *Веб-проверка после Д4* — требования спеки **противоречат друг другу в одном прогоне**:
     если веб отдаёт плейсхолдеры, то сценарий 6б на вебе никогда не увидит экран без «₽», а
     состояние, которое реально уедет пользователям («скоро»), останется единственным, которое веб
     не умеет отрисовать. Это перевёрнутый приоритет. Развязать можно DEV-тумблером «показать
     тарифы-образцы», но он нужен ради единственного потребителя — скриншотной сверки ветки тарифов,
     которую 62 НЕ меняет (она снята и сверена в 53а и 56, и изменится только в 53б вместе с
     настоящими ценами, где и будет сверена заново).
  Итог: `getOffers()` возвращает `[]` на всех платформах, константа плейсхолдеров удаляется
  (витрина с ценами остаётся в макете, состояние А, и в тесте как мутация), `purchases.web.ts`
  появится в 53б, когда в `purchases.ts` войдёт нативный импорт RevenueCat. Сверка 6а в 62 —
  состояние «скоро» приложения против нового блока `#pwSoon` макета.
- **Побочная находка (не 62):** вход «луна → пейвол» в `check_53_web.js` §6 зависит от календаря:
  `devMoonOpen` подставляет «сейчас» = ближайшее событие, и когда ближайшим оказывается
  новолуние (free), панель полнолуния закрыта законно. Сценарий 62 пришпиливает часы браузера
  (`page.clock.install`, приём 47б) и от даты прогона не зависит.

Спека 62 после «ок» Артёма правится по этому разделу (Д1′/Д3′/Д4′, критерий про
`purchases.web.test.ts` снимается, пункт 2 плана по файлам — тоже).

## Глобальные ограничения

- SDK НЕ обновлять; `package.json`/`app.json` не трогать. После каждого шага с кодом —
  `npx tsc --noEmit` чист; перед push — `npm test` зелёный (на старте **1695 тестов в 46 сьютах**).
- Цвета только из `src/theme/theme.ts`; комментарии в коде русские; ни слова про ИИ в коде и коммитах.
- Новая UI-строка — сразу в ЧЕТЫРЕ языка `src/lib/i18n.ts`; контракт паритета ключей
  (`i18nPlurals.test.ts`, по `Object.keys(resources)`) краснеет поимённо на забытом языке.
  Никаких тернаров «если русский — одно, иначе другое» (урок 27).
- Экраны не читают `.free`/`premium.active` в обход `premium.ts` (`premiumSources.test.ts`);
  `app/paywall.tsx` — одно из двух законных мест чтения `premium.active`, список в тесте не менять.
- Веб-проверка: dev-сервер заново с `--clear` на каждое состояние кода; Playwright из кэша npx
  (рецепт `AGENTS.md`); сценарий сначала на СЛОМАННОМ коде (задача 1).
- Стейджить поимённо (`git add <путь>`), не `-A` — сессии параллельны.
- Макет: задача, меняющая экран, правит макет в том же коммите (блок `#pwSoon`), а аудит
  (`shoot_56.js`) обязан и дальше проходить по паре `paywall`.

## Файловая карта

| Файл | Что меняется |
|---|---|
| `scripts/check_62_web.js` | **новый** — сценарий 6б: пять входов → экран «скоро», ссылки условий, состояние Б, диалог без Expo Go, светлая тема |
| `src/lib/__tests__/purchases.test.ts` | **новый** — контракт адаптера и «цены не зашиты в код» |
| `src/lib/purchases.ts` | `getOffers` → `[]`, плейсхолдеры удалены, комментарий про правила цен 53б сохранён |
| `src/lib/i18n.ts` | `paywall.soonTitle`, `paywall.soonSub` ×4, `paywall.unavailableText` ×4 без Expo Go |
| `app/paywall.tsx` | `Offer[] \| null`, ветка «скоро», «Восстановить» внутри веток, `PURCHASES_AVAILABLE` |
| `docs/design-reference.html` | блок `#pwSoon` + `pwSoon(on)`, `setPremium` прячет его |
| `scripts/shoot_56.js` | поле `mockSetup` у пары, у `paywall` — `'pwSoon(true)'` |
| `docs/screenshots/62/` | 4 кадра 6а (app/mock × dark/light) + кадры сценария 6б |
| доки | спека 62 (отчёт), backlog, changelog, CLAUDE.md «Статус», lessons (новые ⚠️), release-checklist |

---

### Задача 1: сценарий `scripts/check_62_web.js` и КРАСНЫЙ прогон на коде 53а

**Файлы:**
- Создать: `scripts/check_62_web.js`
- Читает: `src/lib/i18n.ts` (маркеры), `scripts/check_53_web.js` (форма сида — не сочинять)

**Интерфейсы:**
- Отдаёт: команду `node scripts/check_62_web.js [каталог]`, код выхода 0/1, кадры в `docs/screenshots/62/`.
- Маркеры строк читаются из `i18n.ts` регуляркой по первому (русскому) блоку; отсутствующий
  ключ — `null`, и проверка падает с текстом «ключа нет», а не роняет сценарий: красный прогон
  идёт на коде, где ключей `soonTitle`/`soonSub` ещё нет, и «упал сценарий» ≠ «красные проверки».

- [ ] **Шаг 1: написать сценарий**

```js
/* Веб-проверка пейвола без магазина (задача 62, пункт 6б процесса).
   Проверяет: пять входов на пейвол (настройки, курс, расклады, тренажёр, луна) ведут на экран
   БЕЗ «₽», без кнопки «Оформить …» и без «Восстановить покупки», с панелью «скоро» и живыми
   ссылками «Условия»/«Конфиденциальность»; состояние Б («подписка активна», DEV) не изменилось;
   диалог «Управлять подпиской» не упоминает Expo Go; панель «скоро» есть и в светлой теме.

   Запуск (dev-сервер поднят ЗАНОВО с --clear, рецепт AGENTS.md):
     NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" \
       node scripts/check_62_web.js [каталог-скриншотов]

   ⚠️ Красный прогон обязателен: на коде 53а (до правки purchases.ts) сценарий обязан упасть по
   пяти проверкам на каждом из шести экранов «скоро» (₽, «Оформить», «Восстановить», soonTitle,
   soonSub) и на «Expo Go» в диалоге — ожидаемо 31 красная; входы при этом зелёные.
   Зелёный с первого раза = ошибка в самой проверке (правило проекта).
   ⚠️ Часы браузера пришпилены к 27.08.2026 (page.clock.install, приём задачи 47б): ближайшее
   лунное событие — полнолуние 28.08 (premium), поэтому вход «луна» ведёт на пейвол в любой день
   прогона. На живых часах после ~5.09.2026 ближайшим стало бы новолуние (free), панель полнолуния
   закрылась бы законно и вход открыл бы не пейвол — та же дата-зависимость живёт в check_53 §6.
   ⚠️ Маркеры строк берутся из src/lib/i18n.ts, а не из памяти (урок 28а): отсутствующий ключ
   даёт null и КРАСНУЮ проверку с текстом причины, а не падение сценария.
   ⚠️ Сид — форма scripts/check_53_web.js (урок 54: сид не сочинять). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'docs/screenshots/62';
const BASE = 'http://localhost:8081';
const CLOCK = '2026-08-27T12:00:00';
const TODAY = '2026-08-27';

const I18N = fs.readFileSync(path.resolve('src/lib/i18n.ts'), 'utf8');
/** Русское значение ключа paywall.* — первое вхождение в файле (блок ru идёт первым). */
const ruKey = (key) => {
  const m = I18N.match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));
  return m ? m[1] : null;
};
const SOON_TITLE = ruKey('soonTitle');
const SOON_SUB = ruKey('soonSub');
const UNAVAILABLE_TEXT = ruKey('unavailableText');
const BENEFIT_1 = ruKey('b1');

const NONE = { active: false, source: 'none', until: null };
const DEV = { active: true, source: 'dev', until: null };
const M12 = ['m1l1', 'm1l2', 'm1l3', 'm1l4', 'm2l1', 'm2l2', 'm2l3', 'm2l4', 'm2l5', 'm2l6'];
const progress = (ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1755000000000 }]));
const DECK = ['fool', 'magician', 'high-priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot'];
const dueSrs = () => Object.fromEntries(DECK.map((id) => [id, { reps: 2, intervalDays: 3, ease: 2.5, due: '2026-01-01' }]));

function seed(extra = {}) {
  return JSON.stringify({
    state: {
      themeMode: 'dark',
      lang: 'ru',
      installSeed: 12345,
      profile: { onboarded: true, name: 'Артём' },
      premium: NONE,
      lessonsProgress: progress(M12),
      srs: {},
      reviewDay: { date: '', newCount: 0, doneCount: 0 },
      spreadsHistory: [],
      xp: 400,
      streak: 5,
      ...extra,
    },
    version: 11,
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

/** Перехват внешних ссылок: window.open и клик по <a href> (форма check_54_web.js). */
async function armOpenSpy(page) {
  await page.evaluate(() => {
    window.__opened = [];
    if (!window.__spyArmed) {
      window.__spyArmed = true;
      window.open = (u) => { window.__opened.push(String(u)); return null; };
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (a) { window.__opened.push(a.href); e.preventDefault(); }
      }, true);
    }
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.clock.install({ time: CLOCK });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  /** Ставит состояние и открывает путь (goto → evaluate → reload, урок 39). */
  async function open(route, state) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => localStorage.setItem('arcanum-app', s), state);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const w = await page.evaluate(() => window.innerWidth);
    if (w !== 390) throw new Error(`вьюпорт ${w}, не 390 — снимок недостоверен (урок 16)`);
    return page.url().replace(BASE, '');
  }
  const body = () => page.locator('body').innerText();
  const here = () => page.url().replace(BASE, '');
  const onPaywall = async () => page.url().includes('/paywall') && (await body()).includes('Arcanum Premium');
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

  /** Проверки экрана «скоро» — одни и те же для всех входов. */
  async function assertSoon(tag) {
    const text = await body();
    check(`${tag}: на пейволе нет «₽»`, !text.includes('₽'));
    check(`${tag}: нет кнопки «Оформить за …»`, !/Оформить за/.test(text));
    check(`${tag}: нет «Восстановить покупки»`, !text.includes('Восстановить покупки'));
    check(`${tag}: панель «скоро» — заголовок`, SOON_TITLE !== null && text.includes(SOON_TITLE),
      SOON_TITLE === null ? 'ключа paywall.soonTitle нет в i18n.ts' : '');
    check(`${tag}: панель «скоро» — вторая строка`, SOON_SUB !== null && text.includes(SOON_SUB),
      SOON_SUB === null ? 'ключа paywall.soonSub нет в i18n.ts' : '');
    check(`${tag}: строки «что даёт Premium» на месте`, BENEFIT_1 !== null && text.includes(BENEFIT_1));
    check(`${tag}: ссылки «Условия» и «Конфиденциальность»`, text.includes('Условия') && text.includes('Конфиденциальность'));
  }

  console.log('\n=== 1. Настройки → пейвол ===');
  await open('/settings', seed());
  await page.locator('text=Arcanum Premium').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('настройки: тап по строке → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('настройки');
  await shot('paywall-soon-dark');

  console.log('\n=== 2. Курс → пейвол (узел «текущий» в premium-модуле) ===');
  await open('/course', seed());
  // чип — СОСЕД нажимаемой области узла (урок 53а): центр узла на 91 px ниже верха чипа
  const chipBox = await page.locator('text=✦ ПРЕМИУМ').first().boundingBox();
  check('курс: чип «✦ ПРЕМИУМ» найден', chipBox !== null);
  if (chipBox) {
    await page.mouse.click(chipBox.x + chipBox.width / 2, chipBox.y + 91);
    await page.waitForTimeout(1200);
    check('курс: тап по узлу → пейвол', await onPaywall(), `фактически ${here()}`);
    await assertSoon('курс');
  }

  console.log('\n=== 3. Расклады → пейвол ===');
  await open('/spreads', seed());
  await page.locator('text=Кельтский крест').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('расклады: тап по premium-карточке → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('расклады');

  console.log('\n=== 4. Тренажёр (лимит исчерпан) → пейвол ===');
  await open('/review', seed({ srs: dueSrs(), reviewDay: { date: TODAY, newCount: 0, doneCount: 10 } }));
  await page.locator('text=Ещё').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('тренажёр: тап по «Ещё N» → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('тренажёр');

  console.log('\n=== 5. Луна (панель полнолуния в окне) → пейвол ===');
  await open('/moon', seed({ devMoonOpen: true }));
  await page.locator('text=Расклад полнолуния').first().click({ force: true });
  await page.waitForTimeout(1200);
  check('луна: тап по панели полнолуния → пейвол', await onPaywall(), `фактически ${here()}`);
  await assertSoon('луна');

  console.log('\n=== 6. Ссылки условий ведут на сайт ===');
  await open('/paywall', seed());
  await armOpenSpy(page);
  await page.getByText('Условия', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(600);
  let opened = await page.evaluate(() => window.__opened || []);
  check('«Условия» → terms.html', opened.some((u) => u.includes('/terms.html')), JSON.stringify(opened));
  await page.evaluate(() => { window.__opened = []; });
  await page.getByText('Конфиденциальность', { exact: true }).first().click({ force: true });
  await page.waitForTimeout(600);
  opened = await page.evaluate(() => window.__opened || []);
  check('«Конфиденциальность» → privacy.html', opened.some((u) => u.includes('/privacy.html')), JSON.stringify(opened));

  console.log('\n=== 7. Состояние Б (DEV-право) не изменилось ===');
  await open('/paywall', seed({ premium: DEV }));
  let text = await body();
  check('Б: чип «✦ АКТИВНА»', text.includes('✦ АКТИВНА'));
  check('Б: панель «Подписка активна» + «DEV-режим»', text.includes('Подписка активна') && text.includes('DEV-режим'));
  check('Б: кнопка «Управлять подпиской»', text.includes('Управлять подпиской'));
  check('Б: «Восстановить покупки» на месте (как в макете #pwOn)', text.includes('Восстановить покупки'));
  check('Б: панели «скоро» нет', SOON_TITLE === null || !text.includes(SOON_TITLE));
  await shot('paywall-B-dark');
  await page.locator('text=Управлять подпиской').first().click({ force: true });
  await page.waitForTimeout(800);
  text = await body();
  check('Б: «Управлять» → диалог «Пока недоступно»', text.includes('Пока недоступно'));
  check('Б: диалог не упоминает Expo Go', !text.includes('Expo Go'));
  check('Б: текст диалога = paywall.unavailableText', UNAVAILABLE_TEXT !== null && text.includes(UNAVAILABLE_TEXT));
  await shot('paywall-dialog-dark');

  console.log('\n=== 8. Светлая тема ===');
  await open('/paywall', seed({ themeMode: 'light' }));
  await assertSoon('светлая');
  await shot('paywall-soon-light');

  console.log('\n=== ИТОГ ===');
  console.log(`пройдено ${pass}, упало ${fails.length} (из ${pass + fails.length})`);
  if (fails.length) console.log('УПАЛО:\n  - ' + fails.join('\n  - '));
  const realErrors = consoleErrors.filter((e) => !/pointerEvents is deprecated/.test(e));
  console.log(`\nошибок в консоли: ${realErrors.length}`);
  if (realErrors.length) console.log(realErrors.slice(0, 10).join('\n'));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error('СЦЕНАРИЙ УПАЛ:', e.message);
  process.exit(2);
});
```

- [ ] **Шаг 2: поднять dev-сервер заново и прогнать на ТЕКУЩЕМ коде (красный прогон)**

Запуск в отдельном терминале: `npm run kill:dev` → `npx expo start --web --clear`; дождаться
«Web is waiting on http://localhost:8081». Затем:

```
NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node scripts/check_62_web.js docs/screenshots/62
```

Ожидание: код выхода 1; все 5 входов зелёные («→ пейвол»), красные — по 5 на каждом из шести
экранов «скоро» (`₽`, «Оформить за …», «Восстановить покупки», soonTitle «ключа нет»,
soonSub «ключа нет») + «Б: диалог не упоминает Expo Go» = **31 из ~51**. Если красных
меньше или падают входы — чинить сценарий, а не код (урок 55: красный тоже проверяется на себя).
Записать в шапку сценария фактические числа «упало N из M» вместо ожидаемых.

- [ ] **Шаг 3: коммит сценария**

```bash
git add scripts/check_62_web.js
git commit -m "test: веб-сценарий пейвола без магазина, красный прогон на коде 53а (spec 62)"
```

---

### Задача 2: адаптер `purchases.ts` — предложений нет, цен в коде нет

**Файлы:**
- Создать: `src/lib/__tests__/purchases.test.ts`
- Изменить: `src/lib/purchases.ts` (весь файл, 50 строк)

**Интерфейсы:**
- Отдаёт (без изменений сигнатур): `PURCHASES_AVAILABLE: false`, `PlanId`, `Offer`,
  `PurchaseResult`, `getOffers(): Promise<Offer[]>` — теперь всегда `[]`; `purchase`, `restore`,
  `refreshEntitlement` — как раньше. Экспорт `PLACEHOLDER_OFFERS`/`WEB_PLACEHOLDER_OFFERS` НЕ появляется.
- Потребители: `app/paywall.tsx` (задача 4) импортирует `PURCHASES_AVAILABLE` дополнительно.

- [ ] **Шаг 1: написать тест (падает на коде 53а)**

```ts
/** Контракт адаптера покупок (спека 62): пейвол не показывает цену, которой не назвал магазин.
 *  Пока SDK покупок нет (`PURCHASES_AVAILABLE === false`, 53а/62), `getOffers` обязан отдавать
 *  пустой список — плейсхолдеры «2 890 ₽» задачи 53а не должны доехать до пользователей, а фолбэк
 *  на выдуманную цену пережил бы и 53б («магазин не ответил → показали рубли»).
 *  Вторая половина — цены не зашиты ни в адаптер, ни в экран, ни в строки: в `paywall.*` цена
 *  бывает только подстановкой `{{price}}` из ответа магазина.
 *  Красный прогон (код 53а): падают «getOffers → []» и «purchases.ts без знаков валют». */
import fs from 'fs';
import path from 'path';
import { resources } from '../i18n';
import { getOffers, purchase, PURCHASES_AVAILABLE, refreshEntitlement, restore } from '../purchases';

const ROOT = path.join(__dirname, '../../..');
/** Знаки валют и число рядом с долларом; голый `$` законен (`${}` шаблонных строк). */
const CURRENCY = /[₽€£¥]|\d\s?\$|\$\s?\d/;

describe('адаптер покупок без магазина (спека 62)', () => {
  it('SDK покупок в этой редакции нет — 53б перепишет сьют вместе с флагом', () => {
    expect(PURCHASES_AVAILABLE).toBe(false);
  });

  it('без SDK предложений нет: getOffers → []', async () => {
    expect(await getOffers()).toEqual([]);
  });

  it('оформить/восстановить отвечают unavailable, права из магазина нет', async () => {
    expect(await purchase('year')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await purchase('month')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await restore()).toEqual({ ok: false, reason: 'unavailable' });
    expect(await refreshEntitlement()).toBeNull();
  });
});

describe('цены не зашиты в код (спека 62)', () => {
  it.each(['src/lib/purchases.ts', 'app/paywall.tsx'])('%s без знаков валют', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(src.match(CURRENCY)).toBeNull();
  });

  it.each(Object.keys(resources))('%s: строки paywall.* без валют, цена только через {{price}}', (lng) => {
    const pw = (resources as Record<string, { translation: { paywall: Record<string, string> } }>)[lng]
      .translation.paywall;
    expect(Object.keys(pw).length).toBeGreaterThan(20); // периметр: не пустой объект
    for (const [k, v] of Object.entries(pw)) expect(`${k}: ${v}`).not.toMatch(CURRENCY);
  });
});
```

- [ ] **Шаг 2: прогнать — обязан краснеть**

Run: `npx jest src/lib/__tests__/purchases.test.ts`
Expected: FAIL — «getOffers → []» (получено 2 предложения) и «src/lib/purchases.ts без знаков
валют» (найдено «₽»); остальные зелёные. Красных ровно 2 из 9.

- [ ] **Шаг 3: переписать `src/lib/purchases.ts`**

Заменить файл целиком:

```ts
/** Адаптер покупок (спеки 53, 62). Экраны говорят только с этим модулем; в 53б он получает
 *  реализацию на RevenueCat (`react-native-purchases` — нативный модуль, в Expo Go не работает;
 *  тогда же появится `purchases.web.ts` — заглушка без нативного импорта, приём `pushes.web.ts`,
 *  и dev-сервер веба обязан быть перезапущен с --clear, чтобы увидеть новый файл — урок 06б).
 *
 *  Правило спеки 62: пейвол никогда не показывает цену, которой не назвал магазин, и не предлагает
 *  кнопку, которая не может купить. Поэтому без SDK (`PURCHASES_AVAILABLE === false`) `getOffers`
 *  отдаёт ПУСТОЙ список, а экран рисует состояние «скоро». Плейсхолдеров «2 890 ₽» задачи 53а
 *  здесь больше нет: фолбэк на выдуманную цену пережил бы 53б (магазин не ответил — показали
 *  рубли). Витрина с ценами до 53б живёт только в макете (`v-paywall`, состояние А).
 *
 *  ⚠️ Для 53б (спека 53, раздел «Цены и валюта»): `price` приходит ГОТОВОЙ строкой магазина
 *  (`product.priceString` через RevenueCat) — валюту выбирает страна аккаунта магазина, а не язык
 *  приложения, и форматировать число самим нельзя (у Hermes на телефоне урезанный ICU, урок hf-02);
 *  `discount` считается из фактической пары «год / месяц × 12», а не константой: ценовые уровни
 *  Apple и Google по странам непропорциональны. Тип `price: string` менять не придётся. */
import type { PremiumState } from './premium';

export const PURCHASES_AVAILABLE = false;
export type PlanId = 'year' | 'month';
export interface Offer {
  id: PlanId;
  price: string;
  /** цена в пересчёте на месяц — только у годового */
  perMonth?: string;
  /** бейдж скидки — только у годового */
  discount?: string;
}
export type PurchaseResult =
  | { ok: true; premium: PremiumState }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' };

/** Предложения магазина. Без SDK — []; в 53б: `getOfferings()` RevenueCat, а сбой сети, страна
 *  без продаж и неодобренный продукт — тот же [] (экран показывает «скоро», спека 62, Д1). */
export async function getOffers(): Promise<Offer[]> {
  return [];
}
export async function purchase(_id: PlanId): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
export async function restore(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
/** null — источника права нет (заглушка); 53б вернёт состояние из магазина. */
export async function refreshEntitlement(): Promise<PremiumState | null> {
  return null;
}
```

- [ ] **Шаг 4: проверить**

Run: `npx tsc --noEmit && npx jest src/lib/__tests__/purchases.test.ts`
Expected: tsc чист; 9 из 9 зелёные. (`paywall.tsx` пока компилируется как раньше: сигнатура
`getOffers` не менялась.)

- [ ] **Шаг 5: коммит**

```bash
git add src/lib/purchases.ts src/lib/__tests__/purchases.test.ts
git commit -m "feat: адаптер покупок без плейсхолдерных цен, контракт «цен в коде нет» (spec 62)"
```

---

### Задача 3: строки `i18n.ts` — четыре языка

**Файлы:**
- Изменить: `src/lib/i18n.ts` — блок `paywall` в ru (~строка 252), en (~576), es (~946), pt (~1326)

**Интерфейсы:**
- Отдаёт ключи `paywall.soonTitle`, `paywall.soonSub` (новые) и `paywall.unavailableText`
  (новый текст) — их читают задача 4 (экран) и сценарий задачи 1 (регуляркой по файлу).

- [ ] **Шаг 1: ru — после `activeDev: "DEV-режим",` ничего не менять, а `unavailableText` заменить и добавить два ключа**

В блоке `paywall` русских ресурсов:

```ts
        unavailableTitle: "Пока недоступно",
        unavailableText: "Покупки пока недоступны. Попробуйте позже.",
        ok: "Понятно",
        // состояние «предложений нет» (спека 62): без SDK покупок (53а/62) и когда магазин
        // не ответил (53б) — панель вместо тарифов, без цифр и без кнопки. Текст нейтральный,
        // без обещания срока (решение Артёма 26.08): после 53б та же панель значит «нет сети»
        soonTitle: "Оформить подписку пока нельзя",
        soonSub: "Попробуйте позже — всё, что уже открыто, останется доступным",
```

- [ ] **Шаг 2: en**

```ts
        unavailableTitle: "Not available yet",
        unavailableText: "Purchases aren't available yet. Please try again later.",
        ok: "Got it",
        soonTitle: "Subscribing isn't available yet",
        soonSub: "Try again later — everything that's already open stays available",
```

- [ ] **Шаг 3: es**

```ts
        unavailableTitle: "Aún no disponible",
        unavailableText: "Las compras aún no están disponibles. Inténtalo más tarde.",
        ok: "Entendido",
        soonTitle: "Aún no es posible suscribirse",
        soonSub: "Inténtalo más tarde: todo lo que ya está abierto seguirá disponible",
```

- [ ] **Шаг 4: pt**

```ts
        unavailableTitle: "Ainda não disponível",
        unavailableText: "As compras ainda não estão disponíveis. Tente mais tarde.",
        ok: "Entendi",
        soonTitle: "Ainda não é possível assinar",
        soonSub: "Tente mais tarde: tudo o que já está aberto continua disponível",
```

Тексты утверждены Артёмом 26.08 (нейтральные, без обещания срока). Менять их можно только
парой «здесь + макет (задача 5)» — экран и сценарий текст не знают, сценарий читает его из файла.

- [ ] **Шаг 5: проверить паритет ключей и отсутствие Expo Go**

Run: `npx tsc --noEmit && npx jest src/lib/__tests__/i18nPlurals.test.ts src/lib/__tests__/i18nLangs.test.ts src/lib/__tests__/purchases.test.ts`
Expected: всё зелёное. Дополнительно: `grep -n "Expo Go" src/lib/i18n.ts` → пусто.

- [ ] **Шаг 6: коммит**

```bash
git add src/lib/i18n.ts
git commit -m "feat: строки пейвола «подписка появится» на четырёх языках, диалог без Expo Go (spec 62)"
```

---

### Задача 4: экран `app/paywall.tsx` — ветка «скоро»

**Файлы:**
- Изменить: `app/paywall.tsx` (импорт ~строка 24; состояние ~50–62; JSX ~129–187)

**Интерфейсы:**
- Потребляет: `getOffers`, `PURCHASES_AVAILABLE` из `src/lib/purchases` (задача 2), ключи
  `paywall.soonTitle`/`soonSub` (задача 3), стили `st.panel`/`st.panelTitle`/`st.panelSub`/`st.link`
  (уже есть в файле — перед добавлением стиля грепать имя, урок 46; новых стилей НЕ нужно).

- [ ] **Шаг 1: импорт и состояние**

Строка импорта адаптера:

```ts
import { getOffers, purchase, PURCHASES_AVAILABLE, restore, type Offer, type PlanId } from '../src/lib/purchases';
```

Состояние предложений (заменить `const [offers, setOffers] = React.useState<Offer[]>([]);`):

```ts
  // null — предложения ещё не запрошены (первый кадр), [] — их нет (без SDK покупок в 53а/62;
  // магазин не ответил в 53б) → панель «скоро», непустой — тарифы + CTA. Различать «ещё не
  // запрошено» и «нет» обязательно: иначе в 53б первый кадр мигнул бы панелью «скоро» до
  // ответа магазина (класс «нет данных» ≠ «нет совпадений», урок 46)
  const [offers, setOffers] = React.useState<Offer[] | null>(null);
```

`chosen` — через опциональную цепочку:

```ts
  const chosen = offers?.find((o) => o.id === plan);
  const noOffers = offers !== null && offers.length === 0;
```

- [ ] **Шаг 2: ссылка «Восстановить» — одна константа, три места**

Сразу после `const benefits = …`:

```tsx
  // «Восстановить покупки» живёт ВНУТРИ каждого состояния, как `.trlink` внутри #pwOff/#pwOn
  // макета; в состоянии «скоро» — только когда есть SDK магазина (53б): без него
  // восстанавливать нечего, а тап вёл бы в диалог-заглушку (спека 62, Д3). В 53б при пустых
  // предложениях ссылка нужна: восстановление права не зависит от витрины
  const restoreLink = (
    <Pressable onPress={() => run(restore)} hitSlop={8}>
      <Txt style={[st.link, { color: t.accent }]}>{tr('paywall.restore')}</Txt>
    </Pressable>
  );
```

- [ ] **Шаг 3: JSX состояний**

Ветку `premium.active ? (…) : (…)` и блок `FadeUp index={3}` заменить на:

```tsx
        {premium.active ? (
          <FadeUp index={2} style={{ marginTop: 14 }}>
            {/* `.pwstate` макета: панель ДВЕ строки, выравнивание по левому краю (флаг 6а-0 —
                план рисовал одну центрированную строку с ключом paywall.activeLine, которого
                больше нет). Тарифа («годовая»/«месячная») в PremiumState 53а нет — первая строка
                нейтральная, тариф придёт из RevenueCat в 53б (решение Артёма 22.08) */}
            <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Txt style={[st.panelTitle, { color: t.head }]}>{tr('paywall.activeTitle')}</Txt>
              <Txt style={[st.panelSub, { color: t.muted }]}>
                {premium.source === 'store' && premium.until
                  ? tr('paywall.activeUntil', { date: formatFullDate(premium.until, lang) })
                  : tr('paywall.activeDev')}
              </Txt>
            </View>
            <PressableScale
              onPress={() => {
                hapticTap();
                setUnavailable(true); // 53б: deep link в подписки магазина
              }}
              style={[st.secondary, { borderColor: t.line }]}
            >
              <Txt style={[st.secondaryText, { color: t.head }]}>{tr('paywall.manage')}</Txt>
            </PressableScale>
            {restoreLink}
          </FadeUp>
        ) : (
          <FadeUp index={2} style={{ marginTop: 14 }}>
            {/* обёртка смонтирована всегда, меняется только содержимое (урок 39: условные
                блоки FadeUp дают мини-каскад при каждом возврате) */}
            {offers === null ? null : noOffers ? (
              // состояние В «скоро» (спека 62; макет `#pwSoon`): та же панель, что «активна»,
              // ни цифр, ни кнопки, ни диалога
              <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.panelTitle, { color: t.head }]}>{tr('paywall.soonTitle')}</Txt>
                <Txt style={[st.panelSub, { color: t.muted }]}>{tr('paywall.soonSub')}</Txt>
              </View>
            ) : (
              <>
                <View style={st.plans}>
                  {offers.map((o) => {
                    const on = o.id === plan;
                    return (
                      <PressableScale
                        key={o.id}
                        onPress={() => {
                          hapticTap();
                          setPlan(o.id);
                        }}
                        style={[
                          st.plan,
                          { backgroundColor: on ? t.chipBg : t.panel, borderColor: on ? t.frame : t.line },
                        ]}
                      >
                        <Txt style={[st.planName, { color: t.head }]}>
                          {o.id === 'year' ? tr('paywall.planYear') : tr('paywall.planMonth')} · {o.price}
                        </Txt>
                        {o.perMonth && (
                          <Txt style={[st.planSub, { color: t.muted }]}>{tr('paywall.perMonth', { price: o.perMonth })}</Txt>
                        )}
                        {/* solid: бейдж сидит на верхней рамке карточки — сквозь полупрозрачный
                            chipBg она просвечивала полосой (лайв-проверка 22.08) */}
                        {o.discount && <PremiumBadge label={o.discount} style={st.planBadge} solid />}
                      </PressableScale>
                    );
                  })}
                </View>
                <CtaButton
                  label={
                    chosen
                      ? plan === 'year'
                        ? tr('paywall.ctaYear', { price: chosen.price })
                        : tr('paywall.ctaMonth', { price: chosen.price })
                      : tr('paywall.title')
                  }
                  disabled={!chosen}
                  onPress={() => run(() => purchase(plan))}
                />
              </>
            )}
            {noOffers ? PURCHASES_AVAILABLE && restoreLink : offers !== null && restoreLink}
          </FadeUp>
        )}

        {/* ссылки условий — вне состояний: Apple 3.1.2 требует их на экране подписки всегда
            (спека 62, Д3); в макете `.pwlegal` отстоит от предыдущего блока на свои 14 */}
        <FadeUp index={3}>
          <Txt style={[st.legal, { color: t.muted }]}>
            {tr('paywall.legal')}{' '}
            <LinkTxt href={TERMS_URL}>{tr('paywall.terms')}</LinkTxt>
            {' · '}
            <LinkTxt href={PRIVACY_URL}>{tr('paywall.privacy')}</LinkTxt>
          </Txt>
        </FadeUp>
```

Комментарий над старым `FadeUp index={3}` («отступа у обёртки нет: в макете "Восстановить покупки"
лежит в том же блоке…») удалить — ссылка теперь и правда лежит в блоках состояний.

- [ ] **Шаг 4: обновить шапку файла**

Первую строку doc-комментария заменить на:

```ts
/** Экран Arcanum Premium (спеки 53, 62): три состояния — «активна» (панель + «Управлять»),
 *  «тарифы» (предложения магазина + CTA, 53б) и «скоро» (предложений нет: без SDK покупок
 *  в 53а/62 или магазин не ответил в 53б — панель без цифр и кнопки). Диалог «Пока недоступно»
 *  остаётся у «Управлять подпиской» и «Восстановить». Маршрут корневого стека под гардом
 *  онбординга (app/_layout.tsx). Композиция — макет v-paywall (состояния А/Б/В). */
```

- [ ] **Шаг 5: проверить**

Run: `npx tsc --noEmit && npx jest src/lib/__tests__/purchases.test.ts src/lib/__tests__/premiumSources.test.ts`
Expected: tsc чист (`PURCHASES_AVAILABLE && restoreLink` при литеральном `false` — законное
выражение типа `false`); `premiumSources` по-прежнему видит `premium.active` ровно в
`app/paywall.tsx` и `app/settings.tsx`.

Быстрая ручная проверка в браузере (dev-сервер перезапущен с `--clear`): `/paywall` → панель
«Оформить подписку пока нельзя», без цен; DEV-тумблер в настройках → состояние Б
с «Восстановить покупки».

- [ ] **Шаг 6: коммит**

```bash
git add app/paywall.tsx
git commit -m "feat: пейвол — состояние «скоро» вместо плейсхолдерных тарифов (spec 62)"
```

---

### Задача 5: макет `#pwSoon`, хук аудита и скриншоты 6а

**Файлы:**
- Изменить: `docs/design-reference.html` (вью `v-paywall` ~строки 1098–1142; JS `setPremium` ~1919)
- Изменить: `scripts/shoot_56.js` (массив `PAIRS`, цикл съёмки макета ~строки 150–160)
- Создать: `docs/screenshots/62/paywall-{app,mock}-{dark,light}.png` (генерируются)

**Интерфейсы:**
- Отдаёт в макете функцию `pwSoon(on: boolean)`; пара `paywall` в `shoot_56.js` получает
  `mockSetup: 'pwSoon(true)'`, а цикл выполняет `mock.evaluate(p.mockSetup)` после `show(id)`.

- [ ] **Шаг 1: блок состояния В в макете**

Комментарий-шапку вью (`<!-- Два состояния одного экрана: #pwOff — не оформлено, #pwOn — активна.`)
дополнить: `#pwSoon — предложений нет («скоро», спека 62), включается только pwSoon(true)`.
После блока `<!-- Б. активна -->` … `</div>` (перед закрывающим `</div>` вью `v-paywall`) добавить:

```html
    <!-- В. предложений нет — «скоро» (спека 62): без SDK покупок (53а/62) или магазин не ответил
         (53б). Та же .pwstate, что у Б; ни цен, ни CTA, ни «Восстановить»; ссылки условий остаются.
         Демобар по-прежнему ходит А → Б (цены вернутся в 53б); В включает скрипт сверки: pwSoon(true) -->
    <div id="pwSoon" class="fadeup d4" style="display:none">
      <div class="pwstate"><b>Оформить подписку пока нельзя</b><small>Попробуйте позже — всё, что уже открыто, останется доступным</small></div>
      <p class="pwlegal">Подписка продлевается автоматически, пока вы её не отмените в настройках App&nbsp;Store или Google&nbsp;Play — не позже чем за сутки до конца периода. <a>Условия</a> · <a>Конфиденциальность</a></p>
    </div>
```

- [ ] **Шаг 2: JS макета**

В `setPremium(active)` после строки `document.getElementById('pwOn').style.display = …` добавить:

```js
  document.getElementById('pwSoon').style.display = 'none'; // В живёт только по pwSoon(true)
```

Сразу после функции `setPremium` добавить:

```js
/* Состояние В «скоро» (спека 62) — для сверки 6а (scripts/shoot_56.js, пара paywall).
   При on прячет витрину А; Б не трогает (у активной подписки состояния «скоро» нет). */
function pwSoon(on){
  document.getElementById('pwSoon').style.display = on ? '' : 'none';
  document.getElementById('pwOff').style.display = (on || window.__pwState) ? 'none' : '';
}
```

- [ ] **Шаг 3: хук в `shoot_56.js`**

В `PAIRS` строку пары `paywall` заменить на:

```js
  // после 62 приложение без SDK покупок показывает состояние В «скоро» — макет переключается
  // в него тем же скриптом (mockSetup); витрина А с ценами вернётся в 53б
  { name: 'paywall',    route: '/paywall',                 mock: 'v-paywall',   marker: 'Premium', mockSetup: 'pwSoon(true)' },
```

В комментарии над `PAIRS` («Пары. mock — id вью…») дописать: `mockSetup — JS, выполняемый в макете
после show(id) (состояния, которых демобар не показывает)`. В цикле съёмки макета после
`await mock.evaluate(([id, th]) => {…}, [p.mock, theme]);` добавить:

```js
      if (p.mockSetup) await mock.evaluate(p.mockSetup);
```

- [ ] **Шаг 4: снять пару и сверить**

Dev-сервер перезапущен с `--clear` (код задач 2–4 в дереве). Run:

```
NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node scripts/shoot_56.js docs/screenshots/62 paywall
```

Expected: «снято пар: 1», четыре файла. Сверка по `docs/ui-verification.md` 6а: панель «скоро» —
тот же вид, что панель Б (`.pwstate`: panel/line, радиус 16, паддинг 13×16, заголовок Cormorant 600
15, подпись 10.5 muted); под панелью сразу `.pwlegal` с отступом 14; ни «Восстановить», ни кнопки.
Обе темы. Расхождения — исправить или перечислить в отчёте спеки с причиной.

- [ ] **Шаг 5: полный аудит не сломан**

Run: `node scripts/shoot_56.js docs/screenshots/62/audit` (все 16 пар) — «снято пар: 16, не снято: 0».
Каталог `docs/screenshots/62/audit` после проверки удалить (в коммит идут только 4 кадра пейвола).

- [ ] **Шаг 6: коммит**

```bash
git add docs/design-reference.html scripts/shoot_56.js docs/screenshots/62/paywall-app-dark.png docs/screenshots/62/paywall-app-light.png docs/screenshots/62/paywall-mock-dark.png docs/screenshots/62/paywall-mock-light.png
git commit -m "docs: макет пейвола — состояние «скоро», хук аудита, кадры 6а (spec 62)"
```

---

### Задача 6: зелёный прогон 6б, полный `npm test`, синхронизация доков

**Файлы:**
- Изменить: `docs/specs/62-paywall-no-store.md` (критерии → `[x]`, раздел «Отчёт веб-проверки»
  по форме отчёта в `docs/specs/53-premium.md` § «Отчёт веб-проверки 6а/6б»), `docs/backlog.md`
  (62 → `[x]`, дата), `docs/changelog.md` (запись), `CLAUDE.md` «Статус» (только текущее состояние:
  62 выполнена, ждёт 6в; тестов N в 47 сьютах), `docs/lessons.md` (§4/§8 — новые ⚠️ ниже),
  `docs/release-checklist.md` (пункт «закрытый тест … только после задачи 62» → 62 сделана, ждёт лайва)
- Создать: `docs/screenshots/62/paywall-soon-{dark,light}.png`, `paywall-B-dark.png`, `paywall-dialog-dark.png` (генерируются сценарием)

- [ ] **Шаг 1: зелёный прогон сценария**

Dev-сервер перезапущен с `--clear`. Доставку правки проверить грепом по бандлу (урок 46в):
`curl -s "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false" | grep -c "soonTitle"` → ≥ 1.

Run: `NODE_PATH="…" node scripts/check_62_web.js docs/screenshots/62`
Expected: «упало 0», код 0; ошибок в консоли 0 (кроме `pointerEvents is deprecated` —
@react-navigation, не наш). Красное — чинить до зелёного; в шапку сценария вписать оба числа:
красный прогон «упало 31 из M» на `<hash коммита 53а>` и зелёный «0 из M».

- [ ] **Шаг 2: мутационная проверка сценария (обязательна, урок 28а)**

Временно вернуть в `getOffers` одно предложение: `return [{ id: 'month', price: '1' }];` (без
знака валюты — иначе первым упадёт юнит, а проверяется сценарий). Перезапустить dev-сервер
с `--clear`, прогнать сценарий: обязаны покраснеть «Оформить за …» и «панель "скоро" — заголовок»
на всех шести экранах (12 красных), «₽» — остаться зелёным. Вернуть код, перезапустить, прогон
снова зелёный. Числа мутации — в отчёт спеки.

- [ ] **Шаг 3: полный прогон тестов и типов**

Run: `npx tsc --noEmit && npm test`
Expected: tsc чист; все сьюты зелёные, **47 сьютов** (было 46 + `purchases.test.ts`), тестов
1695 + 9 = **1704**. Записать фактические числа в CLAUDE.md «Статус» и в отчёт спеки.

- [ ] **Шаг 4: доки**

- Спека 62: чек-лист приёмки → `[x]` с числами; раздел «Отчёт веб-проверки 6а/6б (дата)»:
  красный прогон (число, хеш), мутация (число), зелёный; расхождения с макетом (если были);
  сценарий лайв-проверки 6в (ниже).
- `docs/lessons.md` — два ⚠️ под свои темы:
  - §4 (вёрстка/состояния): «Состояние до загрузки ≠ состояние "нет данных": список, стартующий
    с `[]`, показывает пустую ветку первым кадром — тристейт `T[] | null`» (найдено сверкой
    спеки 62 с кодом 26.08, родня урока 46 про "нет данных" ≠ "нет совпадений").
  - §9 (веб-проверка): «Вход, зависящий от календаря (лунное окно), в сценарии пришпиливать
    `page.clock.install`; `check_53_web.js` §6 зависит от даты прогона» (находка 26.08).
- `docs/changelog.md`: запись 62 — что сделано, Д1′/Д3′/Д4′ и почему без `purchases.web.ts`,
  новое общее: тристейт предложений, контракт «цен в коде нет», `mockSetup` в аудите.
- `docs/backlog.md`: 62 → `[x]` … **ВЫПОЛНЕНА <дата>, ждёт 6в** (после лайва — ЗАКРЫТА).
- `docs/release-checklist.md`, раздел «Создание приложения в Play Console», пункт про закрытый
  тест: «после задачи 62» → «порядок Артёма 26.08: 61 → 53б → закрытый тест (тестеры видят
  настоящие покупки); 62 сделана <дата> — страховка внутреннего теста».
- `CLAUDE.md` «Статус»: короткая строка о 62 (без хроники), числа тестов.

- [ ] **Шаг 5: коммит и push**

```bash
git add docs/specs/62-paywall-no-store.md docs/backlog.md docs/changelog.md docs/lessons.md docs/release-checklist.md CLAUDE.md scripts/check_62_web.js docs/screenshots/62/paywall-soon-dark.png docs/screenshots/62/paywall-soon-light.png docs/screenshots/62/paywall-B-dark.png docs/screenshots/62/paywall-dialog-dark.png
git commit -m "feat: пейвол без магазина — состояние «скоро» вместо плейсхолдерных цен (spec 62)"
git push
```

---

## Сценарий лайв-проверки 6в (Артём, iPhone, Expo Go) — отправлять ТОЛЬКО когда правка в дереве

1. Настройки → «Arcanum Premium» → экран без цен и без кнопки: шапка, эмблема, четыре строки
   «что даёт Premium», панель «Оформить подписку пока нельзя / Попробуйте позже — всё, что уже
   открыто, останется доступным», ниже — только абзац про автопродление со ссылками «Условия» и
   «Конфиденциальность» (открываются во внутреннем браузере). «Восстановить покупки» нет.
2. Курс → тап по узлу модуля 3 → тот же экран, кнопка «назад» подписана «Курс».
3. Настройки → DEV «Premium» вкл → «Arcanum Premium»: чип «✦ АКТИВНА», панель «Подписка активна /
   DEV-режим», «Управлять подпиской», под ней «Восстановить покупки». Тап «Управлять» → диалог
   «Пока недоступно / Покупки пока недоступны. Попробуйте позже.» — без слов Expo Go.
4. Язык → English → пейвол: «Subscribing isn't available yet» — тексты панели переведены.
5. Светлая тема — панель читается, ничего не пропало.

## Что осталось от спеки в 53б (не терять)

- `purchases.web.ts` появляется вместе с нативным импортом RevenueCat; веб-заглушка отдаёт `[]`.
- `purchases.test.ts`: снять `expect(PURCHASES_AVAILABLE).toBe(false)`, добавить мок SDK; контракт
  «цен в коде нет» остаётся навсегда.
- Ветка «скоро» при `PURCHASES_AVAILABLE` показывает «Восстановить покупки» — уже заложено.
- Анкета «безопасность данных» в Play Console переписывается ДО релиза (release-checklist).
