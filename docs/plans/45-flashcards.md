# План 45а · Флеш-карты: логика повторений и данные (без экранов)

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ SUB-SKILL — superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans, задача за задачей. Шаги — чекбоксы (`- [ ]`).

**Цель:** чистая логика повторения изученных карт по SM-2 (алгоритм, сборка сессии ≤10, сводка,
правило XP), поля `srs`/`reviewDay` в сторе и бэкапе (persist 10), три DEV-строки в настройках —
всё под тестами, ни одного нового экрана. Экраны — часть 45б, свой план после дорисовки макета.

**Архитектура:** `srs.ts` (переписан: SM-2 по ЛОКАЛЬНЫМ ДНЯМ) → `review.ts` (сессия, сводка,
`applyReview` — единственная функция, меняющая `srs`/`reviewDay`/XP; стор её только применяет,
как `completeLessonProgress` у уроков) → стор (`reviewCard`, `resetSrs`, `devAgeSrs`) → бэкап
(валидация новых полей) → DEV-строки. Общий `shuffle` выносится из `spread.ts`.

**Стек:** Expo SDK 54 (НЕ обновлять), TypeScript strict, zustand/persist, jest-expo. Python не нужен.

**Спека:** `docs/specs/45-flashcards.md` — исполнитель читает её разделы А и Б целиком.

## Глобальные ограничения

- `npx tsc --noEmit` без ошибок после КАЖДОЙ задачи; `npm test` зелёный перед каждым коммитом.
- Комментарии в коде — по-русски; сообщения коммитов — русские, формат `feat: … (spec 45)`; ни слова
  про ИИ/Claude в коде и коммитах, без трейлеров Co-Authored-By.
- Хардкод цветов запрещён (в 45а UI-кода нет, кроме `SettingsRow` с готовыми пропсами).
- Новые UI-строки — сразу в `ru` И `en` внутри `src/lib/i18n.ts`; в этой части только ключи
  DEV-строк.
- Persist: `SCHEMA_VERSION` 9 → **10** в `src/lib/backup.ts` (единственный источник версии),
  `migrate` в сторе НЕ трогать: оба новых поля — ключи ВЕРХНЕГО уровня, дефолты доливаются сами.
- Дубликаты запрещены (правило проекта): тасование — ОДИН `shuffle`, дата +N дней — ОДИН
  `plusDaysISO`.
- Тесты — по правилу «сначала красный»: тест пишется до кода, прогоняется, обязан упасть.
- Даты в тестах строятся из локальных компонентов/ISO-строк, не из `Date.now()` — тесты не зависят
  от часового пояса раннера (образец `dates.test.ts`).
- Ветка `feat/45-flashcards`; после задач 1–8 — ревью и merge в main (лайв-проверки экранов
  у 45а нет по существу — прецедент 28а).

## Структура файлов

| Файл | Ответственность | Действие |
|---|---|---|
| `src/lib/dates.ts` | + `plusDaysISO(iso, n)` — дата через n суток от ISO-дня | правка |
| `src/lib/shuffle.ts` | Фишер–Йетс, возвращает новый массив | новый |
| `src/lib/spread.ts` | `dealSpread` переходит на `shuffle` | правка |
| `src/lib/srs.ts` | SM-2 по дням: `SrsGrade`, `SrsState`, константы, `reviewState`, `isDue` | переписать |
| `src/lib/xp.ts` | + `XP_REVIEW = 1` | правка |
| `src/lib/review.ts` | сессия/сводка/`applyReview`/`sessionStats`/`promptSentence`, `ReviewDay` | новый |
| `src/lib/backup.ts` | `SCHEMA_VERSION = 10`, поля `srs`/`reviewDay`, валидаторы | правка |
| `src/store/useApp.ts` | поля, `reviewCard`/`resetSrs`/`devAgeSrs`, комментарий v9 → v10 | правка |
| `src/lib/i18n.ts` | ключи `settings.devReviewQueue/devAgeSrs/devResetSrs/reviewQueueText` (ru, en) | правка |
| `app/settings.tsx` | три DEV-`SettingsRow` + `ConfirmDialog` очереди | правка |
| `src/lib/__tests__/dates.test.ts`, `shuffle.test.ts`, `srs.test.ts`, `review.test.ts`, `xp.test.ts`, `backup.test.ts` | тесты | новые/правка |
| `docs/logic-spec.md`, `docs/product-spec.md`, `docs/backlog.md`, `AGENTS.md`, `CLAUDE.md`, `docs/specs/45-flashcards.md` | документы и отчёт | правка |

---

### Задача 0: ветка

- [ ] **Шаг 1:** `git checkout -b feat/45-flashcards` от актуального `main` (после коммита спеки
  92318c1). Проверить `git status` — чисто.

---

### Задача 1: `plusDaysISO` в `dates.ts`

**Файлы:** Modify `src/lib/dates.ts` (после `daysAgoISO`); Test `src/lib/__tests__/dates.test.ts`.

**Интерфейсы:** Produces `plusDaysISO(iso: string, n: number): string` — используют `srs.ts`
(due = сегодня + интервал) и `review.ts` (завтра).

- [ ] **Шаг 1: тест (красный).** В `dates.test.ts` добавить импорт `plusDaysISO` в строку импорта
  из `'../dates'` и блок:

```ts
describe('plusDaysISO — дата через n суток от ISO-дня (спека 45)', () => {
  it('переход через месяц и год', () => {
    expect(plusDaysISO('2026-08-31', 1)).toBe('2026-09-01');
    expect(plusDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('n = 0 — та же дата; отрицательное n — назад (в феврале невисокосного года)', () => {
    expect(plusDaysISO('2026-08-19', 0)).toBe('2026-08-19');
    expect(plusDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('365 дней — потолок интервала SM-2', () => {
    expect(plusDaysISO('2026-08-19', 365)).toBe('2027-08-19');
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/dates.test.ts` — падает: `plusDaysISO is not a function`.
- [ ] **Шаг 3: код.** В `src/lib/dates.ts` после `daysAgoISO`:

```ts
/** Дата через n суток от ISO-дня (локально); n может быть отрицательным. Пара к daysAgoISO
 *  для случаев, где отсчёт идёт не от «сейчас», а от сохранённой даты — срок следующего
 *  показа карты повторения (спека 45). */
export function plusDaysISO(iso: string, n: number): string {
  return daysAgoISO(-n, parseISODate(iso));
}
```
  (`parseISODate` объявлена ниже в том же файле — hoisting функций это допускает.)
- [ ] **Шаг 4:** `npx jest src/lib/__tests__/dates.test.ts` — зелёный. `npx tsc --noEmit` чист.
- [ ] **Шаг 5:** `git add src/lib/dates.ts src/lib/__tests__/dates.test.ts && git commit -m "feat: plusDaysISO — дата через n суток от ISO-дня (spec 45)"`

---

### Задача 2: общий `shuffle`, `dealSpread` на нём

**Файлы:** Create `src/lib/shuffle.ts`; Modify `src/lib/spread.ts:35-45`; Test
`src/lib/__tests__/shuffle.test.ts`; существующий `spread.test.ts` должен остаться зелёным.

**Интерфейсы:** Produces `shuffle<T>(items: readonly T[], rng?: () => number): T[]` — новый массив,
вход не мутируется; порядок обращений к `rng` — тот же, что был в `dealSpread` (Фишер–Йетс с
конца).

- [ ] **Шаг 1: тест (красный).** `src/lib/__tests__/shuffle.test.ts`:

```ts
import { shuffle } from '../shuffle';

const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

describe('shuffle — Фишер–Йетс (спека 45, вынесен из spread.ts)', () => {
  it('перестановка: тот же набор элементов, вход не тронут', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(src, lcg(3));
    expect([...out].sort((a, b) => a - b)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out).not.toBe(src);
  });
  it('сидированный rng — детерминированно, другой сид — иначе', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(7))).toEqual(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(7)));
    expect(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(7))).not.toEqual(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(8)));
  });
  it('rng → 0 всегда меняет i-й с нулевым: [1,2,3,4] → [2,3,4,1]; rng → 0.999 — тождество', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
  });
  it('пустой массив и один элемент', () => {
    expect(shuffle([], lcg(1))).toEqual([]);
    expect(shuffle(['a'], lcg(1))).toEqual(['a']);
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/shuffle.test.ts` — падает: модуль не найден.
- [ ] **Шаг 3: код.** `src/lib/shuffle.ts`:

```ts
/** Тасование Фишера–Йетса. Возвращает НОВЫЙ массив, вход не трогает. rng — параметр ради
 *  детерминированных тестов; в приложении Math.random (криптостойкость не нужна).
 *  Вынесен из spread.ts (спека 36), второй потребитель — сессия повторения (спека 45). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```
  В `src/lib/spread.ts`: добавить `import { shuffle } from './shuffle';` и заменить тело
  `dealSpread`:

```ts
export function dealSpread(count: number, rng: () => number = Math.random): DrawnCard[] {
  const ids = shuffle(cards.map((c) => c.id), rng);
  return ids.slice(0, count).map((cardId) => ({ cardId, reversed: rng() < REVERSED_P }));
}
```
  Комментарий над функцией оставить, дописав «тасование — общий `shuffle`».
- [ ] **Шаг 4:** `npx jest src/lib/__tests__/shuffle.test.ts src/lib/__tests__/spread.test.ts` —
  оба зелёные (детерминизм `dealSpread` сохранён: алгоритм и порядок вызовов rng те же).
  `npx tsc --noEmit` чист.
- [ ] **Шаг 5:** `git add src/lib/shuffle.ts src/lib/spread.ts src/lib/__tests__/shuffle.test.ts && git commit -m "refactor: общий shuffle — dealSpread на нём (spec 45)"`

---

### Задача 3: `srs.ts` — SM-2 по дням

**Файлы:** Rewrite `src/lib/srs.ts` целиком; Test `src/lib/__tests__/srs.test.ts` (новый).

**Интерфейсы:** Consumes `plusDaysISO` (задача 1). Produces:
`type SrsGrade = 0|1|2|3`, `interface SrsState { reps; intervalDays; ease; due }`,
`EASE_START = 2.5`, `EASE_MIN = 1.3`, `EASE_MAX = 5`, `MAX_INTERVAL_DAYS = 365`,
`reviewState(prev: SrsState | undefined, grade: SrsGrade, todayISO: string): SrsState`,
`isDue(s: SrsState, todayISO: string): boolean`. Старых `initialSrs`/`review`/`dueCards`/`dueAt`
в репо быть не должно (никто не импортирует — проверить `grep -rn "from './srs'\|from '../srs'" src app`).

- [ ] **Шаг 1: тест (красный).** `src/lib/__tests__/srs.test.ts`:

```ts
import { EASE_MAX, EASE_MIN, EASE_START, isDue, MAX_INTERVAL_DAYS, reviewState, type SrsState } from '../srs';

const T = '2026-08-19';

describe('reviewState — SM-2 по локальным дням (спека 45, logic-spec §12)', () => {
  it('новая карта, «помню» (2): reps 1, интервал 1, due завтра, ease не меняется', () => {
    const s = reviewState(undefined, 2, T);
    expect(s).toEqual({ reps: 1, intervalDays: 1, ease: EASE_START, due: '2026-08-20' });
  });
  it('лестница 1 → 6 → round(6 × ease) при трёх «помню» подряд', () => {
    const s1 = reviewState(undefined, 2, T);
    const s2 = reviewState(s1, 2, s1.due);
    const s3 = reviewState(s2, 2, s2.due);
    expect(s2.intervalDays).toBe(6);
    expect(s2.due).toBe('2026-08-26');
    expect(s3.reps).toBe(3);
    expect(s3.intervalDays).toBe(15);
    expect(s3.due).toBe('2026-09-10');
  });
  it('ease по четырём оценкам от 2.5: 3 → +0.10, 2 → 0, 1 → −0.14, 0 → −0.54', () => {
    expect(reviewState(undefined, 3, T).ease).toBeCloseTo(2.6, 6);
    expect(reviewState(undefined, 2, T).ease).toBeCloseTo(2.5, 6);
    expect(reviewState(undefined, 1, T).ease).toBeCloseTo(2.36, 6);
    expect(reviewState(undefined, 0, T).ease).toBeCloseTo(1.96, 6);
  });
  it('«легко» у новой карты — тот же 1 день (без easy-bonus), отличие только в ease', () => {
    const s = reviewState(undefined, 3, T);
    expect(s.intervalDays).toBe(1);
    expect(s.due).toBe('2026-08-20');
  });
  it('«с трудом» (1) — засчитано: reps растёт, интервал по лестнице', () => {
    expect(reviewState(undefined, 1, T)).toMatchObject({ reps: 1, intervalDays: 1, due: '2026-08-20' });
  });
  it('«не помню» после длинного интервала: reps 0, интервал 0, due = сегодня, ease упал', () => {
    const prev: SrsState = { reps: 5, intervalDays: 60, ease: 2.8, due: T };
    const s = reviewState(prev, 0, T);
    expect(s).toEqual({ reps: 0, intervalDays: 0, ease: expect.closeTo(2.26, 6), due: T });
  });
  it('интервал считается по ease ДО обновления', () => {
    const prev: SrsState = { reps: 2, intervalDays: 6, ease: 2.0, due: T };
    // «легко»: интервал round(6 × 2.0) = 12, а не round(6 × 2.1)
    expect(reviewState(prev, 3, T).intervalDays).toBe(12);
  });
  it('пол ease 1.3 и потолки: ease 5, интервал 365', () => {
    const low: SrsState = { reps: 0, intervalDays: 0, ease: EASE_MIN, due: T };
    expect(reviewState(low, 0, T).ease).toBe(EASE_MIN);
    const high: SrsState = { reps: 3, intervalDays: 10, ease: EASE_MAX, due: T };
    expect(reviewState(high, 3, T).ease).toBe(EASE_MAX);
    const long: SrsState = { reps: 9, intervalDays: 300, ease: 2.5, due: T };
    const s = reviewState(long, 2, T);
    expect(s.intervalDays).toBe(MAX_INTERVAL_DAYS);
    expect(s.due).toBe('2027-08-19');
  });
  it('due переходит через месяц и год', () => {
    const s = reviewState({ reps: 1, intervalDays: 1, ease: 2.5, due: '2026-12-30' }, 2, '2026-12-30');
    expect(s.due).toBe('2027-01-05');
  });
});

describe('isDue', () => {
  const s = (due: string): SrsState => ({ reps: 1, intervalDays: 1, ease: 2.5, due });
  it('вчера и сегодня — к повторению, завтра — нет', () => {
    expect(isDue(s('2026-08-18'), T)).toBe(true);
    expect(isDue(s(T), T)).toBe(true);
    expect(isDue(s('2026-08-20'), T)).toBe(false);
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/srs.test.ts` — падает (`reviewState` не экспортирован).
- [ ] **Шаг 3: код.** Заменить содержимое `src/lib/srs.ts` целиком:

```ts
/**
 * SRS — интервальное повторение флеш-карт, алгоритм SM-2 (P.A. Wozniak, SuperMemo-2, 1987;
 * открытый алгоритм). Спека 45, logic-spec §12. Чистый модуль без импортов react/expo.
 *
 * Оценки: 0 — не помню, 1 — с трудом (кнопки в UI v1 нет, оставлена под будущий режим-викторину),
 * 2 — помню, 3 — легко. Расписание ведётся по ЛОКАЛЬНЫМ ДНЯМ, а не по времени суток: оценка
 * в 23:00 даёт «завтра» = следующий календарный день — иначе утром очередь была бы пуста,
 * а вечером полна.
 */
import { plusDaysISO } from './dates';

export type SrsGrade = 0 | 1 | 2 | 3;

export interface SrsState {
  /** подряд успешных повторений; «не помню» сбрасывает в 0 */
  reps: number;
  intervalDays: number;
  /** фактор лёгкости SM-2, EASE_MIN..EASE_MAX */
  ease: number;
  /** день следующего показа, YYYY-MM-DD локально; due <= сегодня — карта к повторению */
  due: string;
}

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 5;
export const MAX_INTERVAL_DAYS = 365;

/** Оценка → шкала SM-2 (0..5): «не помню» — полный провал (1), дальше 3 / 4 / 5. */
const SM2_QUALITY: Record<SrsGrade, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };

export function isDue(s: SrsState, todayISO: string): boolean {
  return s.due <= todayISO;
}

/** Новое состояние карты после оценки. prev === undefined — карта повторяется впервые.
 *  Интервал: 1 → 6 → round(prev × ease) (ease ДО обновления), потолок MAX_INTERVAL_DAYS;
 *  «не помню» → reps 0, интервал 0, due = сегодня (карта вернётся в конец сессии).
 *  ease обновляется при любой оценке (оригинальный SM-2), в коридоре EASE_MIN..EASE_MAX. */
export function reviewState(prev: SrsState | undefined, grade: SrsGrade, todayISO: string): SrsState {
  const q = SM2_QUALITY[grade];
  const base: SrsState = prev ?? { reps: 0, intervalDays: 0, ease: EASE_START, due: todayISO };
  let reps = base.reps;
  let intervalDays = base.intervalDays;
  if (q < 3) {
    reps = 0;
    intervalDays = 0;
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * base.ease);
    intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
  }
  const raw = base.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const ease = Math.min(EASE_MAX, Math.max(EASE_MIN, raw));
  return { reps, intervalDays, ease, due: plusDaysISO(todayISO, intervalDays) };
}
```

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/srs.test.ts` — зелёный; `npx tsc --noEmit` чист;
  `grep -rn "dueCards\|initialSrs\|dueAt" src app` — пусто.
- [ ] **Шаг 5:** `git add src/lib/srs.ts src/lib/__tests__/srs.test.ts && git commit -m "feat: srs.ts переписан — SM-2 по локальным дням, под тестами (spec 45)"`

---

### Задача 4: `XP_REVIEW` в `xp.ts`

**Файлы:** Modify `src/lib/xp.ts:6-9`; Test `src/lib/__tests__/xp.test.ts`.

- [ ] **Шаг 1: тест (красный).** В `xp.test.ts` добавить `XP_REVIEW` в импорт и тест рядом
  с проверками констант:

```ts
it('+1 за вспомненную карту повторения (спека 45): единственный ежедневный источник после курса', () => {
  expect(XP_REVIEW).toBe(1);
});
```
- [ ] **Шаг 2:** `npx jest src/lib/__tests__/xp.test.ts` — падает.
- [ ] **Шаг 3: код.** В `src/lib/xp.ts` после `XP_SPREAD`:

```ts
/** +1 за вспомненную карту повторения (спека 45): начисляется в момент оценки ≥1 карты, которая
 *  была к повторению; потолок в день естественный — оценённая карта уходит на дни. */
export const XP_REVIEW = 1;
```
- [ ] **Шаг 4:** тест зелёный, tsc чист.
- [ ] **Шаг 5:** `git add src/lib/xp.ts src/lib/__tests__/xp.test.ts && git commit -m "feat: XP_REVIEW — +1 за вспомненную карту (spec 45)"`

---

### Задача 5: `review.ts` — сессия, сводка, `applyReview`, статистика, первое предложение

**Файлы:** Create `src/lib/review.ts`; Test `src/lib/__tests__/review.test.ts` (новый).

**Интерфейсы:** Consumes `learnedCardIds`, `LessonProgressMap` (`courseProgress.ts`),
`CourseModule` (`content.ts`), `plusDaysISO`, `shuffle`, `isDue`/`reviewState`/`SrsGrade`/`SrsState`,
`XP_REVIEW`. Produces (их берут задачи 6–8):
`SESSION_MAX = 10`, `NEW_PER_DAY = 10`, `PROMPT_MIN = 20`, `PROMPT_MAX = 160`,
`type SrsMap = Record<string, SrsState>`, `type Direction = 'toMeaning' | 'toCard'`,
`interface SessionItem { cardId: string; direction: Direction; isNew: boolean }`,
`interface ReviewDay { date: string; newCount: number }`, `REVIEW_DAY_DEFAULT`,
`interface ReviewLogEntry { cardId: string; grade: SrsGrade }`,
`interface ReviewSummary { deckSize; due; newAvailable; dueTomorrow }`,
`deckOrder(modules, progress): string[]`,
`reviewSummary(deck, srs, todayISO, day): ReviewSummary`,
`buildSession(deck, srs, todayISO, day, rng): SessionItem[]`,
`applyGrade(queue, grade): { queue: SessionItem[]; passed: boolean }`,
`applyReview(srs, day, cardId, grade, todayISO): { srs: SrsMap; day: ReviewDay; gained: number }`,
`sessionStats(log): { cards; firstTry; xp }`, `promptSentence(text): string`.

- [ ] **Шаг 1: тест (красный).** `src/lib/__tests__/review.test.ts`:

```ts
import type { CourseModule } from '../content';
import { cards } from '../content';
import type { LessonProgressMap } from '../courseProgress';
import { inLang } from '../lang';
import {
  applyGrade,
  applyReview,
  buildSession,
  deckOrder,
  NEW_PER_DAY,
  PROMPT_MAX,
  PROMPT_MIN,
  promptSentence,
  REVIEW_DAY_DEFAULT,
  reviewSummary,
  SESSION_MAX,
  sessionStats,
  type ReviewDay,
  type ReviewLogEntry,
  type SessionItem,
  type SrsMap,
} from '../review';
import type { SrsState } from '../srs';
import { XP_REVIEW } from '../xp';

const T = '2026-08-19';
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};
// карта с состоянием, due задан
const st = (due: string, extra: Partial<SrsState> = {}): SrsState => ({ reps: 1, intervalDays: 1, ease: 2.5, due, ...extra });
// колода из n карт c1..cn
const deck = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);
// srs, где карты c1..ck просрочены на k, k−1, … дней (c1 самая старая)
const overdue = (k: number): SrsMap =>
  Object.fromEntries(Array.from({ length: k }, (_, i) => [`c${i + 1}`, st(`2026-08-${String(19 - (k - i)).padStart(2, '0')}`)]));

// фабрика модулей — как в courseProgress.test.ts
const fx = (id: string, lessons: number, cardsPerLesson = 0): CourseModule => ({
  id,
  free: true,
  title: { ru: id, en: id },
  lessons: Array.from({ length: lessons }, (_, i) => ({
    id: `${id}${i + 1}`,
    title: { ru: `${id}${i + 1}`, en: `${id}${i + 1}` },
    cards: Array.from({ length: cardsPerLesson }, (_, c) => `${id}${i + 1}-card-${c}`),
  })),
});
const done = (...ids: string[]): LessonProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

describe('deckOrder — колода = карты пройденных уроков в порядке курса', () => {
  it('пустой прогресс → пустая колода; порядок — по урокам, повтор карты не дублируется', () => {
    const mods = [fx('a', 2, 2), fx('b', 1, 2)];
    expect(deckOrder(mods, {})).toEqual([]);
    expect(deckOrder(mods, done('a2', 'a1'))).toEqual(['a1-card-0', 'a1-card-1', 'a2-card-0', 'a2-card-1']);
    // урок-повторение перечисляет карту заново — в колоде она один раз
    const withRepeat: CourseModule[] = [{ ...mods[0], lessons: [...mods[0].lessons, { id: 'a3', title: { ru: 'a3', en: 'a3' }, cards: ['a1-card-0'] }] }];
    expect(deckOrder(withRepeat, done('a1', 'a3'))).toEqual(['a1-card-0', 'a1-card-1']);
  });
});

describe('reviewSummary — сводка для карточки курса и DEV-диалога', () => {
  it('пустая колода — нули', () => {
    expect(reviewSummary([], {}, T, REVIEW_DAY_DEFAULT)).toEqual({ deckSize: 0, due: 0, newAvailable: 0, dueTomorrow: 0 });
  });
  it('due считает просроченные и сегодняшние, dueTomorrow — до завтра включительно, новые — без состояния', () => {
    const srs: SrsMap = { c1: st('2026-08-18'), c2: st(T), c3: st('2026-08-20'), c4: st('2026-08-21') };
    const s = reviewSummary(deck(6), srs, T, REVIEW_DAY_DEFAULT);
    expect(s).toEqual({ deckSize: 6, due: 2, newAvailable: 2, dueTomorrow: 3 });
    // состояние «всё повторено»: просроченных нет — dueTomorrow = ровно завтра
    expect(reviewSummary(['c3', 'c4'], srs, T, REVIEW_DAY_DEFAULT)).toMatchObject({ due: 0, dueTomorrow: 1 });
  });
  it('newAvailable режется дневным лимитом: сегодняшний счётчик учитывается, вчерашний — нет', () => {
    const today: ReviewDay = { date: T, newCount: 8 };
    const yesterday: ReviewDay = { date: '2026-08-18', newCount: 8 };
    expect(reviewSummary(deck(20), {}, T, today).newAvailable).toBe(NEW_PER_DAY - 8);
    expect(reviewSummary(deck(20), {}, T, yesterday).newAvailable).toBe(NEW_PER_DAY);
    expect(reviewSummary(deck(20), {}, T, { date: T, newCount: NEW_PER_DAY }).newAvailable).toBe(0);
  });
  it('состояние карты, выпавшей из колоды (сброс курса), не считается', () => {
    expect(reviewSummary(['c1'], { c1: st(T), zzz: st(T) }, T, REVIEW_DAY_DEFAULT).due).toBe(1);
  });
});

describe('buildSession — порция ≤ SESSION_MAX', () => {
  it('12 просроченных → 10 самых старых, все повторяемые (isNew false)', () => {
    const s = buildSession(deck(12), overdue(12), T, REVIEW_DAY_DEFAULT, lcg(1));
    expect(s).toHaveLength(SESSION_MAX);
    const ids = s.map((i) => i.cardId).sort();
    expect(ids).toEqual(deck(10).sort()); // c11, c12 (самые свежие) не вошли
    expect(s.every((i) => !i.isNew)).toBe(true);
  });
  it('3 просроченных + 20 новых → 3 + 7 новых; новые — первые по порядку колоды и всегда toMeaning', () => {
    const s = buildSession(deck(23), overdue(3), T, REVIEW_DAY_DEFAULT, lcg(2));
    expect(s).toHaveLength(10);
    const fresh = s.filter((i) => i.isNew);
    expect(fresh).toHaveLength(7);
    expect(fresh.map((i) => i.cardId).sort()).toEqual(['c10', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9']);
    expect(fresh.every((i) => i.direction === 'toMeaning')).toBe(true);
  });
  it('лимит новых в день: newCount = 8 → в сессии не больше 2 новых; = 10 → новых нет', () => {
    expect(buildSession(deck(20), {}, T, { date: T, newCount: 8 }, lcg(3))).toHaveLength(2);
    expect(buildSession(deck(20), {}, T, { date: T, newCount: NEW_PER_DAY }, lcg(3))).toEqual([]);
  });
  it('сидированный rng — детерминированный порядок и направления; повторяемым выпадают оба направления', () => {
    const a = buildSession(deck(12), overdue(12), T, REVIEW_DAY_DEFAULT, lcg(5));
    const b = buildSession(deck(12), overdue(12), T, REVIEW_DAY_DEFAULT, lcg(5));
    expect(a).toEqual(b);
    const dirs = new Set(a.map((i) => i.direction));
    expect(dirs.has('toMeaning') && dirs.has('toCard')).toBe(true);
  });
  it('пустая колода → пустая сессия', () => {
    expect(buildSession([], {}, T, REVIEW_DAY_DEFAULT, lcg(1))).toEqual([]);
  });
});

describe('applyGrade — очередь сессии', () => {
  const q: SessionItem[] = [
    { cardId: 'a', direction: 'toMeaning', isNew: true },
    { cardId: 'b', direction: 'toCard', isNew: false },
  ];
  it('«не помню» возвращает карту в хвост, passed false', () => {
    expect(applyGrade(q, 0)).toEqual({ queue: [q[1], q[0]], passed: false });
  });
  it('оценка ≥1 снимает карту, passed true', () => {
    expect(applyGrade(q, 1)).toEqual({ queue: [q[1]], passed: true });
    expect(applyGrade(q, 2)).toEqual({ queue: [q[1]], passed: true });
  });
  it('пустая очередь — пустая очередь', () => {
    expect(applyGrade([], 2)).toEqual({ queue: [], passed: false });
  });
});

describe('applyReview — единственная запись в srs/reviewDay/XP (стор только применяет)', () => {
  it('новая карта, «помню»: состояние появилось, newCount +1 с сегодняшней датой, +XP_REVIEW', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'c1', 2, T);
    expect(r.srs.c1).toMatchObject({ reps: 1, due: '2026-08-20' });
    expect(r.day).toEqual({ date: T, newCount: 1 });
    expect(r.gained).toBe(XP_REVIEW);
  });
  it('вчерашний счётчик новых сбрасывается, сегодняшний — растёт', () => {
    expect(applyReview({}, { date: '2026-08-18', newCount: 7 }, 'c1', 2, T).day).toEqual({ date: T, newCount: 1 });
    expect(applyReview({}, { date: T, newCount: 7 }, 'c1', 2, T).day).toEqual({ date: T, newCount: 8 });
  });
  it('повторяемая карта счётчик новых не трогает', () => {
    const day: ReviewDay = { date: T, newCount: 3 };
    expect(applyReview({ c1: st(T) }, day, 'c1', 2, T).day).toBe(day);
  });
  it('XP: «не помню» — 0; провал и затем «помню» — +1; повторный «помню» карты, уже ушедшей на завтра, — 0', () => {
    const r0 = applyReview({ c1: st(T) }, REVIEW_DAY_DEFAULT, 'c1', 0, T);
    expect(r0.gained).toBe(0);
    const r1 = applyReview(r0.srs, r0.day, 'c1', 2, T);
    expect(r1.gained).toBe(XP_REVIEW);
    const r2 = applyReview(r1.srs, r1.day, 'c1', 2, T);
    expect(r2.gained).toBe(0);
    expect(r2.srs.c1.reps).toBe(2); // состояние всё равно обновилось — только XP не даётся
  });
  it('вход не мутируется', () => {
    const srs: SrsMap = { c1: st(T) };
    const day = { ...REVIEW_DAY_DEFAULT };
    applyReview(srs, day, 'c1', 3, T);
    expect(srs.c1.reps).toBe(1);
    expect(day).toEqual(REVIEW_DAY_DEFAULT);
  });
});

describe('sessionStats и инвариант «xp экрана = xp стора»', () => {
  it('лог «0, 2» одной карты: cards 1, firstTry 0, xp 1; две карты с первого раза — firstTry 2', () => {
    expect(sessionStats([{ cardId: 'a', grade: 0 }, { cardId: 'a', grade: 2 }])).toEqual({ cards: 1, firstTry: 0, xp: XP_REVIEW });
    expect(sessionStats([{ cardId: 'a', grade: 3 }, { cardId: 'b', grade: 2 }])).toEqual({ cards: 2, firstTry: 2, xp: 2 * XP_REVIEW });
    expect(sessionStats([])).toEqual({ cards: 0, firstTry: 0, xp: 0 });
  });
  it('симуляция сессии: сумма gained по applyReview равна sessionStats(log).xp', () => {
    let srs: SrsMap = overdue(4); // c1..c4 просрочены
    let day: ReviewDay = REVIEW_DAY_DEFAULT;
    let queue = buildSession(deck(6), srs, T, day, lcg(9)); // 4 просроченных + 2 новых
    expect(queue).toHaveLength(6);
    // сценарий: первые две карты «не помню», потом всё «помню»
    const script = [0, 0, 2, 2, 2, 2, 2, 2];
    const log: ReviewLogEntry[] = [];
    let gainedTotal = 0;
    for (const g of script as (0 | 2)[]) {
      const head = queue[0];
      const r = applyReview(srs, day, head.cardId, g, T);
      srs = r.srs; day = r.day; gainedTotal += r.gained;
      log.push({ cardId: head.cardId, grade: g });
      queue = applyGrade(queue, g).queue;
    }
    expect(queue).toEqual([]);
    const stats = sessionStats(log);
    expect(stats).toEqual({ cards: 6, firstTry: 4, xp: 6 * XP_REVIEW });
    expect(gainedTotal).toBe(stats.xp);
    // после сессии повторять нечего, новых сегодня введено 2
    expect(reviewSummary(deck(6), srs, T, day)).toMatchObject({ due: 0, newAvailable: 0 });
    expect(day).toEqual({ date: T, newCount: 2 });
  });
});

describe('promptSentence — первое предложение general для оборота/подсказки', () => {
  it('обычный текст — до первой точки', () => {
    expect(promptSentence('Дурак — карта начала пути. Дальше идёт второе предложение.')).toBe('Дурак — карта начала пути.');
  });
  it('короткое первое предложение (< PROMPT_MIN) — берём до второго', () => {
    expect(promptSentence('Дурак. Карта начала пути и доверия миру.')).toBe('Дурак. Карта начала пути и доверия миру.');
  });
  it('«…», «!» и «?» — тоже концы предложений; точка внутри слова — нет', () => {
    expect(promptSentence('Всё только начинается… Дальше текст.')).toBe('Всё только начинается…');
    expect(promptSentence('Что ждёт впереди на этом пути? Неизвестно.')).toBe('Что ждёт впереди на этом пути?');
    expect(promptSentence('Версия 1.5 карты меняет всё. Ещё.')).toBe('Версия 1.5 карты меняет всё.');
  });
  it('текст без знака конца — целиком; пустой — пустая строка; длинное режется до PROMPT_MAX с «…»', () => {
    expect(promptSentence('без точки в конце')).toBe('без точки в конце');
    expect(promptSentence('   ')).toBe('');
    const long = 'а'.repeat(200) + '. Второе.';
    const out = promptSentence(long);
    expect(out.length).toBe(PROMPT_MAX);
    expect(out.endsWith('…')).toBe(true);
  });
  it('контракт по корпусу: у всех 78 карт первое предложение general (ru, en) в коридоре и является началом текста', () => {
    for (const c of cards) {
      for (const lang of ['ru', 'en'] as const) {
        const text = inLang(c.content.general, lang);
        const p = promptSentence(text);
        expect(p.length).toBeGreaterThanOrEqual(PROMPT_MIN);
        expect(p.length).toBeLessThanOrEqual(PROMPT_MAX);
        const head = p.endsWith('…') && !text.trim().startsWith(p) ? p.slice(0, -1) : p;
        expect(text.trim().startsWith(head)).toBe(true);
      }
    }
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/review.test.ts` — падает: модуль не найден.
- [ ] **Шаг 3: код.** `src/lib/review.ts`:

```ts
/** Повторение изученных карт (спека 45, logic-spec §12): сборка сессии, сводка для карточки
 *  курса и DEV-диалога, правило начисления XP. Чистый модуль без импортов react/expo.
 *  Единственная функция, меняющая srs/reviewDay/XP, — applyReview; стор только применяет её
 *  результат (как completeLessonProgress у уроков). */
import type { CourseModule } from './content';
import { learnedCardIds, type LessonProgressMap } from './courseProgress';
import { plusDaysISO } from './dates';
import { shuffle } from './shuffle';
import { isDue, reviewState, type SrsGrade, type SrsState } from './srs';
import { XP_REVIEW } from './xp';

/** Порция карт за один заход и потолок НОВЫХ карт в день (Anki-дефолты). Премиум-гейта в v1
 *  нет — если появится, ограничивать здесь. */
export const SESSION_MAX = 10;
export const NEW_PER_DAY = 10;
/** Коридор длины подсказки-предложения. */
export const PROMPT_MIN = 20;
export const PROMPT_MAX = 160;

export type SrsMap = Record<string, SrsState>;
export type Direction = 'toMeaning' | 'toCard';
export interface SessionItem {
  cardId: string;
  direction: Direction;
  isNew: boolean;
}
/** Сколько НОВЫХ карт введено за день: счётчик действителен, только если date === сегодня. */
export interface ReviewDay {
  date: string;
  newCount: number;
}
export const REVIEW_DAY_DEFAULT: ReviewDay = { date: '', newCount: 0 };
export interface ReviewLogEntry {
  cardId: string;
  grade: SrsGrade;
}
export interface ReviewSummary {
  deckSize: number;
  due: number;
  newAvailable: number;
  dueTomorrow: number;
}

/** Колода = карты пройденных уроков в порядке курса (Set хранит порядок вставки). Вычисляется,
 *  не хранится: DEV-сброс курса сжимает колоду сам, лишние состояния srs безвредны. */
export function deckOrder(modules: CourseModule[], progress: LessonProgressMap): string[] {
  return [...learnedCardIds(modules, progress)];
}

function newToday(day: ReviewDay, todayISO: string): number {
  return day.date === todayISO ? day.newCount : 0;
}

export function reviewSummary(deck: readonly string[], srs: SrsMap, todayISO: string, day: ReviewDay): ReviewSummary {
  const tomorrow = plusDaysISO(todayISO, 1);
  let due = 0;
  let fresh = 0;
  let dueTomorrow = 0;
  for (const id of deck) {
    const s = srs[id];
    if (!s) {
      fresh++;
      continue;
    }
    if (isDue(s, todayISO)) due++;
    // «завтра: M» показывается только когда просроченных нет, поэтому <= завтра = ровно завтра
    if (s.due <= tomorrow) dueTomorrow++;
  }
  const newAvailable = Math.max(0, Math.min(fresh, NEW_PER_DAY - newToday(day, todayISO)));
  return { deckSize: deck.length, due, newAvailable, dueTomorrow };
}

/** Порция ≤ SESSION_MAX: просроченные по due ↑ (при равенстве — порядок колоды), остаток слотов —
 *  новые в порядке колоды не больше newAvailable; итог тасуется. Направление: новая карта всегда
 *  toMeaning (сначала показать образ), повторяемая — 50/50. rng — параметр ради тестов. */
export function buildSession(
  deck: readonly string[],
  srs: SrsMap,
  todayISO: string,
  day: ReviewDay,
  rng: () => number,
): SessionItem[] {
  const pos = new Map(deck.map((id, i) => [id, i] as const));
  const dueIds = deck
    .filter((id) => srs[id] !== undefined && isDue(srs[id], todayISO))
    .sort((a, b) => {
      const da = srs[a].due;
      const db = srs[b].due;
      if (da !== db) return da < db ? -1 : 1;
      return (pos.get(a) ?? 0) - (pos.get(b) ?? 0);
    })
    .slice(0, SESSION_MAX);
  const items: SessionItem[] = dueIds.map((cardId) => ({
    cardId,
    direction: rng() < 0.5 ? 'toMeaning' : 'toCard',
    isNew: false,
  }));
  const { newAvailable } = reviewSummary(deck, srs, todayISO, day);
  const slots = Math.min(SESSION_MAX - items.length, newAvailable);
  const fresh = deck.filter((id) => srs[id] === undefined).slice(0, slots);
  items.push(...fresh.map((cardId): SessionItem => ({ cardId, direction: 'toMeaning', isNew: true })));
  return shuffle(items, rng);
}

/** Очередь сессии после оценки: голова снимается; «не помню» ставит её же в хвост — карта
 *  повторяется, пока не будет вспомнена. */
export function applyGrade(queue: readonly SessionItem[], grade: SrsGrade): { queue: SessionItem[]; passed: boolean } {
  const [head, ...rest] = queue;
  if (!head) return { queue: [], passed: false };
  return grade === 0 ? { queue: [...rest, head], passed: false } : { queue: rest, passed: true };
}

/** Применить оценку: новое состояние карты, счётчик новых за день, XP. Правило XP без понятия
 *  «сессия»: +XP_REVIEW за оценку ≥1 карты, которая ДО этой оценки была к повторению (новая или
 *  due <= сегодня). Провал и затем «помню» дают +1; повторное «помню» карты, уже ушедшей
 *  на завтра, — 0; накрутка невозможна. */
export function applyReview(
  srs: SrsMap,
  day: ReviewDay,
  cardId: string,
  grade: SrsGrade,
  todayISO: string,
): { srs: SrsMap; day: ReviewDay; gained: number } {
  const prev = srs[cardId];
  const wasDue = prev === undefined || isDue(prev, todayISO);
  const next: SrsMap = { ...srs, [cardId]: reviewState(prev, grade, todayISO) };
  const nextDay: ReviewDay = prev === undefined ? { date: todayISO, newCount: newToday(day, todayISO) + 1 } : day;
  return { srs: next, day: nextDay, gained: grade >= 1 && wasDue ? XP_REVIEW : 0 };
}

/** Итог сессии для панели результата: уникальных карт, «с первого раза» (первая оценка ≥1),
 *  XP — по карте с хотя бы одной оценкой ≥1. В сессии из buildSession это совпадает с суммой
 *  gained по applyReview (инвариант под тестом): карта в сессии по построению к повторению,
 *  а вспомненная в очередь не возвращается. */
export function sessionStats(log: readonly ReviewLogEntry[]): { cards: number; firstTry: number; xp: number } {
  const first = new Map<string, SrsGrade>();
  const passed = new Set<string>();
  for (const e of log) {
    if (!first.has(e.cardId)) first.set(e.cardId, e.grade);
    if (e.grade >= 1) passed.add(e.cardId);
  }
  let firstTry = 0;
  for (const g of first.values()) if (g >= 1) firstTry++;
  return { cards: first.size, firstTry, xp: passed.size * XP_REVIEW };
}

/** Первое предложение general для оборота/подсказки: срез по первому `.`/`!`/`?`/`…`, за которым
 *  пробел или конец строки; короче PROMPT_MIN («Дурак.») — берём до второго; длиннее PROMPT_MAX —
 *  режем с «…». Точка внутри слова («1.5») концом не считается. */
export function promptSentence(text: string): string {
  const src = text.trim();
  const ends: number[] = [];
  const re = /[.!?…]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while (ends.length < 2 && (m = re.exec(src)) !== null) ends.push(m.index + m[0].length);
  let cut = ends[0] ?? src.length;
  if (cut < PROMPT_MIN && ends[1] !== undefined) cut = ends[1];
  const out = src.slice(0, cut).trim();
  return out.length > PROMPT_MAX ? `${out.slice(0, PROMPT_MAX - 1).trimEnd()}…` : out;
}
```

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/review.test.ts` — зелёный. Если контракт по корпусу
  падает на конкретной карте — НЕ ослаблять коридор молча: посмотреть текст, понять, почему
  (аббревиатура? предложение короче 20?), и решить в отчёте (правило корпуса важнее удобства).
  `npx tsc --noEmit` чист.
- [ ] **Шаг 5:** `git add src/lib/review.ts src/lib/__tests__/review.test.ts && git commit -m "feat: review.ts — сессия повторения, сводка, applyReview, статистика (spec 45)"`

---

### Задача 6: бэкап — `SCHEMA_VERSION = 10`, поля `srs`/`reviewDay`, валидация

**Файлы:** Modify `src/lib/backup.ts` (импорты, `SCHEMA_VERSION`, `BackupState`,
`PERSIST_DEFAULTS`, валидаторы, `validState`); Test `src/lib/__tests__/backup.test.ts`.

**Интерфейсы:** Consumes `SrsMap`, `ReviewDay`, `REVIEW_DAY_DEFAULT` (`review.ts`), `EASE_MIN`,
`EASE_MAX`, `MAX_INTERVAL_DAYS` (`srs.ts`). Produces `BackupState.srs: SrsMap`,
`BackupState.reviewDay: ReviewDay`, `SCHEMA_VERSION = 10`.

- [ ] **Шаг 1: тесты (красный).** В `backup.test.ts`:
  1. В фикстуру `VALID` добавить поля (после `spreadsHistory`):
```ts
  srs: { fool: { reps: 2, intervalDays: 6, ease: 2.5, due: '2026-08-20' }, magician: { reps: 0, intervalDays: 0, ease: 1.96, due: '2026-08-14' } },
  reviewDay: { date: '2026-08-14', newCount: 3 },
```
  2. В тесте «ключи бэкапа = персистуемая схема» заменить ожидаемый список на отсортированный
     с новыми ключами и обновить заголовок:
```ts
  it('ключи бэкапа = персистуемая схема v10 (спека 45: + srs, reviewDay) — новое поле стора требует осознанного решения здесь', () => {
    expect([...BACKUP_KEYS].sort()).toEqual([
      'freezeMonth', 'freezeSpentDate', 'freezes', 'history', 'installSeed', 'lang',
      'lastDrawDate', 'lessonsProgress', 'profile', 'reviewDay', 'settings', 'spreadsHistory', 'srs', 'streak',
      'themeMode', 'xp',
    ]);
  });
```
  3. Тест версии: `expect(SCHEMA_VERSION).toBe(10);` и заголовок «версия схемы 10: srs/reviewDay
     (спека 45) — файл v10 старому ридеру откажет как «новее», а не «повреждён»».
  4. Новый блок в конце файла:
```ts
describe('parseBackup — повторение (спека 45)', () => {
  const withSrs = (srs: unknown, reviewDay: unknown = VALID.reviewDay) =>
    parseBackup(JSON.stringify({ ...buildBackup(VALID, SCHEMA_VERSION, AT), state: { ...VALID, srs, reviewDay } }), SCHEMA_VERSION);

  it('валидные srs и reviewDay проходят и сохраняются', () => {
    const r = withSrs(VALID.srs);
    expect(r.ok && r.state.srs).toEqual(VALID.srs);
    expect(r.ok && r.state.reviewDay).toEqual(VALID.reviewDay);
  });

  it('файл v9 без srs/reviewDay доливается дефолтами', () => {
    const { srs: _s, reviewDay: _d, ...old } = VALID;
    const raw = { ...buildBackup(VALID, 9, AT), schemaVersion: 9, state: old };
    const r = parseBackup(JSON.stringify(raw), SCHEMA_VERSION);
    expect(r.ok && r.state.srs).toEqual({});
    expect(r.ok && r.state.reviewDay).toEqual({ date: '', newCount: 0 });
  });

  const good = VALID.srs.fool;
  it.each([
    ['чужой cardId', { нет: good }],
    ['ease ниже пола 1.3', { fool: { ...good, ease: 1.0 } }],
    ['ease выше потолка 5', { fool: { ...good, ease: 5.1 } }],
    ['интервал больше 365', { fool: { ...good, intervalDays: 400 } }],
    ['интервал отрицательный', { fool: { ...good, intervalDays: -1 } }],
    ['reps не целое', { fool: { ...good, reps: 1.5 } }],
    ['due не ISO-день', { fool: { ...good, due: '2026-13-01' } }],
    ['состояние — не объект', { fool: 'x' }],
    ['srs — массив', [good]],
  ])('битый srs: %s → corrupt', (_name, srs) => {
    expect(withSrs(srs)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('больше 78 записей srs → corrupt', () => {
    const many = Object.fromEntries(Array.from({ length: 79 }, (_, i) => [`c${i}`, good]));
    expect(withSrs(many)).toEqual({ ok: false, error: 'corrupt' });
  });

  it.each([
    ['дата не ISO и не пустая', { date: '14.08.2026', newCount: 1 }],
    ['newCount больше 78', { date: '2026-08-14', newCount: 100 }],
    ['newCount отрицательный', { date: '2026-08-14', newCount: -1 }],
    ['не объект', 'x'],
  ])('битый reviewDay: %s → corrupt', (_name, day) => {
    expect(withSrs(VALID.srs, day)).toEqual({ ok: false, error: 'corrupt' });
  });

  it('reviewDay с пустой датой (дефолт) валиден', () => {
    expect(withSrs(VALID.srs, { date: '', newCount: 0 }).ok).toBe(true);
  });
});
```
- [ ] **Шаг 2:** `npx jest src/lib/__tests__/backup.test.ts` — падает (тип `VALID` не знает `srs`,
  ключей нет, версия 9).
- [ ] **Шаг 3: код.** В `src/lib/backup.ts`:
  - импорты (в алфавитный блок):
```ts
import { REVIEW_DAY_DEFAULT, type ReviewDay, type SrsMap } from './review';
import { EASE_MAX, EASE_MIN, MAX_INTERVAL_DAYS } from './srs';
```
  - `SCHEMA_VERSION`: комментарий дополнить строкой
    «v9 → v10 (спека 45): `srs` и `reviewDay` — ключи верхнего уровня, дефолты доливаются сами.
    Следующая задача, меняющая схему, поднимает ЭТУ константу до 11.» и `export const SCHEMA_VERSION = 10;`
  - `BackupState`: после `spreadsHistory: SpreadDraw[];`:
```ts
  /** повторение (спека 45): состояние SM-2 по cardId и счётчик новых карт за день */
  srs: SrsMap;
  reviewDay: ReviewDay;
```
  - `PERSIST_DEFAULTS`: после `spreadsHistory: …`:
```ts
  srs: Object.freeze({}) as SrsMap,
  reviewDay: Object.freeze(REVIEW_DAY_DEFAULT) as ReviewDay,
```
  - валидаторы (после `isLesson`):
```ts
// повторение (спека 45): состояние карты — в коридорах алгоритма (ease 1.3..5, интервал ≤ 365),
// ключи — только id колоды; reviewDay.date пуст до первой новой карты
const isSrsState = (v: unknown): boolean =>
  isObj(v) && isCount(v.reps) && isCount(v.intervalDays) && v.intervalDays <= MAX_INTERVAL_DAYS &&
  isNum(v.ease) && v.ease >= EASE_MIN && v.ease <= EASE_MAX && isISODay(v.due);
const isSrsMap = (v: unknown): boolean =>
  isObj(v) && Object.keys(v).length <= cardById.size &&
  Object.entries(v).every(([id, s]) => cardById.has(id) && isSrsState(s));
const isReviewDay = (v: unknown): boolean =>
  isObj(v) && (v.date === '' || isISODay(v.date)) && isCount(v.newCount) && v.newCount <= cardById.size;
```
  - `validState`: перед `isCount(s.xp) …` добавить строку
    `isSrsMap(s.srs) && isReviewDay(s.reviewDay) &&`.
- [ ] **Шаг 4:** `npx jest src/lib/__tests__/backup.test.ts` — зелёный. `npx tsc --noEmit`:
  скорее всего останется чистым — спред `...PERSIST_DEFAULTS` в сторе лишние ключи не ругает
  (excess-property check не действует на спред), а тип-контроль `backupCovers` ловит ОБРАТНОЕ
  направление (поле стора без бэкапа). Если tsc всё же покраснел на `useApp.ts` — это ожидаемо
  и закрывается задачей 7 (поля в `AppState`); коммитим в любом случае, задача 7 идёт сразу.
- [ ] **Шаг 5:** `git add src/lib/backup.ts src/lib/__tests__/backup.test.ts && git commit -m "feat: бэкап знает srs/reviewDay, схема 10 (spec 45)"`

---

### Задача 7: стор — поля, `reviewCard`, `resetSrs`, `devAgeSrs`, persist 10

**Файлы:** Modify `src/store/useApp.ts` (импорты, `AppState`, экшены, комментарий про версии).

**Интерфейсы:** Consumes `applyReview`, `REVIEW_DAY_DEFAULT`, `ReviewDay`, `SrsMap` (`review.ts`),
`SrsGrade` (`srs.ts`), `daysAgoISO`/`parseISODate` (`dates.ts`). Produces экшены стора:
`reviewCard(cardId: string, grade: SrsGrade): number`, `resetSrs(): void`, `devAgeSrs(): void`.

- [ ] **Шаг 1: код.**
  - Импорты: `import { applyReview, REVIEW_DAY_DEFAULT, type ReviewDay, type SrsMap } from '../lib/review';`,
    `import type { SrsGrade } from '../lib/srs';`; в импорт из `'../lib/dates'` добавить `parseISODate`.
  - В `AppState` после `xp: number;`:
```ts
  /** Повторение изученных карт (спека 45, logic-spec §12): состояние SM-2 по cardId (карта
   *  без записи — новая) и счётчик новых карт за день. Колода не хранится — она считается
   *  из lessonsProgress (deckOrder). */
  srs: SrsMap;
  reviewDay: ReviewDay;
```
    и после `completeLesson: …;`:
```ts
  /** Оценка карты в тренажёре: SM-2 + счётчик новых + XP по правилу applyReview; возвращает
   *  начисленный XP (0 или XP_REVIEW). */
  reviewCard: (cardId: string, grade: SrsGrade) => number;
  /** DEV: обнулить повторение (состояния и счётчик дня). */
  resetSrs: () => void;
  /** DEV: «состарить» повторение на день — все due на сутки назад, счётчик новых сброшен;
   *  без этого «ждут завтра» и дневной лимит новых проверяются только календарём. */
  devAgeSrs: () => void;
```
  - Реализация после `resetCourse: …,`:
```ts
      // Тренажёр (спека 45): вся арифметика — в чистой applyReview (review.ts), стор применяет
      // результат и отдаёт начисленный XP экрану (тот же приём, что completeLesson).
      reviewCard: (cardId, grade) => {
        const { srs, reviewDay, xp } = get();
        const r = applyReview(srs, reviewDay, cardId, grade, localDateISO());
        set({ srs: r.srs, reviewDay: r.day, xp: xp + r.gained });
        return r.gained;
      },
      resetSrs: () => set({ srs: {}, reviewDay: REVIEW_DAY_DEFAULT }),
      devAgeSrs: () =>
        set({
          srs: Object.fromEntries(
            Object.entries(get().srs).map(([id, s]) => [id, { ...s, due: daysAgoISO(1, parseISODate(s.due)) }]),
          ),
          reviewDay: REVIEW_DAY_DEFAULT,
        }),
```
  - Комментарий к версиям persist (блок над `version: SCHEMA_VERSION`): к строке про v8 → v9
    добавить: «v9 → v10: srs и reviewDay (спека 45) — ключи ВЕРХНЕГО уровня, дефолты `{}` и
    `{date: '', newCount: 0}` доливаются поверхностным слиянием, ветка миграции не нужна.
    ⚠️ reviewDay — вложенный объект: задача, добавляющая поле ВНУТРЬ него, обязана поднять версию
    и дописать слияние руками (ловушка 06а). Следующая задача, меняющая схему, поднимает до 11.»
    Фразу «Следующая задача, меняющая схему, поднимает до 10» в строке про v9 — убрать.
- [ ] **Шаг 2:** `npx tsc --noEmit` — чист (тип-контроль `backupCovers` доволен: оба поля в
  `BackupState`). `npm test` — зелёный целиком.
- [ ] **Шаг 3:** Ручная проверка типов экшенов: `grep -n "reviewCard\|resetSrs\|devAgeSrs" src/store/useApp.ts`
  — по два вхождения каждого (интерфейс + реализация).
- [ ] **Шаг 4:** `git add src/store/useApp.ts && git commit -m "feat: стор — srs/reviewDay, reviewCard, DEV-сброс и состаривание, persist 10 (spec 45)"`

---

### Задача 8: DEV-строки в настройках + ключи i18n

**Файлы:** Modify `src/lib/i18n.ts` (блоки `settings` в `ru` и `en`), `app/settings.tsx`
(хуки стора, три `SettingsRow` под `__DEV__`, `ConfirmDialog`).

**Интерфейсы:** Consumes `reviewSummary`, `deckOrder` (`review.ts`), `course` (`content.ts`),
`localDateISO`, экшены задачи 7, `ConfirmDialog` (`confirmTone="accent"`, одна кнопка —
`cancelLabel` не передавать), `SettingsRow`, `FadeUp`.

- [ ] **Шаг 1: i18n.** В `ru.settings` после `devDeviceLang: "Язык устройства",`:
```ts
        // тренажёр (спека 45): DEV-строки очереди повторения; ключи экранов review.* — в 45б
        devReviewQueue: "Очередь повторения",
        devAgeSrs: "Состарить повторение на день",
        devResetSrs: "Сбросить повторение",
        // «Число: N» без числительных — плюрализация не нужна (урок hf-02)
        reviewQueueText: "В колоде: {{deck}}\nЖдут сегодня: {{due}}\nНовых доступно: {{fresh}}\nЗавтра: {{tomorrow}}\nНовых введено сегодня: {{introduced}}",
```
  В `en.settings` после `devDeviceLang: "Device language",`:
```ts
        devReviewQueue: "Review queue",
        devAgeSrs: "Age reviews by a day",
        devResetSrs: "Reset reviews",
        reviewQueueText: "Deck: {{deck}}\nDue today: {{due}}\nNew available: {{fresh}}\nTomorrow: {{tomorrow}}\nNew introduced today: {{introduced}}",
```
- [ ] **Шаг 2: экран.** В `app/settings.tsx`:
  - импорты: добавить `import { deckOrder, reviewSummary } from '../src/lib/review';`;
    `localDateISO` (строка 30, из `'../src/lib/dates'`) и `course` (строка 28) уже импортированы —
    не дублировать.
  - хуки рядом с `resetCourse`:
```ts
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  const resetSrs = useApp((s) => s.resetSrs);
  const devAgeSrs = useApp((s) => s.devAgeSrs);
  const [queueText, setQueueText] = React.useState<string | null>(null);
  // DEV: сводка очереди повторения (спека 45) — та же сборка, что возьмёт карточка курса в 45б
  const showReviewQueue = () => {
    const today = localDateISO();
    const sum = reviewSummary(deckOrder(course, lessonsProgress), srs, today, reviewDay);
    setQueueText(
      tr('settings.reviewQueueText', {
        deck: sum.deckSize,
        due: sum.due,
        fresh: sum.newAvailable,
        tomorrow: sum.dueTomorrow,
        introduced: reviewDay.date === today ? reviewDay.newCount : 0,
      }),
    );
  };
```
  - три строки после `FadeUp index={13}` (язык устройства), внутри того же `__DEV__`-фрагмента:
```tsx
            <FadeUp index={14}>
              <SettingsRow icon="layers-outline" label={tr('settings.devReviewQueue')} value="DEV" onPress={showReviewQueue} />
            </FadeUp>
            <FadeUp index={15}>
              <SettingsRow icon="time-outline" label={tr('settings.devAgeSrs')} value="DEV" onPress={devAgeSrs} />
            </FadeUp>
            <FadeUp index={16}>
              <SettingsRow icon="refresh-outline" label={tr('settings.devResetSrs')} value="DEV" onPress={resetSrs} />
            </FadeUp>
```
  - диалог рядом с диалогом плана пушей:
```tsx
        <ConfirmDialog
          visible={queueText !== null}
          title={tr('settings.devReviewQueue')}
          message={queueText ?? ''}
          confirmLabel={tr('settings.ok')}
          confirmTone="accent"
          onConfirm={() => setQueueText(null)}
          onCancel={() => setQueueText(null)}
        />
```
    (`ConfirmDialog`: `cancelLabel?` опционален с задачи 11 — режим одной кнопки; `onCancel?`
    тоже опционален, но передаём — закрытие по скриму должно прятать диалог.)
- [ ] **Шаг 3:** `npx tsc --noEmit` чист; `npm test` зелёный (тесты i18n-паритета, если есть,
  требуют ключи в обоих языках — они добавлены).
- [ ] **Шаг 4: дымовая проверка в вебе.** `npx expo start --web` → онбординг пройден (или сид
  `arcanum-app` с `profile.onboarded: true`) → Настройки → «Очередь повторения»: диалог с пятью
  строками и нулями; DEV «Пройти следующий урок» несколько раз (до урока с картами, m1l2 или m2l1)
  → снова диалог: «В колоде» > 0, «Новых доступно» > 0; «Состарить» → цифры не меняются
  (состояний нет), «Сбросить» → нули не ломаются. Консоль без ошибок. Скриншот не нужен
  (DEV-строки).
- [ ] **Шаг 5:** `git add src/lib/i18n.ts app/settings.tsx && git commit -m "feat: DEV-строки очереди повторения в настройках (spec 45)"`

---

### Задача 9: документы

**Файлы:** Modify `docs/logic-spec.md`, `docs/product-spec.md`, `docs/backlog.md`, `AGENTS.md`,
`CLAUDE.md`, `docs/specs/45-flashcards.md`.

- [ ] **Шаг 1: `docs/logic-spec.md`.**
  - §4 XP: в перечень источников добавить «· повторение: +1 за вспомненную карту (оценка ≥1
    карты, которая была к повторению; спека 45, §12)».
  - §7: в схему добавить `srs: {cardId: {reps, intervalDays, ease, due}}, reviewDay: {date,
    newCount}` и `version: 10`; после абзаца «36 подняла version до 9» добавить: «**45 подняла
    `version` до 10** ради `srs` и `reviewDay` — ключи ВЕРХНЕГО уровня, дефолты доливаются
    поверхностным слиянием, `migrate` не менялся; ⚠️ `reviewDay` — вложенный объект (ловушка
    06а для полей внутри него). Следующая задача, меняющая схему, поднимает до 11.»; в строке
    про 36 убрать «Следующая задача… поднимает до 10».
  - Новый раздел в конце файла:
```markdown
## 12. Повторение изученных карт — SM-2 (спека 45, 19.08)

**Колода** = карты пройденных уроков в порядке курса (`deckOrder` = `learnedCardIds`); карта без
записи в `srs` — новая. **Алгоритм** SM-2 по ЛОКАЛЬНЫМ ДНЯМ (`due` — ISO-день, не timestamp):
оценки 0 не помню / 1 с трудом (в UI нет) / 2 помню / 3 легко → q = 1/3/4/5; q < 3 → reps 0,
интервал 0, due = сегодня (карта возвращается в конец сессии); q ≥ 3 → reps+1, интервал
1 → 6 → round(prev × ease) (ease ДО обновления), потолок 365; ease' = clamp(ease + (0.1 − (5−q)·
(0.08 + (5−q)·0.02)), 1.3, 5) при любой оценке; новая карта стартует с ease 2.5.
**Сессия** ≤ 10: просроченные по due ↑, потом новые в порядке колоды (не больше 10 новых в день —
`reviewDay.newCount` по дате), итог тасуется; новая карта всегда «карта → значение», повторяемая
— 50/50. «Не помню» ставит карту в хвост очереди сессии.
**XP** (`XP_REVIEW = 1`): +1 за оценку ≥1 карты, которая до оценки была к повторению (новая или
due ≤ сегодня); правило без понятия «сессия» — провал и затем «помню» дают +1, повторное «помню»
уже ушедшей карты — 0. **Сводка** для карточки курса: due / newAvailable / dueTomorrow (`due ≤
завтра`, показывается только при due = 0).
Тест-кейсы: `srs.test.ts` (лестница 1/6/15, ease по оценкам, потолки, провал), `review.test.ts`
(12 просроченных → 10 старших; 3 + 20 новых → 3 + 7; лимит новых по дате; инвариант «сумма gained
= sessionStats.xp» на сценарии с двумя провалами; `promptSentence` + контракт по 78 картам).
Хранение — §7 (`srs`, `reviewDay`, persist 10); бэкап валидирует коридоры (ease 1.3..5, интервал
≤ 365, id из колоды, ≤ 78 записей).
```
- [ ] **Шаг 2: `docs/product-spec.md` §2 «Курс».** После абзаца «**Экран курса**…» добавить:
```markdown
**Повторение 🔨(45):** над первым модулем — карточка «ПОВТОРЕНИЕ» (скрыта, пока колода пуста):
«N карт ждут» / «Новых карт: N» (тап → тренажёр) / «Всё повторено ✓ · завтра: M» (не тап).
**Тренажёр** (`/review`, стек, назад → «Курс», без подтверждения выхода — каждая оценка уже
сохранена): сессия ≤10 карт, счётчик «К ПОВТОРЕНИЮ · N». Направление «карта → значение»: карта
лицом вверх + название, подпись «ВСПОМНИТЕ ЗНАЧЕНИЕ · НАЖМИТЕ», тап → панель «ЗНАЧЕНИЕ» (4
ключевых слова чипами + первое предложение общего значения + «Страница карты →»). «Значение →
карта»: рубашка с ключевыми словами и предложением, «ВСПОМНИТЕ КАРТУ · НАЖМИТЕ», тап →
переворот → образ + название + та же панель. Три кнопки «Не помню / Помню / Легко» (хаптика
Light); «не помню» возвращает карту в конец сессии. Результат: «Повторено N · с первого раза K ·
+X XP», CTA «Готово», ссылка «Ещё N» при остатке; конфетти нет. Пустые состояния: колода пуста →
«Повторять пока нечего — пройдите урок…» + «К курсу»; очередь пуста → «Всё повторено ✓ · завтра:
M» + «К курсу». Алгоритм и XP — logic-spec §12. Часть 45а (логика, стор, DEV-строки «Очередь
повторения / Состарить / Сбросить») ✅; экраны — 45б после дорисовки макета.
```
- [ ] **Шаг 3: `AGENTS.md`** — строка `npm test`: обновить число тестов/сьютов по фактическому
  прогону (`npm test 2>&1 | tail -5`); в разделе «Состояние» упомянуть `srs`/`reviewDay` и
  persist 10; в «Архитектура» — строка про `src/lib/srs.ts`: «чистые функции SM-2 по дням
  (спека 45); сессия и сводка — `src/lib/review.ts`».
- [ ] **Шаг 4: `CLAUDE.md`** — в «Статус» абзац «Задача 45а сделана DD.08 …» (persist **10**,
  тесты N в M сьютах, что выросло общего: `shuffle`, `plusDaysISO`, `applyReview`-приём) и
  заменить финальную строку «⚠️ Следующая задача, меняющая схему стора, обязана поднять persist
  version до 10» на «…до 11». Уроки, найденные при реализации, — сюда же кратко.
- [ ] **Шаг 5: `docs/backlog.md`** — в задаче 45 статус «45а — сделана DD.08, ветка ждёт ревью
  и merge; 45б — после дорисовки макета». `docs/specs/45-flashcards.md` — раздел «Отчёт 45а»
  (что сделано, число тестов, что проверялось в вебе, расхождения).
- [ ] **Шаг 6:** `git add -A docs AGENTS.md CLAUDE.md && git commit -m "docs: логика повторения SM-2 в logic-spec/product-spec, отчёт 45а (spec 45)"`

---

### Задача 10: финальная проверка, ревью, merge

- [ ] **Шаг 1:** `npx tsc --noEmit` чист; `npm test` — все сьюты зелёные; записать итог
  «N тестов в M сьютах» в отчёт спеки и CLAUDE.md (задача 9), если число разошлось — поправить.
- [ ] **Шаг 2:** `grep -rn "dueCards\|initialSrs\|dueAt" src app` — пусто; `grep -rn "Math.random() \* (i + 1)" src` — только `shuffle.ts`.
- [ ] **Шаг 3:** Ревью ветки (superpowers:requesting-code-review или финальное ревью Fable
  по проектной практике): особое внимание — правило XP (`wasDue`), лимит новых по дате,
  валидация бэкапа (обе стороны: валидное проходит, битое падает), отсутствие мутаций входа.
- [ ] **Шаг 4:** Лайв-проверка Артёма ограничена DEV-строками (спека, критерий 45а): диалог
  очереди на iPhone показывает числа после DEV-прохода уроков; «Состарить»/«Сбросить» работают.
- [ ] **Шаг 5:** `git checkout main && git merge --no-ff feat/45-flashcards -m "merge: флеш-карты — логика повторения и данные (spec 45а)" && git push`.
  Ветку не удалять — 45б продолжится в ней (или в `feat/45b-flashcards-ui` от main, если между
  частями пройдут другие задачи).

## Самопроверка плана (сделана при написании)

- **Покрытие спеки (раздел А):** `srs.ts` — задача 3 (все константы, `reviewState`, `isDue`, все
  тест-кейсы спеки); `review.ts` — задача 5 (все функции, константы, `promptSentence` с контрактом
  по корпусу, `shuffle` — задача 2); `XP_REVIEW` — задача 4. **Раздел Б:** стор — задача 7
  (поля, `reviewCard`, `resetSrs`, `devAgeSrs`, persist 10, комментарий про ловушку `reviewDay`);
  бэкап — задача 6 (поля, дефолты, `validState`, тесты v9 и corrupt); DEV-строки и i18n —
  задача 8. **Раздел Г:** задача 9. **Критерии приёмки 45а** — все закрыты задачами 3–10.
- **Плейсхолдеров нет:** каждый код-шаг содержит код; «проверить сигнатуру ConfirmDialog» и
  «проверить импорт course» — инструкции к чтению файла, а не отложенные решения.
- **Согласованность типов:** `SrsMap`/`ReviewDay`/`REVIEW_DAY_DEFAULT` объявлены в `review.ts`
  (задача 5) и импортируются в `backup.ts` (6) и стор (7); `SrsGrade`/`SrsState`/константы —
  в `srs.ts` (3); `plusDaysISO` — `dates.ts` (1), используется в 3 и 5; `shuffle` — 2, в 5;
  `XP_REVIEW` — 4, в 5. Порядок задач 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 соблюдает зависимости;
  между задачами 6 и 7 `tsc` может быть красным (если спред всё же споткнётся) — закрывается 7.
- **Цикл импортов:** `review.ts` → `courseProgress.ts` → `content.ts`/`xp.ts`; `backup.ts` →
  `review.ts` и `srs.ts`; стор → всё. Ни один из них не импортирует стор — циклов нет.
