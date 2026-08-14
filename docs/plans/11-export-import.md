# План 11 · Экспорт/импорт данных (бэкап)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователь сохраняет все данные (дневник, серию, XP, курс, профиль, настройки) в один JSON-файл через системный share sheet и восстанавливает их из файла с полной заменой текущего состояния.

**Architecture:** Формат и строгая валидация «всё или ничего» — чистый модуль `src/lib/backup.ts` (ошибки кодами-ключами i18n, приём `pushPlan`). Файловая часть — тонкий `src/lib/backupIo.ts` с веб-парой `backupIo.web.ts` (приём `pushes.web.ts`). Стор получает экшен `restoreBackup` и переезжает на `PERSIST_DEFAULTS`/`SCHEMA_VERSION` из backup.ts — дефолты и версия схемы лежат по одному разу, а тип-контроль в сторе не даст будущей задаче добавить поле, не решив судьбу его бэкапа. Persist version остаётся 7.

**Tech Stack:** Expo SDK 54 (НЕ обновлять), новый API `expo-file-system` (`File`/`Paths`; legacy НЕ использовать), `expo-sharing`, `expo-document-picker`, zustand/persist, jest-expo, react-i18next.

**Spec:** `docs/specs/11-export-import.md` — читать перед выполнением; решения 1–5 согласованы Артёмом 14.08.

## Global Constraints

- Ветка `feat/11-export-import`; merge в main только после лайв-проверки Артёма.
- После КАЖДОГО шага с правкой кода: `npx tsc --noEmit` — чисто.
- Новая формула → тест в том же коммите; `npm test` зелёный перед каждым коммитом. Сейчас 330 тестов в 19 сьютах.
- Комментарии в коде и сообщения коммитов — русские; никаких упоминаний ИИ/Claude/Anthropic, никаких Co-Authored-By трейлеров.
- `backup.ts` остаётся чистым: ни одного импорта из expo/react (импорт `content.ts`/`settings.ts`/`journal.ts`/`dates.ts` и type-only импорты типов — можно).
- Persist version НЕ поднимается (остаётся 7); схема стора не меняется.
- Пакеты ставить ТОЛЬКО через `npx expo install` (подберёт версии SDK 54: `expo-file-system@~19.0.23`, `expo-sharing@~14.0.8`, `expo-document-picker@~14.0.8`). Мажорные версии ничего не трогать.
- ⚠️ В SDK 54 у `expo-file-system` дефолтный импорт — НОВЫЙ класс-ориентированный API (`File`, `Directory`, `Paths`); старый (`writeAsStringAsync`, `cacheDirectory`) переехал в `expo-file-system/legacy` и в этом плане не используется.
- Тексты диалогов — тон design-system §8: без «Ошибка!» и приказов.

---

### Task 1: Ветка + пакеты

**Files:**
- Modify: `package.json`, `package-lock.json` (через `npx expo install`)

**Interfaces:**
- Produces: установленные `expo-file-system`, `expo-sharing`, `expo-document-picker` — их импортирует Task 7.

- [ ] **Step 1: Создать ветку и закоммитить план**

```bash
git checkout -b feat/11-export-import
git add docs/plans/11-export-import.md
git commit -m "docs: план задачи 11 — экспорт/импорт данных (spec 11)"
```

(Спека уже в main отдельным коммитом.)

- [ ] **Step 2: Поставить пакеты**

```bash
npx expo install expo-file-system expo-sharing expo-document-picker
```

Проверить в `package.json`: версии `~19.0.23` / `~14.0.8` / `~14.0.8`, ничего больше не изменилось.

- [ ] **Step 3: tsc и коммит**

Run: `npx tsc --noEmit` — чисто.

```bash
git add package.json package-lock.json
git commit -m "chore: пакеты для бэкапа — file-system, sharing, document-picker (spec 11)"
```

⚠️ Сказать Артёму: `package.json` изменился — при следующем запуске нужен перезапуск
`npx expo start --tunnel` (npm install уже сделан самим `expo install`; все три пакета
входят в Expo Go SDK 54, пересборка клиента не нужна).

---

### Task 2: Каркас `src/lib/backup.ts` — типы, дефолты, сборка файла (TDD)

**Files:**
- Create: `src/lib/backup.ts`
- Create: `src/lib/__tests__/backup.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`, тип `AppSettings` (`src/lib/settings.ts`); типы `DailyDraw` (`src/lib/journal.ts`), `LessonProgressMap` (`src/lib/courseProgress.ts`), `Profile` (`src/lib/birthArcana.ts`), `ThemeMode` (`src/theme/theme.ts`), `Lang` (type-only из `src/store/useApp.ts` — тип-импорт стирается при компиляции, runtime-цикла нет); `localDateISO` (`src/lib/dates.ts`).
- Produces (на них встают Task 3, 4, 8):
  - `SCHEMA_VERSION = 7` — единственный источник версии persist (стор переедет на него в Task 4)
  - `interface BackupState` — 13 персистуемых ключей
  - `PERSIST_DEFAULTS: BackupState` — дефолты персистуемого состояния (стор переедет на них в Task 4)
  - `BACKUP_KEYS: (keyof BackupState)[]`
  - `interface BackupFile { app: 'arcanum'; kind: 'backup'; schemaVersion: number; exportedAt: string; state: BackupState }`
  - `buildBackup(state: BackupState, schemaVersion: number, exportedAt: string): BackupFile`
  - `backupFileName(dateISO: string): string`
  - `backupSummary(p: { state: BackupState; exportedAt: string }): { entries: number; streak: number; dateISO: string }`

- [ ] **Step 1: Написать падающие тесты**

Файл `src/lib/__tests__/backup.test.ts` (первая часть; Task 3 допишет тесты `parseBackup` в этот же файл):

```ts
import { localDateISO } from '../dates';
import {
  BACKUP_KEYS,
  backupFileName,
  backupSummary,
  buildBackup,
  PERSIST_DEFAULTS,
  SCHEMA_VERSION,
  type BackupState,
} from '../backup';

// момент экспорта задаём локальным конструктором: тест не должен зависеть от таймзоны раннера
const AT_DATE = new Date(2026, 7, 14, 12, 0, 0);
const AT = AT_DATE.toISOString();

// валидное состояние со всеми необязательными полями — общая опора и для тестов Task 3
export const VALID: BackupState = {
  themeMode: 'light',
  lang: 'en',
  installSeed: 123456,
  streak: 5,
  lastDrawDate: '2026-08-14',
  freezes: 2,
  freezeMonth: '2026-08',
  freezeSpentDate: null,
  history: [
    { date: '2026-08-14', cardId: 'fool', reversed: false, note: 'запись', outcome: 'yes' },
    { date: '2026-08-13', cardId: 'magician', reversed: false },
  ],
  lessonsProgress: { m1l1: { done: true, errors: 1, ts: 1755000000000, repeatDate: '2026-08-13' } },
  xp: 42,
  settings: { reflectionOn: false, pushesOn: true, pushMorning: '08:00', pushEvening: '22:00', pushAsked: true },
  profile: { name: 'Аня', birthDate: '1993-03-09', birthArcanaId: 'high-priestess', onboarded: true },
};

describe('buildBackup — сборка файла (спека 11)', () => {
  it('конверт заполнен, в state только белый список — dev-поля и функции не утекают', () => {
    const dirty = { ...VALID, devReflect: true, drawToday: () => {} } as unknown as BackupState;
    const f = buildBackup(dirty, SCHEMA_VERSION, AT);
    expect(f.app).toBe('arcanum');
    expect(f.kind).toBe('backup');
    expect(f.schemaVersion).toBe(SCHEMA_VERSION);
    expect(f.exportedAt).toBe(AT);
    expect(Object.keys(f.state).sort()).toEqual([...BACKUP_KEYS].sort());
  });
});

describe('белый список и дефолты', () => {
  it('ключи бэкапа = персистуемая схема v7 — новое поле стора требует осознанного решения здесь', () => {
    expect([...BACKUP_KEYS].sort()).toEqual([
      'freezeMonth', 'freezeSpentDate', 'freezes', 'history', 'installSeed', 'lang',
      'lastDrawDate', 'lessonsProgress', 'profile', 'settings', 'streak', 'themeMode', 'xp',
    ]);
  });
  it('дефолты совпадают с дефолтами стора до задачи 11', () => {
    expect(PERSIST_DEFAULTS.freezes).toBe(1);
    expect(PERSIST_DEFAULTS.settings.pushMorning).toBe('09:00');
    expect(PERSIST_DEFAULTS.profile).toEqual({ onboarded: false });
  });
});

describe('имя файла и сводка', () => {
  it('имя с локальной датой', () => {
    expect(backupFileName('2026-08-14')).toBe('arcanum-backup-2026-08-14.json');
  });
  it('сводка для диалога подтверждения; день бэкапа — локальный', () => {
    expect(backupSummary({ state: VALID, exportedAt: AT })).toEqual({
      entries: 2,
      streak: 5,
      dateISO: localDateISO(AT_DATE),
    });
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test -- backup`
Expected: FAIL — `Cannot find module '../backup'`.

- [ ] **Step 3: Написать `src/lib/backup.ts` (каркас)**

```ts
/** Бэкап (спека 11): формат файла экспорта, дефолты персистуемой схемы и строгая
 *  валидация при импорте. Чистый модуль без импортов expo/react — целиком под юнит-тестами.
 *  Ошибки отдаются КОДАМИ (ключи i18n), а не готовым текстом — приём pushPlan.
 *
 *  Здесь же живут SCHEMA_VERSION и PERSIST_DEFAULTS, которыми пользуется стор:
 *  версия схемы и дефолты лежат по одному разу, а бэкап по построению совпадает
 *  с тем, что реально персистится. */
import type { Profile } from './birthArcana';
import type { LessonProgressMap } from './courseProgress';
import { localDateISO } from './dates';
import type { DailyDraw } from './journal';
import { DEFAULT_SETTINGS, type AppSettings } from './settings';
import type { ThemeMode } from '../theme/theme';
// type-only импорт стирается при компиляции — runtime-цикла со стором нет,
// хотя стор импортирует этот модуль по-настоящему
import type { Lang } from '../store/useApp';

/** Версия персистуемой схемы (logic-spec §7). Единственный источник: стор берёт её отсюда.
 *  Следующая задача, меняющая схему, поднимает ЭТУ константу до 8. */
export const SCHEMA_VERSION = 7;

/** Персистуемое состояние стора — ровно то, что уходит в бэкап (белый список).
 *  Dev-поля (devReflect) сюда не входят; полноту следит тип-контроль в useApp.ts. */
export interface BackupState {
  themeMode: ThemeMode;
  lang: Lang;
  installSeed: number;
  streak: number;
  lastDrawDate: string | null;
  freezes: number;
  freezeMonth: string | null;
  freezeSpentDate: string | null;
  history: DailyDraw[];
  lessonsProgress: LessonProgressMap;
  xp: number;
  settings: AppSettings;
  profile: Profile;
}

/** Дефолты персистуемой схемы — на них стоит и стор, и доливка старых бэкапов. */
export const PERSIST_DEFAULTS: BackupState = {
  themeMode: 'dark',
  lang: 'ru',
  installSeed: 0,
  streak: 0,
  lastDrawDate: null,
  freezes: 1,
  freezeMonth: null,
  freezeSpentDate: null,
  history: [],
  lessonsProgress: {},
  xp: 0,
  settings: DEFAULT_SETTINGS,
  profile: { onboarded: false },
};

export const BACKUP_KEYS = Object.keys(PERSIST_DEFAULTS) as (keyof BackupState)[];

/** Конверт файла бэкапа (спека 11). */
export interface BackupFile {
  app: 'arcanum';
  kind: 'backup';
  schemaVersion: number;
  exportedAt: string;
  state: BackupState;
}

/** Собирает файл экспорта: из состояния стора берётся ТОЛЬКО белый список. */
export function buildBackup(state: BackupState, schemaVersion: number, exportedAt: string): BackupFile {
  const picked = {} as BackupState;
  // прогон по белому списку, а не spread: у getState() кроме данных есть экшены и dev-поля
  for (const k of BACKUP_KEYS) (picked as Record<string, unknown>)[k] = state[k];
  return { app: 'arcanum', kind: 'backup', schemaVersion, exportedAt, state: picked };
}

export function backupFileName(dateISO: string): string {
  return `arcanum-backup-${dateISO}.json`;
}

/** Сводка для диалога подтверждения импорта. День бэкапа — локальный, как все даты проекта. */
export function backupSummary(p: { state: BackupState; exportedAt: string }): {
  entries: number;
  streak: number;
  dateISO: string;
} {
  return {
    entries: p.state.history.length,
    streak: p.state.streak,
    dateISO: localDateISO(new Date(p.exportedAt)),
  };
}
```

⚠️ `(picked as Record<string, unknown>)[k]` — если tsc не пропустит такой каст напрямую,
писать `(picked as unknown as Record<string, unknown>)[k]`.

- [ ] **Step 4: Тесты зелёные, tsc чистый**

Run: `npm test -- backup` → PASS; `npx tsc --noEmit` → чисто; `npm test` → все сьюты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backup.ts src/lib/__tests__/backup.test.ts
git commit -m "feat: формат бэкапа — конверт, белый список, дефолты схемы (spec 11)"
```

---

### Task 3: `parseBackup` — строгая валидация (TDD)

**Files:**
- Modify: `src/lib/backup.ts` (дописать в конец)
- Modify: `src/lib/__tests__/backup.test.ts` (дописать)
- Modify: `src/lib/journal.ts` (одна константа)

**Interfaces:**
- Consumes: `cardById` (`src/lib/content.ts`), `mergeSettings` (`src/lib/settings.ts`), всё из Task 2.
- Produces (на них встают Task 4 и 8):
  - `HISTORY_MAX = 365` в `src/lib/journal.ts`
  - `type ParseError = 'notBackup' | 'newerVersion' | 'corrupt'`
  - `type ParsedBackup = { ok: true; state: BackupState; exportedAt: string } | { ok: false; error: ParseError }`
  - `parseBackup(text: string, currentVersion: number): ParsedBackup`

- [ ] **Step 1: Дописать падающие тесты**

В конец `src/lib/__tests__/backup.test.ts` (импорт дополнить: `parseBackup`, `type ParsedBackup` не нужен):

```ts
const fileOf = (state: BackupState) => JSON.stringify(buildBackup(state, SCHEMA_VERSION, AT));

describe('parseBackup — круговой (спека 11)', () => {
  it('экспорт → импорт возвращает то же состояние', () => {
    expect(parseBackup(fileOf(VALID), SCHEMA_VERSION)).toEqual({ ok: true, state: VALID, exportedAt: AT });
  });
});

describe('parseBackup — отказы конверта', () => {
  it.each([
    ['не JSON', 'это не файл бэкапа'],
    ['JSON без конверта', JSON.stringify({ hello: 1 })],
    ['чужой kind', JSON.stringify({ app: 'arcanum', kind: 'export', schemaVersion: SCHEMA_VERSION, exportedAt: AT, state: {} })],
    ['exportedAt не дата', JSON.stringify({ app: 'arcanum', kind: 'backup', schemaVersion: SCHEMA_VERSION, exportedAt: 'вчера', state: {} })],
  ])('%s → notBackup', (_name, text) => {
    expect(parseBackup(text, SCHEMA_VERSION)).toEqual({ ok: false, error: 'notBackup' });
  });

  it('schemaVersion новее текущей → newerVersion (схему из будущего не накатываем)', () => {
    const f = { ...JSON.parse(fileOf(VALID)), schemaVersion: SCHEMA_VERSION + 1 };
    expect(parseBackup(JSON.stringify(f), SCHEMA_VERSION)).toEqual({ ok: false, error: 'newerVersion' });
  });
});

describe('parseBackup — доливка старых бэкапов (та же логика, что у гидрации persist)', () => {
  it('бэкап без поздних ключей получает дефолты, настройки — через mergeSettings', () => {
    const old = JSON.parse(fileOf(VALID));
    delete old.state.xp;
    delete old.state.freezes;
    delete old.state.freezeMonth;
    delete old.state.freezeSpentDate;
    old.state.settings = { reflectionOn: false };
    old.schemaVersion = 2;
    const r = parseBackup(JSON.stringify(old), SCHEMA_VERSION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.xp).toBe(0);
    expect(r.state.freezes).toBe(1);
    expect(r.state.settings).toEqual({
      reflectionOn: false, pushesOn: true, pushMorning: '09:00', pushEvening: '21:00', pushAsked: false,
    });
  });
});

describe('parseBackup — битые данные → corrupt (всё или ничего)', () => {
  const broken = (patch: (s: Record<string, any>) => void) => {
    const f = JSON.parse(fileOf(VALID));
    patch(f.state);
    return JSON.stringify(f);
  };
  it.each<[string, (s: Record<string, any>) => void]>([
    ['дата записи не ISO', (s) => { s.history[0].date = '14.08.2026'; }],
    ['неизвестная карта', (s) => { s.history[0].cardId = 'nope'; }],
    ['reversed строкой', (s) => { s.history[0].reversed = 'yes'; }],
    ['outcome вне тройки', (s) => { s.history[0].outcome = 'maybe'; }],
    ['history длиннее лимита', (s) => {
      s.history = Array.from({ length: 366 }, () => ({ date: '2026-01-01', cardId: 'fool', reversed: false }));
    }],
    ['streak строкой', (s) => { s.streak = '5'; }],
    ['тема вне пары', (s) => { s.themeMode = 'blue'; }],
    ['урок без done', (s) => { s.lessonsProgress = { m1l1: { errors: 0, ts: 1 } }; }],
    ['profile без onboarded', (s) => { s.profile = { name: 'Аня' }; }],
    ['настройки битых типов', (s) => { s.settings = { reflectionOn: 'да' }; }],
    ['freezeMonth не YYYY-MM', (s) => { s.freezeMonth = 'август'; }],
  ])('%s', (_name, patch) => {
    expect(parseBackup(broken(patch), SCHEMA_VERSION)).toEqual({ ok: false, error: 'corrupt' });
  });
});
```

- [ ] **Step 2: Убедиться, что новые тесты падают**

Run: `npm test -- backup`
Expected: FAIL — `parseBackup is not a function` (старые тесты Task 2 зелёные).

- [ ] **Step 3: `HISTORY_MAX` в journal.ts**

В `src/lib/journal.ts` рядом с `NOTE_MAX` добавить:

```ts
/** Предел истории карт дня (logic-spec §7): старые записи отрезаются. */
export const HISTORY_MAX = 365;
```

- [ ] **Step 4: Дописать валидацию в `src/lib/backup.ts`**

Импорты дополнить: `import { cardById } from './content';`, `mergeSettings` — в существующую
строку импорта из `./settings`, `HISTORY_MAX` и тип `Outcome` — в импорт из `./journal`
(`import { HISTORY_MAX, type DailyDraw, type Outcome } from './journal';`). В конец файла:

```ts
export type ParseError = 'notBackup' | 'newerVersion' | 'corrupt';
export type ParsedBackup =
  | { ok: true; state: BackupState; exportedAt: string }
  | { ok: false; error: ParseError };

// узкие проверки: JSON пришёл снаружи, каждому полю — свой тип
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;
const isISODay = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}$/.test(v);
const isHHMM = (v: unknown): v is string => isStr(v) && /^\d{1,2}:\d{2}$/.test(v);
const isOutcome = (v: unknown): v is Outcome => v === 'yes' || v === 'partly' || v === 'no';
const orNull = (v: unknown, check: (x: unknown) => boolean) => v === null || check(v);
const orAbsent = (v: unknown, check: (x: unknown) => boolean) => v === undefined || check(v);

// cardId проверяем по колоде: 78 карт — полный и вечный набор, чужой id означает чужой
// или битый файл. Id уроков против course НЕ проверяем сознательно: контент растёт без
// смены schemaVersion (М3–М6), и бэкап с новыми уроками обязан открываться старым контентом.
const isDraw = (v: unknown): boolean =>
  isObj(v) && isISODay(v.date) && isStr(v.cardId) && cardById.has(v.cardId) &&
  isBool(v.reversed) && orAbsent(v.outcome, isOutcome) && orAbsent(v.note, isStr);

const isLesson = (v: unknown): boolean =>
  isObj(v) && isBool(v.done) && isCount(v.errors) && isNum(v.ts) && orAbsent(v.repeatDate, isISODay);

// после mergeSettings все ключи на месте — проверяем типы значений (слияние типы не проверяет)
const isSettings = (v: AppSettings): boolean =>
  isBool(v.reflectionOn) && isBool(v.pushesOn) &&
  isHHMM(v.pushMorning) && isHHMM(v.pushEvening) && isBool(v.pushAsked);

const isProfile = (v: unknown): boolean =>
  isObj(v) && isBool(v.onboarded) && orAbsent(v.name, isStr) &&
  orAbsent(v.birthDate, isISODay) &&
  orAbsent(v.birthArcanaId, (x) => isStr(x) && cardById.has(x));

const validState = (s: BackupState): boolean =>
  (s.themeMode === 'dark' || s.themeMode === 'light') &&
  (s.lang === 'ru' || s.lang === 'en') &&
  isCount(s.installSeed) && isCount(s.streak) &&
  orNull(s.lastDrawDate, isISODay) &&
  isCount(s.freezes) && orNull(s.freezeMonth, isMonth) && orNull(s.freezeSpentDate, isISODay) &&
  Array.isArray(s.history) && s.history.length <= HISTORY_MAX && s.history.every(isDraw) &&
  isObj(s.lessonsProgress) && Object.values(s.lessonsProgress).every(isLesson) &&
  isCount(s.xp) && isSettings(s.settings) && isProfile(s.profile);

/** Разбор и валидация файла бэкапа (спека 11): строгая, «всё или ничего».
 *  Порядок: конверт → версия → доливка дефолтов (как у гидрации persist) → типы полей. */
export function parseBackup(text: string, currentVersion: number): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notBackup' };
  }
  if (
    !isObj(raw) || raw.app !== 'arcanum' || raw.kind !== 'backup' ||
    !isNum(raw.schemaVersion) || !isStr(raw.exportedAt) ||
    Number.isNaN(Date.parse(raw.exportedAt)) || !isObj(raw.state)
  ) {
    return { ok: false, error: 'notBackup' };
  }
  // схему из будущего не накатываем: поля, которых текущий код не знает, прошли бы молча
  if (raw.schemaVersion > currentVersion) return { ok: false, error: 'newerVersion' };

  const src = raw.state;
  // доливка — ровно та же, что у гидрации persist: поверхностно по верхнему уровню…
  const state: BackupState = { ...PERSIST_DEFAULTS };
  for (const k of BACKUP_KEYS) {
    if (src[k] !== undefined) (state as Record<string, unknown>)[k] = src[k];
  }
  // …и mergeSettings для вложенного settings (ловушка поверхностного слияния, logic-spec §7)
  state.settings = mergeSettings(isObj(src.settings) ? (src.settings as Partial<AppSettings>) : null);

  if (!validState(state)) return { ok: false, error: 'corrupt' };
  return { ok: true, state, exportedAt: raw.exportedAt };
}
```

⚠️ Как и в Task 2: если tsc не пропустит каст `(state as Record<string, unknown>)[k]`,
писать `(state as unknown as Record<string, unknown>)[k]`.

- [ ] **Step 5: Тесты зелёные, tsc чистый**

Run: `npm test -- backup` → PASS (все describe); `npx tsc --noEmit` → чисто; `npm test` → зелёный.

- [ ] **Step 6: Commit**

```bash
git add src/lib/backup.ts src/lib/__tests__/backup.test.ts src/lib/journal.ts
git commit -m "feat: parseBackup — строгая валидация импорта бэкапа (spec 11)"
```

---

### Task 4: Стор — `restoreBackup`, единые дефолты и версия схемы

**Files:**
- Modify: `src/store/useApp.ts`

**Interfaces:**
- Consumes: `PERSIST_DEFAULTS`, `SCHEMA_VERSION`, тип `BackupState` (Task 2); `HISTORY_MAX` (Task 3).
- Produces: экшен `restoreBackup(s: BackupState): void`; `export interface AppState` (нужен тип-контролю и будущим задачам).

- [ ] **Step 1: Правки `src/store/useApp.ts`**

1. Импорты: добавить
   ```ts
   import { PERSIST_DEFAULTS, SCHEMA_VERSION, type BackupState } from '../lib/backup';
   ```
   в импорт из `../lib/journal` добавить `HISTORY_MAX`; из импорта `../lib/settings` убрать
   `DEFAULT_SETTINGS` (остаются `mergeSettings, type AppSettings` — дефолт теперь приходит
   в составе `PERSIST_DEFAULTS`).
2. `interface AppState` → `export interface AppState` и добавить в него:
   ```ts
   /** Импорт бэкапа (спека 11): полная замена персистуемых данных. Сюда приходит
    *  УЖЕ валидированное состояние — файл разбирает parseBackup. */
   restoreBackup: (s: BackupState) => void;
   ```
3. Дефолты в `create`: заменить 13 строк от `themeMode: 'dark',` до `profile: { onboarded: false },`
   включительно на:
   ```ts
   // дефолты персистуемой схемы лежат в backup.ts (PERSIST_DEFAULTS): бэкап по построению
   // совпадает с тем, что персистится, и доливает старые файлы теми же значениями
   ...PERSIST_DEFAULTS,
   ```
   Строка `devReflect: false,` остаётся.
4. В `drawToday` заменить `.slice(0, 365)` на `.slice(0, HISTORY_MAX)`.
5. Экшен (рядом с `syncFreezeGrant`):
   ```ts
   // Импорт бэкапа (спека 11): полная замена. Persist сам записывает новое состояние,
   // план пушей пересчитывает подписка usePushScheduler, тему и язык применяют
   // существующие подписки — здесь только сама замена и два шага гигиены.
   restoreBackup: (s) => {
     set({
       ...s,
       // очень старый или правленный руками файл мог прийти без сида —
       // назначаем свежий, как это делает onRehydrateStorage после гидрации
       ...(s.installSeed === 0
         ? { installSeed: 1 + Math.floor(Math.random() * (2 ** 31 - 1)) }
         : {}),
     });
     // бэкап прошлого месяца сразу доначисляет заморозку нового, не ожидая перезапуска
     get().syncFreezeGrant();
   },
   ```
6. В опциях persist: `version: 7,` → `version: SCHEMA_VERSION,` и дописать в конец
   соседнего комментария строку:
   ```
   // Значение живёт в src/lib/backup.ts (SCHEMA_VERSION): им же parseBackup отсекает
   // файлы из более новых версий приложения. Поднимать — там.
   ```
7. В конец файла — тип-контроль полноты бэкапа:
   ```ts
   // Контроль полноты бэкапа на уровне типов (спека 11): каждое НЕ-функциональное поле
   // состояния обязано быть либо в белом списке бэкапа (BackupState), либо явно причислено
   // к dev-полям. Добавили поле в стор и не решили судьбу его бэкапа — не соберётся tsc,
   // а имя забытого поля будет прямо в тексте ошибки.
   type DataKeys = {
     [K in keyof AppState]: AppState[K] extends (...args: never[]) => unknown ? never : K;
   }[keyof AppState];
   type OutsideBackup = Exclude<DataKeys, keyof BackupState | 'devReflect'>;
   const backupCovers: OutsideBackup extends never ? true : OutsideBackup = true;
   void backupCovers;
   ```

- [ ] **Step 2: Проверка компилятора и тестов**

Run: `npx tsc --noEmit` → чисто; `npm test` → зелёный (дефолты не изменились по значениям —
это проверяет тест «дефолты совпадают…» из Task 2).

Контроль работоспособности тип-контроля (не коммитить!): временно добавить в `AppState`
поле `probe: number;` → `npx tsc --noEmit` ОБЯЗАН упасть с ошибкой, содержащей `probe`.
Убрать поле, tsc снова чист. Если не падает — тип-контроль написан неверно, чинить до красноты.

- [ ] **Step 3: Commit**

```bash
git add src/store/useApp.ts
git commit -m "feat: restoreBackup в сторе + единые дефолты и версия схемы из backup.ts (spec 11)"
```

---

### Task 5: `ConfirmDialog` — режим «сообщение» (одна кнопка)

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `cancelLabel?: string; onCancel?: () => void` — без них кнопка отмены не рендерится,
  скрим закрывает через `onConfirm`. Существующие вызовы (двухкнопочные) не меняются.

- [ ] **Step 1: Правка компонента**

В типах пропсов: `cancelLabel: string;` → `cancelLabel?: string;`, `onCancel: () => void;` →
`onCancel?: () => void;`. В JSX:

```tsx
<ModalPanel visible={visible} onClose={onCancel ?? onConfirm}>
  <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
  <Txt style={[st.msg, { color: t.muted }]}>{message}</Txt>
  <View style={st.row}>
    {cancelLabel != null && (
      <PressableScale onPress={onCancel} style={[st.btn, { borderColor: t.frame }]}>
        <Txt style={[st.btnTxt, { color: t.accent }]}>{cancelLabel}</Txt>
      </PressableScale>
    )}
    <PressableScale
      onPress={onConfirm}
      style={[st.btn, { borderColor: confirmTone === 'accent' ? t.frame : t.line }]}
    >
      <Txt style={[st.btnTxt, { color: confirmTone === 'accent' ? t.accent : t.danger }]}>
        {confirmLabel}
      </Txt>
    </PressableScale>
  </View>
</ModalPanel>
```

В шапку-комментарий файла дописать: `Без cancelLabel — режим «сообщение» с одной кнопкой
(диалоги исхода импорта, спека 11); скрим тогда закрывает через onConfirm.`

- [ ] **Step 2: tsc и коммит**

Run: `npx tsc --noEmit` → чисто (все существующие вызовы передают обе кнопки — сигнатура
обратно совместима); `npm test` → зелёный.

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "feat: ConfirmDialog — режим сообщения с одной кнопкой (spec 11)"
```

---

### Task 6: Строки i18n (ru + en)

**Files:**
- Modify: `src/lib/i18n.ts`

**Interfaces:**
- Produces: ключи `settings.exportData … settings.importErrCorrupt` — их читает Task 8.
  Имена ключей — ровно как ниже (Task 8 ссылается на них строками).

- [ ] **Step 1: Добавить ключи**

В ru-блок `settings: {…}` (строка ~103, перед `planEmpty`):

```ts
// бэкап (спека 11); тон — design-system §8: без «Ошибка!» и приказов
exportData: "Экспорт данных",
importData: "Импорт из файла",
importConfirmTitle: "Восстановить данные?",
// «Записей: N» вместо числительного — форма без склонений, плюрализация не нужна (урок hf-02)
importConfirmText: "Бэкап от {{date}}. Записей дневника: {{entries}}, серия: {{streak}}. Текущие данные будут заменены.",
importConfirm: "Восстановить",
importCancel: "Отмена",
importDoneTitle: "Данные восстановлены",
importDoneText: "Дневник, прогресс и настройки — снова с вами.",
errTitle: "Не получилось",
exportErr: "Не удалось подготовить файл. Попробуйте ещё раз.",
importErrNotBackup: "Файл не похож на бэкап Arcanum.",
importErrNewer: "Файл создан в более новой версии приложения. Обновите приложение и попробуйте снова.",
importErrCorrupt: "Файл повреждён — восстановить из него не получится.",
```

В en-блок `settings: {…}` (строка ~260, симметрично):

```ts
// бэкап (спека 11)
exportData: "Export data",
importData: "Import from file",
importConfirmTitle: "Restore data?",
importConfirmText: "Backup from {{date}}. Journal entries: {{entries}}, streak: {{streak}}. Current data will be replaced.",
importConfirm: "Restore",
importCancel: "Cancel",
importDoneTitle: "Data restored",
importDoneText: "Your journal, progress and settings are back.",
errTitle: "Something went wrong",
exportErr: "Couldn't prepare the file. Please try again.",
importErrNotBackup: "This file doesn't look like an Arcanum backup.",
importErrNewer: "This file was created in a newer app version. Update the app and try again.",
importErrCorrupt: "The file is damaged and can't be restored.",
```

- [ ] **Step 2: Проверки и коммит**

Run: `npx tsc --noEmit` → чисто; `npm test` → зелёный (сьют i18nPlurals гоняет структурные
проверки по `Object.keys(resources)` — новые ключи без `{{count}}` его не задевают).

```bash
git add src/lib/i18n.ts
git commit -m "feat: строки бэкапа в i18n, ru и en (spec 11)"
```

---

### Task 7: Файловая часть — `backupIo.ts` + `backupIo.web.ts`

**Files:**
- Create: `src/lib/backupIo.ts`
- Create: `src/lib/backupIo.web.ts`

**Interfaces:**
- Consumes: `expo-file-system` (НОВЫЙ API: `File`, `Paths`), `expo-sharing`, `expo-document-picker` (Task 1).
- Produces (Task 8 зависит от точных имён):
  - `shareBackup(json: string, fileName: string): Promise<void>`
  - `pickBackupText(): Promise<string | null>` — `null` = человек передумал (не ошибка)

- [ ] **Step 1: Написать `src/lib/backupIo.ts` (натив)**

```ts
/** Файловая часть бэкапа (спека 11) — единственный модуль, знающий про file-system,
 *  sharing и document-picker. Веб-реализация — backupIo.web.ts, Metro подставит сам
 *  (приём pushes.web.ts). Формат и валидация — в чистом backup.ts. */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Пишет JSON во временный файл и открывает системный share sheet. */
export async function shareBackup(json: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing is not available');
  const file = new File(Paths.cache, fileName);
  // overwrite: без него повторный экспорт в тот же день упал бы на существующем файле
  file.create({ overwrite: true });
  file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json', // Android: тип для Intent
    UTI: 'public.json',           // iOS: тип для share sheet
  });
}

/** Системный выбор файла и чтение его текста. null — выбор отменён. */
export async function pickBackupText(): Promise<string | null> {
  // фильтр по MIME не ставим: iOS сопоставляет .json с public.json/public.data ненадёжно,
  // и файлы в пикере оказываются серыми (expo/expo#8029) — пропускаем всё,
  // содержимое всё равно валидирует parseBackup
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled) return null;
  return new File(res.assets[0].uri).text();
}
```

- [ ] **Step 2: Написать `src/lib/backupIo.web.ts`**

```ts
/** Веб-версия файловой части бэкапа: экспорт — скачивание файла, импорт — <input type="file">.
 *  Ни одного импорта expo — чтобы веб-бандл не тянул нативные модули (приём pushes.web.ts). */

export async function shareBackup(json: string, fileName: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    // отмену диалога современные браузеры отдают событием cancel; где его нет,
    // промис просто остаётся висеть — экран ничего не ждёт в подвешенном состоянии
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
```

- [ ] **Step 3: tsc и коммит**

Run: `npx tsc --noEmit` → чисто (DOM-типы доступны: tsconfig наследует `lib: ["DOM", "ESNext"]`
из expo/tsconfig.base). `npm test` → зелёный (модуль никем не импортируется в тестах).

```bash
git add src/lib/backupIo.ts src/lib/backupIo.web.ts
git commit -m "feat: файловая часть бэкапа — share sheet и выбор файла, натив и веб (spec 11)"
```

---

### Task 8: Экран настроек — строки и диалоги

**Files:**
- Modify: `app/settings.tsx`

**Interfaces:**
- Consumes: `buildBackup`/`parseBackup`/`backupFileName`/`backupSummary`/`SCHEMA_VERSION`/типы
  (Tasks 2–3), `restoreBackup` (Task 4), `ConfirmDialog` с одной кнопкой (Task 5), ключи i18n
  (Task 6), `shareBackup`/`pickBackupText` (Task 7), `formatFullDate`/`localDateISO` (`src/lib/dates.ts`).

- [ ] **Step 1: Импорты и состояние**

В `app/settings.tsx` добавить импорты:

```ts
import {
  backupFileName,
  backupSummary,
  buildBackup,
  parseBackup,
  SCHEMA_VERSION,
  type BackupState,
  type ParseError,
} from '../src/lib/backup';
import { pickBackupText, shareBackup } from '../src/lib/backupIo';
import { formatFullDate, localDateISO } from '../src/lib/dates';
```

На уровень модуля (рядом с `st`):

```ts
// код ошибки parseBackup → ключ текста; тексты в i18n, коды в чистом модуле (приём pushPlan)
const ERR_TEXT: Record<ParseError, string> = {
  notBackup: 'settings.importErrNotBackup',
  newerVersion: 'settings.importErrNewer',
  corrupt: 'settings.importErrCorrupt',
};
```

В компонент (рядом с `planText`):

```ts
const restoreBackup = useApp((s) => s.restoreBackup);
// импорт: сначала подтверждение со сводкой файла, после — уведомление об исходе.
// В notice лежат КЛЮЧИ i18n, а не готовый текст: язык может смениться самим импортом,
// и уведомление обязано выйти уже на языке из бэкапа
const [importAsk, setImportAsk] = React.useState<
  { state: BackupState; entries: number; streak: number; dateISO: string } | null
>(null);
const [notice, setNotice] = React.useState<{ titleKey: string; textKey: string } | null>(null);
```

- [ ] **Step 2: Обработчики (в компонент, рядом с `showPlan`)**

```ts
const onExport = async () => {
  try {
    const file = buildBackup(useApp.getState(), SCHEMA_VERSION, new Date().toISOString());
    await shareBackup(JSON.stringify(file, null, 2), backupFileName(localDateISO()));
  } catch (err) {
    // сбой записи или шаринга не должен молчать: иначе «поделился или нет» неотличимо
    console.warn('[backup] экспорт не удался:', err);
    setNotice({ titleKey: 'settings.errTitle', textKey: 'settings.exportErr' });
  }
};

const onImport = async () => {
  try {
    const text = await pickBackupText();
    if (text === null) return; // передумал в системном пикере — это не ошибка, молчим
    const parsed = parseBackup(text, SCHEMA_VERSION);
    if (!parsed.ok) {
      setNotice({ titleKey: 'settings.errTitle', textKey: ERR_TEXT[parsed.error] });
      return;
    }
    setImportAsk({ state: parsed.state, ...backupSummary(parsed) });
  } catch (err) {
    // не прочитался сам файл (права, обрыв) — по смыслу для человека то же «повреждён»
    console.warn('[backup] импорт не удался:', err);
    setNotice({ titleKey: 'settings.errTitle', textKey: 'settings.importErrCorrupt' });
  }
};
```

- [ ] **Step 3: Строки и диалоги в JSX**

После закрывающей скобки блока `{pushesOn && !denied && (…)}` и ПЕРЕД `{__DEV__ && (…)}`:

```tsx
<FadeUp index={6}>
  <SettingsRow icon="share-outline" label={tr('settings.exportData')} value="" onPress={onExport} />
</FadeUp>
<FadeUp index={6}>
  <SettingsRow icon="folder-open-outline" label={tr('settings.importData')} value="" onPress={onImport} />
</FadeUp>
```

(Индекс 6 у обеих строк — одним блоком, как соседние DEV-строки с повторным 7; DEV-индексы
не перенумеровываем.)

Рядом с существующим `<ConfirmDialog>` плана пушей — два новых диалога:

```tsx
<ConfirmDialog
  visible={importAsk !== null}
  title={tr('settings.importConfirmTitle')}
  message={
    importAsk
      ? tr('settings.importConfirmText', {
          date: formatFullDate(importAsk.dateISO, lang),
          entries: importAsk.entries,
          streak: importAsk.streak,
        })
      : ''
  }
  confirmLabel={tr('settings.importConfirm')}
  cancelLabel={tr('settings.importCancel')}
  onConfirm={() => {
    if (importAsk) restoreBackup(importAsk.state);
    setImportAsk(null);
    setNotice({ titleKey: 'settings.importDoneTitle', textKey: 'settings.importDoneText' });
  }}
  onCancel={() => setImportAsk(null)}
/>
<ConfirmDialog
  visible={notice !== null}
  title={notice ? tr(notice.titleKey) : ''}
  message={notice ? tr(notice.textKey) : ''}
  confirmLabel={tr('settings.ok')}
  confirmTone="accent"
  onConfirm={() => setNotice(null)}
/>
```

- [ ] **Step 4: tsc, тесты, быстрый прогон в вебе**

Run: `npx tsc --noEmit` → чисто; `npm test` → зелёный. Затем на запущенном dev-сервере
(http://localhost:8081) открыть Настройки: обе строки видны, экспорт скачивает
`arcanum-backup-<сегодня>.json`, импорт этого же файла показывает подтверждение со сводкой
и после «Восстановить» — «Данные восстановлены». Консоль — без новых ошибок.

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: экспорт и импорт бэкапа на экране настроек (spec 11)"
```

---

### Task 9: Проверка 6а/6б, синхронизация доков, финальное ревью

**Files:**
- Create: `docs/screenshots/11/` (скриншоты)
- Modify: `docs/product-spec.md` (§5), `docs/logic-spec.md` (§7), `docs/backlog.md`, `CLAUDE.md` (статус),
  `docs/specs/11-export-import.md` (отчёт)

- [ ] **Step 1: Подготовить файлы-фикстуры для проверки импорта**

В скратчпаде (не в репо) собрать три файла: `good.json` — свежий экспорт из приложения;
`future.json` — тот же файл со `schemaVersion: 8`; `broken.json` — тот же файл с
`"reversed": "yes"` в первой записи. Плюс `not-backup.txt` с произвольным текстом.

- [ ] **Step 2: Веб-проверка 6б (прокликивание)**

На http://localhost:8081, обе строки настроек:

- Экспорт: файл скачивается, имя с сегодняшней локальной датой, JSON читаем, `devReflect`
  в `state` отсутствует.
- Импорт `good.json`: подтверждение показывает дату/записи/серию → «Восстановить» →
  «Данные восстановлены»; дневник, серия, XP, тема и язык соответствуют файлу; «Отмена»
  в диалоге ничего не меняет.
- Импорт `good.json` с другой темой/языком внутри — тема и язык переключаются сразу.
- Импорт `future.json` → «…более новой версии…», данные не тронуты.
- Импорт `broken.json` → «Файл повреждён…», данные не тронуты.
- Импорт `not-backup.txt` → «Файл не похож на бэкап…».
- Отмена системного выбора файла → ничего не происходит.
- Консоль браузера — без новых ошибок и предупреждений (ошибки Fast Refresh «X is not defined»
  на полусохранённом модуле — перезагрузить страницу и мерить заново).

- [ ] **Step 3: Веб-проверка 6а (скриншоты)**

Скриншоты экрана настроек 390×844 в ОБЕИХ темах → `docs/screenshots/11/settings-dark.png`,
`settings-light.png`, плюс открытый диалог подтверждения импорта → `import-confirm-dark.png`.
⚠️ Окно Chrome на Windows не сжимается до 390 — снимать Playwright-скриптом с явным
`viewport: {width: 390, height: 844}` (как в задаче 16) и проверять `window.innerWidth`.
Сравнить композицию строк с существующими строками настроек (эталона именно этого экрана
в макете нет — строки повторяют паттерн `SettingsRow`, это и есть критерий).

- [ ] **Step 4: Синхронизация доков**

- `docs/product-spec.md` §5: «Экспорт дневника 🔨(11)» → «Экспорт данных и импорт из файла
  ✅(11): бэкап всего состояния в JSON через share sheet, восстановление с полной заменой
  и подтверждением» (правило 6а-0 — расхождение имени зафиксировано в спеке).
- `docs/logic-spec.md` §7: строку «Экспорт (backlog: бэкап) — JSON-файл через Share, импорт
  с валидацией схемы» дополнить: «✅ реализовано (спека 11): формат и валидация —
  `src/lib/backup.ts`; константа версии схемы — `SCHEMA_VERSION` там же, поле `version`
  в опциях persist берёт её оттуда».
- `docs/backlog.md`: задача 11 → `[~]` с кратким итогом (в `[x]` переведёт только лайв-проверка).
- `CLAUDE.md` раздел «Статус»: абзац о задаче 11 (что сделано, новое общее, счёт тестов).
- `docs/specs/11-export-import.md`: дописать отчёт о реализации и веб-проверке, отметить
  выполненные критерии приёмки (кроме лайв-пунктов).

```bash
git add docs/product-spec.md docs/logic-spec.md docs/backlog.md CLAUDE.md docs/specs/11-export-import.md docs/screenshots/11
git commit -m "docs: задача 11 — отчёт веб-проверки и синхронизация доков (spec 11)"
```

- [ ] **Step 5: Финальное ревью ветки**

Прочитать весь дифф ветки одним куском (`git diff main...HEAD`) глазами ревьюера: дубли,
несогласованность имён, забытые каты, поведение при гонках (двойной тап по строкам экспорт/импорт),
`npm test` и `npx tsc --noEmit` — финальный прогон. Найденное — чинить и коммитить до чистого прохода.

- [ ] **Step 6: Передать Артёму на лайв-проверку**

Чек-лист для iPhone (пункт 6в, задачу закрывает только он):
- «Экспорт данных» → share sheet → «Сохранить в Файлы» → файл открывается и читается;
- полный круг: экспорт → DEV-сброс онбординга и прогресса → импорт из Файлов → всё вернулось
  (дневник с заметками и ✓/≈/✗, серия, заморозки, XP, курс, имя, аркан, настройки), онбординг
  не показался;
- после импорта DEV-«План пушей» согласуется с восстановленными данными;
- после импорта на устройстве с невыданным разрешением прелюдия пушей спрашивает заново;
  DEV-«План пушей» показывает план и ненулевую очередь ОС после выдачи разрешения;
- импорт `broken.json`/`future.json` из Файлов — понятные отказы;
- отмена share sheet и отмена пикера — ничего не ломают.

После ✓ — merge в main (`git checkout main && git merge --no-ff feat/11-export-import`),
отметка `[x]` в backlog, push.

---

## Самопроверка плана (пройдена при написании)

- Покрытие спеки: формат/конверт — Task 2; валидация 4 правил — Task 3; `restoreBackup` +
  installSeed + syncFreezeGrant — Task 4; одна кнопка ConfirmDialog — Task 5; тексты — Task 6;
  файлы/share/picker + веб-пути — Task 7; UI и диалоги — Task 8; контракт полноты — тип-контроль
  (Task 4) + тест белого списка (Task 2); критерии приёмки и доки — Task 9. Persist version 7 —
  не меняется нигде.
- Имена сквозные: `SCHEMA_VERSION`, `PERSIST_DEFAULTS`, `BACKUP_KEYS`, `BackupState`,
  `parseBackup/ParsedBackup/ParseError`, `restoreBackup`, `shareBackup/pickBackupText`,
  `backupFileName/backupSummary`, `HISTORY_MAX` — совпадают между задачами.
- Заглушек и «доделать потом» нет; каждый код-шаг содержит готовый код.
