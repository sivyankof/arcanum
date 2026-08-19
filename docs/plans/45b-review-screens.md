# План 45б · Флеш-карты: экраны тренажёра (карточка «Повторение», `/review`, результат)

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ SUB-SKILL — superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans, задача за задачей. Шаги — чекбоксы (`- [ ]`).

**Цель:** три экрана-состояния над готовой логикой 45а: карточка «Повторение» в шапке таба «Курс»
(4 состояния), экран тренажёра `/review` (два направления вопроса, 3D-переворот, панель «ЗНАЧЕНИЕ»,
три кнопки оценки, счётчик очереди, пустые состояния), панель результата с «Ещё N». Ни одной новой
формулы в сторе: экран — тонкий слой над `review.ts`/`srs.ts`/`reviewCard`.

**Архитектура:** сначала ВЫНОСЫ (правило проекта «2+ раза → общий модуль»): `FlipCard` из `SpreadCard`
(механика переворота с лечением 3D-контекста, спека 36/42), `ResultPanel` из `LessonResult` (въезд +
Success + катящийся XP), `KeywordChips` со страницы карты, `MeaningPanel` с «Сегодня», `faceShadow`
в `glow.ts`, `moduleBox` из `ModuleHeader`; потом новые компоненты `ReviewPanel` / `ReviewFlashcard` /
`ReviewResult` и экран `app/review.tsx`; состояние сессии живёт в экране, каждая оценка сразу
в стор через `reviewCard`. Три чистые функции добавляются в `review.ts` (`reviewCardState`,
`nextSessionSize`, `maskCardName`) — под тестами, последняя — ещё и под корпусным контрактом
78 × ru/en. Макет `#v-trainer` и карточка `.revcard` дорисованы Cowork 19.08 (коммит 9a33503
в main) — значения стилей в плане сняты с него; задача 13 — контрольная сверка и список
осознанных расхождений.

**Стек:** Expo SDK 54 (НЕ обновлять), TypeScript strict, expo-router v6 (typed routes), reanimated,
zustand/persist, jest-expo, Playwright из кэша npx для веб-проверки. Python не нужен.

**Спека:** `docs/specs/45-flashcards.md` — исполнитель читает разделы «Решения», В («Экраны»),
«Расхождения с макетом», критерии приёмки 45б. Макет: `docs/design-reference.html`, блоки
`#v-trainer` и карточка в `#v-course` (после дорисовки). Значения — `docs/design-system.md` §5
(«Оценки повторения», «Карточка „Повторение“»), product-spec §2 «Тренажёр», logic-spec §12.

## Глобальные ограничения

- `npx tsc --noEmit` без ошибок после КАЖДОЙ задачи; `npm test` зелёный перед каждым коммитом.
- Комментарии в коде — по-русски; сообщения коммитов — русские, формат `feat: … (spec 45)` /
  `refactor: … (spec 45)`; ни слова про ИИ/Claude в коде и коммитах, без трейлеров Co-Authored-By.
- Хардкод цветов запрещён — только токены `useTheme()`; `boxShadow` строкой (не `shadow*`-пропы);
  `pointerEvents` — внутри стиля, не пропом.
- Новые UI-строки — сразу в `ru` И `en` внутри `src/lib/i18n.ts`; числительное с {{count}} —
  только с формами (`_one/_few/_many` для ru, `_one/_other` для en); число ПОСЛЕ слова, которое не
  склоняется, — `{{n}}` (logic-spec §10). Структурный тест `i18nPlurals.test.ts` это стережёт.
- Язык в экранах — ТОЛЬКО `useLang()`; тексты контента — через `inLang`/`blockText`
  (контракт-тест `langSources.test.ts`).
- Persist НЕ меняется (остаётся **10**): схема стора не трогается. ⚠️ Следующая задача, меняющая
  схему, поднимает version до 11.
- Дубликаты запрещены: механика переворота — ОДИН `FlipCard`; панель итога — ОДИН `ResultPanel`;
  чипы слов — ОДИН `KeywordChips`; панель значения — ОДИН `MeaningPanel`; тень граней — ОДИН
  `faceShadow`. Перед написанием разметки — `grep` по проекту, нет ли её уже.
- Тесты — «сначала красный»: тест пишется до кода и обязан упасть. Компоненты юнит-тестами не
  покрываются (testing-strategy п.2) — их проверяет веб-прогон задачи 14; рефакторинги задач 3–7
  обязаны оставить поведение байт-в-байт (регрессионные сценарии в задаче 14).
- Ветка `feat/45b-review-screens` от актуального `main`; merge в main ТОЛЬКО после лайв-проверки
  Артёма (UI-задача, обычный порядок; прецедент 45а «мерж без лайв-проверки» сюда не распространяется).
- ⚠️ typed routes: `router.push('/review')` не скомпилируется, пока нет файла `app/review.tsx`, —
  поэтому интеграция в курс (задача 12) идёт ПОСЛЕ экрана (задача 11). Если после создания файла
  `tsc` продолжает падать на маршруте — запустить `npx expo start --web` на минуту: Metro пересоберёт
  `.expo/types/router.d.ts` (ловушка задачи 07).

## Структура файлов

| Файл | Ответственность | Действие |
|---|---|---|
| `src/lib/review.ts` | + `ReviewCardState`, `reviewCardState(sum)`, `nextSessionSize(sum)`, `NAME_MASK`, `maskCardName(text, name)` | правка |
| `src/lib/__tests__/review.test.ts` | + тесты трёх функций (состояния, потолок, согласие с `buildSession`, маска + корпусный контракт 78 × ru/en) | правка |
| `src/lib/i18n.ts` | + `review.*` (ru, en), `card.backReview` | правка |
| `src/lib/__tests__/i18nPlurals.test.ts` | + CASES `review.due` 1/3/12 | правка |
| `src/components/KeywordChips.tsx` | золотые чипы слов (`.kws` эталона), вынос со страницы карты; режим `layout="column"` для рубашки | новый |
| `app/card/[id].tsx` | чипы → `KeywordChips`; `BACK_TITLES.review` | правка |
| `src/components/MeaningPanel.tsx` | панель `.mean` (бокс + Overline), вынос с «Сегодня» | новый |
| `src/theme/glow.ts` | + `faceShadow(glow)` (был `FACE_SHADOW` в index.tsx) | правка |
| `app/(tabs)/index.tsx` | `MeaningPanel`, `faceShadow` вместо локальных | правка |
| `src/components/CardBack.tsx` | + проп `content` — замена зоны эмблемы | правка |
| `src/components/FlipCard.tsx` | общий 3D-переворот (из SpreadCard), `FLIP_MS` | новый |
| `src/components/SpreadCard.tsx` | тонкая обёртка над `FlipCard` | правка |
| `src/components/ResultPanel.tsx` | панель итога: въезд, Success, катящийся XP, title/line, CTA, footer | новый |
| `src/components/LessonResult.tsx` | на `ResultPanel`; оставляет полосу модуля и конфетти | правка |
| `src/components/ModuleHeader.tsx` | экспорт `moduleBox` (геометрия панели `.mhead`) | правка |
| `src/components/ReviewPanel.tsx` | карточка «Повторение» в шапке курса | новый |
| `src/components/ReviewFlashcard.tsx` | флеш-карта 190×330 на `FlipCard`, две грани | новый |
| `src/components/ReviewResult.tsx` | итог сессии на `ResultPanel` + «Ещё N» | новый |
| `app/review.tsx` | экран тренажёра | новый |
| `app/_layout.tsx` | `<Stack.Screen name="review">` под гардом | правка |
| `app/(tabs)/course.tsx` | `ReviewPanel` внутри `FadeUp index={1}` + `today` по фокусу/фону | правка |
| `docs/screenshots/45/` | скриншоты 6а | новые |
| `docs/specs/45-flashcards.md`, `docs/product-spec.md`, `docs/design-system.md`, `docs/logic-spec.md`, `docs/backlog.md`, `CLAUDE.md`, `AGENTS.md` | документы и отчёт | правка |

---

### Задача 0: ветка

- [ ] **Шаг 1:** `git checkout main && git pull` → `git checkout -b feat/45b-review-screens`.
  `git status` — чисто. В `main` уже лежат коммит макета 9a33503 и этот план (b51d550+).

---

### Задача 1: `review.ts` — `reviewCardState`, `nextSessionSize`, `maskCardName`

**Файлы:**
- Правка: `src/lib/review.ts` (после `reviewSummary` и после `promptSentence`)
- Тест: `src/lib/__tests__/review.test.ts`

**Интерфейсы:**
- Потребляет: `ReviewSummary`, `SESSION_MAX`, `buildSession`, `promptSentence` (есть с 45а);
  `cards`, `inLang` — для корпусного теста.
- Производит: `type ReviewCardState = 'hidden' | 'due' | 'new' | 'done'`;
  `reviewCardState(s: ReviewSummary): ReviewCardState`; `nextSessionSize(s: ReviewSummary): number`;
  `NAME_MASK = '···'`; `maskCardName(text: string, name: string): string`.
  Их берут `ReviewPanel` (задача 8), `ReviewFlashcard` (9) и экран (11).

⚠️ Зачем `maskCardName` — флаг Cowork при дорисовке макета (backlog, задача «Макет: правки
дорисовок», закрыта 19.08): первое предложение `general` у **всех 78 карт** начинается с имени карты
(ru: «Дурак — карта начала пути.», en: «The Fool is the card of beginnings.» — замер по корпусу 19.08:
ru 78/78 начинаются с имени, en 78/78 содержат его в первом предложении). Спека 45 писала «рубашка:
слова + предложение (без названия!)», подразумевая, что имени в предложении нет, — это было неверно,
и без маски направление toCard выдавало бы ответ прямо на вопросе. Решение: имя в подсказке
заменяется на «···» (как нарисовано в макете: «··· — карта начала пути.»); в панели «ЗНАЧЕНИЕ» после
ответа предложение показывается целиком.

- [ ] **Шаг 1: тесты (красные).** В конец `review.test.ts` (хелперы `deck`, `overdue`, `T`,
  `REVIEW_DAY_DEFAULT`, `lcg` уже объявлены в шапке файла; импорт дополнить именами
  `nextSessionSize`, `reviewCardState`, `maskCardName`, `NAME_MASK`, `type ReviewSummary`;
  `cards` и `inLang` там уже импортированы):

```ts
describe('maskCardName — имя карты в подсказке toCard заменяется на «···»', () => {
  it('ru: имя в начале предложения; регистр не важен', () => {
    expect(maskCardName('Дурак — карта начала пути.', 'Дурак')).toBe(`${NAME_MASK} — карта начала пути.`);
    expect(maskCardName('ДУРАК — карта.', 'Дурак')).toBe(`${NAME_MASK} — карта.`);
  });
  it('en: артикль The уходит вместе с именем; имя без артикля в name тоже маскируется', () => {
    expect(maskCardName('The Fool is the card of beginnings.', 'The Fool')).toBe(`${NAME_MASK} is the card of beginnings.`);
    expect(maskCardName('The Ace of Wands is the spark.', 'Ace of Wands')).toBe(`${NAME_MASK} is the spark.`);
    // «Wheel Of Fortune» в name против «Wheel of Fortune» в тексте — регистр
    expect(maskCardName('The Wheel of Fortune is the card of the turning point.', 'Wheel Of Fortune')).toBe(`${NAME_MASK} is the card of the turning point.`);
  });
  it('маскируются ВСЕ вхождения, но только целым словом: «примирения» не режется, «literal death» — да', () => {
    expect(maskCardName('Мир — карта примирения с собой и мир вокруг.', 'Мир')).toBe(
      `${NAME_MASK} — карта примирения с собой и ${NAME_MASK} вокруг.`,
    );
    // реальный случай корпуса: у Смерти слово стоит в первом предложении дважды
    expect(maskCardName('Death is the card of endings — and it is almost never about literal death.', 'Death')).toBe(
      `${NAME_MASK} is the card of endings — and it is almost never about literal ${NAME_MASK}.`,
    );
  });
  it('имени в тексте нет — текст как есть', () => {
    expect(maskCardName('Карта начала пути.', 'Дурак')).toBe('Карта начала пути.');
  });

  // контракт по корпусу: ни одна подсказка toCard не содержит имени своей карты — ни на ru, ни на en.
  // Это и есть дефект, найденный при дорисовке макета; тест обязан быть красным без maskCardName
  it.each(['ru', 'en'] as const)('корпус %s: promptSentence(general) после маски не содержит имени карты', (lang) => {
    const leaks = cards
      .map((c) => {
        const name = inLang(c.name, lang);
        const hint = maskCardName(promptSentence(inLang(c.content.general, lang)), name);
        const bare = name.replace(/^the\s+/i, '');
        return new RegExp(bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(hint) ? `${c.id}: ${hint}` : null;
      })
      .filter(Boolean);
    expect(leaks).toEqual([]);
  });
});

describe('reviewCardState — карточка «Повторение» в шапке курса (спека 45, раздел В)', () => {
  const sum = (p: Partial<ReviewSummary>): ReviewSummary => ({ deckSize: 8, due: 0, newAvailable: 0, dueTomorrow: 0, ...p });

  it('колода пуста → hidden, какими бы ни были остальные числа', () => {
    expect(reviewCardState(sum({ deckSize: 0, due: 3, newAvailable: 2 }))).toBe('hidden');
  });
  it('просроченные важнее новых → due', () => {
    expect(reviewCardState(sum({ due: 2, newAvailable: 5 }))).toBe('due');
  });
  it('просроченных нет, новые есть → new', () => {
    expect(reviewCardState(sum({ newAvailable: 1 }))).toBe('new');
  });
  it('ни просроченных, ни новых → done (даже при dueTomorrow 0)', () => {
    expect(reviewCardState(sum({ dueTomorrow: 4 }))).toBe('done');
    expect(reviewCardState(sum())).toBe('done');
  });
});

describe('nextSessionSize — число в ссылке «Ещё N»', () => {
  const sum = (p: Partial<ReviewSummary>): ReviewSummary => ({ deckSize: 20, due: 0, newAvailable: 0, dueTomorrow: 0, ...p });

  it('просроченные + доступные новые, потолок SESSION_MAX, ноль при пустой сводке', () => {
    expect(nextSessionSize(sum({ due: 3, newAvailable: 4 }))).toBe(7);
    expect(nextSessionSize(sum({ due: 8, newAvailable: 8 }))).toBe(SESSION_MAX);
    expect(nextSessionSize(sum())).toBe(0);
  });

  it('обещает ровно столько карт, сколько соберёт buildSession на той же сводке', () => {
    // 12 карт: c1..c3 просрочены, остальные новые; сегодня новых введено 8 → доступно 2
    const d = deck(12);
    const srs = overdue(3);
    const day = { date: T, newCount: 8 };
    const s = reviewSummary(d, srs, T, day);
    expect(nextSessionSize(s)).toBe(5);
    expect(buildSession(d, srs, T, day, lcg(1)).length).toBe(nextSessionSize(s));
    // без дневного лимита упирается в SESSION_MAX — и там тоже совпадает
    const s2 = reviewSummary(d, srs, T, REVIEW_DAY_DEFAULT);
    expect(buildSession(d, srs, T, REVIEW_DAY_DEFAULT, lcg(2)).length).toBe(nextSessionSize(s2));
    expect(nextSessionSize(s2)).toBe(SESSION_MAX);
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/review.test.ts` → FAIL: `reviewCardState is not a function`
  (и `nextSessionSize`, `maskCardName`). ⚠️ Дополнительно убедиться, что корпусный тест КРАСНЕЕТ
  и на «почти верной» реализации: временно заставить `maskCardName` возвращать `text` как есть —
  тест обязан перечислить все 78 карт на каждом языке (это и есть дефект из флага Cowork).

- [ ] **Шаг 3: реализация.** В `src/lib/review.ts` после `promptSentence`:

```ts
/** Заглушка имени карты в подсказке направления toCard (как в макете: «··· — карта начала пути»). */
export const NAME_MASK = '···';
// буква для проверки «целое слово»: латиница, кириллица, расширенная латиница (ES/PT); \b в JS —
// ASCII-only и кириллицу границей не считает, а \p{L} требует флага u, за Hermes которого не ручаемся
const LETTER = /[a-zа-яёÀ-ɏ]/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Прячет имя карты в тексте подсказки: первое предложение general у ВСЕХ 78 карт начинается
 *  с имени (ru) или содержит его (en) — без маски рубашка toCard выдавала бы ответ (флаг дорисовки
 *  макета 19.08). Маскируются все вхождения целым словом, регистр не важен; английский артикль
 *  «The» перед именем уходит вместе с ним; у имён с артиклем («The Fool») пробуется и форма без него.
 *  «Мир» внутри «примирения» не трогается. Имени в тексте нет — текст как есть. */
export function maskCardName(text: string, name: string): string {
  const variants = [name, name.replace(/^the\s+/i, '')].filter((v, i, a) => v.length >= 3 && a.indexOf(v) === i);
  for (const v of variants) {
    const re = new RegExp(`(?:the\\s+)?${escapeRe(v)}`, 'gi');
    const out = text.replace(re, (m: string, offset: number, s: string) => {
      const before = s[offset - 1];
      const after = s[offset + m.length];
      const whole = !(before && LETTER.test(before)) && !(after && LETTER.test(after));
      return whole ? NAME_MASK : m;
    });
    if (out !== text) return out;
  }
  return text;
}
```

  И после `reviewSummary`:

```ts
/** Состояние карточки «Повторение» в шапке курса (спека 45, раздел В): колода пуста — карточки нет
 *  вовсе; есть просроченные — «N карт ждут»; просроченных нет, но есть доступные новые — «Новых
 *  карт: N»; иначе — «Всё повторено ✓ · завтра: M». Порядок проверок = приоритет. */
export type ReviewCardState = 'hidden' | 'due' | 'new' | 'done';
export function reviewCardState(s: ReviewSummary): ReviewCardState {
  if (s.deckSize === 0) return 'hidden';
  if (s.due > 0) return 'due';
  if (s.newAvailable > 0) return 'new';
  return 'done';
}

/** Размер СЛЕДУЮЩЕЙ порции — число в ссылке «Ещё N» панели результата: ровно столько карт соберёт
 *  buildSession (просроченные + доступные новые, не больше SESSION_MAX). Не «всего осталось»:
 *  ссылка обещает сессию, и обещать она должна то, что откроется по тапу. Согласие с buildSession —
 *  под тестом. */
export function nextSessionSize(s: ReviewSummary): number {
  return Math.min(SESSION_MAX, s.due + s.newAvailable);
}
```

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/review.test.ts` → PASS (включая корпусный контракт
  78 × ru/en); `npx tsc --noEmit` чисто.
- [ ] **Шаг 5:** `git add src/lib/review.ts src/lib/__tests__/review.test.ts` →
  `git commit -m "feat: состояние карточки повторения, размер порции «Ещё N», маска имени карты в подсказке (spec 45)"`.

---

### Задача 2: i18n — ключи `review.*` и `card.backReview`

**Файлы:**
- Правка: `src/lib/i18n.ts` (блоки ru и en), `src/lib/__tests__/i18nPlurals.test.ts`

**Производит:** ключи, которые берут задачи 8–11: `review.panelTitle`, `review.due` (формы),
`review.new`, `review.allDone`, `review.overline`, `review.title`, `review.queue`, `review.hintMeaning`,
`review.hintCard`, `review.meaning`, `review.cardPage`, `review.gradeForgot/gradeGood/gradeEasy`,
`review.resultLine`, `review.done`, `review.more`, `review.emptyDeck`, `review.toCourse`,
`card.backReview`.

- [ ] **Шаг 1: тест (красный).** В `CASES` файла `i18nPlurals.test.ts` (перед закрывающей `];`):

```ts
  // карточка «Повторение» на курсе (спека 45б): единственное склоняемое числительное тренажёра
  ['review.due', { count: 1 }, '1 карта ждёт'],
  ['review.due', { count: 3 }, '3 карты ждут'],
  ['review.due', { count: 12 }, '12 карт ждут'],
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/i18nPlurals.test.ts` → FAIL (ключа нет — строка
  возвращается как ключ / фолбэк).

- [ ] **Шаг 3: ключи.** В `ru.translation` после блока `reflect` (или рядом с `lesson` — порядок
  блоков в файле не принципиален, но ru и en кладутся симметрично):

```ts
      // тренажёр повторения (спека 45б). Числительное с формами только у due («карт ждут» склоняется);
      // в остальных строках число стоит ПОСЛЕ слова и не склоняет его — там {{n}}, не {{count}}
      // (logic-spec §10; структурный тест i18nPlurals требует формы у каждого {{count}})
      review: {
        panelTitle: "ПОВТОРЕНИЕ",
        due_one: "{{count}} карта ждёт", due_few: "{{count}} карты ждут", due_many: "{{count}} карт ждут",
        new: "Новых карт: {{n}}",
        allDone: "Всё повторено ✓ · завтра: {{n}}",
        overline: "ПОВТОРЕНИЕ · ИНТЕРВАЛЬНЫЙ МЕТОД",
        title: "Тренажёр",
        queue: "К ПОВТОРЕНИЮ · {{n}}",
        hintMeaning: "ВСПОМНИТЕ ЗНАЧЕНИЕ · НАЖМИТЕ",
        hintCard: "ВСПОМНИТЕ КАРТУ · НАЖМИТЕ",
        meaning: "ЗНАЧЕНИЕ",
        cardPage: "Страница карты →",
        // безличные подписи (content-guide: род читателя безличный), три оценки 0 / 2 / 3
        gradeForgot: "Не помню", gradeGood: "Помню", gradeEasy: "Легко",
        resultLine: "ПОВТОРЕНО {{n}} · С ПЕРВОГО РАЗА {{k}}",
        done: "ГОТОВО",
        more: "Ещё {{n}}",
        emptyDeck: "Повторять пока нечего — пройдите урок, и карты появятся здесь.",
        toCourse: "К КУРСУ",
      },
```

  В `en.translation` симметрично:

```ts
      review: {
        panelTitle: "REVIEW",
        due_one: "{{count}} card waiting", due_other: "{{count}} cards waiting",
        new: "New cards: {{n}}",
        allDone: "All reviewed ✓ · tomorrow: {{n}}",
        overline: "REVIEW · SPACED REPETITION",
        title: "Trainer",
        queue: "TO REVIEW · {{n}}",
        hintMeaning: "RECALL THE MEANING · TAP",
        hintCard: "RECALL THE CARD · TAP",
        meaning: "MEANING",
        cardPage: "Card page →",
        gradeForgot: "Forgot", gradeGood: "Got it", gradeEasy: "Easy",
        resultLine: "REVIEWED {{n}} · FIRST TRY {{k}}",
        done: "DONE",
        more: "{{n}} more",
        emptyDeck: "Nothing to review yet — finish a lesson and cards will appear here.",
        toCourse: "TO THE COURSE",
      },
```

  И в блок `card` обоих языков — подпись кнопки «назад» со страницы карты, открытой из тренажёра:
  ru `backReview: "Тренажёр",` / en `backReview: "Trainer",` (рядом с `backSpread`).

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/i18nPlurals.test.ts` → PASS (в т.ч. «набор ключей
  совпадает во всех языках» и «у каждого семейства все формы»). `npx tsc --noEmit` чисто.
- [ ] **Шаг 5:** `git add src/lib/i18n.ts src/lib/__tests__/i18nPlurals.test.ts` →
  `git commit -m "feat: строки тренажёра повторения ru/en, числительное «карт ждут» с формами (spec 45)"`.

---

### Задача 3: вынос `KeywordChips` со страницы карты

**Файлы:**
- Создать: `src/components/KeywordChips.tsx`
- Правка: `app/card/[id].tsx` (разметка чипов под названием; стили `kws`/`kw` удалить)

**Производит:** `KeywordChips({ words: readonly string[]; layout?: 'wrap' | 'column'; style?: StyleProp<ViewStyle> })`.
Потребители: страница карты (сейчас), панель «ЗНАЧЕНИЕ» тренажёра и рубашка toCard (задачи 9, 11).

- [ ] **Шаг 1: компонент.**

```tsx
/** Золотые чипы ключевых слов (`.kws` эталона, design-system §5): 4 слова витрины под названием
 *  на странице карты, в панели «ЗНАЧЕНИЕ» тренажёра и столбиком на рубашке-вопросе (спека 45) —
 *  вынесены по правилу «2+ раза». Слова приходят уже на нужном языке (inLang снаружи).
 *  layout 'wrap' — лента с переносом (страница карты, панель); 'column' — столбик по центру
 *  (рубашка toCard, `.trkwcol` эталона: gap 5). Сам чип один и тот же везде: макет рисует на рубашке
 *  чип чуть иначе (radius 12, бордер frame, 700) — расхождение осознанное, второй стиль чипа для тех
 *  же слов — дубликат (правило проекта). */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function KeywordChips({
  words,
  layout = 'wrap',
  style,
}: {
  words: readonly string[];
  layout?: 'wrap' | 'column';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[layout === 'column' ? st.column : st.row, style]}>
      {words.map((k) => (
        <View key={k} style={[st.chip, { backgroundColor: t.chipBg, borderColor: t.line }]}>
          <Txt style={[st.txt, { color: t.accent }]}>{k}</Txt>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  column: { flexDirection: 'column', alignItems: 'center', gap: 5 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  txt: { fontSize: 10, fontWeight: '600' },
});
```

- [ ] **Шаг 2: страница карты.** В `app/card/[id].tsx` блок

```tsx
            <View style={st.kws}>
              {inLang(card.keywords, lang).map((k) => (
                <View key={k} style={[st.kw, { backgroundColor: t.chipBg, borderColor: t.line }]}>
                  <Txt style={{ color: t.accent, fontSize: 10, fontWeight: '600' }}>{k}</Txt>
                </View>
              ))}
            </View>
```
  заменить на `<KeywordChips words={inLang(card.keywords, lang)} style={{ marginTop: spacing.m }} />`
  (импорт `KeywordChips` из `../../src/components/KeywordChips`); из `st` удалить `kws` и `kw`.
  Отступ `marginTop: spacing.m` — тот, что был у `kws`; геометрия чипа перенесена один в один.

- [ ] **Шаг 3:** `npx tsc --noEmit` чисто; `npm test` зелёный (контракт-тесты исходников).
- [ ] **Шаг 4:** `git add src/components/KeywordChips.tsx "app/card/[id].tsx"` →
  `git commit -m "refactor: чипы ключевых слов — общий KeywordChips (spec 45)"`.

---

### Задача 4: вынос `MeaningPanel` с «Сегодня»

**Файлы:**
- Создать: `src/components/MeaningPanel.tsx`
- Правка: `app/(tabs)/index.tsx` (блок «ЗНАЧЕНИЕ ДНЯ»; стили `meanBox`/`meanLbl` удалить)

**Производит:** `MeaningPanel({ title, children, style? })` — бокс `.mean` + Overline-подпись.
Потребители: «Сегодня» (сейчас), тренажёр (задача 11).

- [ ] **Шаг 1: компонент.**

```tsx
/** Панель значения `.mean` эталона: фон panel, бордер line, radius 16, паддинг 16, Overline-подпись
 *  accent сверху. Первое место — «ЗНАЧЕНИЕ ДНЯ» на «Сегодня», второе — «ЗНАЧЕНИЕ» в тренажёре
 *  (спека 45) — вынесена по правилу «2+ раза». От Block отличается ровно тем, чем в эталоне `.mean`
 *  отличается от `.block`: у заголовка нет хвоста-линии, отступ сверху 16. Содержимое — children
 *  (у карты дня текст + CTA, у тренажёра чипы + предложение + ссылка + кнопки). */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function MeaningPanel({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }, style]}>
      <Txt style={[st.lbl, { color: t.accent }]}>{title}</Txt>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderRadius: radius.l, borderWidth: 1, padding: spacing.l, marginTop: spacing.l },
  lbl: { fontSize: 9.5, letterSpacing: 3 }, // Overline из дизайн-системы: 9.5–10
});
```

- [ ] **Шаг 2: «Сегодня».** В `app/(tabs)/index.tsx` блок

```tsx
              <View style={[st.meanBox, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.meanLbl, { color: t.accent }]}>{tr('today.meaning')}</Txt>
                <Txt style={[st.meanTxt, { color: t.text }]}>
                  {hasText ? dayText : tr('card.soon')}
                </Txt>
                <CtaButton
                  label={tr('today.continue')}
                  onPress={() => router.push(`/card/${card.id}?from=today`)}
                />
              </View>
```
  заменить на

```tsx
              <MeaningPanel title={tr('today.meaning')}>
                <Txt style={[st.meanTxt, { color: t.text }]}>
                  {hasText ? dayText : tr('card.soon')}
                </Txt>
                <CtaButton
                  label={tr('today.continue')}
                  onPress={() => router.push(`/card/${card.id}?from=today`)}
                />
              </MeaningPanel>
```
  (импорт `MeaningPanel`); из `st` удалить `meanBox` и `meanLbl` (комментарий «Overline из
  дизайн-системы» уехал в компонент). `meanTxt` остаётся — это текст карты дня.

- [ ] **Шаг 3:** `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 4:** `git add src/components/MeaningPanel.tsx "app/(tabs)/index.tsx"` →
  `git commit -m "refactor: панель значения — общий MeaningPanel (spec 45)"`.

---

### Задача 5: `faceShadow` в `glow.ts` + проп `content` у `CardBack`

**Файлы:**
- Правка: `src/theme/glow.ts`, `app/(tabs)/index.tsx`, `src/components/CardBack.tsx`

**Производит:** `faceShadow(glow: string): string`; `CardBack` принимает `content?: React.ReactNode`
(заменяет эмблему+ARCANUM, `hint` остаётся под ним). Потребитель — `ReviewFlashcard` (задача 9).

- [ ] **Шаг 1: `glow.ts`.** В конец файла:

```ts
/** Тень граней крупной карты — `.face` эталона: 0 30px 66px glow + 0 6px 18px rgba(0,0,0,.4).
 *  Карта дня (app/(tabs)/index.tsx) и флеш-карта тренажёра (ReviewFlashcard, спека 45); задаётся
 *  инлайн через boxShadow, потому что зависит от темы. */
export const faceShadow = (glow: string) => `0px 30px 66px ${glow}, 0px 6px 18px rgba(0,0,0,0.4)`;
```

- [ ] **Шаг 2: «Сегодня».** В `app/(tabs)/index.tsx` удалить строку
  `const FACE_SHADOW = (glow: string) => \`0px 30px 66px ${glow}, 0px 6px 18px rgba(0,0,0,0.4)\`;`,
  оба `FACE_SHADOW(t.glow)` → `faceShadow(t.glow)`, `faceShadow` добавить в импорт из
  `'../../src/theme/glow'` (там уже берутся `GLARE_*`). Комментарий у стиля `face` («значение в
  FACE_SHADOW») поправить на «в faceShadow (theme/glow.ts)».

- [ ] **Шаг 3: `CardBack`.** Сигнатура и зона эмблемы:

```tsx
export function CardBack({
  hint,
  corners = false,
  content,
}: {
  hint?: string;
  corners?: boolean;
  /** Содержимое зоны эмблемы вместо компаса и слова ARCANUM — рубашка флеш-карты (спека 45)
   *  несёт там ключевые слова и предложение; hint рисуется под content как обычно. */
  content?: React.ReactNode;
}) {
```
  и внутри `<View style={st.emb}>`:

```tsx
        {content ?? (
          <>
            {/* свечение эмблемы — … (комментарий без изменений) */}
            <View style={glowShadow(t.glow, t.accent, 12, 0.35)}>
              <Emblem size={EMB_SIZE} />
            </View>
            <Txt style={[st.word, { color: t.accent }]}>ARCANUM</Txt>
          </>
        )}

        {!!hint && <Txt style={[st.hint, { color: t.muted }]}>{hint}</Txt>}
```
  Шапку файла дополнить строкой: «Проп `content` — зона эмблемы целиком (флеш-карта, спека 45)».

- [ ] **Шаг 4:** `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 5:** `git add src/theme/glow.ts "app/(tabs)/index.tsx" src/components/CardBack.tsx` →
  `git commit -m "refactor: тень граней в glow.ts, зона эмблемы рубашки настраивается (spec 45)"`.

---

### Задача 6: вынос `FlipCard` из `SpreadCard`

**Файлы:**
- Создать: `src/components/FlipCard.tsx`
- Правка: `src/components/SpreadCard.tsx`

**Производит:** `FlipCard({ open, width, height, radius, shadow, animateFlip?, onPress, back, front })`,
`export const FLIP_MS = 500`. Потребители: `SpreadCard` (сейчас), `ReviewFlashcard` (задача 9),
экран (задержка проявления панели, задача 11).

- [ ] **Шаг 1: `FlipCard.tsx`.** Механика переносится из `SpreadCard` БЕЗ изменений (это лечение
  замыленной грани, проверенное лайв-проверками 36 и 42 — комментарий обязан переехать вместе с кодом):

```tsx
/** Двусторонняя карта с 3D-переворотом — общий механизм карт расклада (SpreadCard, спека 36) и
 *  флеш-карты тренажёра (ReviewFlashcard, спека 45): две грани, rotateY 0→180 / 180→360,
 *  backfaceVisibility hidden, FLIP_MS 500 (product-spec §4 п.2). Содержимое граней приходит снаружи
 *  (back / front): карта сама рисует только рамку frame, скругление и тень. Тень — на внешней обёртке:
 *  overflow hidden граней срезал бы её (схема CtaButton). animateFlip=false — карта сразу лежит нужной
 *  гранью, без кадра с трансформацией.
 *
 *  ⚠️ Урок лайв-проверки 36/42 (комментарий сохранён при выносе из SpreadCard): `rotateY: 360deg` —
 *  НЕ то же самое для компоновщика iOS, что отсутствие поворота. Слой с 3D-трансформом
 *  (perspective/rotateY/backfaceVisibility) навсегда остаётся в 3D-контексте и рисуется через
 *  offscreen-текстуру — растрируется мимо натива экрана, карта выглядит замыленной.
 *  Перестать ПЕРЕДАВАТЬ стиль не помогает: reanimated накладывает свойства на нативное представление
 *  ИМПЕРАТИВНО, со стороны UI-потока, и ранее наложенные transform/backfaceVisibility остаются на слое
 *  сиротами. Лечение — стиль отдаётся ВСЕГДА, и как только переворот ДОЕХАЛ (settledSV — shared value,
 *  выставляется в колбэке withTiming прямо на UI-потоке), воркл frontStyle явно возвращает пустой
 *  transform и backfaceVisibility 'visible' — те же свойства перезаписываются тем же каналом. Скачка
 *  нет: на flip 1 rotateY уже 360°, визуально это identity. Параллельно JS-состояние settled (из того же
 *  колбэка через runOnJS) убирает рубашку из дерева — лишний слой на карту. При возврате open в false
 *  оба флага сбрасываются — иначе повторное использование по key покажет лицо без переворота. */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';

export const FLIP_MS = 500; // product-spec §4 п.2

export function FlipCard({
  open,
  width,
  height,
  radius,
  shadow,
  animateFlip = true,
  onPress,
  back,
  front,
}: {
  open: boolean;
  width: number;
  height: number;
  /** скругление граней и обёртки: карта расклада 10, флеш-карта radius.card */
  radius: number;
  /** тень обёртки — строка boxShadow; зависит от темы, поэтому приходит снаружи */
  shadow: string;
  animateFlip?: boolean;
  onPress: () => void;
  back: React.ReactNode;
  front: React.ReactNode;
}) {
  const t = useTheme();
  const flip = useSharedValue(open ? 1 : 0);
  // доехал ли переворот — держим ОБА представления: settledSV читает воркл frontStyle на UI-потоке
  // и там же перезаписывает 3D-пропы дефолтом; settled (React-состояние) убирает рубашку из дерева
  const settledSV = useSharedValue(open && !animateFlip);
  const [settled, setSettled] = React.useState(open && !animateFlip);

  React.useEffect(() => {
    if (!open) {
      flip.value = 0;
      settledSV.value = false;
      setSettled(false);
      return;
    }
    if (!animateFlip) {
      flip.value = 1;
      settledSV.value = true;
      setSettled(true);
      return;
    }
    settledSV.value = false;
    setSettled(false);
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        settledSV.value = true; // UI-поток: воркл ниже тут же перекрывает 3D-пропы дефолтом
        runOnJS(setSettled)(true); // JS-поток: прячет рубашку
      }
    });
  }, [open, animateFlip, flip, settledSV]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));
  // Стиль отдаётся ВСЕГДА (и до, и после settled) — единственный способ гарантированно перезаписать
  // 3D-пропы, а не просто перестать их слать (см. комментарий к файлу)
  const frontStyle = useAnimatedStyle(() => {
    if (settledSV.value) {
      return { transform: [], backfaceVisibility: 'visible' as const };
    }
    return {
      transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  return (
    <PressableScale onPress={onPress} style={{ width, height, borderRadius: radius, boxShadow: shadow }}>
      {!settled && (
        <Animated.View style={[st.face, { borderRadius: radius, borderColor: t.frame }, backStyle]}>
          {back}
        </Animated.View>
      )}
      <Animated.View style={[st.face, { borderRadius: radius, borderColor: t.frame }, frontStyle]}>
        {front}
      </Animated.View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Шаг 2: `SpreadCard.tsx` целиком** (API прежний — `SpreadScreen`/`SpreadBoard` не трогаем):

```tsx
/** Карта расклада на доске (`.s3card` эталона, design-system §5): 88×150 (или уменьшенная), radius 10,
 *  бордер frame, тень glow. Рубашка — поверхность CardBackSurface + звезда ✶; лицо — изображение
 *  (перевёрнутая — вверх ногами). Переворот и лечение замыленной грани после него — общий FlipCard
 *  (механика и урок лайв-проверок 36/42 описаны там). В просмотре сохранённого (animateFlip=false)
 *  карта сразу лежит лицом. */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';
import { FlipCard } from './FlipCard';

export function SpreadCard({
  cardId,
  reversed,
  open,
  width,
  height,
  animateFlip = true,
  onPress,
}: {
  cardId: string;
  reversed: boolean;
  open: boolean;
  width: number;
  height: number;
  animateFlip?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <FlipCard
      open={open}
      width={width}
      height={height}
      radius={10}
      shadow={`0px 10px 26px ${t.glow}`}
      animateFlip={animateFlip}
      onPress={onPress}
      back={
        <>
          <CardBackSurface />
          {/* ✶ отсутствует в Manrope — обычный Text без fontFamily (правило Txt.tsx) */}
          <Text style={[st.star, { color: t.accent }]}>✶</Text>
        </>
      }
      front={
        <Image
          source={cardImages[cardId]}
          style={[st.img, reversed && st.reversed]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      }
    />
  );
}

const st = StyleSheet.create({
  star: { fontSize: 20 },
  img: { width: '100%', height: '100%' },
  reversed: { transform: [{ rotate: '180deg' }] },
});
```

- [ ] **Шаг 3: проверка переноса.** `grep -n "useSharedValue\|withTiming\|FLIP_MS" src/components/SpreadCard.tsx`
  → пусто (механика уехала целиком); `grep -rn "FLIP_MS" src app` → только `FlipCard.tsx`
  (и позже экран). `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 4:** `git add src/components/FlipCard.tsx src/components/SpreadCard.tsx` →
  `git commit -m "refactor: 3D-переворот карты — общий FlipCard, SpreadCard на нём (spec 45)"`.

---

### Задача 7: вынос `ResultPanel` из `LessonResult`

**Файлы:**
- Создать: `src/components/ResultPanel.tsx`
- Правка: `src/components/LessonResult.tsx`

**Производит:** `ResultPanel({ gained, title?, zeroTitle?, line, cta: {label, onPress}, onCounted?, children?, footer? })`.
Потребители: `LessonResult` (сейчас, без `title`), `ReviewResult` (задача 10, `title` «ПОВТОРЕНИЕ» —
`.lbl` над панелью результата в макете `#trres`).

- [ ] **Шаг 1: `ResultPanel.tsx`.**

```tsx
/** Панель итога (`.lresult` эталона, motion-spec §16): въезжает fade+up 500 мс → хаптика Success →
 *  счётчик «+N XP» катится (55 мс/шаг); когда счётчик докатился — зовёт onCounted (финал урока по нему
 *  запускает полосу модуля и конфетти). Общая часть LessonResult (урок) и ReviewResult (тренажёр,
 *  спека 45) — вынесена по правилу «2+ раза». Порядок содержимого фиксирован: title (Overline, если
 *  задан) → XP (или zeroTitle при gained 0) → line → children → CTA → footer. Порядок важен: footer
 *  у урока — слой конфетти, и он обязан лежать ПОВЕРХ CTA, как раньше. Reduce motion: счётчик
 *  мгновенный (motion-spec §16). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { hapticSuccess } from '../lib/haptics';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CtaButton } from './CtaButton';
import { Txt } from './Txt';

const ENTER_MS = 500; // въезд панели
const TICK_MS = 55; // шаг XP-счётчика

export function ResultPanel({
  gained,
  title,
  zeroTitle,
  line,
  cta,
  onCounted,
  children,
  footer,
}: {
  gained: number;
  /** Overline над счётчиком (8.5/ls3 accent, `.lbl` эталона) — у тренажёра «ПОВТОРЕНИЕ»; у урока нет */
  title?: string;
  /** заголовок вместо счётчика при gained = 0 (повтор урока: +2 сегодня уже получены); не задан — слот пуст */
  zeroTitle?: string;
  /** строка под счётчиком, 11/ls1 muted */
  line: string;
  cta: { label: string; onPress: () => void };
  /** момент «счётчик докатился»: ENTER_MS + gained × TICK_MS (при reduce motion — ENTER_MS) */
  onCounted?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();

  const [shown, setShown] = React.useState(reduced ? gained : 0);
  const enter = useSharedValue(0);

  React.useEffect(() => {
    enter.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });

    // последовательность §16: панель встала → Success → счётчик → onCounted
    const timers: ReturnType<typeof setTimeout>[] = [];
    let tick: ReturnType<typeof setInterval> | undefined;

    timers.push(setTimeout(hapticSuccess, ENTER_MS));

    if (!reduced && gained > 0) {
      timers.push(
        setTimeout(() => {
          let cur = 0;
          tick = setInterval(() => {
            cur += 1;
            setShown(cur);
            if (cur >= gained && tick) clearInterval(tick);
          }, TICK_MS);
        }, ENTER_MS),
      );
    }

    const countMs = reduced ? 0 : gained * TICK_MS;
    if (onCounted) timers.push(setTimeout(onCounted, ENTER_MS + countMs));

    return () => {
      timers.forEach(clearTimeout);
      if (tick) clearInterval(tick);
    };
    // финал запускается один раз при монтировании — зависимости пустые сознательно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

  return (
    <Animated.View style={enterStyle}>
      <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.frame }]}>
        {!!title && <Txt style={[st.title, { color: t.accent }]}>{title}</Txt>}
        {gained > 0 ? (
          <Txt style={[st.xp, { color: t.accent }]}>{tr('lesson.xpGain', { n: shown })}</Txt>
        ) : (
          !!zeroTitle && <Txt style={[st.zero, { color: t.head }]}>{zeroTitle}</Txt>
        )}
        <Txt style={[st.line, { color: t.muted }]}>{line}</Txt>
        {children}
        <CtaButton label={cta.label} onPress={cta.onPress} style={st.cta} />
        {footer}
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // .lresult эталона: radius 18 — осознанный литерал, как radius 13 у строки дневника
  panel: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginTop: spacing.l },
  title: { fontSize: 8.5, letterSpacing: 3, marginBottom: 8 }, // .lbl над результатом тренажёра
  xp: { fontFamily: fonts.displaySemi, fontSize: 36 },
  zero: { fontFamily: fonts.display, fontSize: 24 },
  line: { fontSize: 11, letterSpacing: 1, marginTop: 4 },
  cta: { marginTop: spacing.l, alignSelf: 'stretch' },
});
```

- [ ] **Шаг 2: `LessonResult.tsx` целиком** (поведение байт-в-байт: та же последовательность
  въезд → Success → счётчик → полоса + конфетти, те же константы):

```tsx
/** Финал урока (motion-spec §16, `.lresult` эталона): общая панель ResultPanel (въезд 500мс → хаптика
 *  Success → катящийся «+N XP») и по её onCounted — полоса прогресса модуля пружинной кривой (та же,
 *  что у XpPill) + конфетти вверх веером. Конфетти живёт ТОЛЬКО здесь (и позже в коллекции, этап 3+) —
 *  редкость сохраняет праздник. gained = 0 (повтор, +2 сегодня уже получены): счётчика нет —
 *  заголовок «Повторение пройдено». Reduce motion: конфетти не запускается (motion-spec §16). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { ReduceMotion, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { PROGRESS_EASE, ProgressBar } from './ProgressBar';
import { ResultPanel } from './ResultPanel';
import { Sparks } from './Sparks';

const BAR_MS = 800; // полоса модуля
// конфетти по motion-spec §16: ~22 частицы, вверх веером, 1.1с
const CONFETTI_COUNT = 22;
const CONFETTI_MS = 1100;
const CONFETTI_GLYPHS = ['✦', '✧', '❖', '·'];

export function LessonResult({
  gained,
  done,
  total,
  prevDone,
  onNext,
}: {
  gained: number;
  done: number;
  total: number;
  prevDone: number;
  onNext: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();

  const [burst, setBurst] = React.useState(0);
  const bar = useSharedValue(total ? prevDone / total : 0);

  // счётчик докатился (ResultPanel.onCounted) → полоса + конфетти: шаги §16 после счётчика.
  // Колбэк берётся панелью один раз при монтировании — как раньше брались значения в эффекте
  const onCounted = () => {
    bar.value = withTiming(total ? done / total : 0, {
      duration: BAR_MS,
      easing: PROGRESS_EASE, // перелёт за цель, как полоса XpPill (общий модуль ProgressBar)
      reduceMotion: ReduceMotion.System,
    });
    if (!reduced) setBurst((b) => b + 1);
  };

  return (
    <ResultPanel
      gained={gained}
      zeroTitle={tr('lesson.repeatDone')}
      line={tr('lesson.passedOf', { done, count: total })}
      cta={{ label: tr('lesson.nextOnPath'), onPress: onNext }}
      onCounted={onCounted}
      footer={
        // конфетти из-за панели: верхняя полуокружность + подброс, цвета через один
        <Sparks
          burst={burst}
          count={CONFETTI_COUNT}
          duration={CONFETTI_MS}
          distance={[90, 220]}
          size={[8, 18]}
          glyphs={CONFETTI_GLYPHS}
          angleJitter={0.5}
          angleRange={[Math.PI, Math.PI * 2]}
          lift={-60}
          colors={[t.accent, t.accent2]}
        />
      }
    >
      <ProgressBar progress={bar} radius={3} style={st.bar} />
    </ResultPanel>
  );
}

const st = StyleSheet.create({
  bar: { height: 6, alignSelf: 'stretch', marginTop: 12, marginHorizontal: 30 },
});
```

- [ ] **Шаг 3:** `grep -n "hapticSuccess\|TICK_MS\|ENTER_MS" src/components/LessonResult.tsx` → пусто;
  `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 4:** `git add src/components/ResultPanel.tsx src/components/LessonResult.tsx` →
  `git commit -m "refactor: панель итога — общий ResultPanel, финал урока на нём (spec 45)"`.

---

### Задача 8: `ReviewPanel` — карточка «Повторение» (компонент) + `moduleBox`

**Файлы:**
- Правка: `src/components/ModuleHeader.tsx` (экспорт геометрии панели)
- Создать: `src/components/ReviewPanel.tsx`

**Интерфейсы:**
- Потребляет: `reviewCardState`, `ReviewSummary` (задача 1); ключи `review.panelTitle/due/new/allDone`
  (задача 2).
- Производит: `ReviewPanel({ summary: ReviewSummary; onPress: () => void })` — `null` при `hidden`.
  Потребитель — `app/(tabs)/course.tsx` (задача 12).

- [ ] **Шаг 1: `ModuleHeader.tsx`.** Геометрию панели вынести в именованный экспорт (карточка
  «Повторение» по design-system §5 — «панель как ModuleHeader»):

```tsx
/** Геометрия панели `.mhead` эталона — общая с карточкой «Повторение» над первым модулем (спека 45). */
export const moduleBox = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.m,
  borderWidth: 1,
  borderRadius: radius.l,
  paddingVertical: 14,
  paddingHorizontal: spacing.l,
} as const;
```
  и в `st`: `box: moduleBox,` вместо прежнего литерала (остальные стили без изменений).

- [ ] **Шаг 2: `ReviewPanel.tsx`.**

```tsx
/** Карточка «Повторение» в шапке таба «Курс» (спека 45, раздел В; design-system §5): панель как
 *  ModuleHeader над первым модулем — Overline «ПОВТОРЕНИЕ», строка состояния, справа иконка.
 *  Состояние считает чистая reviewCardState: 'hidden' — колода пуста, карточки нет вовсе; 'due' —
 *  «N карт ждут» и 'new' — «Новых карт: N» ведут в тренажёр; 'done' — «Всё повторено ✓ · завтра: M»
 *  цветом success и НЕ тап. Числительное due — через count (logic-spec §10). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { reviewCardState, type ReviewSummary } from '../lib/review';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function ReviewPanel({ summary, onPress }: { summary: ReviewSummary; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const state = reviewCardState(summary);
  if (state === 'hidden') return null;

  const tappable = state !== 'done';
  const line =
    state === 'due'
      ? tr('review.due', { count: summary.due })
      : state === 'new'
        ? tr('review.new', { n: summary.newAvailable })
        : tr('review.allDone', { n: summary.dueTomorrow });

  const body = (
    <>
      <View style={{ flex: 1 }}>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('review.panelTitle')}</Txt>
        <Txt style={[st.line, { color: tappable ? t.head : t.success }]}>{line}</Txt>
      </View>
      {/* `.revcard .ri` эталона: иконка muted во всех состояниях, тап-аффорданс несёт сама панель */}
      <Ionicons name="sync-outline" size={18} color={t.muted} />
    </>
  );
  const box = [st.box, { backgroundColor: t.panel, borderColor: t.line }];

  // «всё повторено» — не кнопка: без PressableScale, иначе пружина обещала бы переход, которого нет
  return tappable ? (
    <PressableScale onPress={onPress} style={box}>
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  // та же панель, что шапка модуля (design-system §5); отступ снизу — до шапки первого модуля
  box: { ...moduleBox, marginBottom: spacing.m },
  // `.revcard small` / `.revcard b` эталона: Overline 8.5/ls2 accent, строка Cormorant 600 15 (меньше
  // названия модуля намеренно — карточка не спорит с шапками модулей)
  overline: { fontSize: 8.5, letterSpacing: 2, fontWeight: '600' },
  line: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
});
```

- [ ] **Шаг 3:** `npx tsc --noEmit` чисто (компонент пока никем не импортируется — это нормально,
  подключение в задаче 12); `npm test` зелёный.
- [ ] **Шаг 4:** `git add src/components/ModuleHeader.tsx src/components/ReviewPanel.tsx` →
  `git commit -m "feat: карточка «Повторение» для шапки курса, геометрия панели модуля общая (spec 45)"`.

---

### Задача 9: `ReviewFlashcard` — флеш-карта на `FlipCard`

**Файлы:**
- Создать: `src/components/ReviewFlashcard.tsx`

**Интерфейсы:**
- Потребляет: `FlipCard` (задача 6), `CardBack` с `content` и `faceShadow` (задача 5),
  `KeywordChips layout="column"` (задача 3), `Direction` из `review.ts`, `cardImages`.
- Производит: `ReviewFlashcard({ cardId, direction, revealed, keywords, hint, onPress })`,
  `REVIEW_CARD_W = 190`, `REVIEW_CARD_H = 330`. `hint` здесь — ЗАМАСКИРОВАННОЕ предложение
  (`maskCardName(promptSentence(general), name)`), его готовит экран (задача 11). Потребитель — экран.

Композиция по макету (`#v-trainer`, коммит 9a33503): подпись «ВСПОМНИТЕ … · НАЖМИТЕ» стоит ПОД
картой в обоих направлениях (`.trhint`), а не на рубашке — рубашка несёт только чипы-столбик
(`.trkwcol`) и предложение-подсказку. Спека В писала подпись на рубашке — расхождение в пользу макета
(одно место подписи для обоих направлений, и она тапается), фиксируется в отчёте и в правке спеки
(задача 15).

- [ ] **Шаг 1: компонент.**

```tsx
/** Флеш-карта тренажёра (спека 45, раздел В; `#v-trainer` эталона): карта 190×330 (`.ringwrap`) на
 *  общем FlipCard. Направление toMeaning — лицо с самого начала, переворота нет (open + animateFlip
 *  false): образ и название — вопрос, ответ — панель «ЗНАЧЕНИЕ» у экрана. Направление toCard —
 *  рубашка CardBack, в зоне эмблемы 4 ключевых слова столбиком (`.trkwcol`) + первое предложение
 *  общего значения с ИМЕНЕМ КАРТЫ под маской «···» (maskCardName — иначе подсказка выдавала бы
 *  ответ); тап → 3D-переворот FLIP_MS → лицо. Подпись «ВСПОМНИТЕ … · НАЖМИТЕ», плашка названия,
 *  панель и кнопки — у экрана, здесь только карта. Уголков нет: они — знак ритуала карты дня
 *  (design-system §5). */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import type { Direction } from '../lib/review';
import { faceShadow } from '../theme/glow';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CardBack } from './CardBack';
import { FlipCard } from './FlipCard';
import { KeywordChips } from './KeywordChips';
import { Txt } from './Txt';

// `.ringwrap` тренажёра в эталоне: 190×330 (карта дня — 216×378, масштаб ≈ 0.88)
export const REVIEW_CARD_W = 190;
export const REVIEW_CARD_H = 330;

export function ReviewFlashcard({
  cardId,
  direction,
  revealed,
  keywords,
  hint,
  onPress,
}: {
  cardId: string;
  direction: Direction;
  /** ответ открыт (toCard — переворот сделан) */
  revealed: boolean;
  /** 4 слова витрины — чипами-столбиком на рубашке в направлении toCard, уже на языке интерфейса */
  keywords: readonly string[];
  /** подсказка на рубашке: первое предложение general с замаскированным именем; '' — блок todo,
   *  на рубашке только чипы */
  hint: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const toCard = direction === 'toCard';

  return (
    <FlipCard
      open={toCard ? revealed : true}
      animateFlip={toCard}
      width={REVIEW_CARD_W}
      height={REVIEW_CARD_H}
      radius={radius.card}
      shadow={faceShadow(t.glow)}
      onPress={onPress}
      back={
        // CardBack — фрагмент (поверхность + внутренняя рамка + зона эмблемы flex:1) и ждёт родителя
        // на всю грань с колонкой: грань FlipCard центрирует детей, поэтому подкладываем absoluteFill
        <View style={StyleSheet.absoluteFill}>
          <CardBack
            content={
              // `.trkwcol` эталона: столбик gap 5 по центру, паддинг 0 12; предложение Cormorant 11.5
              <View style={st.words}>
                <KeywordChips words={keywords} layout="column" />
                {!!hint && <Txt style={[st.hint, { color: t.head }]}>{hint}</Txt>}
              </View>
            }
          />
        </View>
      }
      front={<Image source={cardImages[cardId]} style={st.img} contentFit="cover" cachePolicy="memory-disk" />}
    />
  );
}

const st = StyleSheet.create({
  words: { alignItems: 'center', paddingHorizontal: 12 },
  hint: { fontFamily: fonts.display, fontSize: 11.5, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  img: { width: '100%', height: '100%' },
});
```

- [ ] **Шаг 2:** `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 3:** `git add src/components/ReviewFlashcard.tsx` →
  `git commit -m "feat: флеш-карта тренажёра на общем FlipCard — две грани вопроса (spec 45)"`.

---

### Задача 10: `ReviewResult` — итог сессии на `ResultPanel`

**Файлы:**
- Создать: `src/components/ReviewResult.tsx`

**Интерфейсы:**
- Потребляет: `ResultPanel` (задача 7), ключи `review.resultLine/done/more` (задача 2).
- Производит: `ReviewResult({ gained, cards, firstTry, more, onDone, onMore })`. Потребитель — экран.

- [ ] **Шаг 1: компонент.**

```tsx
/** Финал сессии повторения (спека 45, раздел В): ResultPanel (въезд, Success, катящийся «+X XP») +
 *  строка «ПОВТОРЕНО N · С ПЕРВОГО РАЗА K» + CTA «ГОТОВО» (назад в курс) + ссылка «Ещё N», если
 *  после сессии есть что повторять (новая порция на том же экране, N = nextSessionSize).
 *  Конфетти нет: акцентная анимация экрана одна — переворот (motion-spec: 1–2 на экран). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { ResultPanel } from './ResultPanel';
import { Txt } from './Txt';

export function ReviewResult({
  gained,
  cards,
  firstTry,
  more,
  onDone,
  onMore,
}: {
  gained: number;
  cards: number;
  firstTry: number;
  /** размер следующей порции; 0 — ссылки «Ещё» нет */
  more: number;
  onDone: () => void;
  onMore: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <ResultPanel
      gained={gained}
      title={tr('review.panelTitle')}
      line={tr('review.resultLine', { n: cards, k: firstTry })}
      cta={{ label: tr('review.done'), onPress: onDone }}
      footer={
        more > 0 ? (
          <Pressable onPress={onMore} hitSlop={8} style={st.more}>
            <Txt style={[st.moreTxt, { color: t.accent }]}>{tr('review.more', { n: more })}</Txt>
          </Pressable>
        ) : undefined
      }
    />
  );
}

const st = StyleSheet.create({
  // `.trlink` эталона: 10.5/ls1 accent по центру, отступ 10
  more: { marginTop: 10 },
  moreTxt: { fontSize: 10.5, letterSpacing: 1, fontWeight: '600', textAlign: 'center' },
});
```

- [ ] **Шаг 2:** `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 3:** `git add src/components/ReviewResult.tsx` →
  `git commit -m "feat: панель итога сессии повторения с «Ещё N» (spec 45)"`.

---

### Задача 11: экран `app/review.tsx` + маршрут под гардом + «назад» со страницы карты

**Файлы:**
- Создать: `app/review.tsx`
- Правка: `app/_layout.tsx` (внутри `<Stack.Protected guard={onboarded}>`), `app/card/[id].tsx`
  (`BACK_TITLES`)

**Интерфейсы:**
- Потребляет: всё из задач 1–10; стор `reviewCard`, `srs`, `reviewDay`, `lessonsProgress`;
  `buildSession`, `applyGrade`, `sessionStats`, `reviewSummary`, `nextSessionSize`, `promptSentence`,
  `deckOrder`; `blockText`, `cardById`, `inLang`; `useBackHaptic`, `hapticTap`; `FLIP_MS`.
- Производит: маршрут `/review` (для `router.push('/review')` в задаче 12).

- [ ] **Шаг 1: `app/review.tsx`.**

```tsx
/** Тренажёр повторения (спека 45, раздел В; product-spec §2 «Тренажёр»; logic-spec §12).
 *  Сессия ≤10 карт собирается один раз при монтировании (buildSession), очередь — состояние экрана;
 *  каждая оценка сразу уходит в стор (reviewCard → applyReview), поэтому «назад» без подтверждения.
 *  Две грани вопроса: toMeaning — лицо + название, панель «ЗНАЧЕНИЕ» скрыта до тапа; toCard —
 *  рубашка со словами, тап → переворот. Три кнопки оценки (Light-хаптика у всех — «не помню» не
 *  ошибка), «не помню» возвращает карту в хвост (applyGrade), счётчик = длина очереди и при «не
 *  помню» не уменьшается. Результат — ReviewResult с «Ещё N» (новая порция на том же экране).
 *  Пустые состояния — EmptyState (design-system §7): колода пуста / очередь на сегодня пуста. */
import { router, Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { EmptyState } from '../src/components/EmptyState';
import { FadeUp } from '../src/components/FadeUp';
import { FLIP_MS } from '../src/components/FlipCard';
import { KeywordChips } from '../src/components/KeywordChips';
import { MeaningPanel } from '../src/components/MeaningPanel';
import { PressableScale } from '../src/components/PressableScale';
import { ReviewFlashcard } from '../src/components/ReviewFlashcard';
import { ReviewResult } from '../src/components/ReviewResult';
import { Rule } from '../src/components/Rule';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { blockText, cardById, course } from '../src/lib/content';
import { localDateISO } from '../src/lib/dates';
import { hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { inLang } from '../src/lib/lang';
import {
  applyGrade,
  buildSession,
  deckOrder,
  maskCardName,
  nextSessionSize,
  promptSentence,
  reviewSummary,
  sessionStats,
  type ReviewLogEntry,
  type SessionItem,
} from '../src/lib/review';
import type { SrsGrade } from '../src/lib/srs';
import { useBackHaptic } from '../src/lib/useBackHaptic';
import { useApp } from '../src/store/useApp';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

// проявление плашки/панели после ответа — как пояснение викторины (350 мс)
const REVEAL_MS = 350;

/** Три кнопки оценки слева направо: danger / text / success (design-system §5). Оценки 1 «с трудом»
 *  в UI v1 нет (спека 45) — тип SrsGrade её допускает под будущий режим-викторину. */
const GRADES: { grade: SrsGrade; key: string; tone: 'danger' | 'text' | 'success' }[] = [
  { grade: 0, key: 'review.gradeForgot', tone: 'danger' },
  { grade: 2, key: 'review.gradeGood', tone: 'text' },
  { grade: 3, key: 'review.gradeEasy', tone: 'success' },
];

export default function ReviewScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  // вибрация на уходе с экрана — общий хук (как урок и страница карты)
  useBackHaptic();

  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  const reviewCard = useApp((s) => s.reviewCard);

  const deck = React.useMemo(() => deckOrder(course, lessonsProgress), [lessonsProgress]);
  const today = localDateISO();

  // Сессия строится один раз при монтировании — ленивый useState, как шаги урока (app/lesson/[id]):
  // пересборка посреди сессии перетасовала бы очередь. «Ещё N» собирает новую порцию из АКТУАЛЬНОГО
  // стора (getState), не из значений в замыкании
  const [queue, setQueue] = React.useState<SessionItem[]>(() =>
    buildSession(deck, srs, today, reviewDay, Math.random),
  );
  // счётчик показанных карт — ключ флеш-карты. cardId в ключе не годится: после «не помню» в очереди
  // из одной карты та же карта идёт следом, и без нового ключа FlipCard остался бы открытым — ответ
  // показался бы до вопроса
  const [step, setStep] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [log, setLog] = React.useState<ReviewLogEntry[]>([]);
  const [gained, setGained] = React.useState(0);
  const scrollRef = React.useRef<ScrollView>(null);

  // защита от двойного тапа по кнопке оценки до перерисовки (busy-guard, как у экспорта/импорта):
  // второй тап по старой очереди оценил бы ту же карту дважды и сдвинул бы очередь мимо головы.
  // Снимается эффектом ПОСЛЕ коммита следующего шага, а не в том же обработчике
  const busy = React.useRef(false);
  React.useEffect(() => {
    busy.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // проявление плашки и панели «ЗНАЧЕНИЕ»: toMeaning — сразу, toCard — после переворота (FLIP_MS)
  const reveal = useSharedValue(0);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  const head = queue[0];
  const card = head ? cardById.get(head.cardId) : undefined;
  const keywords = card ? inLang(card.keywords, lang) : [];
  const name = card ? inLang(card.name, lang) : '';
  // первое предложение общего значения через blockText: при todo — только чипы (keywords у всех 78
  // вычитаны, «Текст готовится» на флеш-карте не бывает). На рубашке toCard — с именем под маской
  // «···» (первое предложение general у всех карт начинается с имени — иначе вопрос выдавал бы
  // ответ), в панели «ЗНАЧЕНИЕ» после ответа — целиком
  const meaning = card ? blockText(card.content.general, lang) : { text: '', todo: true };
  const sentence = meaning.todo ? '' : promptSentence(meaning.text);
  const backHint = sentence ? maskCardName(sentence, name) : '';

  const onReveal = () => {
    if (!head || revealed) return;
    hapticTap();
    setRevealed(true);
    reveal.value = withDelay(
      head.direction === 'toCard' ? FLIP_MS : 0,
      withTiming(1, { duration: REVEAL_MS, reduceMotion: ReduceMotion.System }),
    );
  };

  const onGrade = (grade: SrsGrade) => {
    if (!head || busy.current) return;
    busy.current = true;
    hapticTap(); // Light у всех трёх: самооценка «не помню» — не ошибка (спека 45)
    // стор — ВНЕ функционального setState: апдейтер в dev может отработать дважды (StrictMode)
    const r = reviewCard(head.cardId, grade);
    setGained((g) => g + r);
    setLog((l) => [...l, { cardId: head.cardId, grade }]);
    setQueue(applyGrade(queue, grade).queue);
    setRevealed(false);
    reveal.value = 0;
    setStep((s) => s + 1);
  };

  // «Ещё N»: новая порция из актуального стора на том же экране
  const onMore = () => {
    const s = useApp.getState();
    const next = buildSession(deck, s.srs, localDateISO(), s.reviewDay, Math.random);
    if (next.length === 0) return;
    setQueue(next);
    setLog([]);
    setGained(0);
    setRevealed(false);
    reveal.value = 0;
    setStep((n) => n + 1);
  };

  const sum = reviewSummary(deck, srs, today, reviewDay);
  const empty = !head && log.length === 0; // нечего повторять с самого входа
  const result = !head && log.length > 0; // очередь кончилась — итог
  const stats = sessionStats(log);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.course') }} />
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          // как урок и страница карты: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        <FadeUp index={0}>
          <Txt style={[st.overline, { color: t.muted }]}>{tr('review.overline')}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('review.title')}</Txt>
          <Rule />
        </FadeUp>

        {empty && (
          <FadeUp index={1} style={{ marginTop: spacing.xl }}>
            <EmptyState
              text={deck.length === 0 ? tr('review.emptyDeck') : tr('review.allDone', { n: sum.dueTomorrow })}
            />
            <CtaButton label={tr('review.toCourse')} onPress={() => router.back()} />
          </FadeUp>
        )}

        {result && (
          <ReviewResult
            gained={gained}
            cards={stats.cards}
            firstTry={stats.firstTry}
            more={nextSessionSize(sum)}
            onDone={() => router.back()}
            onMore={onMore}
          />
        )}

        {head && card && (
          <FadeUp index={1}>
            <Txt style={[st.count, { color: t.muted }]}>{tr('review.queue', { n: queue.length })}</Txt>
            <View style={st.cardWrap}>
              <ReviewFlashcard
                key={step}
                cardId={card.id}
                direction={head.direction}
                revealed={revealed}
                keywords={keywords}
                hint={backHint}
                onPress={onReveal}
              />
            </View>

            {/* подпись «ВСПОМНИТЕ … · НАЖМИТЕ» — под картой в ОБОИХ направлениях (`.trhint` эталона),
                тапается наравне с картой. После ответа гаснет, но место держит — иначе плашка и панель
                подпрыгнули бы на её высоту ровно в момент проявления панели */}
            <Pressable onPress={onReveal} hitSlop={8} disabled={revealed} style={revealed && st.hidden}>
              <Txt style={[st.hint, { color: t.muted }]}>
                {tr(head.direction === 'toCard' ? 'review.hintCard' : 'review.hintMeaning')}
              </Txt>
            </Pressable>

            {/* toMeaning: название — часть вопроса, видно сразу */}
            {head.direction === 'toMeaning' && (
              <Txt style={[st.plate, { color: t.head }]}>{name.toUpperCase()}</Txt>
            )}

            {revealed && (
              <Animated.View style={revealStyle}>
                {/* toCard: название — ответ, появляется вместе с панелью после переворота */}
                {head.direction === 'toCard' && (
                  <Txt style={[st.plate, { color: t.head }]}>{name.toUpperCase()}</Txt>
                )}
                <MeaningPanel title={tr('review.meaning')} style={{ marginTop: spacing.m }}>
                  <KeywordChips words={keywords} style={{ marginTop: 10, justifyContent: 'center' }} />
                  {!!sentence && <Txt style={[st.sentence, { color: t.text }]}>{sentence}</Txt>}
                  <Pressable onPress={() => router.push(`/card/${card.id}?from=review`)} hitSlop={8}>
                    <Txt style={[st.link, { color: t.accent }]}>{tr('review.cardPage')}</Txt>
                  </Pressable>
                  <View style={st.grades}>
                    {GRADES.map((g) => (
                      <PressableScale
                        key={g.grade}
                        onPress={() => onGrade(g.grade)}
                        style={[st.grade, { borderColor: t.line }]}
                      >
                        <Txt style={[st.gradeTxt, { color: t[g.tone] }]}>{tr(g.key)}</Txt>
                      </PressableScale>
                    ))}
                  </View>
                </MeaningPanel>
              </Animated.View>
            )}
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  // значения — CSS `#v-trainer` эталона (коммит макета 9a33503): .date/.h2/.tcount/.ringwrap/.trhint/
  // .plate/.mean/.trlink/.gradebtns
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  count: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: 10 }, // .tcount
  cardWrap: { alignSelf: 'center', marginTop: 14 }, // .ringwrap margin-top 14
  hint: { fontSize: 9, letterSpacing: 2, textAlign: 'center', marginTop: 10 }, // .trhint
  hidden: { opacity: 0 },
  plate: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 3, textAlign: 'center', marginTop: 6 }, // .plate b 17/ls3, отступ 6
  sentence: { fontFamily: fonts.display, fontSize: 14.5, lineHeight: 22, marginTop: 10 }, // #trtext
  link: { fontSize: 10.5, letterSpacing: 1, fontWeight: '600', textAlign: 'center', marginTop: 10 }, // .trlink
  // .gradebtns: ряд gap 6, отступ 14; кнопка — бордер line, radius 12, паддинг 9×2, 10/700
  grades: { flexDirection: 'row', gap: 6, marginTop: 14 },
  grade: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 2, alignItems: 'center' },
  gradeTxt: { fontSize: 10, fontWeight: '700' },
});
```

- [ ] **Шаг 2: маршрут под гардом.** В `app/_layout.tsx` после строки
  `<Stack.Screen name="spread/[ts]" options={transparentHeader(t)} />`:

```tsx
          {/* тренажёр повторения (спека 45): корневой стек поверх таба «Курс», прозрачная шапка с
              подписью «Курс» на кнопке назад (ставит сам экран); объявлен здесь, чтобы не пройти
              мимо гарда онбординга (урок 09 — незаявленный файловый маршрут роутер добавляет сам) */}
          <Stack.Screen name="review" options={transparentHeader(t)} />
```

- [ ] **Шаг 3: «назад» со страницы карты.** В `app/card/[id].tsx` в `BACK_TITLES` добавить
  `review: 'card.backReview',` и дописать в комментарий над ним: «из тренажёра — „Тренажёр“».

- [ ] **Шаг 4:** `npx tsc --noEmit` чисто (если падает только на `/review` в typed routes — см.
  глобальные ограничения: запустить dev-сервер, чтобы Metro пересобрал типы маршрутов);
  `npm test` зелёный (в т.ч. `langSources.test.ts` — экран берёт язык через `useLang`).
- [ ] **Шаг 5: дым.** `npx expo start --web` → открыть `http://localhost:8081/review` (при
  `onboarded: true` в localStorage — иначе редирект на онбординг, это ожидаемо): на пустой колоде
  видно пустое состояние «Повторять пока нечего…» + «К КУРСУ», консоль без красного.
- [ ] **Шаг 6:** `git add app/review.tsx app/_layout.tsx "app/card/[id].tsx"` →
  `git commit -m "feat: экран тренажёра /review — сессия, две грани, оценки, итог (spec 45)"`.

---

### Задача 12: карточка «Повторение» в шапке таба «Курс»

**Файлы:**
- Правка: `app/(tabs)/course.tsx`

**Потребляет:** `ReviewPanel` (задача 8), `reviewSummary`/`deckOrder` (45а), `useAppActive`,
`useFocusEffect`, `localDateISO`, маршрут `/review` (задача 11).

- [ ] **Шаг 1: импорты.** Добавить: `useFocusEffect` в импорт из `'expo-router'` (рядом с `router`);
  `import { ReviewPanel } from '../../src/components/ReviewPanel';`;
  `import { localDateISO } from '../../src/lib/dates';`;
  `import { deckOrder, reviewSummary } from '../../src/lib/review';`;
  `import { useAppActive } from '../../src/lib/useAppActive';`.

- [ ] **Шаг 2: сводка.** После `const lessonsProgress = useApp((s) => s.lessonsProgress);`:

```tsx
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  // день для сводки повторения: по фокусу таба И по возврату из фона — useFocusEffect не ловит ни
  // полночь, ни сворачивание (урок 06а), а таб «Курс» может остаться открытым с вечера: утром
  // «ждут» должны появиться без переключения табов
  const [today, setToday] = React.useState(() => localDateISO());
  useFocusEffect(React.useCallback(() => setToday(localDateISO()), []));
  useAppActive(() => setToday(localDateISO()));
  const reviewSum = React.useMemo(
    () => reviewSummary(deckOrder(course, lessonsProgress), srs, today, reviewDay),
    [lessonsProgress, srs, reviewDay, today],
  );
```

- [ ] **Шаг 3: разметка.** В `return` строку
  `{mi === 0 ? <FadeUp index={1}>{section}</FadeUp> : section}` заменить на

```tsx
              {mi === 0 ? (
                <FadeUp index={1}>
                  {/* карточка «Повторение» (спека 45) — над первым модулем, в ТОМ ЖЕ шаге каскада:
                      нового индекса FadeUp не добавляем (design-system §5) */}
                  <ReviewPanel summary={reviewSum} onPress={() => router.push('/review')} />
                  {section}
                </FadeUp>
              ) : (
                section
              )}
```
  Шапку файла поправить: первая строка комментария до сих пор говорит «Движка урока нет — узлы ведут
  на заглушку» — заменить на «Узлы ведут в урок (спека 08); над первым модулем — карточка
  «Повторение» (спека 45)».

- [ ] **Шаг 4:** `npx tsc --noEmit` чисто; `npm test` зелёный.
- [ ] **Шаг 5: дым.** `npx expo start --web`, таб «Курс» на пустом прогрессе — карточки нет; после
  DEV «Пройти следующий урок» ×5 в настройках (m2l1 пройден → колода 2) — «Новых карт: 2», тап → `/review`.
- [ ] **Шаг 6:** `git add "app/(tabs)/course.tsx"` →
  `git commit -m "feat: карточка «Повторение» над первым модулем курса, день по фокусу и фону (spec 45)"`.

---

### Задача 13: контрольная сверка с макетом и список осознанных расхождений

**Файлы:** `docs/design-reference.html` (чтение: `#v-trainer`, `.revcard` в `#v-course`, коммит
9a33503 от 19.08), при необходимости правки значений в `app/review.tsx`, `ReviewFlashcard.tsx`,
`ReviewPanel.tsx`, `ReviewResult.tsx`.

Значения в задачах 8–11 сняты с дорисованного макета при написании плана (19.08, уже в `main`).
Эта задача — перепроверка перед веб-прогоном и фиксация расхождений для отчёта.

- [ ] **Шаг 1: сверить по списку** (если макет менялся после 9a33503 — `git log -1 -- docs/design-reference.html`):
  - `.gradebtns`: три кнопки, gap 6 / паддинг 9×2 / 10×700 / danger–text–success ↔ `st.grades/grade/gradeTxt`;
  - `.trkwcol` (рубашка toCard): столбик gap 5, паддинг 0 12, предложение Cormorant 11.5 ↔
    `ReviewFlashcard st.words/hint`, `KeywordChips layout="column"`;
  - `.trhint` 9/ls2 muted, отступ 10, ПОД картой в обоих направлениях ↔ `st.hint`;
  - `#trname` 17/ls3, отступ 6 ↔ `st.plate`; `.tcount` 10/ls2 отступ 10 ↔ `st.count`;
    `.ringwrap` 190×330 отступ 14 ↔ `st.cardWrap` + `REVIEW_CARD_W/H`;
  - панель `#trmean` отступ 12: `.kws` по центру, `#trtext` 14.5 отступ 10, `.trlink` 10.5/ls1 accent
    по центру ↔ `MeaningPanel style`, `KeywordChips style`, `st.sentence/link`;
  - `.revcard`: Overline 8.5/ls2 accent, строка Cormorant 600 15, иконка 18 muted, done цветом `done`
    ↔ `ReviewPanel`;
  - `#trres`: «ПОВТОРЕНИЕ» → строка → «+X XP» → CTA «ГОТОВО» → «Ещё N» ↔ `ReviewResult`/`ResultPanel`.
- [ ] **Шаг 2: осознанные расхождения — в отчёт** (не копировать макет):
  1. пустое состояние: макет рисует `#trempty` 64×104 пунктиром — приложение берёт общий `EmptyState`
     (design-system §7, уже в четырёх местах);
  2. чип на рубашке: макет — radius 12 / бордер frame / 700; приложение — тот же `KeywordChips`, что
     и везде (radius 14 / line / 600): второй стиль чипа для тех же слов — дубликат;
  3. порядок в панели результата: макет «строка → +X XP», приложение «+X XP → строка» — ритм общего
     `ResultPanel` (как финал урока); Overline «ПОВТОРЕНИЕ» сверху — как в макете;
  4. кегль «+X XP» 36 против 34 макета — решение задачи 08; подпись панели «ЗНАЧЕНИЕ» 9.5 против 8.5
     (`.lbl`) — общий `MeaningPanel`, как «ЗНАЧЕНИЕ ДНЯ»;
  5. подпись «НАЖМИТЕ» после ответа в макете остаётся — в приложении гаснет (место держит).
- [ ] **Шаг 3:** если шаг 1 дал правки — `npx tsc --noEmit`, `git commit -m "fix: значения тренажёра по макету (spec 45)"`;
  иначе коммита нет, так и записать в отчёт.

---

### Задача 14: веб-проверка 6а/6б (Playwright) + скриншоты + регрессия выносов

**Файлы:** скрипт — в scratchpad сессии (в репо не кладётся); скриншоты → `docs/screenshots/45/`.

Подготовка: `npx expo start --web` (порт 8081). Скрипт запускается так (AGENTS.md):
`NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node check45.js`.

- [ ] **Шаг 1: скрипт честности СНАЧАЛА красный.** Перед запуском на рабочем коде временно сломать
  экран: в `onGrade` заменить `applyGrade(queue, grade).queue` на `queue.slice(1)` («не помню»
  перестаёт возвращать карту). Сценарий A обязан упасть на проверках «счётчик после „Не помню“
  остаётся 8» и «+8 XP / С ПЕРВОГО РАЗА 7». Вернуть код. Зелёный с первого раза — искать ошибку
  в скрипте, не радоваться.

- [ ] **Шаг 2: скрипт** (`check45.js` в scratchpad). Сид — `goto → evaluate → reload` (НЕ
  `addInitScript`: он срабатывает на каждой навигации и затирает состояние; для стаба `Math.random`
  `addInitScript` допустим — состояние он не трогает). Карта дня качается — тут не мешает: на
  `/review` и «Курсе» бесконечных анимаций у кликаемых элементов нет (пружина PressableScale
  останавливается), но на всякий случай все клики — `click({ force: true })`.

```js
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/45';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8081';
const DUE = { reps: 1, intervalDays: 1, ease: 2.5, due: '2026-01-01' }; // всегда просрочена

const lp = (...ids) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));
const seed = async (page, state) => {
  await page.goto(BASE + '/');
  await page.evaluate((s) => localStorage.setItem('arcanum-app', JSON.stringify({ state: s, version: 10 })), {
    themeMode: 'dark', lang: 'ru', profile: { onboarded: true, name: 'Тест' }, xp: 0, ...state,
  });
  await page.reload();
  await page.waitForTimeout(800);
};
const xp = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('arcanum-app')).state.xp);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); console.log((cond ? 'ok   ' : 'FAIL ') + msg); };
const text = (page, s) => page.getByText(s, { exact: false }).first();
const visible = async (page, s) => text(page, s).isVisible().catch(() => false);

const FLIP = 500; // FLIP_MS
// открыть ответ: подпись на рубашке (toCard) или под картой (toMeaning) — какая есть
async function reveal(page) {
  if (await visible(page, 'ВСПОМНИТЕ КАРТУ')) { await text(page, 'ВСПОМНИТЕ КАРТУ').click({ force: true }); await page.waitForTimeout(FLIP + 450); return 'toCard'; }
  await text(page, 'ВСПОМНИТЕ ЗНАЧЕНИЕ').click({ force: true }); await page.waitForTimeout(450); return 'toMeaning';
}
async function grade(page, label) { await text(page, label).click({ force: true }); await page.waitForTimeout(250); }
// вариант ответа викторины (.opt: бордер 1.5) — клик в контексте страницы, селектора по тексту у вариантов нет
const clickOption = (page) => page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).borderWidth === '1.5px');
  if (el) el.click();
  return !!el;
});

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // ---------- A: 8 новых карт (м2l1..m2l4), все toMeaning, один «Не помню» ----------
  await seed(page, { lessonsProgress: lp('m2l1', 'm2l2', 'm2l3', 'm2l4') });
  await page.goto(BASE + '/course'); await page.waitForTimeout(900);
  check(await visible(page, 'Новых карт: 8'), 'A курс: «Новых карт: 8»');
  await shot(page, 'course-new-dark');
  await text(page, 'Новых карт: 8').click({ force: true }); await page.waitForTimeout(900);
  check(await visible(page, 'К ПОВТОРЕНИЮ · 8'), 'A тренажёр: счётчик 8');
  check(await visible(page, 'ВСПОМНИТЕ ЗНАЧЕНИЕ'), 'A toMeaning: подпись под картой');
  check(!(await visible(page, 'Не помню')), 'A до ответа кнопок нет');
  await shot(page, 'review-meaning-question-dark');
  check((await reveal(page)) === 'toMeaning', 'A новая карта всегда toMeaning');
  check(await visible(page, 'Не помню') && await visible(page, 'Страница карты'), 'A после ответа: кнопки + ссылка');
  await shot(page, 'review-meaning-revealed-dark');
  await grade(page, 'Не помню');
  check(await visible(page, 'К ПОВТОРЕНИЮ · 8'), 'A после «Не помню» счётчик остаётся 8');
  let guard = 0;
  while (!(await visible(page, 'ГОТОВО')) && guard++ < 12) { await reveal(page); await grade(page, 'Помню'); }
  check(guard === 8, `A до результата 8 оценок «Помню» (было ${guard})`);
  await page.waitForTimeout(1400); // счётчик докатился
  check(await visible(page, 'ПОВТОРЕНО 8 · С ПЕРВОГО РАЗА 7'), 'A результат: 8 / с первого раза 7');
  check(await visible(page, '+8 XP'), 'A результат: +8 XP');
  check(!(await visible(page, 'Ещё')), 'A «Ещё» отсутствует (всё повторено)');
  check((await xp(page)) === 8, 'A xp в сторе = 8 (ровно число вспомненных)');
  await shot(page, 'review-result-dark');
  await text(page, 'ГОТОВО').click({ force: true }); await page.waitForTimeout(900);
  check(await visible(page, 'Всё повторено ✓ · завтра: 8'), 'A курс после сессии: всё повторено · завтра 8');
  await shot(page, 'course-done-dark');

  // ---------- B: 3 просроченных + 1 новая, Math.random = 0.7 → просроченные toCard ----------
  await ctx.addInitScript(() => { Math.random = () => 0.7; });
  await seed(page, { lessonsProgress: lp('m2l1', 'm2l2'), srs: { fool: DUE, magician: DUE, 'high-priestess': DUE } });
  await page.goto(BASE + '/course'); await page.waitForTimeout(900);
  check(await visible(page, '3 карты ждут'), 'B курс: «3 карты ждут»');
  await shot(page, 'course-due-dark');
  await text(page, '3 карты ждут').click({ force: true }); await page.waitForTimeout(900);
  check(await visible(page, 'К ПОВТОРЕНИЮ · 4'), 'B счётчик 4 (3 просроченных + 1 новая)');
  // при rng 0.7 все три просроченные — toCard, новая — toMeaning; проверяем, что рубашка со словами
  // встретилась в ходе сессии (порядок после детерминированного тасования заранее не считаем)
  let sawBack = false, sawBackShot = false;
  guard = 0;
  while (!(await visible(page, 'ГОТОВО')) && guard++ < 30) {
    if (await visible(page, 'ВСПОМНИТЕ КАРТУ')) {
      sawBack = true;
      // рубашка: имя карты под маской «···», плашки с именем ещё нет
      check(await visible(page, '···'), 'B рубашка: подсказка с маской «···»');
      if (!sawBackShot) { await shot(page, 'review-card-question-dark'); sawBackShot = true; }
      await reveal(page);
      check(await visible(page, 'Не помню'), 'B toCard: после переворота кнопки видны');
      if (sawBackShot && !fs.existsSync(`${OUT}/review-card-revealed-dark.png`)) await shot(page, 'review-card-revealed-dark');
    } else await reveal(page);
    await grade(page, 'Легко');
  }
  check(sawBack, 'B направление toCard встретилось (рубашка со словами)');
  await page.waitForTimeout(1400);
  check(await visible(page, '+4 XP'), 'B результат +4 XP');
  check((await xp(page)) === 4, 'B xp в сторе = 4');

  // ---------- C: 12 просроченных → порция 10 → «Ещё 2» → порция 2 ----------
  await seed(page, {
    lessonsProgress: lp('m2l1', 'm2l2', 'm2l3', 'm2l4', 'm3l1', 'm3l2'),
    srs: Object.fromEntries(['fool','magician','high-priestess','empress','emperor','hierophant','lovers','chariot','strength','hermit','wheel-of-fortune','justice'].map((id) => [id, DUE])),
  });
  await page.goto(BASE + '/course'); await page.waitForTimeout(900);
  check(await visible(page, '12 карт ждут'), 'C курс: «12 карт ждут»');
  await text(page, '12 карт ждут').click({ force: true }); await page.waitForTimeout(900);
  check(await visible(page, 'К ПОВТОРЕНИЮ · 10'), 'C порция 10');
  guard = 0;
  while (!(await visible(page, 'ГОТОВО')) && guard++ < 30) { await reveal(page); await grade(page, 'Помню'); }
  await page.waitForTimeout(1400);
  check(await visible(page, 'Ещё 2'), 'C результат: «Ещё 2»');
  await text(page, 'Ещё 2').click({ force: true }); await page.waitForTimeout(600);
  check(await visible(page, 'К ПОВТОРЕНИЮ · 2'), 'C вторая порция 2');
  guard = 0;
  while (!(await visible(page, 'ГОТОВО')) && guard++ < 10) { await reveal(page); await grade(page, 'Помню'); }
  await page.waitForTimeout(1400);
  check(await visible(page, '+2 XP') && !(await visible(page, 'Ещё')), 'C вторая порция: +2 XP, «Ещё» нет');
  check((await xp(page)) === 12, 'C xp = 12');

  // ---------- D: пустые состояния + светлая тема ----------
  await seed(page, { themeMode: 'light' });
  await page.goto(BASE + '/review'); await page.waitForTimeout(900);
  check(await visible(page, 'Повторять пока нечего'), 'D колода пуста: пустое состояние');
  await shot(page, 'review-empty-deck-light');
  await seed(page, { themeMode: 'light', lessonsProgress: lp('m2l1'), srs: { fool: { ...DUE, due: '2099-01-01' }, magician: { ...DUE, due: '2099-01-01' } } });
  await page.goto(BASE + '/review'); await page.waitForTimeout(900);
  check(await visible(page, 'Всё повторено ✓ · завтра: 0'), 'D очередь пуста: «Всё повторено ✓ · завтра: 0»');
  await shot(page, 'review-empty-done-light');
  await page.goto(BASE + '/course'); await page.waitForTimeout(900);
  check(await visible(page, 'Всё повторено ✓ · завтра: 0'), 'D курс: done');
  await seed(page, { themeMode: 'light', lessonsProgress: lp('m2l1', 'm2l2', 'm2l3', 'm2l4') });
  await page.goto(BASE + '/course'); await page.waitForTimeout(900);
  await shot(page, 'course-new-light');
  await text(page, 'Новых карт: 8').click({ force: true }); await page.waitForTimeout(900);
  await shot(page, 'review-meaning-question-light');
  await reveal(page); await shot(page, 'review-meaning-revealed-light');
  // ссылка «Страница карты →» ведёт на карту с подписью «назад» = Тренажёр, сессия переживает возврат
  await text(page, 'Страница карты').click({ force: true }); await page.waitForTimeout(900);
  check(await visible(page, 'Тренажёр'), 'D страница карты: кнопка назад «Тренажёр»');
  await page.goBack(); await page.waitForTimeout(700);
  check(await visible(page, 'К ПОВТОРЕНИЮ · 8'), 'D после возврата сессия на месте');

  // ---------- R: регрессия выносов ----------
  // R1 карта дня: панель значения (MeaningPanel) и тень грани (faceShadow)
  await seed(page, { themeMode: 'dark' });
  await page.goto(BASE + '/'); await page.waitForTimeout(900);
  // карта качается ±6px бесконечно — обычный click ждёт неподвижности и падает по таймауту (AGENTS.md)
  await text(page, 'НАЖМИ, ЧТОБЫ ОТКРЫТЬ').click({ force: true }); await page.waitForTimeout(1600);
  check(await visible(page, 'ЗНАЧЕНИЕ ДНЯ'), 'R1 карта дня: панель «ЗНАЧЕНИЕ ДНЯ» на месте');
  // R2 страница карты: чипы ключевых слов (KeywordChips) — 4 штуки
  await page.goto(BASE + '/card/fool'); await page.waitForTimeout(900);
  const chips = await page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).borderRadius === '14px' && d.children.length === 1 && d.textContent.length < 30).length);
  check(chips >= 4, `R2 страница карты: чипов ≥4 (${chips})`);
  // R3 расклад: три карты открываются переворотом (FlipCard)
  await page.goto(BASE + '/spreads'); await page.waitForTimeout(900);
  await text(page, 'Три карты').click({ force: true }); await page.waitForTimeout(900);
  await text(page, 'Разложить карты').click({ force: true }); await page.waitForTimeout(1200);
  const faces = page.locator('img');
  const before = await faces.count();
  check(before === 0, `R3 до открытия картинок карт нет (${before})`);
  // тап по трём рубашкам (звезда ✶ — текст внутри PressableScale)
  for (let i = 0; i < 3; i++) { await page.getByText('✶').first().click({ force: true }); await page.waitForTimeout(900); }
  check((await faces.count()) === 3, 'R3 три карты открыты переворотом');
  // R4 финал урока (ResultPanel): пройти m1l1 DEV-строкой нельзя — он пишет прогресс мимо экрана;
  // вместо этого открыть урок и дойти до финала кликами «ДАЛЕЕ»/вариантами
  await seed(page, { themeMode: 'dark' });
  await page.goto(BASE + '/lesson/m1l1'); await page.waitForTimeout(900);
  guard = 0;
  while (!(await visible(page, 'ДАЛЬШЕ ПО ПУТИ')) && guard++ < 40) {
    if (await visible(page, 'ДАЛЕЕ')) await text(page, 'ДАЛЕЕ').click({ force: true });
    else { // вопрос: жмём первый вариант (верный или нет — неважно, нужен финал), затем ДАЛЕЕ
      check(await clickOption(page), 'R4 вариант ответа найден');
      await page.waitForTimeout(700);
      await text(page, 'ДАЛЕЕ').click({ force: true });
    }
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1600);
  check(await visible(page, 'XP') && await visible(page, 'ПРОЙДЕНО 1 ИЗ 4'), 'R4 финал урока: панель с XP и строкой модуля');

  console.log('\nconsole errors:', errors.length, errors.slice(0, 5));
  console.log(fails.length ? `\n${fails.length} FAIL` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
```

  ⚠️ Подсказки по ловушкам (из прошлых прогонов): `onboarded` живёт ВНУТРИ `profile` — без него любой
  маршрут редиректит на `/onboarding`; refs/локаторы брать заново после каждой перерисовки; иконки
  `@expo/vector-icons` на вебе — глифы шрифта, не `<svg>`; `Alert` на вебе пустой. Если селекторы R3/R4
  не находят элементы — поправить селектор, а не снимать проверку (цель — убедиться, что выносы
  FlipCard/ResultPanel/KeywordChips/MeaningPanel не сломали прежние экраны).

- [ ] **Шаг 3: прогон на рабочем коде** → все `ok`, `console errors: 0` (единственный допустимый
  warning — чужой `props.pointerEvents is deprecated` из `@react-navigation/elements`); скриншоты в
  `docs/screenshots/45/` (не меньше 12: `course-new/due/done-dark`, `course-new-light`,
  `review-meaning-question/revealed-dark/light`, `review-card-question/revealed-dark`,
  `review-result-dark`, `review-empty-deck-light`, `review-empty-done-light`).
- [ ] **Шаг 4: сверка 6а глазами** по `docs/ui-verification.md` — каждый скриншот против
  `#v-trainer`/`#v-course` макета в file://: композиция, типографика (Cormorant у названия и
  предложения), цвета кнопок, отступы 24, рамка frame у карты, обе темы. Каждое расхождение —
  исправить или записать в отчёт с причиной (известное: пустое состояние — `EmptyState` против
  `#trempty`).
- [ ] **Шаг 5:** `git add docs/screenshots/45` → `git commit -m "docs: скриншоты веб-проверки тренажёра (spec 45)"`
  (+ коммиты правок по находкам, если были).

---

### Задача 15: документы, отчёт, финал ветки

**Файлы:** `docs/specs/45-flashcards.md`, `docs/product-spec.md`, `docs/design-system.md`,
`docs/logic-spec.md`, `docs/backlog.md`, `CLAUDE.md`, `AGENTS.md`.

- [ ] **Шаг 1: спека.** В `docs/specs/45-flashcards.md` отметить критерии приёмки 45б
  (`[x]` — кроме лайв-проверки), в разделе В поправить две формулировки под реализацию: подпись
  «ВСПОМНИТЕ … · НАЖМИТЕ» — ПОД картой в обоих направлениях (по макету), а на рубашке toCard —
  чипы-столбик + предложение с именем карты под маской «···» (`maskCardName`; причина — первое
  предложение `general` у всех 78 карт начинается с имени). Добавить раздел **«Отчёт 45б (дата)»**
  по образцу отчёта 45а: сделано (файлы, выносы, чем отличается от плана), тесты (число и разбивка:
  `review.test.ts` +12, `i18nPlurals.test.ts` +3 — перепроверить прогоном каждого файла),
  веб-проверка (что прошло, скриншоты, консоль), расхождения с макетом (список задачи 13 шаг 2),
  **сценарий лайв-проверки для Артёма** (переворот toCard и маска «···» на рубашке, хаптика у трёх
  кнопок, «Ещё N» после «Состарить на день» × нужное число раз при колоде ≥ 11, карточка на курсе
  в трёх состояниях, «назад» со страницы карты — «Тренажёр», регрессия: расклад «Три карты», финал
  урока, карта дня, чипы на странице карты).
- [ ] **Шаг 2: product-spec §2.** «**Повторение 🔨(45)**» → «**Повторение ✅(45)**»; в абзаце
  «Тренажёр» — подпись под картой в обоих направлениях, рубашка «значение → карта» — чипы +
  предложение с именем под маской; последнее предложение («Часть 45а … ✅; экраны — 45б после
  дорисовки макета») → «Обе части ✅ (45а — логика/стор/DEV, 45б — экраны)».
- [ ] **Шаг 3: design-system §5.** Абзац «Рубашка-вопрос тренажёра (направление toCard)» (добавлен
  Cowork 19.08) привести к реализации: чипы — общий `KeywordChips` столбиком (не отдельный стиль
  chipBg/frame/700), предложение Cormorant 11.5 с именем под маской «···», подпись «ВСПОМНИТЕ КАРТУ ·
  НАЖМИТЕ» — под картой (`.trhint` 9/ls2 muted), не на рубашке. Добавить строку про общие
  компоненты, появившиеся в задаче: `FlipCard` (переворот), `ResultPanel` (панель итога),
  `MeaningPanel` (`.mean`), `KeywordChips` (`.kws`) — по одной строке, где сейчас перечислены `Block`
  и `ModalPanel`.
- [ ] **Шаг 4: logic-spec §12.** Одной строкой: «Карточка курса: `reviewCardState` (hidden/due/new/
  done по приоритету), ссылка «Ещё N» — `nextSessionSize = min(SESSION_MAX, due + newAvailable)`
  (совпадение с `buildSession` под тестом); подсказка toCard — `maskCardName(promptSentence(general))`
  (корпусный контракт: имени карты в подсказке нет, 78 × ru/en)».
- [ ] **Шаг 5: backlog.** Задача 45: статус «45б СДЕЛАНА (дата): экраны, веб-проверка 6а/6б ✓,
  ждёт лайв-проверки Артёма; ветка `feat/45b-review-screens`»; флаг Cowork про `promptSentence`/имя
  карты (в закрытой задаче «Макет: правки дорисовок» и в строке 45) пометить «закрыт 45б:
  `maskCardName` + корпусный контракт». После лайв-проверки — `[x]` и строка «ЗАКРЫТА».
- [ ] **Шаг 6: CLAUDE.md «Статус» + AGENTS.md.** Абзац про 45б: что сделано, новые общие
  компоненты, уроки задачи (что вскрылось в ходе реализации — заполняется по факту), число тестов
  и сьютов (замерить `npm test`); в AGENTS.md — число тестов в разделе «Команды», упоминание
  `app/review.tsx` и общих компонентов одной строкой.
- [ ] **Шаг 7:** `npx tsc --noEmit` чисто, `npm test` зелёный, `git status` — только свои файлы;
  `git commit -m "docs: отчёт 45б, статусы в product-spec/design-system/backlog, CLAUDE/AGENTS (spec 45)"`;
  `git push -u origin feat/45b-review-screens`.
- [ ] **Шаг 8:** финальное ревью ветки (superpowers:requesting-code-review) → волна фиксов → лайв-проверка
  Артёма по сценарию из отчёта → merge в main (`git merge --no-ff`), push, backlog/CLAUDE.md —
  «ЗАКРЫТА».

---

## Самопроверка плана (сделана при написании)

**Покрытие спеки (раздел В + критерии 45б):**
- карточка «Повторение», 4 состояния, внутри `FadeUp index={1}`, панель как ModuleHeader, тап только
  в due/new — задачи 1, 8, 12 ✓; числительные через count — задача 2 (`review.due` формы, тест) ✓;
- `/review` под гардом, прозрачная шапка с «Курс», без подтверждения выхода — задача 11 (шаг 2,
  `headerBackTitle`, `useBackHaptic`; `useLeaveGuard` сознательно не используется) ✓;
- композиция Overline → заголовок → Rule → счётчик → карта 190×330 → плашка → панель → 3 кнопки —
  задача 11 ✓; сессия один раз при монтировании, очередь — состояние, busy-guard — задача 11 ✓;
- toMeaning лицом вверх, панель скрыта, подпись под картой, тап по карте ИЛИ подписи, fade 350 —
  задачи 9, 11 ✓; toCard рубашка со словами + предложением БЕЗ имени (маска «···», `maskCardName`
  под корпусным контрактом — задача 1), переворот 500 (`SpreadCard`-механика = `FlipCard`) — задачи
  5, 6, 9 ✓; подпись «ВСПОМНИТЕ КАРТУ · НАЖМИТЕ» — под картой, как в макете (спека В правится
  в задаче 15, расхождение осознанное); `blockText` при todo — только чипы ✓;
- кнопки «Не помню/Помню/Легко» (0/2/3), danger/text/success, бордер line, radius 12, 10/700,
  хаптика Light — задача 11 ✓; «не помню» → хвост (`applyGrade`), счётчик не уменьшается ✓;
- пустые состояния двух видов + CTA «К курсу» — задача 11 (`EmptyState`, расхождение с `#trempty`
  зафиксировано) ✓;
- результат: «Повторено N · с первого раза K · +X XP», катящийся счётчик (ResultPanel), «Готово»,
  «Ещё N» при остатке, без конфетти — задачи 7, 10, 11 ✓; «общая часть выносится, если 2+ места» —
  выполнено (`ResultPanel`) ✓;
- веб-проверка 390×844, обе темы, `docs/screenshots/45/`, сценарий «≥3 карт с одним „Не помню“ —
  карта возвращается, XP вырос ровно на число вспомненных» — задача 14 (сценарий A) ✓;
- документы Г — задача 15 ✓; persist не трогается ✓.

**Плейсхолдеры:** в задачах нет «TBD»/«добавить по аналогии»; код каждого компонента выписан
целиком; значения стилей сняты с дорисованного макета (коммит 9a33503), задача 13 — контрольная
сверка, а не источник значений.

**Согласованность имён:** `reviewCardState`/`nextSessionSize`/`maskCardName`/`NAME_MASK` (задача 1)
← `ReviewPanel` (8), экран (11); `FlipCard`/`FLIP_MS` (6) ← `SpreadCard` (6), `ReviewFlashcard` (9),
экран (11); `ResultPanel({gained, title, zeroTitle, line, cta, onCounted, children, footer})` (7) ←
`LessonResult` (7), `ReviewResult` (10); `CardBack.content` + `faceShadow` (5) ← `ReviewFlashcard`
(9); `KeywordChips({words, layout, style})` (3) ← `ReviewFlashcard` (9, column), экран (11, wrap);
`MeaningPanel` (4) ← экран (11); `moduleBox` (8) ← `ReviewPanel` (8); ключи i18n (2) ← 8, 10, 11;
`ReviewFlashcard({cardId, direction, revealed, keywords, hint, onPress})` (9) ← экран (11, `hint` =
`backHint`); `BACK_TITLES.review` (11) ← ссылка «Страница карты →» с `?from=review` (11) ✓.

**Решения, принятые в плане (не в спеке) — для отчёта и ревью:**
1. «Ещё N» показывает размер СЛЕДУЮЩЕЙ порции (`nextSessionSize`), а не «всего осталось»: ссылка
   обещает сессию, и открывается ровно N карт; общий остаток пользователь увидит на карточке курса.
2. Хаптика открытия ответа — Light (`hapticTap`), не Heavy: Heavy — только карта дня (haptics.ts).
3. Пустые состояния — общий `EmptyState` (design-system §7), не копия `#trempty` из макета.
4. Хвост-линия у заголовка панели: `MeaningPanel` (как `.mean`), а не `Block` (`.block`) — чтобы
   панель тренажёра выглядела как «ЗНАЧЕНИЕ ДНЯ», её ближайший родственник.
5. XP на панели результата — сумма, реально начисленная стором (`reviewCard` возвращает gained), а не
   `sessionStats(log).xp`: по инварианту 45а они равны, но источник правды — стор; `sessionStats`
   даёт cards/firstTry.
6. Имя карты в подсказке toCard маскируется «···» (`maskCardName`, все вхождения целым словом) —
   ответ на флаг Cowork: первое предложение `general` у всех 78 карт начинается с имени. Спека 45
   этого не предвидела; в панели «ЗНАЧЕНИЕ» после ответа предложение целиком.
7. Подпись «ВСПОМНИТЕ … · НАЖМИТЕ» — под картой в ОБОИХ направлениях (макет), а не на рубашке
   (спека В): одно место, одна тап-зона; после ответа гаснет, место держит.
8. Чипы на рубашке — тот же `KeywordChips` (столбиком), а не второй стиль чипа из макета
   (radius 12 / frame / 700): правило «один компонент на одну сущность».
9. Порядок в панели результата — ритм общего `ResultPanel` («+X XP» → строка), Overline
   «ПОВТОРЕНИЕ» сверху по макету; макет рисует строку над XP — расхождение осознанное.
