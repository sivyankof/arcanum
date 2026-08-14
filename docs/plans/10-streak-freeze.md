# План 10 · Заморозка серии

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пропуск одного дня не сжигает серию: месячная бесплатная заморозка тратится сама при следующем открытии карты; профиль получает третью стату, «Сегодня» — строку спасения, план пушей — вид `freeze`.

**Architecture:** Вся арифметика — новый чистый модуль `src/lib/streak.ts` (`advanceStreak`, `grantFreezes`), стор только применяет результат (образец — `completeLessonProgress`). Три новых ключа ВЕРХНЕГО уровня в persist (v7), начисление ленивое (гидрация + возврат из фона). Пуш `freeze` подменяет утренний в дне после первого пропуска — расширение `planPushes` без смены его модели «план под допущение, что приложение больше не откроют».

**Tech Stack:** Expo SDK 54 (НЕ обновлять), zustand/persist, jest-expo, react-i18next, content/phrases.json + `pickPhrase`.

**Spec:** `docs/specs/10-streak-freeze.md` — читать перед выполнением; решения 1–4 согласованы Артёмом 14.08.

## Global Constraints

- Ветка `feat/10-streak-freeze`; merge в main только после лайв-проверки Артёма.
- После КАЖДОГО шага с правкой кода: `npx tsc --noEmit` — чисто.
- Новая формула → тест в том же коммите; `npm test` зелёный перед каждым коммитом.
- Комментарии в коде и сообщения коммитов — русские; никаких упоминаний ИИ/Claude/Anthropic, никаких Co-Authored-By трейлеров.
- Цвета только из `useTheme()`/`theme.ts` — хардкод запрещён. Снежинка — `Ionicons`, НЕ эмодзи.
- persist version → **7**; новые ключи — только верхнего уровня (поверхностное слияние дольёт дефолты само). Следующая задача после этой поднимает до 8.
- `pushPlan.ts` и `streak.ts` остаются чистыми: ни одного импорта из expo/react.

---

### Task 1: Ветка + чистый модуль `src/lib/streak.ts` (TDD)

**Files:**
- Create: `src/lib/streak.ts`
- Create: `src/lib/__tests__/streak.test.ts`

**Interfaces:**
- Consumes: `daysAgoISO(n, from)`, `parseISODate(iso)` из `src/lib/dates.ts`.
- Produces (Task 2 и 3 зависят от точных имён):
  - `FREEZE_MAX = 2`
  - `advanceStreak(s: {streak: number; lastDrawDate: string | null; freezes: number}, todayISO: string): {streak: number; freezes: number; freezeSpent: boolean}`
  - `grantFreezes(s: {freezes: number; freezeMonth: string | null}, todayISO: string): {freezes: number; freezeMonth: string}`

- [ ] **Step 1: Создать ветку и закоммитить спеку с планом**

```bash
git checkout -b feat/10-streak-freeze
git add docs/specs/10-streak-freeze.md docs/plans/10-streak-freeze.md
git commit -m "docs: спека и план задачи 10 — заморозка серии (spec 10)"
```

- [ ] **Step 2: Написать падающие тесты**

Файл `src/lib/__tests__/streak.test.ts` целиком:

```ts
import { advanceStreak, FREEZE_MAX, grantFreezes } from '../streak';

describe('advanceStreak — продолжение и спасение серии (logic-spec §2)', () => {
  it('вчера открывали — серия растёт, заморозки целы', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-13', freezes: 1 }, '2026-08-14'))
      .toEqual({ streak: 6, freezes: 1, freezeSpent: false });
  });

  it('пропущен ровно один день, заморозка есть — серия растёт, заморозка тратится', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-12', freezes: 1 }, '2026-08-14'))
      .toEqual({ streak: 6, freezes: 0, freezeSpent: true });
  });

  it('пропущен один день, заморозок нет — сброс в 1', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-12', freezes: 0 }, '2026-08-14'))
      .toEqual({ streak: 1, freezes: 0, freezeSpent: false });
  });

  it('пропущено два дня — сброс, заморозка НЕ тратится', () => {
    expect(advanceStreak({ streak: 5, lastDrawDate: '2026-08-11', freezes: 2 }, '2026-08-14'))
      .toEqual({ streak: 1, freezes: 2, freezeSpent: false });
  });

  it('первое открытие вообще — серия 1', () => {
    expect(advanceStreak({ streak: 0, lastDrawDate: null, freezes: 1 }, '2026-08-14'))
      .toEqual({ streak: 1, freezes: 1, freezeSpent: false });
  });

  it('пропуск через границу месяца: 31 июля → 2 августа — заморозка работает', () => {
    expect(advanceStreak({ streak: 3, lastDrawDate: '2026-07-31', freezes: 1 }, '2026-08-02'))
      .toEqual({ streak: 4, freezes: 0, freezeSpent: true });
  });
});

describe('grantFreezes — начисление 1-го числа месяца (логически; фактически — лениво)', () => {
  it('месяц ещё не записан — инициализация текущим БЕЗ начисления (стартовая 1 уже «за этот месяц»)', () => {
    expect(grantFreezes({ freezes: 1, freezeMonth: null }, '2026-08-14'))
      .toEqual({ freezes: 1, freezeMonth: '2026-08' });
  });

  it('тот же месяц — без изменений', () => {
    expect(grantFreezes({ freezes: 1, freezeMonth: '2026-08' }, '2026-08-31'))
      .toEqual({ freezes: 1, freezeMonth: '2026-08' });
  });

  it('новый месяц — +1', () => {
    expect(grantFreezes({ freezes: 0, freezeMonth: '2026-08' }, '2026-09-01'))
      .toEqual({ freezes: 1, freezeMonth: '2026-09' });
  });

  it('потолок 2 — сверх него не копится', () => {
    expect(grantFreezes({ freezes: 2, freezeMonth: '2026-08' }, '2026-09-05'))
      .toEqual({ freezes: 2, freezeMonth: '2026-09' });
    expect(FREEZE_MAX).toBe(2);
  });

  it('пропущено три месяца с нуля — доначисляется по одному за месяц, до потолка', () => {
    expect(grantFreezes({ freezes: 0, freezeMonth: '2026-05' }, '2026-08-14'))
      .toEqual({ freezes: 2, freezeMonth: '2026-08' });
  });

  it('граница года: декабрь → январь', () => {
    expect(grantFreezes({ freezes: 0, freezeMonth: '2026-12' }, '2027-01-02'))
      .toEqual({ freezes: 1, freezeMonth: '2027-01' });
  });

  it('часы перевели назад (записанный месяц в будущем) — ничего не меняем и не дарим повторно', () => {
    expect(grantFreezes({ freezes: 1, freezeMonth: '2026-08' }, '2026-07-30'))
      .toEqual({ freezes: 1, freezeMonth: '2026-08' });
  });
});
```

- [ ] **Step 3: Прогнать — тесты падают**

Run: `npm test -- streak`
Expected: FAIL — «Cannot find module '../streak'».

- [ ] **Step 4: Реализация**

Файл `src/lib/streak.ts` целиком:

```ts
/** Серия и заморозки — чистая арифметика (logic-spec §2, спека 10). Без импортов из expo/react:
 *  стор только применяет результат, как с `completeLessonProgress`.
 *
 *  Модель заморозки: событие серии — ТОЛЬКО открытие карты дня, поэтому и трата ленивая —
 *  в момент следующего открытия, а не «в полночь пропущенного дня» (фоновых задач у офлайн-
 *  приложения нет). Пропущенный день в счёт серии не входит: 5 → пропуск → 6.
 */
import { daysAgoISO, parseISODate } from './dates';

/** Потолок накопления заморозок (logic-spec §2). */
export const FREEZE_MAX = 2;

export interface StreakAdvance {
  streak: number;
  freezes: number;
  /** Заморозка потрачена этим открытием — стору сигнал записать `freezeSpentDate`. */
  freezeSpent: boolean;
}

/** Следующее значение серии при открытии карты. Повтор в тот же день сюда не доходит —
 *  его отсекает guard в `drawToday` (`lastDrawDate === today`). */
export function advanceStreak(
  s: { streak: number; lastDrawDate: string | null; freezes: number },
  todayISO: string,
): StreakAdvance {
  const from = parseISODate(todayISO);
  if (s.lastDrawDate === daysAgoISO(1, from)) {
    return { streak: s.streak + 1, freezes: s.freezes, freezeSpent: false };
  }
  // пропуск РОВНО одного дня и есть запас — заморозка укрывает дыру, серия продолжается
  if (s.lastDrawDate === daysAgoISO(2, from) && s.freezes > 0) {
    return { streak: s.streak + 1, freezes: s.freezes - 1, freezeSpent: true };
  }
  // пропуск 2+ дней спасать нечем — сброс, заморозки целы (logic-spec §2)
  return { streak: 1, freezes: s.freezes, freezeSpent: false };
}

/** Ленивое начисление: «+1 первого числа месяца» наступает при первом открытии приложения
 *  в новом месяце. Пропущенные месяцы доначисляются по одному, потолок общий. */
export function grantFreezes(
  s: { freezes: number; freezeMonth: string | null },
  todayISO: string,
): { freezes: number; freezeMonth: string } {
  const month = todayISO.slice(0, 7);
  // первый запуск с этой механикой: записываем месяц БЕЗ начисления — стартовый запас 1
  // (дефолт стора) и есть «заморозка за текущий месяц» (спека 10, решение 2)
  if (s.freezeMonth === null) return { freezes: s.freezes, freezeMonth: month };
  const passed = monthsBetween(s.freezeMonth, month);
  // 0 — тот же месяц; отрицательное — часы перевели назад: месяц не трогаем,
  // иначе возврат к настоящему времени начислил бы за него второй раз
  if (passed <= 0) return { freezes: s.freezes, freezeMonth: s.freezeMonth };
  return { freezes: Math.min(FREEZE_MAX, s.freezes + passed), freezeMonth: month };
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
```

- [ ] **Step 5: Прогнать тесты и tsc**

Run: `npm test -- streak` → PASS (13 тестов). Затем `npx tsc --noEmit` → чисто.

- [ ] **Step 6: Commit**

```bash
git add src/lib/streak.ts src/lib/__tests__/streak.test.ts
git commit -m "feat: чистый модуль заморозки серии — advanceStreak и grantFreezes (spec 10)"
```

---

### Task 2: Стор — поля заморозки, persist v7, трата и начисление

**Files:**
- Modify: `src/store/useApp.ts` (интерфейс ~29–72, дефолты ~77–87, `drawToday` ~92–105, `resetToday` ~175–185, комментарий версий + `version` ~212–233, `onRehydrateStorage` ~245–249)
- Modify: `app/_layout.tsx` (импорты ~20–22, вызов после `usePushScheduler()` ~56)

**Interfaces:**
- Consumes: `advanceStreak`, `grantFreezes`, `FREEZE_MAX` из `src/lib/streak.ts` (Task 1); `useAppActive` из `src/lib/useAppActive.ts`.
- Produces: поля стора `freezes: number`, `freezeMonth: string | null`, `freezeSpentDate: string | null`; экшены `syncFreezeGrant(): void`, `devSkipYesterday(): void`. На них полагаются Task 3 (планировщик), 4 («Сегодня»), 5 (профиль), 6 (настройки).

- [ ] **Step 1: Интерфейс AppState**

В `interface AppState` после `lastDrawDate: string | null;` добавить:

```ts
  /** Заморозки серии (logic-spec §2, спека 10): запас (0..FREEZE_MAX), месяц последнего
   *  начисления ('YYYY-MM', null до первой синхронизации) и день последней траты —
   *  по нему «Сегодня» весь день спасения показывает строку «Серию спасла заморозка». */
  freezes: number;
  freezeMonth: string | null;
  freezeSpentDate: string | null;
```

И после `resetToday: () => void;`:

```ts
  /** Ленивое начисление заморозок: зовётся на гидрации и при возврате из фона. */
  syncFreezeGrant: () => void;
  /** Только для разработки: симулирует пропущенный вчера день. */
  devSkipYesterday: () => void;
```

- [ ] **Step 2: Дефолты**

После `lastDrawDate: null,` добавить:

```ts
      freezes: 1,
      freezeMonth: null,
      freezeSpentDate: null,
```

- [ ] **Step 3: `drawToday` через `advanceStreak`**

Заменить тело `drawToday` (строки с `const yesterday = daysAgoISO(1);` и `const newStreak = ...` уходят):

```ts
      drawToday: (cardId, reversed) => {
        const t = localDateISO();
        const { lastDrawDate, streak, freezes, history, xp } = get();
        if (lastDrawDate === t) return; // уже тянули сегодня
        // вся арифметика серии и заморозки — в чистом advanceStreak (streak.ts)
        const adv = advanceStreak({ streak, lastDrawDate, freezes }, t);
        set({
          lastDrawDate: t,
          streak: adv.streak,
          freezes: adv.freezes,
          ...(adv.freezeSpent ? { freezeSpentDate: t } : {}),
          history: [{ date: t, cardId, reversed }, ...history].slice(0, 365),
          // ритуал дня: +5 XP (logic-spec §4); повторное начисление отсекает проверка выше
          xp: xp + XP_DRAW,
        });
      },
```

Импорт вверху файла: `import { advanceStreak, FREEZE_MAX, grantFreezes } from '../lib/streak';`
(если `daysAgoISO` после правки остаётся нужен только `devSkipYesterday` — импорт из `dates` сохранить).

- [ ] **Step 4: `syncFreezeGrant` и `devSkipYesterday`**

После `resetToday` добавить:

```ts
      // Ленивое «1-е число месяца»: фоновых задач нет, поэтому начисление происходит при
      // первом открытии приложения в новом месяце — из onRehydrateStorage (холодный старт)
      // и по возврату из фона (app/_layout.tsx, useAppActive). Пустой set не делаем.
      syncFreezeGrant: () => {
        const { freezes, freezeMonth } = get();
        const next = grantFreezes({ freezes, freezeMonth }, localDateISO());
        if (next.freezes !== freezes || next.freezeMonth !== freezeMonth) set(next);
      },

      // Только для разработки: «вчера пропущен» — lastDrawDate уезжает на позавчера,
      // сегодняшняя запись стирается. Следующий переворот карты либо тратит заморозку,
      // либо (freezes === 0) сбрасывает серию — иначе механику не проверить, не ждя сутки.
      devSkipYesterday: () => {
        const t = localDateISO();
        set({
          history: get().history.filter((h) => h.date !== t),
          lastDrawDate: daysAgoISO(2),
          freezeSpentDate: null,
        });
      },
```

- [ ] **Step 5: Рефанд в `resetToday`**

Заменить `resetToday` целиком:

```ts
      // Для разработки: отменяет сегодняшнюю карту, чтобы вытянуть заново.
      // Серия уменьшается на 1 (точное прежнее значение не хранится).
      resetToday: () => {
        const t = localDateISO();
        const { history, streak, freezes, freezeSpentDate } = get();
        if (!history.some((h) => h.date === t)) return;
        const rest = history.filter((h) => h.date !== t);
        set({
          history: rest,
          lastDrawDate: rest[0]?.date ?? null,
          streak: Math.max(0, streak - 1),
          // сегодняшняя трата возвращается — иначе каждый DEV-сброс сжигал бы заморозку
          ...(freezeSpentDate === t
            ? { freezes: Math.min(FREEZE_MAX, freezes + 1), freezeSpentDate: null }
            : {}),
        });
      },
```

- [ ] **Step 6: version 7 + начисление на гидрации**

`version: 6,` → `version: 7,`. К комментарию версий дописать:

```ts
      // v6 → v7: freezes/freezeMonth/freezeSpentDate (спека 10) — снова ключи ВЕРХНЕГО уровня,
      // дефолты (1/null/null) доливаются поверхностным слиянием сами, ветка миграции не нужна.
      // Существующие пользователи получают freezes: 1 сразу (решение 2 спеки 10).
      // Следующая задача, меняющая схему, поднимает до 8.
```

`onRehydrateStorage` — добавить вызов после блока installSeed:

```ts
      onRehydrateStorage: () => (state) => {
        if (state && state.installSeed === 0) {
          useApp.setState({ installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)) });
        }
        // холодный старт в новом месяце — момент «1-го числа» для начисления заморозки;
        // возврат из фона ловит useAppActive в app/_layout.tsx
        useApp.getState().syncFreezeGrant();
      },
```

- [ ] **Step 7: Возврат из фона — `app/_layout.tsx`**

К импортам: `import { useAppActive } from '../src/lib/useAppActive';`
После строки `usePushScheduler();`:

```ts
  // смена месяца, пока приложение живёт в фоне: «1-е число» должно наступить и без перезапуска
  // (тот же класс, что час рефлексии в 06а — всё временнóе слушает ещё и AppState)
  useAppActive(() => useApp.getState().syncFreezeGrant());
```

- [ ] **Step 8: Проверка**

Run: `npx tsc --noEmit` → чисто; `npm test` → зелёный (все сьюты).

- [ ] **Step 9: Commit**

```bash
git add src/store/useApp.ts app/_layout.tsx
git commit -m "feat: заморозка в сторе — persist v7, трата при открытии карты, ленивое начисление (spec 10)"
```

---

### Task 3: Пуш «серию спасла заморозка» (TDD)

**Files:**
- Modify: `src/lib/pushPlan.ts` (тип `PushKind` ~16, `PlanInput` ~32–44, `PRIORITY` ~57, `PHRASE_KEY` ~59–64, `planInputFromStore` ~80–96, `planPushes` цикл утренних ~135–138)
- Modify: `src/lib/__tests__/pushPlan.test.ts` (база ~17–23 + новые describe)
- Modify: `src/lib/pushes.ts` (`TITLE_KEY` ~101–106)
- Modify: `src/lib/usePushScheduler.ts` (селекторы, вызов, deps)
- Modify: `app/settings.tsx` (селекторы ~53–55, `showPlan` ~88)
- Modify: `content/phrases.json` (семейство `push.freeze_saved`)
- Modify: `src/lib/i18n.ts` (ключ `push.titleFreeze` в ru и en)

**Interfaces:**
- Consumes: поля стора `freezes`, `lastDrawDate` (Task 2); `daysAgoISO` из `dates.ts`.
- Produces: `PushKind` += `'freeze'`; `PlanInput` += `freezes: number; lastDrawDate: string | null`; сигнатура `planInputFromStore(settings, streak, history, freezes, lastDrawDate, now?)`.

- [ ] **Step 1: Дополнить тесты (падают)**

В `pushPlan.test.ts`: в `base` добавить два поля —

```ts
const base: PlanInput = {
  pushesOn: true,
  reflectionOn: true,
  morning: '09:00',
  evening: '21:00',
  streak: 0,
  freezes: 0,
  lastDrawDate: null,
};
```

Вверху к импортам добавить `import { pickPhrase } from '../phrases';`. Новый describe в конец файла:

```ts
describe('planPushes — пуш «серию спасла заморозка» (спека 10)', () => {
  // MORNING_8AM = 12 августа; «вчера» = 11-е, «позавчера» = 10-е

  it('карта открыта — freeze-пуш на послезавтра вместо утреннего', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-12', todayCardId: 'the-tower' };
    const plan = planPushes(input, MORNING_8AM);
    const freeze = plan.filter((p) => p.kind === 'freeze');
    expect(freeze).toHaveLength(1);
    expect(freeze[0].date).toBe('2026-08-14');
    expect(freeze[0].hour).toBe(9);
    expect(freeze[0].n).toBe(5);
    // замена, а не добавка: обычного утреннего в этот день нет
    expect(onDate(input, MORNING_8AM, '2026-08-14').map((p) => p.kind)).toEqual(['freeze']);
  });

  it('карта не открыта, вчера открывали — freeze-пуш на завтра вместо утреннего', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-11' };
    const plan = planPushes(input, MORNING_8AM);
    const freeze = plan.filter((p) => p.kind === 'freeze');
    expect(freeze).toHaveLength(1);
    expect(freeze[0].date).toBe('2026-08-13');
    expect(onDate(input, MORNING_8AM, '2026-08-13').map((p) => p.kind)).toEqual(['freeze']);
  });

  it('последнее открытие позавчера — к утру серию уже не спасти, freeze-пуша нет', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-10' };
    expect(kinds(input, MORNING_8AM)).not.toContain('freeze');
  });

  it('заморозок нет — freeze-пуша нет', () => {
    const input = { ...base, streak: 5, freezes: 0, lastDrawDate: '2026-08-11' };
    expect(kinds(input, MORNING_8AM)).not.toContain('freeze');
  });

  it('серии нет — freeze-пуша нет', () => {
    const input = { ...base, streak: 0, freezes: 2, lastDrawDate: '2026-08-11' };
    expect(kinds(input, MORNING_8AM)).not.toContain('freeze');
  });

  it('ключ фразы push.freeze_saved существует в phrases.json', () => {
    const input = { ...base, streak: 5, freezes: 1, lastDrawDate: '2026-08-11' };
    const freeze = planPushes(input, MORNING_8AM).find((p) => p.kind === 'freeze')!;
    expect(freeze.phraseKey).toBe('push.freeze_saved');
    expect(pickPhrase('push.freeze_saved', freeze.date, 'ru', { days: '5 дней' })).not.toBe('');
    expect(pickPhrase('push.freeze_saved', freeze.date, 'en', { days: '5 days' })).not.toBe('');
  });
});
```

И в describe `capPerDay — обрезка на искусственном входе` дописать:

```ts
  it('freeze в PRIORITY выше утреннего: из freeze+morning+comeback выживают freeze и morning', () => {
    const three: PlannedPush[] = [
      { kind: 'comeback', date: day, hour: 9, minute: 0, phraseKey: 'push.winback' },
      { kind: 'morning', date: day, hour: 9, minute: 0, phraseKey: 'push.morning_card' },
      { kind: 'freeze', date: day, hour: 9, minute: 0, phraseKey: 'push.freeze_saved', n: 5 },
    ];
    const kept = capPerDay(three).map((p) => p.kind);
    expect(kept).toEqual(expect.arrayContaining(['freeze', 'morning']));
    expect(kept).not.toEqual(expect.arrayContaining(['comeback']));
  });
```

Run: `npm test -- pushPlan` → FAIL (тип без `freezes`, вид `freeze` не существует).

- [ ] **Step 2: Реализация в `pushPlan.ts`**

```ts
export type PushKind = 'morning' | 'evening' | 'streak' | 'comeback' | 'freeze';
```

В `PlanInput` после `streak: number;`:

```ts
  /** Запас заморозок (logic-spec §2) — от него зависит freeze-пуш. */
  freezes: number;
  /** Дата последнего открытия карты — по ней считается день freeze-пуша. */
  lastDrawDate: string | null;
```

Импорт: `import { daysAgoISO, localDateISO } from './dates';`

```ts
const PRIORITY: PushKind[] = ['streak', 'evening', 'freeze', 'morning', 'comeback'];
```

В `PHRASE_KEY` добавить `freeze: 'push.freeze_saved',`.

`planInputFromStore` — новая сигнатура (оба вызывающих обновляются в Step 3):

```ts
export function planInputFromStore(
  settings: AppSettings,
  streak: number,
  history: DailyDraw[],
  freezes: number,
  lastDrawDate: string | null,
  now: Date = new Date(),
): PlanInput {
  const today = history.find((h) => h.date === localDateISO(now));
  return {
    pushesOn: settings.pushesOn,
    reflectionOn: settings.reflectionOn,
    morning: settings.pushMorning,
    evening: settings.pushEvening,
    streak,
    freezes,
    lastDrawDate,
    todayCardId: today?.cardId,
    todayOutcome: today?.outcome,
  };
}
```

В `planPushes` перед циклом утренних:

```ts
  // «серию спасла заморозка» — утро дня после ПЕРВОГО полностью пропущенного дня (спека 10):
  // замена обычного утреннего, не добавка. План строится под допущение «пользователь больше
  // не откроет приложение»: карта сегодня открыта → первый пропуск завтра, пуш послезавтра;
  // не открыта при вчерашнем открытии → пропуск сегодня, пуш завтра; открытие старше — к утру
  // серию уже не спасти (пропуск 2+ дней заморозка не покрывает, logic-spec §2).
  const freezeDay =
    input.freezes > 0 && input.streak >= 1
      ? drawn
        ? 2
        : input.lastDrawDate === daysAgoISO(1, now)
          ? 1
          : null
      : null;
```

Сам цикл:

```ts
  for (let d = 1; d <= MORNING_AHEAD_DAYS; d++) {
    if (d === freezeDay) {
      out.push({
        kind: 'freeze',
        date: daysAheadISO(d, now),
        ...morning,
        phraseKey: PHRASE_KEY.freeze,
        n: input.streak,
      });
    } else {
      out.push({ kind: 'morning', date: daysAheadISO(d, now), ...morning, phraseKey: PHRASE_KEY.morning });
    }
  }
```

- [ ] **Step 3: Вызывающие и заголовок**

`src/lib/usePushScheduler.ts` — добавить селекторы и deps:

```ts
  const freezes = useApp((s) => s.freezes);
  const lastDrawDate = useApp((s) => s.lastDrawDate);
```

вызов: `planPushes(planInputFromStore(settings, streak, history, freezes, lastDrawDate, now), now)`;
deps: `[settings, streak, history, freezes, lastDrawDate, lang, tick]`.

`app/settings.tsx` — рядом с существующими селекторами `streak`/`history`:

```ts
  const freezes = useApp((s) => s.freezes);
  const lastDrawDate = useApp((s) => s.lastDrawDate);
```

в `showPlan`: `planPushes(planInputFromStore(settings, streak, history, freezes, lastDrawDate, now), now)`.

`src/lib/pushes.ts` — в `TITLE_KEY` добавить `freeze: 'push.titleFreeze',`
(`pushes.web.ts` не трогать — заголовков он не собирает; `pushBody` уже умеет `{days}`).

- [ ] **Step 4: Тексты**

`content/phrases.json`, внутрь объекта `"push"` после `"winback"`:

```json
  "freeze_saved": [
   {
    "ru": "Серия {days} цела — пропущенный день укрыла заморозка",
    "en": "Your streak of {days} is safe — the freeze covered the missed day"
   },
   {
    "ru": "Заморозка сработала: серия продолжается, карта ждёт ✦",
    "en": "The freeze did its job — your streak lives on, a card is waiting ✦"
   },
   {
    "ru": "Вчера прошло без карты, но серию сохранила заморозка",
    "en": "Yesterday passed without a card, but the freeze kept your streak"
   }
  ]
```

`src/lib/i18n.ts`: в ru-блок `push` после `titleComeback`: `titleFreeze: "Серия спасена ❄",`
в en-блок `push` после `titleComeback`: `titleFreeze: "Streak saved ❄",`.

- [ ] **Step 5: Проверка**

Run: `npm test` → зелёный (pushPlan + все остальные); `npx tsc --noEmit` → чисто.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pushPlan.ts src/lib/__tests__/pushPlan.test.ts src/lib/pushes.ts src/lib/usePushScheduler.ts app/settings.tsx content/phrases.json src/lib/i18n.ts
git commit -m "feat: пуш «серию спасла заморозка» вместо утреннего после пропуска (spec 10)"
```

---

### Task 4: Строка спасения на «Сегодня»

**Files:**
- Modify: `app/(tabs)/index.tsx` (импорты ~17–43, селектор рядом со `streak` ~153, разметка после блока пилюль ~330–333, стили ~466)
- Modify: `content/phrases.json` (новое семейство `freeze.saved` — верхний уровень, после `"push"`)

**Interfaces:**
- Consumes: `freezeSpentDate` из стора (Task 2); `pickPhrase` из `src/lib/phrases.ts`; `todayISO` (уже есть в компоненте, ~192).

- [ ] **Step 1: Фразы**

`content/phrases.json`, верхний уровень после объекта `"push"` (2 варианта, БЕЗ эмодзи — снежинку рисует иконка рядом):

```json
 "freeze": {
  "saved": [
   {
    "ru": "Серию спасла заморозка",
    "en": "A freeze saved your streak"
   },
   {
    "ru": "Пропущенный день укрыла заморозка — серия цела",
    "en": "The freeze covered the missed day — your streak is safe"
   }
  ]
 },
```

- [ ] **Step 2: Разметка**

Импорты в `app/(tabs)/index.tsx`:

```ts
import Ionicons from '@expo/vector-icons/Ionicons';
import { pickPhrase } from '../../src/lib/phrases';
```

Селектор после `const streak = useApp((s) => s.streak);`:

```ts
  const freezeSpentDate = useApp((s) => s.freezeSpentDate);
```

Сразу ПОСЛЕ `<FadeUp index={2} style={st.pills}>…</FadeUp>` (ряд пилюль):

```tsx
        {/* строка «серию спасла заморозка» — весь день спасения (спека 10, решение 1).
            Отдельный FadeUp с ТЕМ ЖЕ индексом, что у пилюль: появляются вместе, а внутрь
            st.pills строку не положить — тот контейнер горизонтальный */}
        {freezeSpentDate === todayISO && (
          <FadeUp index={2} style={st.freezeRow}>
            <Ionicons name="snow" size={12} color={t.accent} />
            <Txt style={[st.freezeText, { color: t.muted }]}>
              {pickPhrase('freeze.saved', todayISO, lang)}
            </Txt>
          </FadeUp>
        )}
```

Стили рядом с `pills`:

```ts
  // по образцу строки луны: по центру, muted; макета для строки нет — расхождение осознанное (спека 10)
  freezeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  freezeText: { fontSize: 12 },
```

- [ ] **Step 3: Проверка**

Run: `npx tsc --noEmit` → чисто; `npm test` → зелёный.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/index.tsx content/phrases.json
git commit -m "feat: строка спасения серии на «Сегодня» (spec 10)"
```

---

### Task 5: Третья стата «Заморозка» в профиле

**Files:**
- Modify: `app/(tabs)/profile.tsx` (селектор рядом со `streak` ~60, третья коробка ~117–118)
- Modify: `src/lib/i18n.ts` (ключ `profile.freeze` в ru и en)

**Interfaces:**
- Consumes: `freezes` из стора (Task 2); `StatBox` (проп `icon` уже принимает любое имя Ionicons, цвет — accent, менять компонент не нужно).

- [ ] **Step 1: i18n**

ru `profile`: после `cards: "КАРТ ДНЯ",` → `freeze: "ЗАМОРОЗКА",`
en `profile`: после `cards: "DAILY CARDS",` → `freeze: "FREEZE",`.

- [ ] **Step 2: Разметка**

Селектор: `const freezes = useApp((s) => s.freezes);`
После `<StatBox value={history.length} label={tr('profile.cards')} />`:

```tsx
        {/* снежинка — иконкой, как огонёк: эмодзи ❄ из макета — указание на смысл,
            не на способ рисования (правило задачи 16); цвет accent — холодный синий
            в палитру «Небесного золота» не вводим (спека 10) */}
        <StatBox value={freezes} label={tr('profile.freeze')} icon="snow" />
```

- [ ] **Step 3: Проверка**

Run: `npx tsc --noEmit` → чисто.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/profile.tsx src/lib/i18n.ts
git commit -m "feat: третья стата «Заморозка» в профиле (spec 10)"
```

---

### Task 6: DEV-строка «Пропустить вчера» в настройках

**Files:**
- Modify: `app/settings.tsx` (селектор ~41, новая строка после блока `resetToday` ~242–249)
- Modify: `src/lib/i18n.ts` (ключ `settings.devSkipYesterday` в ru и en)

**Interfaces:**
- Consumes: `devSkipYesterday` из стора (Task 2).

- [ ] **Step 1: i18n**

ru `settings`: после `reflectNow: "Рефлексия: показать сейчас",` → `devSkipYesterday: "Пропустить вчера",`
en `settings`: после `reflectNow: "Reflection: show now",` → `devSkipYesterday: "Skip yesterday",`.

- [ ] **Step 2: Строка**

Селектор: `const devSkipYesterday = useApp((s) => s.devSkipYesterday);`
Внутри блока `__DEV__`, сразу после `FadeUp` со строкой `resetToday` (индексы дальше не сдвигать — дубль индекса уже есть у подписи пушей, задержка каскада совпадёт со соседней строкой):

```tsx
            <FadeUp index={7}>
              <SettingsRow
                icon="snow-outline"
                label={tr('settings.devSkipYesterday')}
                value="DEV"
                // симуляция пропуска: следующий переворот карты тратит заморозку или,
                // если запас нулевой, сбрасывает серию (спека 10) — иначе механику
                // не проверить ни в вебе, ни на лайв-проверке, не ожидая сутки
                onPress={devSkipYesterday}
              />
            </FadeUp>
```

- [ ] **Step 3: Проверка**

Run: `npx tsc --noEmit` → чисто.

- [ ] **Step 4: Commit**

```bash
git add app/settings.tsx src/lib/i18n.ts
git commit -m "feat: DEV-симуляция пропущенного дня в настройках (spec 10)"
```

---

### Task 7: Синхронизация документации

**Files:**
- Modify: `docs/logic-spec.md` (§2 — абзац «Заморозка»; §7 — список версий схемы; §8 — виды пушей и приоритет)
- Modify: `docs/backlog.md` (строка задачи 10 → `[x]` + итог)
- Modify: `CLAUDE.md` (раздел «Статус» + «Ближайшие задачи» + предупреждение о persist 8)
- Modify: `docs/design-system.md` (раздел профиля/«Сегодня» — только если статы и строки там перечислены поимённо; иначе не трогать)

- [ ] **Step 1: logic-spec §2** — заменить абзац «**Заморозка (backlog 10):** …» на:

```
**Заморозка ✅(10):** стартовый запас 1 (и у существующих установок после обновления); +1
начисляется 1-го числа месяца, потолок 2 (`FREEZE_MAX`). Начисление ленивое — при первом
открытии приложения в новом месяце (гидрация + возврат из фона, `syncFreezeGrant`);
пропущенные месяцы доначисляются по одному, потолок общий. Пропуск ровно одного дня и
freezes>0 → при следующем открытии карты: freezes−1, streak+1 (пропущенный день в счёт не
входит: 5 → пропуск → 6), на «Сегодня» весь день строка «Серию спасла заморозка»
(`freezeSpentDate`), утром дня после пропуска — пуш `freeze` вместо утреннего (§8).
Пропуск 2+ дней подряд → сброс в 1 (заморозка не тратится). Чистые функции —
`src/lib/streak.ts` (advanceStreak/grantFreezes). Тест-кейсы: 5 → пропуск 1 дня (freezes 1)
→ 6; пропуск 2 дней (freezes 2) → 1, заморозки целы; месяцы 05→08 с нуля → 2.
```

- [ ] **Step 2: logic-spec §7** — в описание версий схемы дописать строку: `v7: freezes, freezeMonth, freezeSpentDate (спека 10)`.

- [ ] **Step 3: logic-spec §8** — в правила пушей добавить вид: `freeze` — утро дня после первого пропущенного дня, ЗАМЕНА утреннего слота (не добавка), условия `freezes > 0` и `streak ≥ 1`; приоритет обрезки: `streak > evening > freeze > morning > comeback`.

- [ ] **Step 4: backlog** — строку задачи 10 перевести в `[x] **10 · Заморозка серии** — ЗАКРЫТА <дата>` с итогом: механика (старт 1, +1/мес до 2, трата при пропуске ровно 1 дня), третья стата в профиле (хвост 16 закрыт), строка на «Сегодня», пуш `freeze`, DEV-строка «Пропустить вчера», persist v7, `src/lib/streak.ts` + тесты.

- [ ] **Step 5: CLAUDE.md** — в «Статус» добавить абзац о задаче 10 (по образцу прошлых: что сделано, новое общее, ⚠️-уроки, счёт тестов — взять фактический из `npm test`); в «Ближайшие задачи» убрать пункт 1 (задача 10) и хвост про третью стату; предупреждение «Следующая задача, меняющая схему стора, обязана поднять persist version до 7» → «до 8».

- [ ] **Step 6: design-system.md** — проверить раздел профиля: если там перечислены две статы — дописать третью («ЗАМОРОЗКА», значение = запас заморозок, снежинка-иконка accent) и строку спасения на «Сегодня» (по образцу строки луны: 12px, muted, снежинка accent 12px). Если раздел не детализирует статы — файл не трогать.

- [ ] **Step 7: Commit**

```bash
git add docs/logic-spec.md docs/backlog.md CLAUDE.md docs/design-system.md
git commit -m "docs: синхронизация документации по задаче 10 (spec 10)"
```

---

### Task 8: Проверка 6а/6б (веб) и подготовка к лайв-проверке

**Files:**
- Create: `docs/screenshots/10/*.png` (профиль и «Сегодня» со строкой спасения, 390×844, обе темы)

Прогон — САМ, без Артёма (процесс, п.6):

- [ ] **Step 1:** `npx tsc --noEmit` и `npm test` — чисто/зелёный; зафиксировать фактическое число тестов для CLAUDE.md (Task 7 Step 5 — поправить, если разошлось).
- [ ] **Step 2:** `npx expo start --web` (порт 8081). Скриншоты строго 390×844 — Playwright-СКРИПТОМ, не MCP-окном (урок задачи 16: окно Chrome на Windows не сжимается до 390, проверять `window.innerWidth`).
- [ ] **Step 3:** Сценарий спасения: настройки → DEV «Пропустить вчера» → «Сегодня» → перевернуть карту. Ожидание: серия prev+1 (не 1), строка «Серию спасла заморозка» под пилюлями, в профиле заморозка 0. Перезагрузить страницу — строка на месте (persist).
- [ ] **Step 4:** Сценарий сброса: ещё раз DEV «Пропустить вчера» (запас уже 0) → переворот. Ожидание: серия = 1, строки нет, заморозка 0 (не в минусе).
- [ ] **Step 5:** DEV «План пушей»: при открытой карте и freezes>0 на послезавтра стоит `freeze` (не `morning`); повторить с freezes 0 — снова `morning`. (Чтобы вернуть заморозку после трат: DEV «Сбросить карту дня» рефандит сегодняшнюю трату.)
- [ ] **Step 6:** Профиль: ТРИ статы в ряд, обе темы, скриншоты в `docs/screenshots/10/`; сверка с `.statrow` эталона (design-reference.html, профиль).
- [ ] **Step 7:** Консоль браузера — без новых ошибок/предупреждений; прокликать изменённые экраны (обе темы, оба языка — метка «FREEZE»/«ЗАМОРОЗКА», фразы обоих языков).
- [ ] **Step 8:** Коммит скриншотов и правок по находкам:

```bash
git add docs/screenshots/10
git commit -m "chore: скриншоты веб-проверки задачи 10 (spec 10)"
```

- [ ] **Step 9:** Доложить Артёму результаты веб-проверки и передать на лайв-проверку iPhone (сценарий: DEV «Пропустить вчера» → переворот → строка + вибрация салюта серии; три статы; DEV-план пушей). Merge в main и `git push` — ТОЛЬКО после её прохождения.

---

## Self-review

- Покрытие спеки: механика (Task 1–2), пуш (Task 3), UI «Сегодня»/профиль (Task 4–5), DEV-инструмент (Task 6), тексты (Task 3–5), доки (Task 7), критерии приёмки (Task 8) — все пункты спеки имеют задачу.
- Типы сквозные: `advanceStreak`/`grantFreezes` (Task 1) ← стор (Task 2); `freezes`/`lastDrawDate` в `PlanInput` и новая сигнатура `planInputFromStore` (Task 3) согласованы с обоими вызывающими; `freezeSpentDate` (Task 2) ← «Сегодня» (Task 4).
- Плейсхолдеров нет; каждый кодовый шаг несёт готовый код.
