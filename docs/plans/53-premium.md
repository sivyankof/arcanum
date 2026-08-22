# Arcanum Premium (53а) — детальный план

> **Для исполнителя:** план идёт задача за задачей, шаги помечены `- [ ]`. Каждая задача
> заканчивается проверкой и коммитом. Спека — `docs/specs/53-premium.md`, читать вместе с планом.
> Шаг 0 процесса: `docs/lessons.md` §1 (стор/persist/бэкап), §5 (навигация), §8 (тесты).

**Цель:** в приложении появляется право Premium — один ключ стора, чистые правила «что заперто»,
гейты в курсе/раскладах/тренажёре, экран пейвола и DEV-тумблер; покупки (RevenueCat) — отдельный
заход 53б на EAS-сборке, к которому эта часть готовит один адаптер.

**Архитектура:** право `premium` — ключ верхнего уровня стора, вне бэкапа; правила — чистый
`src/lib/premium.ts` поверх существующих флагов `free` контента; экраны спрашивают только его.
Гейт маршрутов — `<Redirect href="/paywall">` по прецеденту лунного окна (`/spreads/[id]`).
Адаптер покупок `src/lib/purchases.ts` в 53а — честная заглушка «недоступно».

**Стек:** Expo SDK 54, expo-router v6, zustand/persist, react-i18next, jest-expo. Новых пакетов нет.

**Ветка:** `feat/53-premium`.

## Глобальные ограничения

- SDK НЕ обновлять, мажорные версии не менять; `package.json`/`app.json` эта часть НЕ трогает.
- После каждого шага с кодом — `npx tsc --noEmit` без ошибок; перед каждым push — `npm test`
  зелёный. На старте — **1501 тест в 40 сьютах**.
- Цвета только из `src/theme/theme.ts`; комментарии в коде русские; ни слова про ИИ в коде и коммитах.
- Новая UI-строка — сразу в ЧЕТЫРЕ языка `src/lib/i18n.ts` (контракт `i18nPlurals` краснеет поимённо).
- Экраны НЕ читают `free`/`premium.active` напрямую — только `src/lib/premium.ts` (задача 9 стережёт грепом).
- Persist: `SCHEMA_VERSION` 10 → **11** (поле `doneCount` ВНУТРИ `reviewDay` — слияние руками, урок 06а/45а);
  `premium` в бэкап НЕ входит (решение 4 спеки).
- Макет пейвола (`v-paywall`, дорисовка Cowork по `docs/prompts/53-paywall-mockup.md`) — источник
  композиции для задачи 5: перед её стартом принять дорисовку и снять точные значения из CSS
  (`.cta`, `.lk`, `.prow`, `.pcap`); в плане стоят значения из промта.
- ⚠️ Повтор уже пройденного урока premium-модуля после истечения подписки — ЗАПЕРТ (одно правило
  «модуль premium и права нет», применяется к узлам `current` и `done`); пройденность и XP остаются.
  Это уточнение решения 5 спеки: узел `done` в приложении открывает повтор урока (+2 XP/день).

---

### Задача 1: `reviewDay.doneCount` — счётчик карт, покинувших очередь за день

**Файлы:**
- Изменить: `src/lib/review.ts` (интерфейс `ReviewDay`, `REVIEW_DAY_DEFAULT`, новая `doneToday`,
  новая `mergeReviewDay`, `applyReview`)
- Изменить: `src/lib/__tests__/review.test.ts`

**Интерфейсы:**
- Использует: `isDue`, `reviewState` из `src/lib/srs.ts` (как сейчас).
- Отдаёт: `ReviewDay = { date: string; newCount: number; doneCount: number }`,
  `REVIEW_DAY_DEFAULT`, `doneToday(day, todayISO): number`, `mergeReviewDay(saved: unknown): ReviewDay`,
  `applyReview` — прежняя сигнатура, `day.doneCount` растёт.

- [ ] **Шаг 1: тесты — doneCount считает только карты, покинувшие очередь, и сбрасывается по дню**

В `src/lib/__tests__/review.test.ts` добавить в конец файла:

```ts
describe('doneCount — карты, покинувшие очередь за день (спека 53)', () => {
  const T = '2026-08-22';
  it('оценка «помню» по карте к повторению увеличивает doneCount на 1', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'fool', 2, T);
    expect(r.day).toEqual({ date: T, newCount: 1, doneCount: 1 });
  });
  it('«не помню» doneCount не трогает — карта вернётся в ту же порцию', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'fool', 0, T);
    expect(r.day.doneCount).toBe(0);
    // …а следом «помню» по той же карте считает её один раз
    const r2 = applyReview(r.srs, r.day, 'fool', 2, T);
    expect(r2.day.doneCount).toBe(1);
  });
  it('повторное «помню» карты, уже ушедшей на завтра, не считается', () => {
    const r = applyReview({}, REVIEW_DAY_DEFAULT, 'fool', 2, T);
    const r2 = applyReview(r.srs, r.day, 'fool', 3, T);
    expect(r2.day.doneCount).toBe(1);
  });
  it('новый день обнуляет счётчик', () => {
    const day: ReviewDay = { date: '2026-08-21', newCount: 3, doneCount: 7 };
    expect(doneToday(day, T)).toBe(0);
    const r = applyReview({}, day, 'fool', 2, T);
    expect(r.day).toEqual({ date: T, newCount: 1, doneCount: 1 });
  });
  it('mergeReviewDay доливает doneCount старой записи и не трогает полную', () => {
    expect(mergeReviewDay({ date: T, newCount: 4 })).toEqual({ date: T, newCount: 4, doneCount: 0 });
    expect(mergeReviewDay({ date: T, newCount: 4, doneCount: 2 })).toEqual({ date: T, newCount: 4, doneCount: 2 });
    expect(mergeReviewDay(undefined)).toEqual(REVIEW_DAY_DEFAULT);
    expect(mergeReviewDay(null)).toEqual(REVIEW_DAY_DEFAULT);
  });
});
```
Добавить в импорт из `'../review'`: `doneToday`, `mergeReviewDay`.

- [ ] **Шаг 2: прогон — тесты падают**

`npx jest src/lib/__tests__/review.test.ts` → FAIL (`doneToday`/`mergeReviewDay` не экспортированы,
`doneCount` нет в типе).

- [ ] **Шаг 3: реализация в `src/lib/review.ts`**

Заменить блок `ReviewDay`/`REVIEW_DAY_DEFAULT`:

```ts
/** Счётчики дня: сколько НОВЫХ карт введено и сколько карт ПОКИНУЛО очередь (оценка ≥1 по карте,
 *  которая была к повторению). Действительны, только если date === сегодня. doneCount — лимит
 *  бесплатного тренажёра (спека 53): без права Premium в день не больше SESSION_MAX карт. */
export interface ReviewDay {
  date: string;
  newCount: number;
  doneCount: number;
}
export const REVIEW_DAY_DEFAULT: ReviewDay = { date: '', newCount: 0, doneCount: 0 };

/** Доливка старой записи (до спеки 53 поля doneCount не было): persist сливает состояние только
 *  по верхнему уровню ключей, поэтому вложенный reviewDay старого приложения пришёл бы без
 *  doneCount, и `+1` дал бы NaN. Зовётся из migrate стора И из parseBackup (правило-близнец
 *  logic-spec §7). Не-объект — дефолт. */
export function mergeReviewDay(saved: unknown): ReviewDay {
  if (typeof saved !== 'object' || saved === null) return REVIEW_DAY_DEFAULT;
  return { ...REVIEW_DAY_DEFAULT, ...(saved as Partial<ReviewDay>) };
}
```
После `newToday` добавить:
```ts
/** Сколько карт покинуло очередь сегодня — та же оговорка про дату, что у newToday. */
export function doneToday(day: ReviewDay, todayISO: string): number {
  return day.date === todayISO ? day.doneCount : 0;
}
```
В `applyReview` заменить строку `const nextDay ...` и `return`:
```ts
  const passed = grade >= 1 && wasDue; // карта покинула очередь: то же условие, что даёт XP
  const nextDay: ReviewDay = {
    date: todayISO,
    newCount: newToday(day, todayISO) + (prev === undefined ? 1 : 0),
    doneCount: doneToday(day, todayISO) + (passed ? 1 : 0),
  };
  return { srs: next, day: nextDay, gained: passed ? XP_REVIEW : 0 };
```
⚠️ Раньше `nextDay` при `prev !== undefined` возвращал `day` КАК ЕСТЬ (даже вчерашний); теперь
дата всегда сегодняшняя — `newToday`/`doneToday` обнуляют вчерашние счётчики сами. Существующие
тесты `applyReview` это проверяют: если какой-то ждал `day` нетронутым — поправить ожидание,
предварительно убедившись, что он проверял именно «не трогает», а не «дата вчерашняя» (второе —
был бы дефект: вчерашняя дата с сегодняшним счётчиком).

- [ ] **Шаг 4: tsc и тесты**

`npx tsc --noEmit` — покраснеют литералы `ReviewDay` без `doneCount` в тестах (`review.test.ts`,
`backup.test.ts`, `pushPlan`? — смотреть список из вывода) и в `app/settings.tsx` (DEV-диалог
очереди строит `ReviewDay`?). Дописать `doneCount: 0` в каждый литерал. Затем
`npx jest src/lib/__tests__/review.test.ts` → PASS.

- [ ] **Шаг 5: коммит**

```bash
git add src/lib/review.ts src/lib/__tests__/review.test.ts <прочие исправленные литералы>
git commit -m "feat: reviewDay.doneCount — карты, покинувшие очередь за день (spec 53)"
```

---

### Задача 2: чистый модуль правил `src/lib/premium.ts`

**Файлы:**
- Создать: `src/lib/premium.ts`
- Создать: `src/lib/__tests__/premium.test.ts`

**Интерфейсы:**
- Использует: `CourseModule`, `Spread` из `src/lib/content.ts`; `ReviewDay`, `SESSION_MAX`,
  `doneToday` из `src/lib/review.ts`.
- Отдаёт:
  ```ts
  export type PremiumSource = 'none' | 'dev' | 'store';
  export interface PremiumState { active: boolean; source: PremiumSource; until: string | null }
  export const PREMIUM_NONE: PremiumState;
  export const FREE_REVIEW_PER_DAY: number; // = SESSION_MAX
  export function moduleLocked(mod: CourseModule, premium: PremiumState): boolean;
  export function lessonLocked(lessonId: string, modules: readonly CourseModule[], premium: PremiumState): boolean;
  export function spreadLocked(spread: Spread, premium: PremiumState): boolean;
  export function reviewLeftToday(day: ReviewDay, todayISO: string, premium: PremiumState): number;
  export function reviewLimitReached(day: ReviewDay, todayISO: string, premium: PremiumState): boolean;
  ```

- [ ] **Шаг 1: тесты**

`src/lib/__tests__/premium.test.ts`:
```ts
/** Правила Premium (спека 53): заперто ⟺ контент не free И права нет. Фикстуры синтетические —
 *  тест не зависит от того, какие модули/расклады free в контенте сегодня. */
import type { CourseModule, Spread } from '../content';
import {
  FREE_REVIEW_PER_DAY,
  lessonLocked,
  moduleLocked,
  PREMIUM_NONE,
  reviewLeftToday,
  reviewLimitReached,
  spreadLocked,
  type PremiumState,
} from '../premium';
import { REVIEW_DAY_DEFAULT, SESSION_MAX } from '../review';

const ACTIVE: PremiumState = { active: true, source: 'dev', until: null };
const mod = (id: string, free: boolean, lessons: string[]): CourseModule =>
  ({ id, free, title: { ru: id, en: id }, lessons: lessons.map((l) => ({ id: l, title: { ru: l, en: l }, cards: [] })) }) as unknown as CourseModule;
const MODS = [mod('m1', true, ['m1l1', 'm1l2']), mod('m3', false, ['m3l1'])];
const spread = (free: boolean): Spread =>
  ({ id: 's', free, cards: 3, name: { ru: 's', en: 's' }, description: { ru: '', en: '' }, positions: [] }) as unknown as Spread;

describe('модули и уроки', () => {
  it('free-модуль открыт всегда, premium — только с правом', () => {
    expect(moduleLocked(MODS[0], PREMIUM_NONE)).toBe(false);
    expect(moduleLocked(MODS[1], PREMIUM_NONE)).toBe(true);
    expect(moduleLocked(MODS[1], ACTIVE)).toBe(false);
  });
  it('урок заперт по своему модулю; чужой id — не заперт (гейт его не знает, маршрут сам уйдёт назад)', () => {
    expect(lessonLocked('m1l2', MODS, PREMIUM_NONE)).toBe(false);
    expect(lessonLocked('m3l1', MODS, PREMIUM_NONE)).toBe(true);
    expect(lessonLocked('m3l1', MODS, ACTIVE)).toBe(false);
    expect(lessonLocked('zzz', MODS, PREMIUM_NONE)).toBe(false);
  });
});

describe('расклады', () => {
  it('заперт ⟺ не free и права нет', () => {
    expect(spreadLocked(spread(true), PREMIUM_NONE)).toBe(false);
    expect(spreadLocked(spread(false), PREMIUM_NONE)).toBe(true);
    expect(spreadLocked(spread(false), ACTIVE)).toBe(false);
  });
});

describe('лимит тренажёра', () => {
  const T = '2026-08-22';
  it('лимит равен размеру порции', () => {
    expect(FREE_REVIEW_PER_DAY).toBe(SESSION_MAX);
  });
  it('9 сделано → осталась 1; 10 → 0 и лимит достигнут', () => {
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 9 }, T, PREMIUM_NONE)).toBe(1);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 9 }, T, PREMIUM_NONE)).toBe(false);
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 10 }, T, PREMIUM_NONE)).toBe(0);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 10 }, T, PREMIUM_NONE)).toBe(true);
  });
  it('вчерашний счётчик не считается', () => {
    expect(reviewLeftToday({ date: '2026-08-21', newCount: 0, doneCount: 10 }, T, PREMIUM_NONE)).toBe(FREE_REVIEW_PER_DAY);
  });
  it('с правом лимита нет', () => {
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 99 }, T, ACTIVE)).toBe(Infinity);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 99 }, T, ACTIVE)).toBe(false);
    expect(reviewLimitReached(REVIEW_DAY_DEFAULT, T, PREMIUM_NONE)).toBe(false);
  });
});
```

- [ ] **Шаг 2: прогон — падает** (`Cannot find module '../premium'`).

- [ ] **Шаг 3: реализация**

`src/lib/premium.ts`:
```ts
/** Право Premium и правила «что заперто» (спека 53). Чистый модуль: ни react, ни expo, ни i18n.
 *  Источник правды «что платное» — флаги free в контенте (module.free, spread.free); экраны
 *  сравнивают их ТОЛЬКО через функции отсюда (контракт-тест premiumSources). Само право лежит
 *  в сторе (useApp.premium) и в бэкап не входит — решение 4 спеки. */
import type { CourseModule, Spread } from './content';
import { doneToday, SESSION_MAX, type ReviewDay } from './review';

export type PremiumSource = 'none' | 'dev' | 'store';
export interface PremiumState {
  active: boolean;
  /** откуда право: магазин (53б), DEV-тумблер настроек, нет права */
  source: PremiumSource;
  /** конец оплаченного периода, ISO (53б); у dev/none — null */
  until: string | null;
}
export const PREMIUM_NONE: PremiumState = { active: false, source: 'none', until: null };

/** Бесплатный тренажёр: не больше одной порции в день. Понятия «сессия» у повторения нет
 *  намеренно (спека 45), поэтому считаем карты, покинувшие очередь, — doneCount. */
export const FREE_REVIEW_PER_DAY = SESSION_MAX;

export function moduleLocked(mod: CourseModule, premium: PremiumState): boolean {
  return !mod.free && !premium.active;
}

/** Урок заперт по модулю, в котором лежит. Неизвестный id — не заперт: гейт маршрута
 *  до этого места не дойдёт (чужой id уводит назад раньше). */
export function lessonLocked(lessonId: string, modules: readonly CourseModule[], premium: PremiumState): boolean {
  const mod = modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  return mod !== undefined && moduleLocked(mod, premium);
}

export function spreadLocked(spread: Spread, premium: PremiumState): boolean {
  return !spread.free && !premium.active;
}

export function reviewLeftToday(day: ReviewDay, todayISO: string, premium: PremiumState): number {
  if (premium.active) return Infinity;
  return Math.max(0, FREE_REVIEW_PER_DAY - doneToday(day, todayISO));
}

export function reviewLimitReached(day: ReviewDay, todayISO: string, premium: PremiumState): boolean {
  return reviewLeftToday(day, todayISO, premium) === 0;
}
```

- [ ] **Шаг 4: прогон — PASS; `npx tsc --noEmit` чист.**

- [ ] **Шаг 5: коммит** — `feat: правила Premium — чистый модуль premium.ts (spec 53)`.

---

### Задача 3: право в сторе, persist version 11, бэкап

**Файлы:**
- Изменить: `src/lib/backup.ts` (`SCHEMA_VERSION`, `isReviewDay`, доливка `reviewDay` в `parseBackup`)
- Изменить: `src/store/useApp.ts` (`premium`, `setPremium`, `migrate`, `OutsideBackup`)
- Изменить: `src/lib/__tests__/backup.test.ts`

**Интерфейсы:**
- Использует: `PremiumState`, `PREMIUM_NONE` из `src/lib/premium.ts`; `mergeReviewDay` из `review.ts`.
- Отдаёт: `useApp.premium: PremiumState`, `useApp.setPremium(next: PremiumState)`, `SCHEMA_VERSION === 11`.

- [ ] **Шаг 1: тесты бэкапа**

В `src/lib/__tests__/backup.test.ts` добавить:
```ts
describe('версия 11 (спека 53)', () => {
  it('SCHEMA_VERSION = 11', () => {
    expect(SCHEMA_VERSION).toBe(11);
  });
  it('файл версии 10 с reviewDay без doneCount принимается и получает doneCount: 0', () => {
    const file = buildBackup(VALID, 10, AT);
    const raw = JSON.parse(JSON.stringify(file));
    delete raw.state.reviewDay.doneCount;
    const r = parseBackup(JSON.stringify(raw), SCHEMA_VERSION);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.reviewDay.doneCount).toBe(0);
  });
  it('doneCount вне коридора — файл битый', () => {
    const raw = JSON.parse(JSON.stringify(buildBackup(VALID, SCHEMA_VERSION, AT)));
    raw.state.reviewDay.doneCount = -1;
    expect(parseBackup(JSON.stringify(raw), SCHEMA_VERSION)).toEqual({ ok: false, error: 'corrupt' });
  });
  it('поле premium в файле игнорируется — право из бэкапа не приходит', () => {
    const raw = JSON.parse(JSON.stringify(buildBackup(VALID, SCHEMA_VERSION, AT)));
    raw.state.premium = { active: true, source: 'store', until: null };
    const r = parseBackup(JSON.stringify(raw), SCHEMA_VERSION);
    expect(r.ok).toBe(true);
    if (r.ok) expect('premium' in r.state).toBe(false);
    expect(BACKUP_KEYS).not.toContain('premium');
  });
});
```
Если фикстура `VALID.reviewDay` в тесте — литерал без `doneCount`, задача 1 уже заставила дописать `doneCount`.

- [ ] **Шаг 2: прогон — падает** (версия 10; `doneCount` не валидируется).

- [ ] **Шаг 3: `src/lib/backup.ts`**

- `export const SCHEMA_VERSION = 11;` и комментарий к истории версий дополнить строкой:
  `v10 → v11 (спека 53): doneCount ВНУТРИ reviewDay — слияние руками (mergeReviewDay) в migrate и тут; premium — ключ стора ВНЕ бэкапа.`
- `isReviewDay`:
  ```ts
  const isReviewDay = (v: unknown): boolean =>
    isObj(v) && (v.date === '' || isISODay(v.date)) &&
    isCount(v.newCount) && v.newCount <= cardById.size &&
    isCount(v.doneCount) && v.doneCount <= cardById.size * 4; // карта может уйти и вернуться несколько раз за день
  ```
- в `parseBackup` после цикла по `BACKUP_KEYS` и строки с `mergeSettings` добавить:
  ```ts
  // …и mergeReviewDay для вложенного reviewDay (v11: doneCount; правило-близнец logic-spec §7)
  state.reviewDay = mergeReviewDay(state.reviewDay);
  ```
  Импорт `mergeReviewDay` из `./review` (рядом с `REVIEW_DAY_DEFAULT`).

- [ ] **Шаг 4: `src/store/useApp.ts`**

- В `AppState` после `devMoonOpen` добавить:
  ```ts
  /** Право Premium (спека 53): единственный источник правды для гейтов; в бэкап НЕ входит
   *  (право даёт магазин или DEV-тумблер, не файл). Меняется только через setPremium. */
  premium: PremiumState;
  setPremium: (next: PremiumState) => void;
  ```
- В инициализаторе после `devMoonOpen: false,` → `premium: PREMIUM_NONE,`; рядом с `setDevMoonOpen`
  → `setPremium: (premium) => set({ premium }),`.
- `migrate`: `return { ...s, settings: mergeSettings(s.settings), reviewDay: mergeReviewDay(s.reviewDay) } as AppState;`
  и дописать в комментарий истории версий: `// v10 → v11: doneCount ВНУТРИ reviewDay (спека 53) — слияние руками; premium — ключ верхнего уровня вне бэкапа, дефолт доливается сам.`
- `type OutsideBackup = Exclude<DataKeys, keyof BackupState | 'devReflect' | 'devMoonOpen' | 'premium'>;`
- Импорты: `import { PREMIUM_NONE, type PremiumState } from '../lib/premium';`, `mergeReviewDay` из `'../lib/review'`.
- В `restoreBackup` ничего не менять: `s: BackupState` не несёт `premium`, `set({...s})` право не трогает.

- [ ] **Шаг 5: tsc, `npx jest src/lib/__tests__/backup.test.ts src/lib/__tests__/review.test.ts` → PASS; `npm test` зелёный.**

- [ ] **Шаг 6: коммит** — `feat: право premium в сторе, persist version 11, doneCount в бэкапе (spec 53)`.

---

### Задача 4: адаптер покупок-заглушка, строки i18n ×4, условия подписки в «О приложении»

**Файлы:**
- Создать: `src/lib/purchases.ts`
- Изменить: `src/lib/i18n.ts` (четыре языка), `app/about.tsx`

**Интерфейсы:**
- Отдаёт: `PURCHASES_AVAILABLE: boolean`, `type PlanId = 'year' | 'month'`,
  `interface Offer { id: PlanId; price: string; perMonth?: string; discount?: string }`,
  `getOffers(): Promise<Offer[]>`, `purchase(id: PlanId): Promise<PurchaseResult>`,
  `restore(): Promise<PurchaseResult>`, `refreshEntitlement(): Promise<PremiumState | null>`,
  `type PurchaseResult = { ok: true; premium: PremiumState } | { ok: false; reason: 'unavailable' | 'cancelled' | 'error' }`.

- [ ] **Шаг 1: `src/lib/purchases.ts`**

```ts
/** Адаптер покупок (спека 53). В 53а — честная заглушка: react-native-purchases (RevenueCat) —
 *  нативный модуль, в Expo Go не работает, поэтому «оформить» и «восстановить» отвечают
 *  'unavailable', а экран показывает диалог «появится в сборке из стора». В 53б этот файл
 *  получает реализацию на RevenueCat (+ purchases.web.ts — заглушка для веба, приём pushes.web.ts);
 *  экраны и стор правок не потребуют — они говорят только с этим модулем.
 *  Цены — плейсхолдеры макета (master-plan §3.4), настоящие приедут из магазина в 53б. */
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

const PLACEHOLDER_OFFERS: Offer[] = [
  { id: 'year', price: '2 890 ₽', perMonth: '241 ₽', discount: '−40 %' },
  { id: 'month', price: '399 ₽' },
];

export async function getOffers(): Promise<Offer[]> {
  return PLACEHOLDER_OFFERS;
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

- [ ] **Шаг 2: строки i18n — четыре языка**

Новая секция `paywall` (ставить после секции `about` в каждом языке) и ключи в `settings`/`course`/`review`/`about`.

**ru:**
```ts
      paywall: {
        overline: "ПОДПИСКА",
        title: "Arcanum Premium",
        subtitle: "Весь курс, все расклады и тренажёр без лимита. Справочник, карта дня и дневник остаются бесплатными всегда.",
        b1: "Курс целиком — 6 модулей, 32 урока",
        b2: "Все расклады — 9, включая Кельтский крест и расклад полнолуния",
        b3: "Тренажёр без лимита — сколько угодно повторений в день",
        b4: "И всё, что появится дальше",
        planYear: "Год", planMonth: "Месяц",
        perMonth: "≈ {{price}} в месяц",
        ctaYear: "Оформить за {{price}} в год", ctaMonth: "Оформить за {{price}} в месяц",
        restore: "Восстановить покупки",
        legal: "Подписка продлевается автоматически, пока вы её не отмените в настройках App Store или Google Play — не позже чем за сутки до конца периода.",
        terms: "Условия", privacy: "Конфиденциальность",
        activeChip: "✦ АКТИВНА",
        activeLine: "Подписка активна · продлится {{date}}",
        activeDev: "Подписка активна · DEV",
        manage: "Управлять подпиской",
        unavailableTitle: "Пока недоступно",
        unavailableText: "Покупки появятся в сборке из App Store и Google Play. В Expo Go оформить подписку нельзя.",
        ok: "Понятно",
      },
```
в `settings` (после `reflectNow`): `premium: "Arcanum Premium", premiumBuy: "Оформить ›", premiumActive: "Активна ›", devPremium: "Premium: переключить",`
в `course` (после `startLesson`): `premiumChip: "✦ ПРЕМИУМ",`
в `about` (после `sourcesText`): `termsTitle: "Условия подписки", termsText: "Arcanum Premium — подписка с автоматическим продлением: месячная или годовая. Оплата списывается через ваш аккаунт App Store или Google Play при подтверждении покупки и продлевается автоматически, пока вы не отмените подписку в настройках аккаунта магазина — не позже чем за сутки до конца текущего периода. Бесплатные функции приложения остаются доступными без подписки.",`

**en:**
```ts
      paywall: {
        overline: "SUBSCRIPTION",
        title: "Arcanum Premium",
        subtitle: "The whole course, every spread and an unlimited trainer. The reference, the daily card and the journal stay free forever.",
        b1: "The full course — 6 modules, 32 lessons",
        b2: "All spreads — 9, including the Celtic Cross and the Full Moon spread",
        b3: "Unlimited trainer — as many reviews a day as you like",
        b4: "And everything that comes next",
        planYear: "Year", planMonth: "Month",
        perMonth: "≈ {{price}} a month",
        ctaYear: "Subscribe for {{price}} a year", ctaMonth: "Subscribe for {{price}} a month",
        restore: "Restore purchases",
        legal: "The subscription renews automatically until you cancel it in your App Store or Google Play settings — at least 24 hours before the end of the period.",
        terms: "Terms", privacy: "Privacy",
        activeChip: "✦ ACTIVE",
        activeLine: "Subscription active · renews {{date}}",
        activeDev: "Subscription active · DEV",
        manage: "Manage subscription",
        unavailableTitle: "Not available yet",
        unavailableText: "Purchases will be available in the App Store and Google Play build. You can't subscribe inside Expo Go.",
        ok: "Got it",
      },
```
settings: `premium: "Arcanum Premium", premiumBuy: "Subscribe ›", premiumActive: "Active ›", devPremium: "Premium: toggle",`
course: `premiumChip: "✦ PREMIUM",`
about: `termsTitle: "Subscription terms", termsText: "Arcanum Premium is an auto-renewing subscription, monthly or yearly. Payment is charged to your App Store or Google Play account when you confirm the purchase and renews automatically until you cancel it in your store account settings — at least 24 hours before the end of the current period. The free features of the app stay available without a subscription.",`

**es:**
```ts
      paywall: {
        overline: "SUSCRIPCIÓN",
        title: "Arcanum Premium",
        subtitle: "Todo el curso, todas las tiradas y el entrenador sin límite. La guía, la carta del día y el diario siguen siendo gratis para siempre.",
        b1: "El curso completo: 6 módulos, 32 lecciones",
        b2: "Todas las tiradas: 9, incluida la Cruz Celta y la tirada de luna llena",
        b3: "Entrenador sin límite: todos los repasos que quieras al día",
        b4: "Y todo lo que venga después",
        planYear: "Año", planMonth: "Mes",
        perMonth: "≈ {{price}} al mes",
        ctaYear: "Suscribirme por {{price}} al año", ctaMonth: "Suscribirme por {{price}} al mes",
        restore: "Restaurar compras",
        legal: "La suscripción se renueva automáticamente hasta que la canceles en los ajustes de App Store o Google Play, al menos 24 horas antes de que termine el periodo.",
        terms: "Términos", privacy: "Privacidad",
        activeChip: "✦ ACTIVA",
        activeLine: "Suscripción activa · se renueva el {{date}}",
        activeDev: "Suscripción activa · DEV",
        manage: "Gestionar suscripción",
        unavailableTitle: "Aún no disponible",
        unavailableText: "Las compras estarán disponibles en la versión de App Store y Google Play. En Expo Go no es posible suscribirse.",
        ok: "Entendido",
      },
```
settings: `premium: "Arcanum Premium", premiumBuy: "Suscribirme ›", premiumActive: "Activa ›", devPremium: "Premium: alternar",`
course: `premiumChip: "✦ PREMIUM",`
about: `termsTitle: "Condiciones de la suscripción", termsText: "Arcanum Premium es una suscripción con renovación automática, mensual o anual. El pago se carga a tu cuenta de App Store o Google Play al confirmar la compra y se renueva automáticamente hasta que la canceles en los ajustes de tu cuenta de la tienda, al menos 24 horas antes de que termine el periodo actual. Las funciones gratuitas de la app siguen disponibles sin suscripción.",`

**pt:**
```ts
      paywall: {
        overline: "ASSINATURA",
        title: "Arcanum Premium",
        subtitle: "O curso inteiro, todas as tiragens e o treinador sem limite. O guia, a carta do dia e o diário continuam grátis para sempre.",
        b1: "O curso completo: 6 módulos, 32 aulas",
        b2: "Todas as tiragens: 9, incluindo a Cruz Celta e a tiragem de lua cheia",
        b3: "Treinador sem limite: quantas revisões quiser por dia",
        b4: "E tudo o que vier depois",
        planYear: "Ano", planMonth: "Mês",
        perMonth: "≈ {{price}} por mês",
        ctaYear: "Assinar por {{price}} ao ano", ctaMonth: "Assinar por {{price}} ao mês",
        restore: "Restaurar compras",
        legal: "A assinatura é renovada automaticamente até que você a cancele nas configurações da App Store ou do Google Play, pelo menos 24 horas antes do fim do período.",
        terms: "Termos", privacy: "Privacidade",
        activeChip: "✦ ATIVA",
        activeLine: "Assinatura ativa · renova em {{date}}",
        activeDev: "Assinatura ativa · DEV",
        manage: "Gerenciar assinatura",
        unavailableTitle: "Ainda não disponível",
        unavailableText: "As compras estarão disponíveis na versão da App Store e do Google Play. No Expo Go não é possível assinar.",
        ok: "Entendi",
      },
```
settings: `premium: "Arcanum Premium", premiumBuy: "Assinar ›", premiumActive: "Ativa ›", devPremium: "Premium: alternar",`
course: `premiumChip: "✦ PREMIUM",`
about: `termsTitle: "Condições da assinatura", termsText: "O Arcanum Premium é uma assinatura com renovação automática, mensal ou anual. O pagamento é cobrado na sua conta da App Store ou do Google Play ao confirmar a compra e renovado automaticamente até que você cancele a assinatura nas configurações da conta da loja, pelo menos 24 horas antes do fim do período atual. Os recursos gratuitos do aplicativo continuam disponíveis sem assinatura.",`

⚠️ Плейсхолдеры `{{price}}`, `{{n}}`, `{{date}}` — одинаковые во всех языках (контракт паритета
плейсхолдеров в `i18nPlurals`). es/pt написаны сессией — хвост: вычитка носителем (прецедент 28н).

- [ ] **Шаг 3: «О приложении» — блок условий**

В `app/about.tsx` после блока `about.dataTitle` добавить:
```tsx
        <FadeUp index={4}>
          <Block title={tr('about.termsTitle')} text={tr('about.termsText')} />
        </FadeUp>
```
и у блока источников поднять индекс на 5. Ссылки пейвола «Условия»/«Конфиденциальность»
в 53а ведут на этот экран (решение 7 спеки; в 53б — web-URL).

- [ ] **Шаг 4: `npx tsc --noEmit`; `npx jest src/lib/__tests__/i18nPlurals.test.ts src/lib/__tests__/i18nLangs.test.ts` → PASS.**

- [ ] **Шаг 5: коммит** — `feat: адаптер покупок-заглушка, строки пейвола ×4, условия подписки в «О приложении» (spec 53)`.

---

### Задача 5: экран пейвола, маршрут, строки настроек, DEV-тумблер

**Файлы:**
- Создать: `app/paywall.tsx`
- Изменить: `app/_layout.tsx` (маршрут под гардом), `app/settings.tsx` (строка первой + DEV-строка)

**Интерфейсы:**
- Использует: `useApp.premium`/`setPremium`; `getOffers`, `purchase`, `restore`, `PURCHASES_AVAILABLE`,
  `type Offer`, `type PlanId` из `purchases.ts`; `ConfirmDialog`, `CtaButton`, `Emblem`, `FadeUp`,
  `PressableScale`, `Rule`, `ScreenBg`, `Txt`; `formatFullDate` из `dates.ts`; `transparentHeader(t)`.
- Отдаёт: маршрут `/paywall` (все гейты задач 6–8 ведут сюда `router.push('/paywall')` или `<Redirect href="/paywall" />`).

⚠️ Перед стартом — принять дорисовку `v-paywall` и сверить значения ниже с CSS макета (`.cta`,
`.lk`, `.prow`, `.pcap`, карточки тарифов). Расхождение макета со спекой — флаг 6а-0, не копировать молча.

- [ ] **Шаг 1: `app/paywall.tsx`**

```tsx
/** Экран Arcanum Premium (спека 53): два состояния — «не оформлено» (тарифы + CTA) и «активна».
 *  В 53а покупки недоступны (Expo Go): CTA/«Восстановить»/«Управлять» открывают диалог-объяснение,
 *  сам экран и гейты проверяются с DEV-тумблером в настройках. Маршрут корневого стека под
 *  гардом онбординга (app/_layout.tsx). Композиция — макет v-paywall. */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { CtaButton } from '../src/components/CtaButton';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { PressableScale } from '../src/components/PressableScale';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { formatFullDate } from '../src/lib/dates';
import { hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { getOffers, purchase, restore, type Offer, type PlanId } from '../src/lib/purchases';
import { useBackHaptic } from '../src/lib/useBackHaptic';
import { useApp } from '../src/store/useApp';
import { fonts, radius, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

/** Подпись «назад» по источнику перехода; неизвестный/пустой from — «Настройки». */
const BACK_TITLES: Record<string, string> = {
  settings: 'settings.title',
  course: 'tabs.course',
  spreads: 'tabs.spreads',
  moon: 'moon.title',
  review: 'review.title',
};

export default function PaywallScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  useBackHaptic();
  const premium = useApp((s) => s.premium);
  const setPremium = useApp((s) => s.setPremium);
  // откуда пришли — подпись кнопки «назад» (приём card/[id]: BACK_TITLES по параметру from)
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [plan, setPlan] = React.useState<PlanId>('year');
  const [unavailable, setUnavailable] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    getOffers().then((o) => alive && setOffers(o));
    return () => {
      alive = false;
    };
  }, []);

  const chosen = offers.find((o) => o.id === plan);
  // один обработчик на все три действия: результат 'unavailable' — диалог, успех — право в стор
  const run = async (action: () => ReturnType<typeof purchase>) => {
    const r = await action();
    if (r.ok) setPremium(r.premium);
    else if (r.reason === 'unavailable') setUnavailable(true);
  };

  const benefits = ['b1', 'b2', 'b3', 'b4'] as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr(BACK_TITLES[from ?? ''] ?? 'settings.title') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        <FadeUp index={0} style={st.head}>
          <Txt style={[st.overline, { color: t.muted }]}>{tr('paywall.overline')}</Txt>
          <Emblem size={56} ticks={false} />
          <View style={st.titleRow}>
            <Txt style={[st.title, { color: t.head }]}>{tr('paywall.title')}</Txt>
            {premium.active && (
              <View style={[st.lk, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                <Txt style={[st.lkText, { color: t.accent }]}>{tr('paywall.activeChip')}</Txt>
              </View>
            )}
          </View>
          <Txt style={[st.subtitle, { color: t.text }]}>{tr('paywall.subtitle')}</Txt>
        </FadeUp>

        <FadeUp index={1} style={{ marginTop: spacing.l }}>
          {benefits.map((k) => (
            <View key={k} style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Txt style={[st.star, { color: t.accent }]}>✦</Txt>
              <Txt style={[st.rowText, { color: t.text }]}>{tr(`paywall.${k}`)}</Txt>
            </View>
          ))}
        </FadeUp>

        {premium.active ? (
          <FadeUp index={2} style={{ marginTop: spacing.l }}>
            <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.frame }]}>
              <Txt style={[st.panelText, { color: t.head }]}>
                {premium.source === 'store' && premium.until
                  ? tr('paywall.activeLine', { date: formatFullDate(premium.until, lang) })
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
          </FadeUp>
        ) : (
          <FadeUp index={2} style={{ marginTop: spacing.l }}>
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
                    {o.discount && (
                      <View style={[st.lk, st.planBadge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                        <Txt style={[st.lkText, { color: t.accent }]}>{o.discount}</Txt>
                      </View>
                    )}
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
              style={{ marginTop: spacing.m }}
            />
          </FadeUp>
        )}

        <FadeUp index={3} style={{ marginTop: spacing.m }}>
          <Pressable onPress={() => run(restore)} hitSlop={8}>
            <Txt style={[st.link, { color: t.accent }]}>{tr('paywall.restore')}</Txt>
          </Pressable>
          <Txt style={[st.legal, { color: t.muted }]}>
            {tr('paywall.legal')}{' '}
            <Txt style={{ color: t.accent }} onPress={() => router.push('/about')}>
              {tr('paywall.terms')}
            </Txt>
            {' · '}
            <Txt style={{ color: t.accent }} onPress={() => router.push('/about')}>
              {tr('paywall.privacy')}
            </Txt>
          </Txt>
        </FadeUp>
      </ScrollView>

      <ConfirmDialog
        visible={unavailable}
        title={tr('paywall.unavailableTitle')}
        message={tr('paywall.unavailableText')}
        confirmLabel={tr('paywall.ok')}
        confirmTone="accent"
        onConfirm={() => setUnavailable(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  head: { alignItems: 'center' },
  overline: { fontSize: 9.5, letterSpacing: 2.5, marginBottom: spacing.m },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.m },
  title: { fontFamily: fonts.display, fontSize: 26 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.s },
  // панель преимущества — `.pwfeat` принятого макета: panel/line, радиус 14, паддинг 11×14, зазор 8
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 14, marginTop: 8 },
  star: { fontSize: 12, marginTop: 2 },
  rowText: { flex: 1, fontSize: 12.5, lineHeight: 19 },
  plans: { flexDirection: 'row', gap: 10 },
  // `.plan` макета: радиус 16, паддинг 13×12, текст по центру; бейдж «−40 %» сверху по центру на −9px
  plan: { flex: 1, borderWidth: 1, borderRadius: radius.l, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', minHeight: 76 },
  planName: { fontFamily: fonts.displaySemi, fontSize: 15, textAlign: 'center' },
  planSub: { fontSize: 10, marginTop: 4, textAlign: 'center' },
  planBadge: { position: 'absolute', top: -9, alignSelf: 'center' },
  // `.lk` макета: 8.5 / ls 1.5, бордер frame, фон chipBg, радиус 10
  lk: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  lkText: { fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' },
  panel: { borderWidth: 1, borderRadius: radius.l, padding: 14 },
  panelText: { fontSize: 14, textAlign: 'center' },
  // `.cta2` макета: контур line, текст head, 12 / ls 1.6, паддинг 13, радиус 16
  secondary: { marginTop: spacing.m, borderWidth: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontSize: 12, letterSpacing: 1.6, fontWeight: '700' },
  link: { fontSize: 10.5, letterSpacing: 1, textAlign: 'center', marginTop: 12 }, // `.trlink`
  legal: { fontSize: 9.5, lineHeight: 15, textAlign: 'center', marginTop: spacing.m, paddingHorizontal: 4 }, // `.pwlegal`
});
```
`radius.l = 16`, `formatFullDate(iso, lang)` — проверены по `theme.ts`/`dates.ts`.

- [ ] **Шаг 2: маршрут под гардом**

В `app/_layout.tsx` после `<Stack.Screen name="moon" .../>`:
```tsx
          {/* пейвол Premium (спека 53): корневой стек, прозрачная шапка; объявлен здесь, чтобы не
              пройти мимо гарда онбординга (урок 09) */}
          <Stack.Screen name="paywall" options={transparentHeader(t)} />
```
⚠️ `typedRoutes`: пока файла `app/paywall.tsx` не было, `router.push('/paywall')` не компилировался —
создавать файл экрана РАНЬШЕ гейтов (задачи 6–8); если `tsc` ругается после создания — запустить
dev-сервер, чтобы Metro пересобрал `.expo/types/router.d.ts` (урок 07).

- [ ] **Шаг 3: строки настроек**

В `app/settings.tsx`:
- стор: `const premium = useApp((s) => s.premium); const setPremium = useApp((s) => s.setPremium);`
- ПЕРВОЙ строкой (перед `FadeUp index={0}` с темой) — новая `FadeUp index={0}`, а у остальных индексы
  сдвинуть на +1 НЕ надо: вложить обе строки в один `FadeUp index={0}` (один шаг каскада, как
  карточка повторения над первым модулем, design-system §5):
  ```tsx
        <FadeUp index={0}>
          <SettingsRow
            icon="sparkles-outline"
            label={tr('settings.premium')}
            value={premium.active ? tr('settings.premiumActive') : tr('settings.premiumBuy')}
            onPress={() => router.push({ pathname: '/paywall', params: { from: 'settings' } })}
          />
          <SettingsRow ...тема как была... />
        </FadeUp>
  ```
- DEV-строка под `devMoonOpen`-строкой:
  ```tsx
            <FadeUp index={7}>
              <SettingsRow
                icon="diamond-outline"
                label={tr('settings.devPremium')}
                value={premium.active ? 'DEV · ВКЛ' : 'DEV'}
                // без права запертые/открытые состояния на лайв-проверке не увидеть; источник 'dev'
                // отличает тумблер от магазина (53б), чтобы refreshEntitlement его не перетирал
                onPress={() => setPremium({ active: !premium.active, source: premium.active ? 'none' : 'dev', until: null })}
              />
            </FadeUp>
  ```
- Все входы на пейвол передают источник: `router.push({ pathname: '/paywall', params: { from: 'settings' } })`
  (`course` / `spreads` / `moon` / `review` — в задачах 6–8); `<Redirect href="/paywall?from=course" />`
  в гейтах маршрутов. Ключи подписей `tabs.course`/`tabs.spreads`/`moon.title`/`review.title`/`settings.title`
  существуют (проверено 22.08).

- [ ] **Шаг 4: tsc; веб-проверка вручную: `/paywall` открывается, тарифы переключаются, CTA → диалог,
  DEV-строка переключает «Активна ›» и состояние экрана.**

- [ ] **Шаг 5: коммит** — `feat: экран пейвола, маршрут под гардом, строка настроек и DEV-тумблер Premium (spec 53)`.

---

### Задача 6: гейты курса

**Файлы:**
- Изменить: `app/(tabs)/course.tsx`, `src/components/ModuleHeader.tsx`, `app/lesson/[id].tsx`

**Интерфейсы:**
- Использует: `moduleLocked`, `lessonLocked` из `premium.ts`; `useApp.premium`; `/paywall`.
- `ModuleHeader` получает проп `premiumLocked: boolean` и `onPremiumPress?: () => void`.

- [ ] **Шаг 1: `ModuleHeader`** — подпись и тап

Пропсы: добавить `premiumLocked: boolean; onPremiumPress?: () => void;`. Шапку обернуть
в `PressableScale` ТОЛЬКО когда `premiumLocked` (иначе `View` как сейчас — открытая шапка
не нажимается). Рядом с замком (в `overlineRow`) показывать подпись:
```tsx
          {premiumLocked && (
            <View style={[st.lk, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
              <Txt style={[st.lkText, { color: t.accent }]}>{tr('spreads.premium')}</Txt>
            </View>
          )}
```
Стили `lk`/`lkText` — те же значения, что у плашки раскладов (`app/(tabs)/spreads/index.tsx` `st.badge`):
8.5 / ls 1.5 / weight 700, бордер 1, радиус 10, паддинг 8×3. ⚠️ Третье появление плашки
(расклады, шапка модуля, пейвол) — по правилу «2+ раза» вынести в `src/components/PremiumBadge.tsx`
(`<PremiumBadge label?>`, дефолт `spreads.premium`) и перевести на него плашку раскладов и
бейдж пейвола из задачи 5. Замок `lock-closed` остаётся (он про «платное» всегда).
Обновить шапку-комментарий файла: «в v1 подписки нет» больше не верно.

- [ ] **Шаг 2: `course.tsx`**

```tsx
const premium = useApp((s) => s.premium);
const openPaywall = () => router.push({ pathname: '/paywall', params: { from: 'course' } });
…
{course.map((m, mi) => {
  const locked = moduleLocked(m, premium);
  const section = (
    <>
      <ModuleHeader module={m} index={mi} total={course.length} progress={lessonsProgress} lang={lang}
        premiumLocked={locked} onPremiumPress={openPaywall} />
      <CoursePath module={m} states={states} lang={lang}
        chipLabel={locked ? tr('course.premiumChip') : chipLabel}
        onLessonPress={locked ? openPaywall : openLesson} />
    </>
  );
```
`PathNode` не меняется: узлы `locked` по-прежнему качают замок (последовательность главнее),
`current`/`done` зовут `onLessonPress` — в premium-модуле это пейвол, чип «✦ ПРЕМИУМ».

- [ ] **Шаг 3: гейт маршрута `app/lesson/[id].tsx`**

После `const found = React.useMemo(() => findLesson(id), [id]);`:
```tsx
  const premium = useApp((s) => s.premium);
  // premium-модуль без права — на пейвол (прецедент гейта лунного окна в /spreads/[id]):
  // прямая ссылка не должна обходить замок пути
  if (found && lessonLocked(found.lesson.id, course, premium)) return <Redirect href="/paywall?from=course" />;
```
⚠️ Хуки ниже (`useState`, `useEffect`, `useSharedValue`) идут ПОСЛЕ этого раннего return? — нельзя:
правило хуков. Ранний return ставить ПОСЛЕ всех хуков экрана (найти последний хук перед `return (`)
либо рендерить `<Redirect>` внутри JSX вместо дерева экрана. Предпочтительно: переменная
`const gated = !!found && lessonLocked(...)` после хуков и `if (gated) return <Redirect href="/paywall?from=course" />;`
непосредственно перед основным `return (`. Импорт `Redirect` из `expo-router`, `lessonLocked` из premium.

- [ ] **Шаг 4: tsc; веб: DEV-Premium выкл → шапка М3 с «ПРЕМИУМ», тап → пейвол; пройти М2 DEV-строкой
  «пройти следующий урок» до m3l1 → золотой узел с чипом «✦ ПРЕМИУМ», тап → пейвол; `/lesson/m3l1`
  → пейвол; DEV-Premium вкл → всё открыто, чип «НАЧАТЬ УРОК».**

- [ ] **Шаг 5: коммит** — `feat: гейты Premium в курсе — шапка модуля, узлы, маршрут урока (spec 53)`.

---

### Задача 7: гейты раскладов

**Файлы:**
- Изменить: `app/(tabs)/spreads/index.tsx`, `app/(tabs)/spreads/[id].tsx`, `src/components/MoonSpreadPanel.tsx`

- [ ] **Шаг 1: список**

```tsx
const premium = useApp((s) => s.premium);
…
const open = (s: Spread, locked: boolean) => {
  if (locked) return;
  if (s.moon && !moonSpreadState(s.moon, devNow ?? new Date())?.open) return;
  hapticTap();
  if (s.id === 'card-of-day') { router.navigate('/'); return; }
  if (spreadLocked(s, premium)) { router.push({ pathname: '/paywall', params: { from: 'spreads' } }); return; } // premium без права — пейвол
  router.push({ pathname: '/spreads/[id]', params: { id: s.id } });
};
```
Плашка «ПРЕМИУМ» остаётся как есть (показывает флаг) — перевести на `PremiumBadge` из задачи 6.
Карточка НЕ приглушается (приглушение — только «вне окна»). ⚠️ У лунной карточки полнолуния бейджа ДВА
(принятый макет): «○ СОБЫТИЕ» + `PremiumBadge` рядом; вне окна карточка по-прежнему не нажимается
(лунный гейт первый — спека 51), в окне без права → пейвол.

- [ ] **Шаг 2: маршрут `[id].tsx`**

После лунного гейта:
```tsx
  const premium = useApp((s) => s.premium);
  if (spreadLocked(spread, premium)) return <Redirect href="/paywall?from=spreads" />;
```
(хук `useApp` — до всех `return`, как `useDevMoonNow`).

- [ ] **Шаг 3: панель полнолуния на луне**

В `MoonSpreadPanel`: `const premium = useApp((s) => s.premium); const locked = spreadLocked(spread, premium);`
В `onPress` открытой панели перед `router.push`: `if (locked) { router.push({ pathname: '/paywall', params: { from: 'moon' } }); return; }`.
Рядом с правой подписью при `open && locked` — `<PremiumBadge />` (в ряд перед «ОТКРЫТЬ →»).

- [ ] **Шаг 4: tsc; веб с DEV-луной вкл и DEV-Premium выкл: полнолуние в списке → пейвол,
  `/spreads/full-moon` → пейвол, панель на луне → пейвол; новолуние открывается; DEV-Premium вкл —
  полнолуние играется; сохранённый расклад из дневника открывается при любом праве.**

- [ ] **Шаг 5: коммит** — `feat: гейты Premium в раскладах — список, маршрут, панель полнолуния (spec 53)`.

---

### Задача 8: гейт тренажёра

**Файлы:**
- Изменить: `app/review.tsx`, `src/components/ReviewResult.tsx`

- [ ] **Шаг 1: `ReviewResult`** — проп `moreLocked?: boolean`: при `more > 0 && moreLocked` рядом
  с текстом «Ещё N» (тот же `.trlink`, ключ `review.more` как есть) в ряд рисуется
  `<PremiumBadge label={tr('course.premiumChip')} />` («✦ ПРЕМИУМ», задача 6) — так в принятом макете
  (`#tragain` + `.lk`); `onMore` — тот же колбэк (экран решает, куда вести).

- [ ] **Шаг 2: `review.tsx`**

```tsx
const premium = useApp((s) => s.premium);
const limitReached = reviewLimitReached(reviewDay, today, premium);
// сессия не строится, если дневной лимит исчерпан: иначе открылась бы 11-я карта
const [queue, setQueue] = React.useState<SessionItem[]>(() =>
  limitReached ? [] : buildSession(deck, srs, today, reviewDay, Math.random),
);
…
const onMore = () => {
  if (busy.current) return;
  if (reviewLimitReached(useApp.getState().reviewDay, localDateISO(), useApp.getState().premium)) {
    router.push({ pathname: '/paywall', params: { from: 'review' } });
    return;
  }
  …как было…
};
…
const empty = (!head && log.length === 0 && !limitReached) || cardMissing;
const result = !head && (log.length > 0 || limitReached); // лимит с порога — панель итога без карт
…
<ReviewResult gained={gained} cards={stats.cards} firstTry={stats.firstTry}
  more={nextSessionSize(sum)} moreLocked={reviewLimitReached(reviewDay, today, premium)}
  onDone={() => router.back()} onMore={onMore} />
```
⚠️ `limitReached` с порога при `deck.length === 0` — невозможно (doneCount растёт только с колодой),
но `empty` проверяет `deck.length === 0` раньше — оставить порядок как есть.

- [ ] **Шаг 3: tsc; веб: DEV-сброс повторения → пройти 10 карт → «Ещё N · ✦ ПРЕМИУМ» → пейвол;
  выйти и снова войти в `/review` → сразу панель итога с запертой «Ещё»; DEV-Premium вкл → «Ещё N»
  собирает порцию; DEV «состарить» → на новый день лимит обнулён.**

- [ ] **Шаг 4: коммит** — `feat: лимит бесплатного тренажёра 10 карт/день и «Ещё N · ПРЕМИУМ» (spec 53)`.

---

### Задача 9: контракт-тест источников и документы

**Файлы:**
- Создать: `src/lib/__tests__/premiumSources.test.ts`
- Изменить: `docs/logic-spec.md` (§7 схема + новый §14), `docs/product-spec.md` (§2, §4, §5 + «Пейвол»),
  `docs/design-system.md` §5 (пейвол, `PremiumBadge`, чип узла — значения ПО ПРИНЯТОМУ МАКЕТУ),
  `docs/backlog.md`, `CLAUDE.md` (статус), `docs/changelog.md`, `docs/lessons.md` (если появились ⚠️).

- [ ] **Шаг 1: контракт**

```ts
/** Страж правила спеки 53: экраны не решают доступ по флагу free и не читают premium.active сами —
 *  только через src/lib/premium.ts. Образец — langSources.test.ts. */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}
const files = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)));
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');

describe('доступ Premium решается только в premium.ts (спека 53)', () => {
  it('исходники найдены', () => expect(files.length).toBeGreaterThan(30));
  it('никто не сравнивает .free в условиях доступа', () => {
    // плашка «ПРЕМИУМ» показывает флаг — это разрешено и помечено комментарием `// показ флага`
    const bad = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /!\w+\.free\b|\.free\s*(===|!==|&&|\|\||\?)/.test(src.replace(/.*\/\/ показ флага.*/g, ''));
    });
    expect(bad.map(rel)).toEqual([]);
  });
  it('premium.active читают только пейвол и настройки', () => {
    const bad = files.filter((f) => /premium\.active/.test(fs.readFileSync(f, 'utf8')));
    expect(bad.map(rel).sort()).toEqual(['app/paywall.tsx', 'app/settings.tsx']);
  });
});
```
Проверить красным: временно вписать `if (!s.free)` в `spreads/index.tsx` — тест обязан упасть; снять.

- [ ] **Шаг 2: документы** — logic-spec §7: `premium: {active, source, until}` (вне бэкапа) и
  `reviewDay: {date, newCount, doneCount}`, version 11; новый §14 «Premium»: правила из `premium.ts`
  словами + лимит тренажёра + таблица гейтов; product-spec: раздел «Пейвол» и пометки в §2/§4/§5;
  design-system §5 — по макету; backlog 53 (статус 53а), CLAUDE.md «Статус» (persist 11, тесты),
  changelog — запись 53а.

- [ ] **Шаг 3: `npm test` зелёный, `tsc` чист; коммит** — `docs+test: контракт источников Premium, документы (spec 53)`.

---

### Задача 10: веб-проверка 6а/6б и лайв

- [ ] Dev-сервер заново с `--clear`; доставка правок проверяется грепом по бандлу (урок 46в).
- [ ] Playwright-сценарий (390×844, обе темы) с сидом `premium` и `reviewDay`: таблица гейтов спеки
  полностью; **красный прогон** — снять гейт в `app/lesson/[id].tsx` → `/lesson/m3l1` обязан открыть
  урок и уронить проверку; вернуть.
- [ ] Скриншоты в `docs/screenshots/53/`; сверка с макетом по `docs/ui-verification.md`; расхождения —
  исправить либо перечислить с причиной (флаг 6а-0).
- [ ] Сценарий лайв-проверки Артёма — в спеку; после ✓ — merge, push, статус.
