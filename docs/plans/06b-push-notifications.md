# План реализации 06б · Локальные пуши

> **Для исполнителя:** выполняй по одной задаче за раз, шаги помечены `- [ ]`. После каждой задачи —
> `npx tsc --noEmit` и `npm test`, затем коммит. Спека: `docs/specs/06b-push-notifications.md`.

**Цель:** утром напомнить вытянуть карту, вечером — ответить, отозвалась ли она; всё локально,
без сервера, с жёстким инвариантом «не больше двух пушей в день».

**Архитектура:** чистая функция `planPushes` считает конкретные «дата + время + ключ фразы» на
горизонт вперёд; адаптер над `expo-notifications` снимает всё запланированное и ставит заново.
Перепланирование — в пяти точках: гидрация стора, возврат приложения из фона, открытие карты дня,
ответ рефлексии, смена настроек. Повторяющиеся `DAILY`-триггеры не используются: они безусловны,
а три правила из четырёх — условные.

**Стек:** Expo SDK 54 (Expo Go), expo-notifications, @react-native-community/datetimepicker,
zustand + persist, react-i18next, jest-expo.

## Общие ограничения

- **SDK не обновлять**: Expo SDK 54, ставить только через `npx expo install`, мажорные версии
  пакетов не менять (правило CLAUDE.md).
- **Цвета только из `src/theme/theme.ts`** через `useTheme()`, хардкод цветов запрещён.
- **Комментарии в коде — на русском**, тексты интерфейса — в `src/lib/i18n.ts` в обоих языках (ru + en).
- **Тексты пушей не выдумывать**: они уже лежат в `content/phrases.json`
  (`push.morning_card`, `push.evening_reflect`, `push.streak_save`, `push.winback`).
- **Никаких `Alert.alert`**: в react-native-web это пустая заглушка. Диалоги — только `ConfirmDialog`.
- **Веб не должен падать**: `expo-notifications` и `datetimepicker` веб не поддерживают, все
  обращения к ним — за проверкой платформы или в файле `.web.tsx`.
- **Работаем в `main`**, ветка не нужна (ветки начинаются с задачи 07).
- **Числительные — через плюрализацию i18next** (`_one/_few/_many` для ru), а не склейкой строк.

## Карта файлов

| Файл | Ответственность |
|---|---|
| `src/lib/settings.ts` | **создать** — тип `AppSettings`, дефолты, слияние при миграции, разбор `'HH:MM'` |
| `src/lib/pushPlan.ts` | **создать** — чистые правила расписания (`logic-spec §8`) |
| `src/lib/pushes.ts` | **создать** — единственный модуль, знающий про `expo-notifications` |
| `src/lib/useAppActive.ts` | **создать** — общий слушатель возврата приложения из фона |
| `src/lib/usePushScheduler.ts` | **создать** — связка стор → план → расписание |
| `src/components/TimePicker.tsx` | **создать** — натив: системное колесо |
| `src/components/TimePicker.web.tsx` | **создать** — веб: список целых часов |
| `src/store/useApp.ts` | новые поля `settings`, три экшена, `version: 3` |
| `src/components/ConfirmDialog.tsx` | новый проп `confirmTone` (у прелюдии кнопка не красная) |
| `app/settings.tsx` | тумблер, две строки времени, подпись, DEV-строки |
| `app/(tabs)/index.tsx` | прелюдия разрешения; слушатель `AppState` → общий хук |
| `app/_layout.tsx` | вызов `usePushScheduler()` |
| `src/lib/i18n.ts` | новые строки ru + en |

---

### Задача 1: Установка пакетов

**Файлы:**
- Modify: `package.json` (через `npx expo install`, вручную не править)

**Интерфейсы:**
- Produces: модули `expo-notifications` и `@react-native-community/datetimepicker` доступны для импорта

- [ ] **Шаг 1: Установить оба пакета одной командой**

```bash
npx expo install expo-notifications @react-native-community/datetimepicker
```

`npx expo install` (а не `npm install`) выбирает версии, совместимые с SDK 54. Оба пакета входят
в Expo Go: локальные уведомления работают на iOS и Android, веба нет ни у того, ни у другого.

- [ ] **Шаг 2: Проверить, что версии встали в `dependencies`**

```bash
node -e "const p=require('./package.json');console.log(p.dependencies['expo-notifications'], p.dependencies['@react-native-community/datetimepicker'])"
```

Ожидание: две непустые версии, `expo` в `dependencies` остался `~54.0.35` (мажор не сменился).

- [ ] **Шаг 3: Проверить типы**

```bash
npx tsc --noEmit
```

Ожидание: без ошибок.

- [ ] **Шаг 4: Сказать Артёму про перезапуск**

Дословно: «Добавлены два нативных модуля — нужен перезапуск `npx expo start`, Fast Refresh их
не подхватит». Дальше можно продолжать, но приложение до перезапуска новые модули не увидит.

- [ ] **Шаг 5: Коммит**

```bash
git add package.json package-lock.json
git commit -m "chore: expo-notifications и datetimepicker (спека 06б)"
```

---

### Задача 2: Настройки в сторе и миграция `version: 3`

**Файлы:**
- Create: `src/lib/settings.ts`
- Test: `src/lib/__tests__/settings.test.ts`
- Modify: `src/store/useApp.ts` (строки 15–21 — тип и дефолт; 31–43 — интерфейс; 102 — экшены; 119–132 — persist)

**Интерфейсы:**
- Produces: `AppSettings`, `DEFAULT_SETTINGS`, `mergeSettings(saved?) → AppSettings`,
  `parseHHMM(value, fallbackHour) → {hour, minute}`, `formatHHMM(hour, minute) → string`,
  `timeLabel(value) → string`; в сторе — `setPushesOn(on)`, `setPushTime(kind, hhmm)`, `setPushAsked()`

- [ ] **Шаг 1: Написать падающий тест**

Создать `src/lib/__tests__/settings.test.ts`:

```ts
import {
  DEFAULT_SETTINGS,
  formatHHMM,
  mergeSettings,
  parseHHMM,
  timeLabel,
} from '../settings';

describe('mergeSettings', () => {
  it('без сохранённого объекта отдаёт дефолт', () => {
    expect(mergeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('дописывает ключи, которых не было в сохранённой версии', () => {
    // так выглядит settings у пользователя, установившего приложение на версии 06а
    const saved = { reflectionOn: false };
    expect(mergeSettings(saved)).toEqual({
      reflectionOn: false,
      pushesOn: true,
      pushMorning: '09:00',
      pushEvening: '21:00',
      pushAsked: false,
    });
  });

  it('не затирает сохранённые значения дефолтными', () => {
    const saved = { pushMorning: '07:00', pushAsked: true };
    const merged = mergeSettings(saved);
    expect(merged.pushMorning).toBe('07:00');
    expect(merged.pushAsked).toBe(true);
  });
});

describe('parseHHMM', () => {
  it('разбирает корректное время', () => {
    expect(parseHHMM('09:00', 9)).toEqual({ hour: 9, minute: 0 });
    expect(parseHHMM('21:30', 21)).toEqual({ hour: 21, minute: 30 });
  });

  it('мусор в хранилище откатывается к запасному часу, а не роняет планировщик', () => {
    expect(parseHHMM('', 9)).toEqual({ hour: 9, minute: 0 });
    expect(parseHHMM('25:99', 21)).toEqual({ hour: 21, minute: 0 });
    expect(parseHHMM('девять', 9)).toEqual({ hour: 9, minute: 0 });
  });
});

describe('formatHHMM и timeLabel', () => {
  it('хранение — с ведущим нулём, показ — без него (как в макете «9:00 · 21:00»)', () => {
    expect(formatHHMM(9, 0)).toBe('09:00');
    expect(formatHHMM(21, 30)).toBe('21:30');
    expect(timeLabel('09:00')).toBe('9:00');
    expect(timeLabel('21:30')).toBe('21:30');
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

```bash
npx jest src/lib/__tests__/settings.test.ts
```

Ожидание: FAIL — `Cannot find module '../settings'`.

- [ ] **Шаг 3: Написать модуль**

Создать `src/lib/settings.ts`:

```ts
/** Настройки приложения (logic-spec §7) и правило их слияния при обновлении.
 *
 *  Отдельный чистый модуль, а не часть стора: `zustand/persist` сливает сохранённое состояние
 *  с дефолтным ТОЛЬКО по верхнему уровню ключей, поэтому объект `settings` приходит из хранилища
 *  целиком — без полей, добавленных новой версией приложения. Дописывать недостающие ключи
 *  приходится руками (на этом уже спотыкались в 06а), и дешевле проверить это тестом,
 *  чем установкой приложения поверх старой версии.
 */

export interface AppSettings {
  /** Вечерняя рефлексия: блок на «Сегодня» (06а) и вечерний пуш (06б). */
  reflectionOn: boolean;
  /** Наше согласие на напоминания. Системное разрешение — отдельно, у ОС. */
  pushesOn: boolean;
  /** Время утреннего напоминания, 'HH:MM'. */
  pushMorning: string;
  /** Время вечернего напоминания, 'HH:MM'. */
  pushEvening: string;
  /** Прелюдия разрешения уже показана — второй раз не спрашиваем (product-spec §1). */
  pushAsked: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  reflectionOn: true,
  pushesOn: true,
  pushMorning: '09:00',
  pushEvening: '21:00',
  pushAsked: false,
};

/** Дописывает ключи, которых не было в сохранённой версии. */
export function mergeSettings(saved?: Partial<AppSettings> | null): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

/** 'HH:MM' → {hour, minute}. Непарсимое значение откатывается к запасному часу:
 *  испорченная запись в хранилище не должна ронять планировщик. */
export function parseHHMM(value: string, fallbackHour: number): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!m) return { hour: fallbackHour, minute: 0 };
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return { hour: fallbackHour, minute: 0 };
  return { hour, minute };
}

/** {9, 0} → '09:00' — формат хранения. */
export function formatHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** '09:00' → '9:00' — формат показа в строке настроек (в макете «9:00 · 21:00»). */
export function timeLabel(value: string): string {
  const { hour, minute } = parseHHMM(value, 9);
  return `${hour}:${String(minute).padStart(2, '0')}`;
}
```

- [ ] **Шаг 4: Убедиться, что тест проходит**

```bash
npx jest src/lib/__tests__/settings.test.ts
```

Ожидание: PASS, 6 тестов.

- [ ] **Шаг 5: Подключить модуль к стору**

В `src/store/useApp.ts` **удалить** локальные `AppSettings` и `DEFAULT_SETTINGS` (строки 15–21)
и заменить импортом:

```ts
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from '../lib/settings';
```

Оставить реэкспорт типа, чтобы экраны не меняли импорты:

```ts
export type { AppSettings };
```

В `interface AppState` добавить к существующим экшенам:

```ts
  setPushesOn: (on: boolean) => void;
  setPushTime: (kind: 'morning' | 'evening', hhmm: string) => void;
  setPushAsked: () => void;
```

Рядом с `setReflectionOn` добавить реализации:

```ts
      setPushesOn: (on) => set({ settings: { ...get().settings, pushesOn: on } }),
      setPushTime: (kind, hhmm) =>
        set({
          settings: {
            ...get().settings,
            ...(kind === 'morning' ? { pushMorning: hhmm } : { pushEvening: hhmm }),
          },
        }),
      setPushAsked: () => set({ settings: { ...get().settings, pushAsked: true } }),
```

- [ ] **Шаг 6: Поднять версию персиста и переписать миграцию**

В опциях `persist` заменить блок `version` + `migrate`:

```ts
      // schemaVersion из logic-spec §7 хранится тут же, отдельного поля в состоянии нет.
      // v1 → v2: появились настройки (settings.reflectionOn).
      // v2 → v3: настройки пушей (pushesOn, pushMorning, pushEvening, pushAsked).
      version: 3,
      // ⚠️ persist сливает состояние ПОВЕРХНОСТНО: сохранённый `settings` заменяет объект-дефолт
      // целиком, а не сливается с ним по ключам. Поэтому недостающие ключи дописываем здесь
      // руками — и следующая задача, добавляя поля в settings, обязана поднять версию и сделать
      // то же самое, иначе новые настройки не появятся у уже существующих пользователей.
      migrate: (persistedState) => {
        const s = (persistedState ?? {}) as Partial<AppState>;
        return { ...s, settings: mergeSettings(s.settings) } as AppState;
      },
```

- [ ] **Шаг 7: Проверить типы и все тесты**

```bash
npx tsc --noEmit && npm test
```

Ожидание: типы чистые, все сьюты зелёные (settings — новый).

- [ ] **Шаг 8: Коммит**

```bash
git add src/lib/settings.ts src/lib/__tests__/settings.test.ts src/store/useApp.ts
git commit -m "feat: настройки пушей в сторе, миграция version 3 (спека 06б)"
```

---

### Задача 3: Планировщик `pushPlan.ts` — чистые правила

**Файлы:**
- Create: `src/lib/pushPlan.ts`
- Test: `src/lib/__tests__/pushPlan.test.ts`

**Интерфейсы:**
- Consumes: `parseHHMM` из `src/lib/settings.ts`; `localDateISO` из `src/lib/dates.ts`;
  тип `Outcome` из `src/lib/journal.ts`
- Produces: `planPushes(input: PlanInput, now: Date) → PlannedPush[]`; типы `PushKind`,
  `PlannedPush`, `PlanInput`; константы `MORNING_AHEAD_DAYS = 3`, `COMEBACK_AFTER_DAYS = 4`,
  `STREAK_SAVE_HOUR = 20`, `STREAK_MIN = 3`, `MAX_PER_DAY = 2`

- [ ] **Шаг 1: Написать падающие тесты**

Создать `src/lib/__tests__/pushPlan.test.ts`:

```ts
import {
  COMEBACK_AFTER_DAYS,
  MAX_PER_DAY,
  MORNING_AHEAD_DAYS,
  planPushes,
  type PlanInput,
} from '../pushPlan';

// 12 августа 2026, 08:00 локального времени — до утреннего пуша
const MORNING_8AM = new Date(2026, 7, 12, 8, 0);
// то же число, 19:00 — после утреннего, до вечернего
const EVENING_7PM = new Date(2026, 7, 12, 19, 0);

/** База: напоминания и рефлексия включены, карта дня НЕ открыта, серии нет. */
const base: PlanInput = {
  pushesOn: true,
  reflectionOn: true,
  morning: '09:00',
  evening: '21:00',
  streak: 0,
};

const kinds = (input: PlanInput, now: Date) => planPushes(input, now).map((p) => p.kind);
const onDate = (input: PlanInput, now: Date, date: string) =>
  planPushes(input, now).filter((p) => p.date === date);

describe('planPushes — утренний', () => {
  it('карта не открыта — сегодняшний утренний стоит', () => {
    const today = onDate(base, MORNING_8AM, '2026-08-12');
    expect(today.map((p) => p.kind)).toContain('morning');
    expect(today[0].hour).toBe(9);
    expect(today[0].minute).toBe(0);
  });

  it('карта уже открыта — сегодняшнего утреннего нет', () => {
    const today = onDate({ ...base, todayCardId: 'the-tower' }, MORNING_8AM, '2026-08-12');
    expect(today.map((p) => p.kind)).not.toContain('morning');
  });

  it('время сегодняшнего утреннего уже прошло — не планируется', () => {
    const today = onDate(base, EVENING_7PM, '2026-08-12');
    expect(today.map((p) => p.kind)).not.toContain('morning');
  });

  it('утренние ставятся ровно на три дня вперёд', () => {
    const future = planPushes(base, MORNING_8AM).filter(
      (p) => p.kind === 'morning' && p.date > '2026-08-12',
    );
    expect(future.map((p) => p.date)).toEqual(['2026-08-13', '2026-08-14', '2026-08-15']);
    expect(MORNING_AHEAD_DAYS).toBe(3);
  });
});

describe('planPushes — вечерний', () => {
  it('карта открыта, ответа нет — вечерний стоит с названием карты', () => {
    const plan = planPushes({ ...base, todayCardId: 'the-tower' }, MORNING_8AM);
    const evening = plan.find((p) => p.kind === 'evening');
    expect(evening).toBeDefined();
    expect(evening!.date).toBe('2026-08-12');
    expect(evening!.hour).toBe(21);
    expect(evening!.cardId).toBe('the-tower');
  });

  it('карта не открыта — вечернего нет', () => {
    expect(kinds(base, MORNING_8AM)).not.toContain('evening');
  });

  it('ответ уже дан — вечернего нет', () => {
    const input = { ...base, todayCardId: 'the-tower', todayOutcome: 'yes' as const };
    expect(kinds(input, MORNING_8AM)).not.toContain('evening');
  });

  it('рефлексия выключена — вечернего нет', () => {
    const input = { ...base, reflectionOn: false, todayCardId: 'the-tower' };
    expect(kinds(input, MORNING_8AM)).not.toContain('evening');
  });

  it('вечерний ставится только на сегодня, на будущие дни его нет', () => {
    const plan = planPushes({ ...base, todayCardId: 'the-tower' }, MORNING_8AM);
    expect(plan.filter((p) => p.kind === 'evening')).toHaveLength(1);
  });
});

describe('planPushes — спасение серии', () => {
  it('серия 3 и карта не открыта — спасение в 20:00 с числом дней', () => {
    const plan = planPushes({ ...base, streak: 3 }, MORNING_8AM);
    const save = plan.find((p) => p.kind === 'streak');
    expect(save).toBeDefined();
    expect(save!.hour).toBe(20);
    expect(save!.n).toBe(3);
  });

  it('серия 2 — спасения нет', () => {
    expect(kinds({ ...base, streak: 2 }, MORNING_8AM)).not.toContain('streak');
  });

  it('карта открыта — спасать нечего', () => {
    const input = { ...base, streak: 7, todayCardId: 'the-tower' };
    expect(kinds(input, MORNING_8AM)).not.toContain('streak');
  });
});

describe('planPushes — возврат и инварианты', () => {
  it('возвратный ровно один и на четвёртый день', () => {
    const plan = planPushes(base, MORNING_8AM);
    const back = plan.filter((p) => p.kind === 'comeback');
    expect(back).toHaveLength(1);
    expect(back[0].date).toBe('2026-08-16');
    expect(COMEBACK_AFTER_DAYS).toBe(4);
  });

  it('в сутки не больше двух пушей — жёсткий инвариант logic-spec §8', () => {
    // самое населённое состояние: карта не открыта, серия длинная
    const plan = planPushes({ ...base, streak: 12 }, MORNING_8AM);
    const perDay = new Map<string, number>();
    for (const p of plan) perDay.set(p.date, (perDay.get(p.date) ?? 0) + 1);
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(MAX_PER_DAY);
  });

  it('напоминания выключены — план пустой', () => {
    expect(planPushes({ ...base, pushesOn: false, streak: 12 }, MORNING_8AM)).toEqual([]);
  });

  it('один и тот же вход даёт один и тот же план (детерминизм)', () => {
    const a = planPushes({ ...base, streak: 5 }, MORNING_8AM);
    const b = planPushes({ ...base, streak: 5 }, MORNING_8AM);
    expect(a).toEqual(b);
  });

  it('у каждого пуша есть ключ фразы из content/phrases.json', () => {
    const plan = planPushes({ ...base, streak: 5 }, MORNING_8AM);
    expect(plan.length).toBeGreaterThan(0);
    for (const p of plan) expect(p.phraseKey.startsWith('push.')).toBe(true);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тесты падают**

```bash
npx jest src/lib/__tests__/pushPlan.test.ts
```

Ожидание: FAIL — `Cannot find module '../pushPlan'`.

- [ ] **Шаг 3: Написать модуль**

Создать `src/lib/pushPlan.ts`:

```ts
/** Расписание локальных пушей (logic-spec §8) — чистые правила без единого импорта из expo.
 *
 *  Почему не повторяющийся DAILY-триггер: он безусловен, а три правила из четырёх условные —
 *  утренний не нужен, если карта уже открыта, вечерний не нужен без открытой карты и после
 *  ответа, спасение серии зависит от её длины. Поэтому план считается заново на каждое
 *  изменение состояния и ставится конкретными датами (спека 06б, решение 2).
 *
 *  Отсчёт горизонта идёт от СЕГОДНЯ, а не от последнего открытия карты: планировщик работает
 *  только когда приложение открыли, значит сегодняшняя активность гарантирована. Правило
 *  «3+ дня тишины → один возвратный» получается из этого само.
 */
import { localDateISO } from './dates';
import type { Outcome } from './journal';
import { parseHHMM } from './settings';

export type PushKind = 'morning' | 'evening' | 'streak' | 'comeback';

export interface PlannedPush {
  kind: PushKind;
  /** Локальная дата 'YYYY-MM-DD'. */
  date: string;
  hour: number;
  minute: number;
  /** Ключ в content/phrases.json, а НЕ готовый текст: модуль не знает про язык и контент. */
  phraseKey: string;
  /** Подстановка {card} у вечернего. */
  cardId?: string;
  /** Подстановка {n} у спасения серии. */
  n?: number;
}

export interface PlanInput {
  pushesOn: boolean;
  reflectionOn: boolean;
  /** 'HH:MM' */
  morning: string;
  /** 'HH:MM' */
  evening: string;
  streak: number;
  /** Карта дня открыта сегодня. */
  todayCardId?: string;
  /** Ответ вечерней рефлексии уже дан. */
  todayOutcome?: Outcome;
}

/** На сколько дней вперёд ставим утренние, прежде чем замолчать. */
export const MORNING_AHEAD_DAYS = 3;
/** На какой день тишины приходит единственный возвратный пуш. */
export const COMEBACK_AFTER_DAYS = 4;
export const STREAK_SAVE_HOUR = 20;
/** Короче трёх дней серию спасать не зовём — терять почти нечего. */
export const STREAK_MIN = 3;
/** Жёсткий инвариант logic-spec §8. */
export const MAX_PER_DAY = 2;

/** Кого оставляем, когда на день претендует больше двух. */
const PRIORITY: PushKind[] = ['streak', 'evening', 'morning', 'comeback'];

const PHRASE_KEY: Record<PushKind, string> = {
  morning: 'push.morning_card',
  evening: 'push.evening_reflect',
  streak: 'push.streak_save',
  comeback: 'push.winback',
};

/** Локальная дата через N суток. Конструктор Date сам нормализует переход через месяц и год. */
function daysAheadISO(n: number, from: Date): string {
  return localDateISO(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n));
}

/** Момент уже прошёл? Сравнение в локальном времени — как и всё в проекте после аудита H2. */
function isPast(p: PlannedPush, now: Date): boolean {
  const [y, m, d] = p.date.split('-').map(Number);
  return new Date(y, m - 1, d, p.hour, p.minute).getTime() <= now.getTime();
}

export function planPushes(input: PlanInput, now: Date): PlannedPush[] {
  if (!input.pushesOn) return [];

  const morning = parseHHMM(input.morning, 9);
  const evening = parseHHMM(input.evening, 21);
  const today = localDateISO(now);
  const drawn = !!input.todayCardId;
  const out: PlannedPush[] = [];

  // сегодняшний утренний — только пока карта не открыта
  if (!drawn) {
    out.push({ kind: 'morning', date: today, ...morning, phraseKey: PHRASE_KEY.morning });
  }

  // вечерний — только на сегодня: он называет карту по имени, а откроют ли завтрашнюю, неизвестно
  if (input.reflectionOn && drawn && !input.todayOutcome) {
    out.push({
      kind: 'evening',
      date: today,
      ...evening,
      phraseKey: PHRASE_KEY.evening,
      cardId: input.todayCardId,
    });
  }

  // спасение серии — только на сегодня: не открыл сегодня, завтра серия уже сброшена
  if (!drawn && input.streak >= STREAK_MIN) {
    out.push({
      kind: 'streak',
      date: today,
      hour: STREAK_SAVE_HOUR,
      minute: 0,
      phraseKey: PHRASE_KEY.streak,
      n: input.streak,
    });
  }

  // утренние вперёд, затем один возвратный — и тишина до возвращения
  for (let d = 1; d <= MORNING_AHEAD_DAYS; d++) {
    out.push({ kind: 'morning', date: daysAheadISO(d, now), ...morning, phraseKey: PHRASE_KEY.morning });
  }
  out.push({
    kind: 'comeback',
    date: daysAheadISO(COMEBACK_AFTER_DAYS, now),
    ...morning,
    phraseKey: PHRASE_KEY.comeback,
  });

  return capPerDay(out.filter((p) => !isPast(p, now)));
}

/** По построению претендентов на один день никогда не больше двух (спасение серии живёт при
 *  закрытой карте, вечерний — при открытой), но инвариант должен быть выражен в коде и покрыт
 *  тестом, а не держаться на рассуждении. */
function capPerDay(pushes: PlannedPush[]): PlannedPush[] {
  const byDate = new Map<string, PlannedPush[]>();
  for (const p of pushes) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const kept: PlannedPush[] = [];
  for (const list of byDate.values()) {
    list.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
    kept.push(...list.slice(0, MAX_PER_DAY));
  }
  return kept.sort((a, b) =>
    a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1,
  );
}
```

- [ ] **Шаг 4: Убедиться, что тесты проходят**

```bash
npx jest src/lib/__tests__/pushPlan.test.ts
```

Ожидание: PASS, 17 тестов.

- [ ] **Шаг 5: Проверить типы и весь набор тестов**

```bash
npx tsc --noEmit && npm test
```

Ожидание: чисто; сьютов стало 10 (было 8).

- [ ] **Шаг 6: Коммит**

```bash
git add src/lib/pushPlan.ts src/lib/__tests__/pushPlan.test.ts
git commit -m "feat: планировщик пушей — чистые правила расписания (спека 06б)"
```

---

### Задача 4: Общий хук `useAppActive`

**Файлы:**
- Create: `src/lib/useAppActive.ts`
- Modify: `app/(tabs)/index.tsx` (строки 168–176 — инлайновый слушатель; строка 6 — импорт `AppState`)

**Интерфейсы:**
- Produces: `useAppActive(cb: () => void): void`

- [ ] **Шаг 1: Создать хук**

Создать `src/lib/useAppActive.ts`:

```ts
/** Вызывает `cb` каждый раз, когда приложение возвращается из фона.
 *
 *  `useFocusEffect` этого НЕ ловит: он реагирует только на смену фокуса экрана внутри
 *  навигатора, а свёрнутое и заново развёрнутое приложение фокус не меняет. Нашлось финальным
 *  ревью 06а: утром открыл карту → свернул → вечером вернулся, и час оставался утренним.
 *  Всё, что зависит от текущего времени (вечерний блок, планировщик пушей, переход через
 *  полночь, будущая заморозка серии), обязано слушать ещё и AppState.
 */
import React from 'react';
import { AppState } from 'react-native';

export function useAppActive(cb: () => void): void {
  // колбэк держим в ref: иначе подписка пересоздавалась бы на каждый рендер вызывающего
  const ref = React.useRef(cb);
  ref.current = cb;

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ref.current();
    });
    return () => sub.remove();
  }, []);
}
```

- [ ] **Шаг 2: Перевести экран «Сегодня» на общий хук**

В `app/(tabs)/index.tsx` удалить блок с комментарием «возврат из фона фокус экрана НЕ меняет…»
(строки 168–176) и заменить одной строкой:

```ts
  // возврат из фона фокус экрана не меняет — час обновляем ещё и по AppState (06а)
  useAppActive(() => setHour(new Date().getHours()));
```

Добавить импорт:

```ts
import { useAppActive } from '../../src/lib/useAppActive';
```

Убрать `AppState` из импорта `react-native` в строке 6 (остальные имена оставить):

```ts
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
```

- [ ] **Шаг 3: Проверить типы**

```bash
npx tsc --noEmit
```

Ожидание: чисто. Если ругается на неиспользуемый `AppState` — импорт не убрали.

- [ ] **Шаг 4: Проверить, что поведение не изменилось**

Открыть приложение в вебе (`npx expo start --web`, http://localhost:8081), включить в настройках
DEV-строку «Рефлексия: показать сейчас» и убедиться, что блок рефлексии на «Сегодня» появляется
как прежде. Консоль браузера — без новых ошибок.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/useAppActive.ts "app/(tabs)/index.tsx"
git commit -m "refactor: слушатель возврата из фона вынесен в useAppActive (спека 06б)"
```

---

### Задача 5: Адаптер `pushes.ts` над expo-notifications

**Файлы:**
- Create: `src/lib/pushes.ts`
- Modify: `src/lib/i18n.ts` (заголовки баннеров в оба языка)

**Интерфейсы:**
- Consumes: `PlannedPush` из `pushPlan.ts`; `pickPhrase` из `phrases.ts`; `cardById` из `content.ts`
- Produces: `initPushes()`, `getPermission() → Promise<PermissionState>`,
  `requestPermission() → Promise<PermissionState>`, `applyPlan(plan, lang) → Promise<void>`,
  `listScheduled()`, `sendTestPush(lang)`; тип `PermissionState = 'granted' | 'denied' | 'undetermined'`

- [ ] **Шаг 1: Добавить заголовки баннеров в i18n**

В `src/lib/i18n.ts` в русский блок ресурсов добавить секцию `push` рядом с `settings`:

```ts
      // заголовки баннеров: тело пуша берётся из content/phrases.json (правило вариативности),
      // а заголовок — короткая метка типа. Числительное — плюрализацией, иначе «Серия 3 дней»
      push: {
        titleMorning: "Карта дня ✦",
        titleEvening: "Как прошёл день?",
        titleStreak_one: "Серия {{count}} день",
        titleStreak_few: "Серия {{count}} дня",
        titleStreak_many: "Серия {{count}} дней",
        titleComeback: "Давно не виделись",
      },
```

В английский блок:

```ts
      push: {
        titleMorning: "Card of the day ✦",
        titleEvening: "How was your day?",
        titleStreak_one: "{{count}}-day streak",
        titleStreak_other: "{{count}}-day streak",
        titleComeback: "It's been a while",
      },
```

- [ ] **Шаг 2: Написать адаптер**

Создать `src/lib/pushes.ts`:

```ts
/** Единственный модуль, знающий про expo-notifications.
 *
 *  Веб: `expo-notifications` браузер не поддерживает, поэтому все функции здесь на вебе —
 *  пустышки. Это не заглушка «на будущее», а условие проверяемости: экран настроек должен
 *  открываться и прокликиваться в браузере (шаг 6а процесса), даже когда пушей там нет.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { cardById } from './content';
import { localDateISO } from './dates';
import i18n from './i18n';
import { pickPhrase } from './phrases';
import type { PlannedPush, PushKind } from './pushPlan';

const WEB = Platform.OS === 'web';

/** Канал уведомлений Android: без него на Android 8+ уведомления не показываются вовсе. */
const CHANNEL_ID = 'daily';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

let inited = false;

/** Хендлер + канал. Идемпотентна: вызывается из планировщика на каждом пересчёте. */
export async function initPushes(): Promise<void> {
  if (WEB || inited) return;
  inited = true;

  // ⚠️ без этого на iOS баннер не показывается, пока приложение открыто, — и DEV-проверка
  // выглядит так, будто пуш не пришёл вовсе
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t('settings.pushes'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function getPermission(): Promise<PermissionState> {
  if (WEB) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

export async function requestPermission(): Promise<PermissionState> {
  if (WEB) return 'denied';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

const TITLE_KEY: Record<PushKind, string> = {
  morning: 'push.titleMorning',
  evening: 'push.titleEvening',
  streak: 'push.titleStreak',
  comeback: 'push.titleComeback',
};

/** Тело пуша: вариант выбирается по дате самого пуша, поэтому текст стабилен в течение дня
 *  (logic-spec §9) и не меняется при каждом пересчёте плана. */
export function pushBody(p: PlannedPush, lang: 'ru' | 'en'): string {
  const card = p.cardId ? cardById.get(p.cardId) : undefined;
  return pickPhrase(p.phraseKey, p.date, lang, {
    card: card ? card.name[lang] : '',
    n: p.n ?? 0,
  });
}

/** Снимает всё запланированное и ставит план заново. Другого способа выразить условные
 *  правила logic-spec §8 нет: система условий не проверяет, она просто шлёт в срок. */
export async function applyPlan(plan: PlannedPush[], lang: 'ru' | 'en'): Promise<void> {
  if (WEB) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if ((await getPermission()) !== 'granted') return;

  for (const p of plan) {
    const [y, m, d] = p.date.split('-').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t(TITLE_KEY[p.kind], { count: p.n ?? 0 }),
        body: pushBody(p, lang),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(y, m - 1, d, p.hour, p.minute),
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Для DEV-строки «План пушей». */
export async function listScheduled(): Promise<Notifications.NotificationRequest[]> {
  if (WEB) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

/** DEV: пуш через 10 секунд — успеть свернуть приложение и увидеть настоящий баннер. */
export async function sendTestPush(lang: 'ru' | 'en'): Promise<void> {
  if (WEB) return;
  await initPushes();
  const status = (await getPermission()) === 'granted' ? 'granted' : await requestPermission();
  if (status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('push.titleMorning'),
      body: pickPhrase('push.morning_card', localDateISO(), lang),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      channelId: CHANNEL_ID,
    },
  });
}
```

- [ ] **Шаг 3: Проверить типы**

```bash
npx tsc --noEmit
```

Ожидание: чисто. Если ругается на `SchedulableTriggerInputTypes` — пакет не установлен
(задача 1) или не перезапущен dev-сервер.

- [ ] **Шаг 4: Проверить, что веб не сломался**

Открыть http://localhost:8081, пройти по всем пяти табам. Ожидание: приложение работает как
прежде, в консоли браузера нет ошибок про `expo-notifications`.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/pushes.ts src/lib/i18n.ts
git commit -m "feat: адаптер локальных уведомлений с веб-заглушками (спека 06б)"
```

---

### Задача 6: Планировщик в корне приложения

**Файлы:**
- Create: `src/lib/usePushScheduler.ts`
- Modify: `app/_layout.tsx` (вызов хука внутри `RootLayout`)

**Интерфейсы:**
- Consumes: `planPushes` (задача 3), `applyPlan`/`initPushes` (задача 5), `useAppActive` (задача 4)
- Produces: `usePushScheduler(): void`

- [ ] **Шаг 1: Написать хук**

Создать `src/lib/usePushScheduler.ts`:

```ts
/** Связка «состояние → план → системное расписание».
 *
 *  Живёт в корневом layout, вызывается ровно один раз. Пересчёт происходит в пяти точках
 *  из спеки 06б: гидрация стора (первый рендер), возврат приложения из фона, открытие карты
 *  дня, ответ рефлексии и смена настроек — три последних приходят сами через подписку на стор.
 */
import React from 'react';
import { useApp } from '../store/useApp';
import { localDateISO } from './dates';
import { planPushes } from './pushPlan';
import { applyPlan, initPushes } from './pushes';
import { useAppActive } from './useAppActive';

export function usePushScheduler(): void {
  const settings = useApp((s) => s.settings);
  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);
  const lang = useApp((s) => s.lang);

  // возврат из фона состояние стора не меняет, а план устареть успел: наступил вечер,
  // сменились сутки. Тик заставляет эффект пересчитаться
  const [tick, setTick] = React.useState(0);
  useAppActive(() => setTick((n) => n + 1));

  React.useEffect(() => {
    const today = history.find((h) => h.date === localDateISO());
    const plan = planPushes(
      {
        pushesOn: settings.pushesOn,
        reflectionOn: settings.reflectionOn,
        morning: settings.pushMorning,
        evening: settings.pushEvening,
        streak,
        todayCardId: today?.cardId,
        todayOutcome: today?.outcome,
      },
      new Date(),
    );
    initPushes().then(() => applyPlan(plan, lang));
  }, [settings, streak, history, lang, tick]);
}
```

- [ ] **Шаг 2: Подключить в корневой layout**

В `app/_layout.tsx` добавить импорт:

```ts
import { usePushScheduler } from '../src/lib/usePushScheduler';
```

и вызов внутри `RootLayout` сразу после `const [fontsLoaded] = useFonts({...});`:

```ts
  usePushScheduler();
```

⚠️ Вызов должен стоять ДО раннего `if (!fontsLoaded) return null;` — иначе правило хуков нарушится.

- [ ] **Шаг 3: Проверить типы и тесты**

```bash
npx tsc --noEmit && npm test
```

Ожидание: чисто, все сьюты зелёные.

- [ ] **Шаг 4: Проверить веб**

Открыть http://localhost:8081, перезагрузить страницу, пройти по табам, открыть карту дня.
Ожидание: ошибок в консоли нет (в вебе `applyPlan` выходит сразу).

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/usePushScheduler.ts app/_layout.tsx
git commit -m "feat: перепланирование пушей при изменении состояния и возврате из фона (спека 06б)"
```

---

### Задача 7: `TimePicker` — системное колесо и веб-список

**Файлы:**
- Create: `src/components/TimePicker.tsx` (натив)
- Create: `src/components/TimePicker.web.tsx` (веб)

**Интерфейсы:**
- Consumes: `parseHHMM`, `formatHHMM` из `src/lib/settings.ts`
- Produces: компонент `TimePicker` с пропами
  `{ visible: boolean; value: string; title: string; hours: number[]; onPick: (hhmm: string) => void; onClose: () => void }`

Metro сам подставляет `.web.tsx` в веб-сборке, поэтому импорт в экране один:
`import { TimePicker } from '../src/components/TimePicker';`. Прямого импорта
`@react-native-community/datetimepicker` в вебе не случится — у пакета нет веб-реализации.

- [ ] **Шаг 1: Написать нативную реализацию**

Создать `src/components/TimePicker.tsx`:

```tsx
/** Выбор времени напоминания — системный пикер (@react-native-community/datetimepicker,
 *  входит в Expo Go SDK 54). Решение Артёма 12.08: родной жест и минуты важнее единства стиля.
 *  Веб-реализации у пакета нет — она лежит в соседнем TimePicker.web.tsx, Metro подставит его сам.
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { formatHHMM, parseHHMM } from '../lib/settings';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function TimePicker({
  visible,
  value,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** 'HH:MM' */
  value: string;
  title: string;
  /** Список часов используется только веб-реализацией; в нативной проп игнорируется. */
  hours?: number[];
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { hour, minute } = parseHHMM(value, 9);
  const date = React.useMemo(() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [hour, minute]);

  const onChange = (event: DateTimePickerEvent, picked?: Date) => {
    // Android рисует системный диалог сам: 'dismissed' = отмена, 'set' = выбор
    if (event.type === 'dismissed' || !picked) {
      onClose();
      return;
    }
    onPick(formatHHMM(picked.getHours(), picked.getMinutes()));
    if (Platform.OS === 'android') onClose();
  };

  if (!visible) return null;

  // Android: компонент сам открывает системный диалог, обёртка не нужна
  if (Platform.OS === 'android') {
    return <DateTimePicker value={date} mode="time" is24Hour display="default" onChange={onChange} />;
  }

  // iOS: колесо живёт внутри нашей модалки, закрытие — своей кнопкой
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose}>
        <Pressable
          style={[st.panel, { backgroundColor: t.bg, borderColor: t.line }]}
          onPress={() => {}}
        >
          <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
          <DateTimePicker value={date} mode="time" is24Hour display="spinner" onChange={onChange} />
          <Pressable onPress={onClose} style={[st.done, { borderColor: t.frame }]}>
            <Txt style={[st.doneTxt, { color: t.accent }]}>OK</Txt>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.xl,
  },
  title: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.s },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
```

- [ ] **Шаг 2: Написать веб-реализацию**

Создать `src/components/TimePicker.web.tsx`:

```tsx
/** Веб-версия выбора времени: список целых часов.
 *
 *  У @react-native-community/datetimepicker веб-реализации нет вовсе, а без неё экран
 *  «Настройки» нечем прокликать в браузере — то есть шаг 6а процесса по этой задаче
 *  выполнить было бы невозможно. Минуты в вебе не выбираются: там проверяется поведение
 *  экрана, а точное время — на устройстве.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { formatHHMM, parseHHMM } from '../lib/settings';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function TimePicker({
  visible,
  value,
  title,
  hours = [7, 8, 9, 10, 11],
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string;
  title: string;
  hours?: number[];
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const current = parseHHMM(value, hours[0]).hour;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose}>
        <Pressable
          style={[st.panel, { backgroundColor: t.bg, borderColor: t.line }]}
          onPress={() => {}}
        >
          <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
          <ScrollView style={{ maxHeight: 260 }}>
            {hours.map((h) => {
              const selected = h === current;
              return (
                <Pressable
                  key={h}
                  onPress={() => {
                    onPick(formatHHMM(h, 0));
                    onClose();
                  }}
                  style={[
                    st.row,
                    selected && { backgroundColor: t.chipBg, borderColor: t.frame },
                  ]}
                >
                  <Txt style={{ color: selected ? t.head : t.text, fontSize: 15.5, flex: 1 }}>
                    {`${h}:00`}
                  </Txt>
                  {selected && <Txt style={{ color: t.accent, fontSize: 13 }}>✓</Txt>}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.xl,
  },
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.m,
    paddingVertical: 11,
    paddingHorizontal: spacing.m,
    marginBottom: 5,
  },
});
```

- [ ] **Шаг 3: Проверить типы**

```bash
npx tsc --noEmit
```

Ожидание: чисто. Компонент пока никем не используется — это нормально, подключение в задаче 8.

- [ ] **Шаг 4: Коммит**

```bash
git add src/components/TimePicker.tsx src/components/TimePicker.web.tsx
git commit -m "feat: выбор времени напоминания — системное колесо и веб-список (спека 06б)"
```

---

### Задача 8: Строки напоминаний в настройках

**Файлы:**
- Modify: `app/settings.tsx` (после блока «Вечерняя рефлексия», строки 61–68; DEV-блок перенумеровать)
- Modify: `src/lib/i18n.ts` (секция `settings` в обоих языках)

**Интерфейсы:**
- Consumes: `setPushesOn`, `setPushTime` из стора (задача 2); `timeLabel` из `settings.ts`;
  `TimePicker` (задача 7); `getPermission` (задача 5); `useAppActive` (задача 4)

- [ ] **Шаг 1: Добавить строки интерфейса**

В `src/lib/i18n.ts` в русскую секцию `settings` дописать:

```ts
        pushes: "Напоминания",
        pushMorning: "Утреннее",
        pushEvening: "Вечернее",
        pushDenied: "Выключены в системе",
        pushHint: "Ещё напомним, если серия под угрозой, и один раз — если вы давно не заходили",
        pickMorning: "Когда напомнить утром",
        pickEvening: "Когда напомнить вечером",
```

В английскую:

```ts
        pushes: "Reminders",
        pushMorning: "Morning",
        pushEvening: "Evening",
        pushDenied: "Off in system settings",
        pushHint: "We'll also nudge you if your streak is at risk, and once if you've been away",
        pickMorning: "Morning reminder time",
        pickEvening: "Evening reminder time",
```

- [ ] **Шаг 2: Добавить состояние и строки в экран**

В `app/settings.tsx` добавить импорты:

```tsx
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { TimePicker } from '../src/components/TimePicker';
import { Txt } from '../src/components/Txt';
import { getPermission, type PermissionState } from '../src/lib/pushes';
import { timeLabel } from '../src/lib/settings';
import { useAppActive } from '../src/lib/useAppActive';
```

(строку импорта `react-native` заменить целиком — `StyleSheet` и `Linking` новые).

Внутри компонента, после существующих подписок на стор:

```tsx
  const pushesOn = useApp((s) => s.settings.pushesOn);
  const pushMorning = useApp((s) => s.settings.pushMorning);
  const pushEvening = useApp((s) => s.settings.pushEvening);
  const setPushesOn = useApp((s) => s.setPushesOn);
  const setPushTime = useApp((s) => s.setPushTime);

  // какой пикер открыт (null — ни один)
  const [picker, setPicker] = React.useState<'morning' | 'evening' | null>(null);

  // системное разрешение спрашиваем при входе на экран и при возврате из фона:
  // человек мог уйти в системные настройки и вернуться уже с другим ответом
  const [perm, setPerm] = React.useState<PermissionState>('undetermined');
  React.useEffect(() => {
    getPermission().then(setPerm);
  }, []);
  useAppActive(() => {
    getPermission().then(setPerm);
  });

  const denied = perm === 'denied';
```

- [ ] **Шаг 3: Вставить строки после «Вечерней рефлексии»**

Сразу после `<FadeUp index={2}>…</FadeUp>` (блок рефлексии) добавить:

```tsx
        <FadeUp index={3}>
          <SettingsRow
            icon="notifications-outline"
            label={tr('settings.pushes')}
            value={denied ? tr('settings.pushDenied') : pushesOn ? tr('settings.on') : tr('settings.off')}
            onPress={() => (denied ? Linking.openSettings() : setPushesOn(!pushesOn))}
          />
        </FadeUp>
        {pushesOn && !denied && (
          <>
            <FadeUp index={4}>
              <SettingsRow
                icon="sunny-outline"
                label={tr('settings.pushMorning')}
                value={timeLabel(pushMorning)}
                onPress={() => setPicker('morning')}
              />
            </FadeUp>
            <FadeUp index={5}>
              <SettingsRow
                icon="moon-outline"
                label={tr('settings.pushEvening')}
                value={timeLabel(pushEvening)}
                onPress={() => setPicker('evening')}
              />
            </FadeUp>
            {/* единственное место, где можно рассказать про два молчаливых пуша:
                своих тумблеров у спасения серии и возврата нет (спека 06б, решение 4) */}
            <FadeUp index={5}>
              <Txt style={[st.hint, { color: t.muted }]}>{tr('settings.pushHint')}</Txt>
            </FadeUp>
          </>
        )}
```

DEV-блок ниже перенумеровать: `index={3}` → `index={6}`, `index={4}` → `index={7}`.

Перед закрывающим `</ScrollView>` добавить сам пикер:

```tsx
        <TimePicker
          visible={picker !== null}
          value={picker === 'evening' ? pushEvening : pushMorning}
          title={picker === 'evening' ? tr('settings.pickEvening') : tr('settings.pickMorning')}
          hours={picker === 'evening' ? [19, 20, 21, 22, 23] : [7, 8, 9, 10, 11]}
          onPick={(hhmm) => picker && setPushTime(picker, hhmm)}
          onClose={() => setPicker(null)}
        />
```

В конец файла добавить стиль подписи:

```tsx
const st = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 17, marginTop: spacing.s, paddingHorizontal: spacing.xs },
});
```

(`spacing.xs` = 4, `spacing.s` = 8 — `src/theme/theme.ts:86`.)

- [ ] **Шаг 4: Проверить типы**

```bash
npx tsc --noEmit
```

Ожидание: чисто.

- [ ] **Шаг 5: Прокликать в браузере**

http://localhost:8081 → Профиль → шестерёнка. Проверить:
- тумблер «Напоминания» переключается Вкл/Выкл, при «Выкл» две строки времени и подпись исчезают;
- тап по «Утреннее» открывает список 7:00–11:00 с галочкой на текущем; выбор меняет значение
  в строке и закрывает список; тап мимо панели закрывает без изменения;
- тап по «Вечернее» открывает список 19:00–23:00;
- значение переживает перезагрузку страницы;
- консоль без ошибок.

- [ ] **Шаг 6: Снять скриншоты**

Размер окна 390×844, обе темы, папка `docs/screenshots/06b/`: экран настроек с включёнными
и выключенными напоминаниями, открытый список часов.

- [ ] **Шаг 7: Коммит**

```bash
git add app/settings.tsx src/lib/i18n.ts docs/screenshots/06b
git commit -m "feat: строки напоминаний в настройках (спека 06б)"
```

---

### Задача 9: DEV-инструменты проверки

**Файлы:**
- Modify: `src/components/ConfirmDialog.tsx` (новый проп `confirmTone`)
- Modify: `app/settings.tsx` (DEV-блок)
- Modify: `src/lib/i18n.ts` (четыре строки в обоих языках)

**Интерфейсы:**
- Consumes: `sendTestPush`, `listScheduled` из `pushes.ts` (задача 5)
- Produces: `ConfirmDialog` принимает `confirmTone?: 'danger' | 'accent'` (по умолчанию `'danger'`,
  так что все существующие вызовы выглядят как раньше) — им же пользуется прелюдия в задаче 10

- [ ] **Шаг 1: Добавить тон кнопки в `ConfirmDialog`**

Диалог писался под «удалить / уйти без сохранения», поэтому кнопка подтверждения всегда красная.
Здесь и в прелюдии подтверждение не разрушительное, красный цвет читался бы как предупреждение.

В `src/components/ConfirmDialog.tsx` добавить в список пропов после `onCancel`:

```tsx
  confirmTone = 'danger',
```

и в тип:

```tsx
  /** Тон кнопки подтверждения. 'danger' — «удалить / уйти без сохранения» (по умолчанию),
   *  'accent' — когда подтверждение не разрушительное (показ плана пушей, прелюдия разрешения). */
  confirmTone?: 'danger' | 'accent';
```

Заменить кнопку подтверждения целиком:

```tsx
            <PressableScale
              onPress={onConfirm}
              style={[st.btn, { borderColor: confirmTone === 'accent' ? t.frame : t.line }]}
            >
              <Txt style={[st.btnTxt, { color: confirmTone === 'accent' ? t.accent : t.danger }]}>
                {confirmLabel}
              </Txt>
            </PressableScale>
```

- [ ] **Шаг 2: Добавить строки интерфейса**

В русскую секцию `settings`:

```ts
        testPush: "Тестовый пуш (10 сек)",
        showPlan: "План пушей",
        planEmpty: "Ничего не запланировано",
        close: "Закрыть",
```

В английскую:

```ts
        testPush: "Test push (10 sec)",
        showPlan: "Scheduled pushes",
        planEmpty: "Nothing scheduled",
        close: "Close",
```

- [ ] **Шаг 3: Добавить DEV-строки и диалог**

В `app/settings.tsx` импорты:

```tsx
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { listScheduled, sendTestPush } from '../src/lib/pushes';
```

Состояние (рядом с `picker`):

```tsx
  const [planText, setPlanText] = React.useState<string | null>(null);

  // читаемая расшифровка очереди: что и когда система реально пришлёт
  const showPlan = async () => {
    const list = await listScheduled();
    const lines = list.map((r) => {
      const trigger = r.trigger as { type?: string; value?: number };
      const when = typeof trigger?.value === 'number' ? new Date(trigger.value) : null;
      const stamp = when
        ? `${when.getDate()}.${when.getMonth() + 1} ${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')}`
        : '—';
      return `${stamp} · ${r.content.title ?? ''}`;
    });
    setPlanText(lines.length ? lines.join('\n') : tr('settings.planEmpty'));
  };
```

В DEV-блок, после существующих двух строк:

```tsx
            <FadeUp index={8}>
              <SettingsRow
                icon="send-outline"
                label={tr('settings.testPush')}
                value="DEV"
                onPress={() => sendTestPush(lang)}
              />
            </FadeUp>
            <FadeUp index={9}>
              <SettingsRow
                icon="list-outline"
                label={tr('settings.showPlan')}
                value="DEV"
                onPress={showPlan}
              />
            </FadeUp>
```

Рядом с `TimePicker` — диалог показа плана:

```tsx
        <ConfirmDialog
          visible={planText !== null}
          title={tr('settings.showPlan')}
          message={planText ?? ''}
          confirmLabel="OK"
          cancelLabel={tr('settings.close')}
          confirmTone="accent"
          onConfirm={() => setPlanText(null)}
          onCancel={() => setPlanText(null)}
        />
```

- [ ] **Шаг 4: Проверить типы**

```bash
npx tsc --noEmit
```

Ожидание: чисто.

- [ ] **Шаг 5: Проверить в браузере**

Обе DEV-строки видны (веб — это `__DEV__`), тап по «План пушей» открывает диалог с текстом
«Ничего не запланировано» (в вебе `listScheduled` возвращает пустой список), тап по «Тестовый пуш»
ничего не ломает и не даёт ошибок в консоли. Заодно проверить, что старые диалоги не изменились:
на экране заметки выход без сохранения по-прежнему показывает красную кнопку подтверждения.

- [ ] **Шаг 6: Коммит**

```bash
git add src/components/ConfirmDialog.tsx app/settings.tsx src/lib/i18n.ts
git commit -m "feat: DEV-строки для проверки пушей (спека 06б)"
```

---

### Задача 10: Прелюдия разрешения после первой карты

**Файлы:**
- Modify: `app/(tabs)/index.tsx` (диалог после первого переворота)
- Modify: `src/lib/i18n.ts` (секция `push`, обе локали)

**Интерфейсы:**
- Consumes: `requestPermission` из `pushes.ts` (задача 5); `setPushAsked` из стора (задача 2);
  `confirmTone` у `ConfirmDialog` (задача 9)

- [ ] **Шаг 1: Добавить тексты прелюдии**

В `src/lib/i18n.ts` в русскую секцию `push`:

```ts
        preludeTitle: "Напомнить утром?",
        preludeText: "Пришлём одно тихое напоминание, когда придёт время новой карты. Выключить можно в любой момент в настройках.",
        preludeYes: "Напомнить",
        preludeNo: "Не сейчас",
```

В английскую:

```ts
        preludeTitle: "A morning nudge?",
        preludeText: "We'll send one quiet reminder when it's time for a new card. You can turn it off anytime in settings.",
        preludeYes: "Remind me",
        preludeNo: "Not now",
```

- [ ] **Шаг 2: Показать прелюдию после первого переворота**

В `app/(tabs)/index.tsx` импорты:

```tsx
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { requestPermission } from '../../src/lib/pushes';
```

Подписки на стор (рядом с существующими):

```tsx
  const pushAsked = useApp((s) => s.settings.pushAsked);
  const setPushAsked = useApp((s) => s.setPushAsked);
  const [preludeOpen, setPreludeOpen] = React.useState(false);
```

В конец функции `onDraw` (после строки с `STREAK_MILESTONE`):

```tsx
    // прелюдия — только один раз за всё время и только после того, как карта уже открылась:
    // системный диалог даётся однажды навсегда, и показывать его на пустом экране — значит
    // потерять согласие безвозвратно (product-spec §1)
    if (!pushAsked) setTimeout(() => setPreludeOpen(true), FLIP_MS + 600);
```

Перед закрывающим тегом корневого `View` экрана добавить:

```tsx
      <ConfirmDialog
        visible={preludeOpen}
        title={tr('push.preludeTitle')}
        message={tr('push.preludeText')}
        confirmLabel={tr('push.preludeYes')}
        cancelLabel={tr('push.preludeNo')}
        confirmTone="accent"
        onConfirm={() => {
          setPushAsked();
          setPreludeOpen(false);
          requestPermission();
        }}
        onCancel={() => {
          // «Не сейчас» и промах мимо панели — одно и то же: больше не спрашиваем,
          // выключить или включить напоминания можно в настройках
          setPushAsked();
          setPreludeOpen(false);
        }}
      />
```

- [ ] **Шаг 3: Проверить типы и тесты**

```bash
npx tsc --noEmit && npm test
```

Ожидание: чисто, все сьюты зелёные.

- [ ] **Шаг 4: Прокликать в браузере**

Настройки → DEV «Сбросить карту дня», вернуться на «Сегодня», открыть карту. Ожидание: примерно
через секунду после переворота появляется диалог «Напомнить утром?» с золотой кнопкой «Напомнить»
и обычной «Не сейчас». После любого ответа повторный сброс карты и новое открытие прелюдию
больше НЕ показывают.

- [ ] **Шаг 5: Скриншоты**

`docs/screenshots/06b/`: прелюдия в обеих темах, 390×844.

- [ ] **Шаг 6: Коммит**

```bash
git add "app/(tabs)/index.tsx" src/lib/i18n.ts docs/screenshots/06b
git commit -m "feat: прелюдия разрешения на пуши после первой карты (спека 06б)"
```

---

### Задача 11: Синхронизация документации

**Файлы:**
- Modify: `docs/logic-spec.md` (§7 схема, §8 расписание)
- Modify: `docs/product-spec.md` (§1 прелюдия, §5 напоминания)
- Modify: `docs/design-system.md` (§5 подпись под группой строк)
- Modify: `docs/backlog.md` (06б закрыта, пункты в задачу 15)
- Modify: `CLAUDE.md` (раздел «Статус»)

- [ ] **Шаг 1: `logic-spec §7`**

В схему хранения добавить `pushAsked` и поднять версию:

```
`{ schemaVersion: 3, installSeed, profile: {...}, themeMode, lang, streak, lastDrawDate, freezes,
xp, history: DailyDraw[365], lessonsProgress: {...}, spreadsHistory: SpreadDraw[100],
settings: {reflectionOn: true, pushesOn: true, pushMorning: '09:00', pushEvening: '21:00', pushAsked: false} }`
```

В абзаце про ловушку поверхностного слияния заменить «06б добавит … и обязана поднять `version`
до 3» на «06б подняла до 3, добавив `pushesOn`/`pushMorning`/`pushEvening`/`pushAsked`;
следующая задача с новым полем в `settings` обязана поднять до 4».

- [ ] **Шаг 2: `logic-spec §8`**

Дописать под существующий текст:

```
**Как это реализовано (06б).** План считается заново на каждое изменение состояния и ставится
конкретными датами (`SchedulableTriggerInputTypes.DATE`), а не повторяющимся DAILY: система
условий не проверяет, а три правила из четырёх условные. Горизонт — от сегодня: утренние на 3 дня
вперёд, на 4-й день один возвратный, дальше тишина до возвращения. Вечерний и спасение серии
ставятся ТОЛЬКО на сегодня (вечерний называет карту по имени, а откроют ли завтрашнюю —
неизвестно; серия после пропущенного дня уже сброшена). Приоритет при обрезке до 2 пушей в день:
спасение серии > вечерний > утренний > возврат. Чистые правила — `src/lib/pushPlan.ts`
(16 юнит-тестов), работа с системой — `src/lib/pushes.ts`.
```

- [ ] **Шаг 3: `product-spec §1` и `§5`**

В §1 заменить «системный запрос пушей с прелюдией («Напомнить о карте завтра утром?» → кнопка →
системный диалог)» на точные кнопки:

```
**После первой карты:** прелюдия «Напомнить утром?» с кнопками «Напомнить» / «Не сейчас»
(показывается один раз за всё время, флаг `settings.pushAsked`); «Напомнить» открывает системный
диалог. Отказ не переспрашиваем — включить можно в настройках.
```

В §5 в строке про настройки заменить «Напоминания 🔨(06б)» на:

```
Напоминания ✅ (тумблер + время утреннего и вечернего + подпись про молчаливые пуши; отдельного
экрана нет — решение 12.08)
```

- [ ] **Шаг 4: `design-system §5`**

Добавить абзац про подпись под группой строк настроек:

```
**Подпись-пояснение под группой строк настроек:** Manrope 12/17, цвет `muted`, отступ сверху
`spacing.s`, горизонтальный отступ 4. Нужна там, где поведение есть, а тумблера у него нет
(спасение серии и возвратный пуш, задача 06б).
```

- [ ] **Шаг 5: `backlog.md`**

Строку 06б заменить на закрытую (`[x]`) с итогом; в задачу 15 дописать два пункта:

```
      Дописано 12.08 при спеке 06б — две правки: (и) строка «Напоминания · 9:00 · 21:00» выглядит
      переходом на отдельный экран, а в приложении это тумблер + две строки времени + подпись
      про молчаливые пуши; (к) прелюдии разрешения на пуши в макете нет вовсе, хотя это первый
      экранный момент новичка после первой карты.
```

- [ ] **Шаг 6: `CLAUDE.md`**

В раздел «Статус» добавить абзац про 06б: что сделано, ловушки (`DAILY` не годится для условных
правил; веб не проверяет ни пуши, ни системный пикер; `useAppActive` теперь общий), что выросло
общего (`useAppActive`, `settings.ts`, `TimePicker` с `.web.tsx`, `confirmTone` у `ConfirmDialog`),
новое число тестов.

- [ ] **Шаг 7: Финальная проверка и коммит**

```bash
npx tsc --noEmit && npm test
git add docs CLAUDE.md
git commit -m "docs: синхронизация доков после задачи 06б"
git push
```

---

## Проверка после всех задач

**Веб (делаю сам, шаги 6а/6б процесса):**
- скриншоты 390×844 в обеих темах в `docs/screenshots/06b/`: настройки с включёнными и
  выключенными напоминаниями, список часов, прелюдия;
- прокликать каждый элемент: тумблер, обе строки времени, список часов, обе DEV-строки, прелюдию;
- консоль браузера без ошибок и без предупреждений про `expo-notifications`.

**Телефон (Артём, шаг 6в):**
- «DEV · тестовый пуш» → свернуть приложение → баннер через 10 секунд с текстом и заголовком;
- «DEV · план пушей» в четырёх состояниях: карта не открыта; карта открыта без ответа;
  карта открыта с ответом; серия ≥ 3 при закрытой карте — список совпадает с таблицей правил;
- системное колесо выбора времени, смена времени меняет план;
- прелюдия после первой карты, отказ в системном диалоге → строка «Выключены в системе» → тап
  открывает системные настройки;
- реальная доставка утреннего пуша на следующий день и отсутствие лишних после открытия карты.
