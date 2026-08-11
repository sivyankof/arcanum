# План реализации 06а · Вечерняя рефлексия

> **Для исполнителя:** план задуман под пошаговое исполнение — одна задача за раз, после каждой
> `npx tsc --noEmit`, чекбоксы отмечать по ходу. Спека: `docs/specs/06a-evening-reflection.md`.

**Цель:** вечером на экране «Сегодня» появляется вопрос «как отозвалась карта» с тремя кнопками;
ответ ложится в запись дневника и оживляет отметки, фильтры и сводки, оставленные пустыми задачей 05.

**Архитектура:** вся арифметика — чистые функции в `src/lib` (`journal.ts`, `reflection.ts`,
`phrases.ts`) под юнит-тестами; UI собирается из уже существующих компонентов (`Block`, `NotePlate`,
`EmptyState`, `SettingsRow`), новых ровно два — `Reflection` и общий `FilterChips`, вынесенный
из справочника. Ответ хранится в той же записи `history`, что и заметка, — новых хранилищ нет.

**Стек:** Expo SDK 54, React Native 0.81, expo-router v6, zustand + persist (AsyncStorage),
react-i18next, react-native-reanimated 4, jest-expo.

## Глобальные ограничения

- **SDK не трогаем.** Expo SDK 54, никаких `expo upgrade` и мажорных бампов. `npm install`
  в этой задаче не нужен вовсе — новых пакетов нет.
- **Цвета только из `src/theme/theme.ts`** через `useTheme()`. Хардкод цветов запрещён.
- **Комментарии в коде — по-русски.** Сообщения коммитов — по-русски.
- **`npx tsc --noEmit` без ошибок после каждой задачи**, `npm test` зелёный перед push.
- **Формулировки ответов — «Отозвалась / Отчасти / Не отозвалась»** (EN: Resonated / Partly /
  Not really). Слово «сбылось» запрещено content-guide и logic-spec §3 — в коде, в контенте
  и в i18n его быть не должно.
- **`Math.random` для выбора текста запрещён** (logic-spec §9) — только хеш от даты и ключа.
- **`Alert.alert` не использовать** — в react-native-web это пустая заглушка; подтверждения —
  через `ConfirmDialog` (в этой задаче они не нужны).
- **Ветка не заводится** — задачи до 07 идут в `main` (правило CLAUDE.md).

---

### Задача 1: Арифметика ответов в `src/lib/journal.ts`

**Файлы:**
- Изменить: `src/lib/journal.ts`
- Изменить: `src/lib/__tests__/journal.test.ts`
- Изменить (переименование): `src/store/useApp.ts`, `app/note/[date].tsx`

**Интерфейсы:**
- Отдаёт дальше: `type Outcome = 'yes' | 'partly' | 'no'`; `OUTCOME_MARK: Record<Outcome, string>`;
  `type JournalFilter = 'all' | Outcome | 'note'`; `JOURNAL_FILTERS: JournalFilter[]`;
  `outcomeStats(history, month): OutcomeStats`; `filterEntries(entries, filter): DailyDraw[]`;
  `filterCounts(entries): Record<JournalFilter, number>`; `canEditEntry(date, today?): boolean`;
  `CardHistory` получает поле `resonated: number`.

- [ ] **Шаг 1: Написать падающие тесты**

В `src/lib/__tests__/journal.test.ts` заменить блок импортов на:

```ts
import { localDateISO } from '../dates';
import {
  canEditEntry,
  cardHistory,
  entriesOfMonth,
  filterCounts,
  filterEntries,
  monthSummary,
  monthsWithEntries,
  normalizeNote,
  NOTE_MAX,
  outcomeStats,
  type DailyDraw,
  type Outcome,
} from '../journal';
```

Под хелпером `d(...)` добавить второй хелпер:

```ts
/** Запись с ответом рефлексии. */
const o = (date: string, cardId: string, outcome: Outcome, note?: string): DailyDraw => ({
  ...d(date, cardId, note),
  outcome,
});
```

Существующий `describe('canEditNote', …)` переименовать в `canEditEntry` и заменить вызовы
внутри него на `canEditEntry`.

В существующем `describe('cardHistory')` в тесте «карта не выпадала» добавить в ожидаемый объект
`resonated: 0` — иначе тест упадёт на новом поле:

```ts
  it('карта не выпадала — пустая история', () => {
    expect(cardHistory(history, 'tower')).toEqual({
      times: 0,
      resonated: 0,
      lastDate: undefined,
      lastNote: undefined,
    });
  });
```

В конец файла добавить новые блоки:

```ts
describe('outcomeStats', () => {
  const history = [
    o('2026-08-11', 'moon', 'yes'),
    o('2026-08-10', 'sun', 'partly'),
    o('2026-08-09', 'star', 'no'),
    o('2026-08-08', 'moon', 'yes'),
    d('2026-08-07', 'tower'), // без ответа — в знаменатель не идёт
    o('2026-07-30', 'moon', 'yes'), // чужой месяц
  ];

  it('считает ответы по видам', () => {
    const s = outcomeStats(history, '2026-08');
    expect(s.yes).toBe(2);
    expect(s.partly).toBe(1);
    expect(s.no).toBe(1);
  });

  it('знаменатель — только дни С ОТВЕТОМ, запись без ответа не считается', () => {
    expect(outcomeStats(history, '2026-08').answered).toBe(4);
  });

  it('отозвалось = «да» + «отчасти»', () => {
    expect(outcomeStats(history, '2026-08').resonated).toBe(3);
  });

  it('соседний месяц не подмешивается', () => {
    expect(outcomeStats(history, '2026-07').answered).toBe(1);
  });

  it('месяц без ответов даёт нули', () => {
    expect(outcomeStats([d('2026-06-01', 'moon')], '2026-06')).toEqual({
      answered: 0, resonated: 0, yes: 0, partly: 0, no: 0,
    });
  });
});

describe('filterEntries', () => {
  const entries = [
    o('2026-08-11', 'moon', 'yes', 'с заметкой'),
    o('2026-08-10', 'sun', 'partly'),
    o('2026-08-09', 'star', 'no'),
    d('2026-08-08', 'tower', 'только заметка'),
  ];

  it('«все» отдаёт список как есть', () => {
    expect(filterEntries(entries, 'all')).toHaveLength(4);
  });

  it('фильтр по ответу', () => {
    expect(filterEntries(entries, 'yes').map((e) => e.cardId)).toEqual(['moon']);
    expect(filterEntries(entries, 'partly').map((e) => e.cardId)).toEqual(['sun']);
    expect(filterEntries(entries, 'no').map((e) => e.cardId)).toEqual(['star']);
  });

  it('«с заметкой» не зависит от ответа', () => {
    expect(filterEntries(entries, 'note').map((e) => e.cardId)).toEqual(['moon', 'tower']);
  });
});

describe('filterCounts', () => {
  it('даёт число для каждого чипа', () => {
    const entries = [
      o('2026-08-11', 'moon', 'yes', 'с заметкой'),
      o('2026-08-10', 'sun', 'yes'),
      d('2026-08-09', 'star'),
    ];
    expect(filterCounts(entries)).toEqual({ all: 3, yes: 2, partly: 0, no: 0, note: 1 });
  });
});

describe('cardHistory · отзывалась', () => {
  it('считает «да» и «отчасти», записи без ответа не в счёт', () => {
    const history = [
      o('2026-08-11', 'moon', 'yes'),
      o('2026-08-04', 'moon', 'partly'),
      o('2026-07-20', 'moon', 'no'),
      d('2026-07-10', 'moon'),
    ];
    const h = cardHistory(history, 'moon');
    expect(h.times).toBe(4);
    expect(h.resonated).toBe(2);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тесты падают**

Запустить: `npm test -- journal`
Ожидается: FAIL — `canEditEntry`, `outcomeStats`, `filterEntries`, `filterCounts` не экспортируются.

- [ ] **Шаг 3: Реализовать в `src/lib/journal.ts`**

Тип записи и новые типы (заменить существующие объявления `DailyDraw` и `CardHistory`):

```ts
/** Ответ вечерней рефлексии (logic-spec §3). */
export type Outcome = 'yes' | 'partly' | 'no';

/** Знак ответа в интерфейсе: строка дневника, чипы-фильтры, свёрнутая строка рефлексии. */
export const OUTCOME_MARK: Record<Outcome, string> = { yes: '✓', partly: '≈', no: '✗' };

/** Запись дня: карта дня, заметка и вечерняя рефлексия. */
export interface DailyDraw {
  date: string; // YYYY-MM-DD
  cardId: string;
  reversed: boolean;
  note?: string;
  outcome?: Outcome;
}

/** Фильтры ленты дневника (product-spec §5). */
export type JournalFilter = 'all' | Outcome | 'note';
export const JOURNAL_FILTERS: JournalFilter[] = ['all', 'yes', 'partly', 'no', 'note'];

/** Сводка рефлексий месяца: для строки «Отозвалось X из Y» и полоски распределения. */
export interface OutcomeStats {
  answered: number;   // дни С ОТВЕТОМ — знаменатель
  resonated: number;  // yes + partly
  yes: number;
  partly: number;
  no: number;
}

/** Личная история одной карты для блока на её странице. */
export interface CardHistory {
  times: number;
  resonated: number;
  lastDate?: string;
  lastNote?: string;
}
```

Переименовать функцию (доккомментарий тоже поправить — правило одно на заметку и на ответ):

```ts
/** Правка разрешена только за сегодня: в полночь запись фиксируется (logic-spec §3).
 *  Одно правило и для заметки, и для ответа рефлексии. */
export function canEditEntry(date: string, today: string = localDateISO()): boolean {
  return date === today;
}
```

В `cardHistory` добавить подсчёт (остальное тело не трогать):

```ts
  return {
    times: entries.length,
    resonated: entries.filter((e) => e.outcome === 'yes' || e.outcome === 'partly').length,
    lastDate: entries[0]?.date,
    lastNote: entries.find((e) => e.note)?.note,
  };
```

В конец файла добавить:

```ts
/** Сводка ответов за месяц. Знаменатель — дни С ОТВЕТОМ, а не все записи месяца:
 *  «Отозвалось 12 из 18» читается как «из 18 дней, когда вы отвечали» (logic-spec §3). */
export function outcomeStats(history: DailyDraw[], month: string): OutcomeStats {
  const entries = entriesOfMonth(history, month);
  const yes = entries.filter((e) => e.outcome === 'yes').length;
  const partly = entries.filter((e) => e.outcome === 'partly').length;
  const no = entries.filter((e) => e.outcome === 'no').length;
  return { answered: yes + partly + no, resonated: yes + partly, yes, partly, no };
}

/** Записи, попавшие под фильтр ленты. */
export function filterEntries(entries: DailyDraw[], filter: JournalFilter): DailyDraw[] {
  if (filter === 'all') return entries;
  if (filter === 'note') return entries.filter((e) => !!e.note);
  return entries.filter((e) => e.outcome === filter);
}

/** Числа для чипов-фильтров. Чип с нулём не показывается, поэтому счёт нужен заранее. */
export function filterCounts(entries: DailyDraw[]): Record<JournalFilter, number> {
  return {
    all: entries.length,
    yes: filterEntries(entries, 'yes').length,
    partly: filterEntries(entries, 'partly').length,
    no: filterEntries(entries, 'no').length,
    note: filterEntries(entries, 'note').length,
  };
}
```

- [ ] **Шаг 4: Починить два места, где использовалось старое имя**

`src/store/useApp.ts` — в импорте и в теле `setNote`:

```ts
import { canEditEntry, normalizeNote, type DailyDraw } from '../lib/journal';
```
```ts
        if (!canEditEntry(date)) return;
```

`app/note/[date].tsx` — в импорте и в вычислении `editable`:

```ts
import { canEditEntry, normalizeNote, NOTE_MAX } from '../../src/lib/journal';
```
```ts
  const editable = !!entry && canEditEntry(date ?? '');
```

- [ ] **Шаг 5: Проверить**

Запустить: `npm test -- journal`
Ожидается: PASS, все блоки зелёные.

Запустить: `npx tsc --noEmit`
Ожидается: пусто (ни одной ошибки).

- [ ] **Шаг 6: Коммит**

```bash
git add src/lib/journal.ts src/lib/__tests__/journal.test.ts src/store/useApp.ts "app/note/[date].tsx"
git commit -m "feat: арифметика ответов рефлексии в journal.ts (spec 06а)"
```

---

### Задача 2: Правило показа блока — `src/lib/reflection.ts`

**Файлы:**
- Создать: `src/lib/reflection.ts`
- Создать: `src/lib/__tests__/reflection.test.ts`

**Интерфейсы:**
- Использует: ничего (чистый модуль без зависимостей).
- Отдаёт дальше: `REFLECT_HOUR = 18`; `reflectionVisible({ drawn, hour, enabled, devForce }): boolean`.

- [ ] **Шаг 1: Написать падающий тест**

Создать `src/lib/__tests__/reflection.test.ts`:

```ts
import { REFLECT_HOUR, reflectionVisible } from '../reflection';

/** База: карта открыта, вечер, тумблер включён. Каждый тест ломает ровно одно условие. */
const base = { drawn: true, hour: 20, enabled: true };

describe('reflectionVisible', () => {
  it('вечером при открытой карте блок виден', () => {
    expect(reflectionVisible(base)).toBe(true);
  });

  it('карта дня не открыта — блока нет даже вечером', () => {
    expect(reflectionVisible({ ...base, drawn: false })).toBe(false);
  });

  it('карта дня не открыта — DEV-обход времени не помогает', () => {
    expect(reflectionVisible({ ...base, drawn: false, devForce: true })).toBe(false);
  });

  it('до 18:00 блока нет', () => {
    expect(reflectionVisible({ ...base, hour: REFLECT_HOUR - 1 })).toBe(false);
  });

  it('ровно в 18:00 блок появляется', () => {
    expect(reflectionVisible({ ...base, hour: REFLECT_HOUR })).toBe(true);
  });

  it('тумблер выключен — блока нет', () => {
    expect(reflectionVisible({ ...base, enabled: false })).toBe(false);
  });

  it('DEV-обход снимает только время, но не тумблер', () => {
    expect(reflectionVisible({ ...base, hour: 10, devForce: true })).toBe(true);
    expect(reflectionVisible({ ...base, hour: 10, enabled: false, devForce: true })).toBe(false);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Запустить: `npm test -- reflection`
Ожидается: FAIL — `Cannot find module '../reflection'`.

- [ ] **Шаг 3: Реализовать**

Создать `src/lib/reflection.ts`:

```ts
/** Когда на «Сегодня» показывается блок вечерней рефлексии (product-spec §1, logic-spec §3).
 *
 *  Вынесено в чистую функцию, чтобы граничные случаи (17:59 / 18:00, карта не открыта,
 *  выключенный тумблер) проверялись тестами, а не наблюдением за часами.
 */

/** С этого часа местного времени появляется блок. */
export const REFLECT_HOUR = 18;

export interface ReflectionGate {
  /** Карта дня уже открыта — иначе рефлексировать не о чем. */
  drawn: boolean;
  /** Текущий локальный час, 0–23. */
  hour: number;
  /** Настройка «Вечерняя рефлексия». */
  enabled: boolean;
  /** DEV-обход времени (строка в настройках под __DEV__). Тумблер НЕ обходит. */
  devForce?: boolean;
}

export function reflectionVisible({ drawn, hour, enabled, devForce }: ReflectionGate): boolean {
  if (!drawn || !enabled) return false;
  return devForce === true || hour >= REFLECT_HOUR;
}
```

- [ ] **Шаг 4: Проверить**

Запустить: `npm test -- reflection`
Ожидается: PASS (7 тестов).

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/reflection.ts src/lib/__tests__/reflection.test.ts
git commit -m "feat: правило показа блока рефлексии (spec 06а)"
```

---

### Задача 3: Правило вариативности — `src/lib/phrases.ts` + контент

**Файлы:**
- Изменить: `content/phrases.json`
- Создать: `src/lib/phrases.ts`
- Создать: `src/lib/__tests__/phrases.test.ts`

**Интерфейсы:**
- Использует: `fnv1a32` из `src/lib/content.ts` (уже есть).
- Отдаёт дальше: `pickPhrase(key, dateISO, lang, vars?): string` — ключ путём через точку
  (`'reflect.question'`, `'empty.filter'`, `'empty.journal'`).

- [ ] **Шаг 1: Добавить контент**

В `content/phrases.json` добавить новый блок верхнего уровня — сразу после блока `"greeting": {…}`,
перед `"push": {`:

```json
 "reflect": {
  "question": [
   {
    "ru": "Как отозвалась {card} сегодня?",
    "en": "How did {card} resonate today?"
   },
   {
    "ru": "{card} была с вами весь день. Что скажете?",
    "en": "{card} was with you all day. How was it?"
   },
   {
    "ru": "Вечер — время оглянуться: {card} про ваш день?",
    "en": "Evening is for looking back — was {card} about your day?"
   }
  ]
 },
```

В том же файле исправить третий вариант `push.evening_reflect` — слово «сбылась» запрещено
редполитикой (content-guide, logic-spec §3):

```json
   {
    "ru": "Минутка перед сном: отозвалась ли {card}?",
    "en": "A moment before sleep — did {card} resonate?"
   }
```

- [ ] **Шаг 2: Написать падающий тест**

Создать `src/lib/__tests__/phrases.test.ts`:

```ts
import { pickPhrase } from '../phrases';

describe('pickPhrase', () => {
  it('в течение дня формулировка стабильна (никакого Math.random)', () => {
    const results = new Set(
      Array.from({ length: 100 }, () =>
        pickPhrase('reflect.question', '2026-08-11', 'ru', { card: 'Звезда' }),
      ),
    );
    expect(results.size).toBe(1);
  });

  it('за месяц формулировки чередуются, а не залипают на одной', () => {
    const texts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        pickPhrase('reflect.question', `2026-08-${String(i + 1).padStart(2, '0')}`, 'ru', {
          card: 'Звезда',
        }),
      ),
    );
    expect(texts.size).toBeGreaterThan(1);
  });

  it('подставляет плейсхолдер', () => {
    const text = pickPhrase('reflect.question', '2026-08-11', 'ru', { card: 'Звезда' });
    expect(text).toContain('Звезда');
    expect(text).not.toContain('{card}');
  });

  it('английский вариант берётся из того же места', () => {
    const text = pickPhrase('reflect.question', '2026-08-11', 'en', { card: 'The Star' });
    expect(text).toContain('The Star');
    expect(/[а-яё]/i.test(text)).toBe(false);
  });

  it('незаполненный плейсхолдер остаётся текстом, а не превращается в undefined', () => {
    const text = pickPhrase('reflect.question', '2026-08-11', 'ru');
    expect(text).toContain('{card}');
    expect(text).not.toContain('undefined');
  });

  it('неизвестный ключ даёт пустую строку, а не падение', () => {
    expect(pickPhrase('nope.nothing', '2026-08-11', 'ru')).toBe('');
  });

  it('работает с вложенным ключом пустых состояний', () => {
    expect(pickPhrase('empty.filter', '2026-08-11', 'ru').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Шаг 3: Убедиться, что тест падает**

Запустить: `npm test -- phrases`
Ожидается: FAIL — `Cannot find module '../phrases'`.

- [ ] **Шаг 4: Реализовать**

Создать `src/lib/phrases.ts`:

```ts
/** Выбор варианта системного текста — правило вариативности (logic-spec §9).
 *
 *  Один смысл живёт в content/phrases.json несколькими формулировками, а вариант выбирается
 *  ХЕШЕМ от даты и ключа, а не `Math.random`: в течение дня текст стабилен (вернулся на экран —
 *  та же фраза), назавтра, как правило, другая. Math.random здесь запрещён спекой.
 */
import phrasesJson from '../../content/phrases.json';
import { fnv1a32 } from './content';

interface Phrase { ru: string; en: string }

/** Список вариантов по пути через точку: 'reflect.question', 'empty.filter'. */
function variantsAt(key: string): Phrase[] {
  let node: unknown = phrasesJson;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return [];
    node = (node as Record<string, unknown>)[part];
  }
  return Array.isArray(node) ? (node as Phrase[]) : [];
}

/** Плейсхолдеры {card}, {name}, {n} подставляются ПОСЛЕ выбора варианта (logic-spec §9).
 *  Неизвестный плейсхолдер остаётся в тексте как есть — это заметно при вычитке,
 *  в отличие от тихой подстановки «undefined». */
export function pickPhrase(
  key: string,
  dateISO: string,
  lang: 'ru' | 'en',
  vars: Record<string, string | number> = {},
): string {
  const variants = variantsAt(key);
  if (variants.length === 0) return '';
  const text = variants[fnv1a32(`${dateISO}:${key}`) % variants.length][lang];
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
```

- [ ] **Шаг 5: Проверить**

Запустить: `npm test -- phrases`
Ожидается: PASS (7 тестов).

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

- [ ] **Шаг 6: Коммит**

```bash
git add content/phrases.json src/lib/phrases.ts src/lib/__tests__/phrases.test.ts
git commit -m "feat: выбор варианта системного текста по правилу вариативности (spec 06а)"
```

---

### Задача 4: Стор — ответ, настройка, миграция схемы

**Файлы:**
- Изменить: `src/store/useApp.ts`

**Интерфейсы:**
- Использует: `canEditEntry`, `type Outcome` из задачи 1.
- Отдаёт дальше: `setOutcome(date, outcome)`, `setReflectionOn(on)`, состояние
  `settings: { reflectionOn: boolean }` и DEV-флаг `devReflect: boolean` с `setDevReflect(on)`.

- [ ] **Шаг 1: Расширить импорт и типы состояния**

В импорте `src/store/useApp.ts` добавить `Outcome`:

```ts
import { canEditEntry, normalizeNote, type DailyDraw, type Outcome } from '../lib/journal';
```

Над `interface AppState` добавить:

```ts
/** Настройки приложения (logic-spec §7). Пуш-поля добавит задача 06б. */
export interface AppSettings {
  /** Вечерняя рефлексия: блок на «Сегодня» (06а) и вечерний пуш (06б). */
  reflectionOn: boolean;
}

const DEFAULT_SETTINGS: AppSettings = { reflectionOn: true };
```

В `interface AppState` добавить поля и экшены:

```ts
  settings: AppSettings;
  /** Только для разработки: показать блок рефлексии, не дожидаясь 18:00. */
  devReflect: boolean;
  setOutcome: (date: string, outcome: Outcome) => void;
  setReflectionOn: (on: boolean) => void;
  setDevReflect: (on: boolean) => void;
```

- [ ] **Шаг 2: Дописать начальное состояние и экшены**

В теле стора рядом с `history: []` добавить:

```ts
      settings: DEFAULT_SETTINGS,
      devReflect: false,
```

После экшена `setNote` добавить:

```ts
      // Ответ вечерней рефлексии. Правило то же, что у заметки: правится только сегодняшняя
      // запись (logic-spec §3). Смена ответа до полуночи разрешена, снятия ответа нет.
      setOutcome: (date, outcome) => {
        if (!canEditEntry(date)) return;
        set({
          history: get().history.map((h) => (h.date === date ? { ...h, outcome } : h)),
        });
      },

      setReflectionOn: (on) => set({ settings: { ...get().settings, reflectionOn: on } }),
      setDevReflect: (devReflect) => set({ devReflect }),
```

- [ ] **Шаг 3: Поднять версию схемы и написать миграцию**

Заменить блок `version` / `migrate` в опциях persist на:

```ts
      // schemaVersion из logic-spec §7 хранится тут же, отдельного поля в состоянии нет.
      // v1 → v2: появились настройки (settings.reflectionOn).
      version: 2,
      // ⚠️ persist сливает состояние ПОВЕРХНОСТНО: сохранённый `settings` заменяет объект-дефолт
      // целиком, а не сливается с ним по ключам. Поэтому недостающие ключи дописываем здесь
      // руками — и следующая задача, добавляя поля в settings, обязана поднять версию и сделать
      // то же самое, иначе новые настройки не появятся у уже существующих пользователей.
      migrate: (persistedState) => {
        const s = (persistedState ?? {}) as Partial<AppState>;
        return { ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) } } as AppState;
      },
```

- [ ] **Шаг 4: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

Запустить: `npm test`
Ожидается: PASS — 8 сьютов (moon, dates, cardOfDay, cardSearch, scrollAware, journal, reflection,
phrases), ни одного упавшего.

- [ ] **Шаг 5: Коммит**

```bash
git add src/store/useApp.ts
git commit -m "feat: ответ рефлексии и настройки в сторе, схема v2 (spec 06а)"
```

---

### Задача 5: Строки интерфейса (i18n)

**Файлы:**
- Изменить: `src/lib/i18n.ts`

**Интерфейсы:**
- Отдаёт дальше ключи: `reflect.title` · `reflect.yes` / `reflect.partly` / `reflect.no` ·
  `reflect.saved` · `reflect.edit` · `journal.resonated` · `journal.filters.*` ·
  `card.resonated` · `settings.reflection` / `settings.on` / `settings.off` / `settings.reflectNow`.

- [ ] **Шаг 1: Русские строки**

В `ru.translation` после блока `note: { … }` добавить (запятая после `note`-блока обязательна):

```ts
      // вечерняя рефлексия (product-spec §1). Слово «сбылось» запрещено content-guide:
      // мы про рефлексию, а не про предсказание, — везде «отозвалась»
      reflect: {
        title: "Как прошёл день",
        yes: "Отозвалась", partly: "Отчасти", no: "Не отозвалась",
        saved: "Записано в дневник · {{answer}}",
        edit: "изменить можно до полуночи",
      },
```

В том же `ru` внутри блока `journal: { … }` добавить строки:

```ts
        resonated: "Отозвалось {{n}} из {{total}} дней",
        filters: { all: "Все", yes: "✓", partly: "≈", no: "✗", note: "С заметкой" },
```

Внутри блока `card: { … }` добавить:

```ts
        resonated: "отзывалась {{n}}",
```

Внутри блока `settings: { … }` добавить:

```ts
        reflection: "Вечерняя рефлексия", on: "Вкл", off: "Выкл",
        reflectNow: "Рефлексия: показать сейчас",
```

- [ ] **Шаг 2: Английские строки**

В `en.translation` после блока `note: { … }` добавить:

```ts
      reflect: {
        title: "How was your day",
        yes: "Resonated", partly: "Partly", no: "Not really",
        saved: "Saved to your journal · {{answer}}",
        edit: "you can change this until midnight",
      },
```

В `en` внутри `journal: { … }`:

```ts
        resonated: "Resonated on {{n}} of {{total}} days",
        filters: { all: "All", yes: "✓", partly: "≈", no: "✗", note: "With a note" },
```

В `en` внутри `card: { … }`:

```ts
        resonated: "resonated {{n}}",
```

В `en` внутри `settings: { … }`:

```ts
        reflection: "Evening reflection", on: "On", off: "Off",
        reflectNow: "Reflection: show now",
```

- [ ] **Шаг 3: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

- [ ] **Шаг 4: Коммит**

```bash
git add src/lib/i18n.ts
git commit -m "feat: строки вечерней рефлексии и фильтров дневника (spec 06а)"
```

---

### Задача 6: Компонент `Reflection` и вечерний блок на «Сегодня»

**Файлы:**
- Создать: `src/components/Reflection.tsx`
- Изменить: `app/(tabs)/index.tsx`

**Интерфейсы:**
- Использует: `Outcome`, `OUTCOME_MARK` (задача 1); `reflectionVisible`, `REFLECT_HOUR` (задача 2);
  `pickPhrase` (задача 3); `setOutcome`, `settings.reflectionOn`, `devReflect` (задача 4);
  ключи `reflect.*` (задача 5).
- Отдаёт дальше: `<Reflection cardName dateISO lang outcome onAnswer />`.

- [ ] **Шаг 1: Создать компонент**

Создать `src/components/Reflection.tsx`:

```tsx
/** Вечерняя рефлексия: вопрос и три кнопки (product-spec §1, design-system §5).
 *
 *  Живёт ВНУТРИ того же блока, что и заметка: до 18:00 блок называется «Заметка о дне»
 *  и содержит одну плашку, после 18:00 у него меняется заголовок и над плашкой появляется
 *  этот вопрос. Заметка в записи одна (logic-spec §3), поэтому второй плашки здесь нет —
 *  плашка передаётся блоку снаружи.
 *
 *  После ответа кнопки сворачиваются в строку (как в эталоне), а строка возвращает их обратно:
 *  ответ можно менять до полуночи (logic-spec §3), и в макете этого пути нет — дорисовка 15.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { hapticTap } from '../lib/haptics';
import { OUTCOME_MARK, type Outcome } from '../lib/journal';
import { pickPhrase } from '../lib/phrases';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Смена «кнопки ↔ строка ответа» — только прозрачность (motion-spec §4). Высота блока
 *  меняется без анимации: скачущая высота посреди скролла хуже мгновенной смены. */
const SWAP_MS = 180;

const ORDER: Outcome[] = ['yes', 'partly', 'no'];

export function Reflection({
  cardName,
  dateISO,
  lang,
  outcome,
  onAnswer,
}: {
  cardName: string;
  dateISO: string;
  lang: 'ru' | 'en';
  outcome?: Outcome;
  onAnswer: (o: Outcome) => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  // кнопки видны, пока ответа нет; после ответа сворачиваются, тап по строке возвращает
  const [editing, setEditing] = React.useState(!outcome);
  const fade = useSharedValue(1);

  const swap = (next: boolean) => {
    fade.value = 0;
    fade.value = withTiming(1, {
      duration: SWAP_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    setEditing(next);
  };

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const question = pickPhrase('reflect.question', dateISO, lang, { card: cardName });

  return (
    <View>
      <Txt style={[st.question, { color: t.text }]}>{question}</Txt>

      <Animated.View style={fadeStyle}>
        {editing ? (
          <View style={st.btns}>
            {ORDER.map((o) => {
              const active = outcome === o;
              return (
                <PressableScale
                  key={o}
                  onPress={() => {
                    hapticTap(); // Success бережём для настоящих побед (серия, урок)
                    onAnswer(o);
                    swap(false);
                  }}
                  style={[
                    st.btn,
                    {
                      borderColor: active ? t.frame : t.line,
                      backgroundColor: active ? t.chipBg : 'transparent',
                    },
                  ]}
                >
                  <Txt style={[st.btnTxt, { color: active ? t.accent : t.text }]}>
                    {tr(`reflect.${o}`)}
                  </Txt>
                </PressableScale>
              );
            })}
          </View>
        ) : (
          <PressableScale
            onPress={() => {
              hapticTap();
              swap(true);
            }}
            style={st.saved}
          >
            <Txt style={[st.savedTxt, { color: t.accent }]}>
              {tr('reflect.saved', {
                answer: outcome ? `${tr(`reflect.${outcome}`)} ${OUTCOME_MARK[outcome]}` : '',
              })}
            </Txt>
            <Txt style={[st.edit, { color: t.accent, borderBottomColor: t.frame }]}>
              {tr('reflect.edit')}
            </Txt>
          </PressableScale>
        )}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  // `.reflect p` эталона: тот же Cormorant, что у значения дня, но кегль меньше
  question: { fontFamily: fonts.display, fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  // `.rbtns` / `.rb` эталона
  btns: { flexDirection: 'row', gap: 7, marginTop: 10 },
  btn: { flex: 1, borderWidth: 1, borderRadius: radius.m, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center' },
  btnTxt: { fontSize: 11, textAlign: 'center' },
  // `.done2` эталона + вторая строка-кнопка, которой в макете нет
  saved: { alignItems: 'center', paddingTop: 6, paddingBottom: 2, marginTop: spacing.s },
  savedTxt: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  edit: { fontSize: 10.5, marginTop: 3, borderBottomWidth: 1, borderStyle: 'dashed' },
});
```

Шрифт вопроса — `fonts.display` (`CormorantGaramond_500Medium`), тот же, что у «Значения дня»:
у Cormorant начертания не синтезируются, поэтому имя семейства берётся только из `fonts`,
строковый литерал сюда писать нельзя.

- [ ] **Шаг 2: Подключить на «Сегодня»**

В `app/(tabs)/index.tsx` дополнить импорты:

```tsx
import { useFocusEffect } from 'expo-router';
import { Reflection } from '../../src/components/Reflection';
import { reflectionVisible } from '../../src/lib/reflection';
import type { Outcome } from '../../src/lib/journal';
```

В теле `TodayScreen` рядом с остальными селекторами стора добавить:

```tsx
  const setOutcome = useApp((s) => s.setOutcome);
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const devReflect = useApp((s) => s.devReflect);

  // час пересчитываем при возврате на таб, а не таймером каждую минуту: сидеть в приложении
  // ровно в 17:59:59 — не тот случай, ради которого стоит держать интервал
  const [hour, setHour] = React.useState(() => new Date().getHours());
  useFocusEffect(React.useCallback(() => setHour(new Date().getHours()), []));

  const showReflection = reflectionVisible({
    drawn: !!drawn,
    hour,
    enabled: reflectionOn,
    devForce: __DEV__ && devReflect,
  });
```

Заменить блок заметки (`<Block title={tr('note.title')}> … </Block>`) на:

```tsx
              {/* один блок на весь вечерний ритуал: до 18:00 это «Заметка о дне» с плашкой,
                  после — тот же блок с вопросом и кнопками над той же плашкой (спека 06а) */}
              <Block title={showReflection ? tr('reflect.title') : tr('note.title')}>
                {showReflection && (
                  <Reflection
                    cardName={card.name[lang]}
                    dateISO={todayISO}
                    lang={lang}
                    outcome={drawn?.outcome}
                    onAnswer={(o: Outcome) => setOutcome(todayISO, o)}
                  />
                )}
                <NotePlate
                  note={drawn?.note}
                  onPress={() => router.push({ pathname: '/note/[date]', params: { date: todayISO } })}
                />
              </Block>
```

- [ ] **Шаг 3: Проверить типы**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

- [ ] **Шаг 4: Проверить в браузере**

Запустить: `npx expo start --web` (приложение на http://localhost:8081).

Проверить руками:
1. Открыть карту дня. До 18:00 блок называется «ЗАМЕТКА О ДНЕ», внутри одна плашка — как раньше.
2. Проверить вечерний вид пока нельзя (DEV-строка появится в задаче 13) — временно поменять
   в `src/lib/reflection.ts` `REFLECT_HOUR` на `0`, перезагрузить страницу, убедиться:
   заголовок «КАК ПРОШЁЛ ДЕНЬ», вопрос с названием карты, три кнопки, плашка заметки под ними.
3. Нажать «Отозвалась» — кнопки сворачиваются в строку «Записано в дневник · Отозвалась ✓»
   и подпись «изменить можно до полуночи».
4. Нажать на строку — кнопки вернулись, «Отозвалась» подсвечена золотым.
5. Нажать «Отчасти» — строка изменилась на «Отчасти ≈».
6. Перезагрузить страницу — ответ на месте.
7. Консоль браузера без ошибок и предупреждений.
8. **Вернуть `REFLECT_HOUR = 18`.**

- [ ] **Шаг 5: Коммит**

```bash
git add src/components/Reflection.tsx "app/(tabs)/index.tsx"
git commit -m "feat: вечерний блок рефлексии на экране «Сегодня» (spec 06а)"
```

---

### Задача 7: Общий компонент `FilterChips` (вынос из справочника)

**Файлы:**
- Создать: `src/components/FilterChips.tsx`
- Изменить: `app/(tabs)/cards.tsx`

**Интерфейсы:**
- Отдаёт дальше: `<FilterChips values labels active onPick contentStyle />` — универсальная лента
  чипов-фильтров для любого экрана.

Это ВТОРОЕ появление чипов в проекте (первое — справочник), поэтому разметка выносится в общий
компонент, а не копируется в профиль. Значения — из `app/(tabs)/cards.tsx`, менять их нельзя:
справочник после правки должен выглядеть в точности как до неё.

- [ ] **Шаг 1: Создать компонент**

Создать `src/components/FilterChips.tsx`:

```tsx
/** Горизонтальная лента чипов-фильтров (design-system §5).
 *
 *  ⚠️ Лента идёт ОТ КРАЯ ДО КРАЯ экрана (правило задачи 19): горизонтальный отступ 24 держит
 *  внутренний `contentContainerStyle`, а НЕ контейнер вокруг. Паддинг на контейнере обрывает
 *  прокрутку за 24px до края, и крайние чипы выглядят обрезанными посреди экрана.
 *  Значит родитель ленты не должен иметь горизонтальных паддингов.
 */
import React from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { hapticTap } from '../lib/haptics';
import { spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function FilterChips<T extends string>({
  values,
  labels,
  active,
  onPick,
  contentStyle,
}: {
  values: readonly T[];
  /** Подпись чипа — вместе со счётчиком, если он нужен экрану. */
  labels: (value: T) => string;
  active: T;
  onPick: (value: T) => void;
  /** Отступ сверху и прочая посадка на конкретном экране. */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[st.row, contentStyle]}
    >
      {values.map((v) => (
        <PressableScale
          key={v}
          onPress={() => {
            hapticTap();
            onPick(v);
          }}
          style={[
            st.chip,
            {
              borderColor: active === v ? t.frame : t.line,
              backgroundColor: active === v ? t.chipBg : 'transparent',
            },
          ]}
        >
          <Txt style={[st.txt, { color: active === v ? t.accent : t.muted }]}>{labels(v)}</Txt>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 9, paddingHorizontal: spacing.xl },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  txt: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
});
```

- [ ] **Шаг 2: Перевести справочник на общий компонент**

В `app/(tabs)/cards.tsx` добавить импорт:

```tsx
import { FilterChips } from '../../src/components/FilterChips';
```

В компоненте `Filters` заменить `<ScrollView horizontal …>…</ScrollView>` целиком на:

```tsx
      <FilterChips
        values={CARD_FILTERS}
        labels={label}
        active={filter}
        onPick={onFilter}
        contentStyle={compact && st.segRowCompact}
      />
```

Из `st` в том же файле удалить ставшие ненужными `segRow`, `seg`, `segTxt` (оставить
`segRowCompact` — им задаётся поджатый отступ парящей панели). Убрать из импортов `PressableScale`
и `hapticTap`, если после правки они больше не используются в файле (проверить поиском по файлу —
`PressableScale` используется ещё и в карточке сетки, тогда импорт оставить).

- [ ] **Шаг 3: Проверить типы**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

- [ ] **Шаг 4: Проверить, что справочник не изменился**

В браузере (http://localhost:8081) открыть таб «Карты»:
1. Чипы на месте, в одну строку, с той же высотой и отступами.
2. Прокрутка ленты доходит до самого края экрана с обеих сторон.
3. Активный чип золотой, тап переключает фильтр, сетка перестраивается.
4. Прокрутить вниз, потянуть вверх — в парящей панели чипы тоже на месте и поджаты.
5. Ввести текст в поиск и, не убирая фокус, нажать чип — фильтр применился (это проверяет,
   что `keyboardShouldPersistTaps` не потерялся).
6. Консоль без ошибок.

- [ ] **Шаг 5: Коммит**

```bash
git add src/components/FilterChips.tsx "app/(tabs)/cards.tsx"
git commit -m "refactor: чипы-фильтры вынесены в общий FilterChips (spec 06а)"
```

---

### Задача 8: Профиль — отступы переезжают с контейнера на элементы

**Файлы:**
- Изменить: `app/(tabs)/profile.tsx`

Отдельная задача, потому что это правка вёрстки без новой функциональности: её легко проверить
на «ничего не сдвинулось», а смешанная с фильтрами она такой проверки не даёт.

Причина: лента чипов из задачи 9 должна прокручиваться до края экрана, а сейчас у списка
`paddingHorizontal: spacing.xl` на `contentContainerStyle` — он обрежет ленту за 24px до края
(та самая ошибка, которую чинила задача 19).

- [ ] **Шаг 1: Снять паддинг с контейнера**

В `contentContainerStyle` списка убрать строку `paddingHorizontal: spacing.xl`:

```tsx
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: 120,
        }}
```

- [ ] **Шаг 2: Раздать отступ элементам**

В `st` добавить общий стиль и повесить его на всё, что раньше жило внутри паддинга:

```tsx
  // горизонтальный отступ держат сами элементы, а не контейнер списка: иначе лента чипов
  // обрывается за 24px до края экрана (правило задачи 19, design-system §5)
  pad: { marginHorizontal: spacing.xl },
```

Правки в разметке:

```tsx
      <FadeUp index={0} style={st.pad}>
        <Txt style={[st.title, { color: t.head }]}>{tr('profile.title')}</Txt>
      </FadeUp>

      <FadeUp index={1} style={[st.stats, st.pad]}>
```

```tsx
        <FadeUp index={2} style={st.pad}>
          <MonthNav … />
          <MonthCard … />
        </FadeUp>
```

Строку записи и пустое состояние тоже прижать:

```tsx
          return index < BODY_ROWS ? (
            <FadeUp index={BODY_STEP} style={st.pad}>{row}</FadeUp>
          ) : (
            <View style={st.pad}>{row}</View>
          );
```

```tsx
        ListEmptyComponent={<View style={st.pad}><EmptyState text={tr('journal.empty')} /></View>}
```

`View` уже импортирован в файле — дополнительных импортов не нужно.

- [ ] **Шаг 3: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

В браузере открыть таб «Профиль» и сверить с тем, что было: заголовок «Профиль» по центру,
две плитки статистики той же ширины, навигатор месяцев, карточка месяца и строки записей —
с прежними полями по 24px слева и справа. Ничего не должно стать шире или уже.

- [ ] **Шаг 4: Коммит**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "refactor: отступы профиля переехали с контейнера списка на элементы (spec 06а)"
```

---

### Задача 9: Профиль — чипы-фильтры и фильтрация ленты

**Файлы:**
- Изменить: `app/(tabs)/profile.tsx`

**Интерфейсы:**
- Использует: `JOURNAL_FILTERS`, `filterEntries`, `filterCounts`, `type JournalFilter` (задача 1);
  `pickPhrase` (задача 3); `FilterChips` (задача 7); ключи `journal.filters.*` (задача 5).

- [ ] **Шаг 1: Добавить состояние и вычисления**

Дополнить импорты:

```tsx
import { FilterChips } from '../../src/components/FilterChips';
import { pickPhrase } from '../../src/lib/phrases';
import {
  entriesOfMonth,
  filterCounts,
  filterEntries,
  JOURNAL_FILTERS,
  monthsWithEntries,
  monthSummary,
  type DailyDraw,
  type JournalFilter,
} from '../../src/lib/journal';
```

В теле компонента после вычисления `entries` добавить:

```tsx
  const [filter, setFilter] = React.useState<JournalFilter>('all');
  // смена месяца сбрасывает фильтр: счётчики в чипах относятся к текущему месяцу
  React.useEffect(() => setFilter('all'), [month]);

  const counts = React.useMemo(() => filterCounts(entries), [entries]);
  // чип с нулём не показываем — тап по нему вёл бы в пустоту; «Все» остаётся всегда
  const chips = React.useMemo(
    () => JOURNAL_FILTERS.filter((f) => f === 'all' || counts[f] > 0),
    [counts],
  );
  const shown = React.useMemo(() => filterEntries(entries, filter), [entries, filter]);
```

- [ ] **Шаг 2: Показать чипы и отдать списку отфильтрованные записи**

В `header`, сразу после `<MonthCard … />` внутри того же `FadeUp index={2}`, чипы поставить
НЕЛЬЗЯ: у этого `FadeUp` есть `style={st.pad}`, а лента должна идти от края до края. Поэтому
добавить чипы отдельным элементом ПОСЛЕ закрывающего `</FadeUp>` блока с навигатором:

```tsx
      {month && chips.length > 1 && (
        <FadeUp index={2}>
          <FilterChips
            values={chips}
            labels={(f) =>
              f === 'all'
                ? tr('journal.filters.all')
                : `${tr(`journal.filters.${f}`)} ${counts[f]}`
            }
            active={filter}
            onPick={setFilter}
            contentStyle={st.chips}
          />
        </FadeUp>
      )}
```

Условие `chips.length > 1` прячет ленту, пока фильтровать нечего: в месяце без ответов
и без заметок остаётся один чип «Все», и лента из одного чипа выглядит мусором.

В списке заменить `data={entries}` на `data={shown}` и пустое состояние — на фразу фильтра:

```tsx
        data={shown}
```

```tsx
        ListEmptyComponent={
          <View style={st.pad}>
            <EmptyState
              text={
                entries.length === 0
                  ? pickPhrase('empty.journal', today, lang)
                  : pickPhrase('empty.filter', today, lang)
              }
            />
          </View>
        }
```

В `st` добавить отступ ленты:

```tsx
  chips: { marginTop: 12 },
```

- [ ] **Шаг 3: Проверить типы**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

- [ ] **Шаг 4: Проверить в браузере**

Ответов пока может не быть — сначала наберём данные: на «Сегодня» открыть карту дня, ответить
на рефлексию (временно `REFLECT_HOUR = 0`, как в задаче 6), написать заметку. Затем в профиле:
1. Над лентой появились чипы «Все N», «✓ N», «С заметкой N» — только те, у которых счёт > 0.
2. Тап по «✓» оставляет в ленте только записи с этим ответом, счётчики не меняются.
3. Тап по чипу, под который ничего не подходит, невозможен — таких чипов нет.
4. Лента чипов прокручивается до самого края экрана (если чипов много — сузить окно браузера).
5. Переключить месяц стрелками — фильтр вернулся на «Все».
6. Выбрать фильтр, дающий пустой результат (например, удалить единственную заметку через экран
   заметки и выбрать «С заметкой» до перерисовки) — показывается `EmptyState` с фразой про фильтр.
7. Консоль без ошибок.
8. Вернуть `REFLECT_HOUR = 18`, если правил.

- [ ] **Шаг 5: Коммит**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat: чипы-фильтры и фильтрация ленты дневника (spec 06а)"
```

---

### Задача 10: Карточка месяца — «Отозвалось X из Y» и полоска распределения

**Файлы:**
- Изменить: `src/components/MonthCard.tsx`
- Изменить: `app/(tabs)/profile.tsx`

**Интерфейсы:**
- Использует: `outcomeStats`, `type OutcomeStats` (задача 1); ключ `journal.resonated` (задача 5).
- Меняет сигнатуру: `<MonthCard summary stats lang onPress />` — добавился проп `stats`.

⚠️ Сейчас `MonthCard` возвращает `null`, когда «карты месяца» нет (`topCount <= 1`). Если оставить
как есть, в таком месяце сводка рефлексии не покажется никогда. Условие меняется: карточка
рисуется, если есть карта месяца ИЛИ есть хотя бы один ответ.

- [ ] **Шаг 1: Передать статистику из профиля**

В `app/(tabs)/profile.tsx` добавить `outcomeStats` в импорт из `../../src/lib/journal`
и вычислить рядом с `summary`:

```tsx
  const stats = React.useMemo(() => (month ? outcomeStats(history, month) : null), [history, month]);
```

Передать в компонент:

```tsx
          <MonthCard summary={summary} stats={stats} lang={lang} onPress={openCard} />
```

Условие показа блока с навигатором уже проверяет `month && summary` — этого достаточно,
`stats` при наличии месяца всегда посчитан.

- [ ] **Шаг 2: Переписать `MonthCard`**

В `src/components/MonthCard.tsx` дополнить импорты:

```tsx
import type { MonthSummary, OutcomeStats } from '../lib/journal';
```

Заменить сигнатуру и условие показа:

```tsx
export function MonthCard({
  summary,
  stats,
  lang,
  onPress,
}: {
  summary: MonthSummary;
  stats: OutcomeStats | null;
  lang: 'ru' | 'en';
  onPress: (cardId: string) => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  // «Карта месяца» имеет смысл только при повторе: с одним выпадением это просто случайная
  // карта из ленты, и подпись «КАРТА МЕСЯЦА · 1 раз» обещает закономерность, которой нет
  const card = summary.topCount > 1 && summary.topCardId ? cardById.get(summary.topCardId) : undefined;
  const answered = stats?.answered ?? 0;
  // без карты месяца карточка всё равно нужна, если есть ответы: иначе сводка рефлексии
  // в таком месяце не покажется никогда
  if (!card && answered === 0) return null;
```

Разметку внутри `PressableScale` заменить на:

```tsx
      {card && (
        <View style={[st.thumbClip, { borderColor: t.frame }]}>
          <Image source={cardImages[card.id]} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      )}
      <View style={st.texts}>
        {card && (
          <>
            <Txt style={[st.overline, { color: t.accent }]}>{tr('journal.monthCard').toUpperCase()}</Txt>
            <Txt style={[st.name, { color: t.head }]}>
              {`${card.name[lang]} · ${tr('journal.times', { count: summary.topCount })}`}
            </Txt>
          </>
        )}
        <Txt style={[st.stats, { color: t.muted }]}>{statsLine}</Txt>
        {stats && answered > 0 && (
          <>
            <Txt style={[st.stats, { color: t.muted }]}>
              {tr('journal.resonated', { n: stats.resonated, total: answered })}
            </Txt>
            {/* трёхсегментная полоска распределения (product-spec §5): доли ✓/≈/✗ за месяц.
                Единственная визуализация рефлексий в v1 — графиков и «процента точности» нет */}
            <View style={[st.bar, { backgroundColor: t.line }]}>
              <View style={{ flex: stats.yes, backgroundColor: t.success }} />
              <View style={{ flex: stats.partly, backgroundColor: t.accent }} />
              <View style={{ flex: stats.no, backgroundColor: t.muted }} />
            </View>
          </>
        )}
      </View>
```

Переименовать локальную переменную `stats` (она конфликтует с новым пропом) — строку
статистики назвать `statsLine`:

```tsx
  const statsLine = [
    tr('journal.entries', { count: summary.count }),
    summary.withNote > 0 ? tr('journal.withNote', { count: summary.withNote }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
```

Обработчик нажатия должен пережить отсутствие карты:

```tsx
    <PressableScale
      onPress={card ? () => onPress(card.id) : undefined}
      style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}
    >
```

В `st` добавить стиль полоски:

```tsx
  // тонкий трёхсегментный бар: сегменты встык, подложка line видна, когда доля нулевая
  bar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
```

- [ ] **Шаг 3: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

В браузере на табе «Профиль»:
1. В месяце с ответами под строкой «N записей» появилась строка «Отозвалось X из Y дней»
   и полоска под ней.
2. Пропорции полоски совпадают с ответами (один ответ «отозвалась» — полоска целиком зелёная).
3. В месяце без ответов ни строки, ни полоски нет.
4. Карточка не пропадает в месяце, где нет повторяющейся карты, но есть ответ (проверить,
   сбросив карту дня DEV-кнопкой и ответив на новую карту).

- [ ] **Шаг 4: Коммит**

```bash
git add src/components/MonthCard.tsx "app/(tabs)/profile.tsx"
git commit -m "feat: сводка и полоска рефлексий в карточке месяца (spec 06а)"
```

---

### Задача 11: Отметка ✓/≈/✗ в строке дневника

**Файлы:**
- Изменить: `src/components/JournalRow.tsx`

**Интерфейсы:**
- Использует: `OUTCOME_MARK`, `type Outcome` (задача 1).

- [ ] **Шаг 1: Добавить отметку**

В `src/components/JournalRow.tsx` дополнить импорт:

```tsx
import { OUTCOME_MARK, type DailyDraw, type Outcome } from '../lib/journal';
```

Над компонентом добавить цветовое правило:

```tsx
/** Цвет отметки: отозвалась — успех, отчасти — золото, не отозвалась — приглушённый.
 *  Красного здесь нет намеренно: «не отозвалась» — не ошибка (design-system §4). */
const markColor = (t: ReturnType<typeof useTheme>, o: Outcome) =>
  o === 'yes' ? t.success : o === 'partly' ? t.accent : t.muted;
```

После закрывающего `</View>` блока `st.texts`, перед закрытием `PressableScale`, добавить:

```tsx
      {entry.outcome && (
        <Txt style={[st.mark, { color: markColor(t, entry.outcome) }]}>
          {OUTCOME_MARK[entry.outcome]}
        </Txt>
      )}
```

В `st` добавить:

```tsx
  mark: { fontSize: 12 },
```

Комментарий в шапке файла («Место справа под отметку рефлексии займёт задача 06») заменить на:
«Справа — отметка рефлексии, если на день дан ответ.»

- [ ] **Шаг 2: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

В браузере на табе «Профиль»: у записи с ответом справа появился знак нужного цвета,
у записи без ответа справа пусто и текст заметки занимает всю ширину, как раньше.

- [ ] **Шаг 3: Коммит**

```bash
git add src/components/JournalRow.tsx
git commit -m "feat: отметка рефлексии в строке дневника (spec 06а)"
```

---

### Задача 12: «отзывалась N» на странице карты

**Файлы:**
- Изменить: `app/card/[id].tsx`

**Интерфейсы:**
- Использует: `cardHistory(...).resonated` (задача 1); ключ `card.resonated` (задача 5).

- [ ] **Шаг 1: Дописать хвост строки**

В `app/card/[id].tsx` найти сборку `personalText` и заменить первый элемент массива на вариант
с хвостом:

```tsx
  const drawnLine =
    // при единственном выпадении «выпадала 1 раз · последняя 10 августа» звучит как отчёт;
    // одной датой — по-человечески
    personal.times === 1
      ? tr('journal.drawnOnce', { date: lastDay })
      : `${tr('journal.drawn', { count: personal.times })} · ${tr('journal.lastDate', { date: lastDay })}`;

  const personalText = [
    // «отзывалась N» — счёт ответов «да» и «отчасти» (logic-spec §3), только если они были
    personal.resonated > 0
      ? `${drawnLine} · ${tr('card.resonated', { n: personal.resonated })}`
      : drawnLine,
    personal.lastNote ? `«${personal.lastNote}»` : null,
  ]
    .filter(Boolean)
    .join('\n');
```

Комментарий над блоком в разметке («Счётчик "отзывалась N" добавит задача 06 — ответов рефлексии
пока нет») убрать.

- [ ] **Шаг 2: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

В браузере: открыть карту, на которую был дан ответ «отозвалась» → в блоке «Ваша история
с картой» строка вида «Выпадала 2 раза · последняя 11 августа · отзывалась 1». У карты без
ответов хвоста нет.

- [ ] **Шаг 3: Коммит**

```bash
git add "app/card/[id].tsx"
git commit -m "feat: счётчик «отзывалась N» на странице карты (spec 06а)"
```

---

### Задача 13: Настройки — тумблер рефлексии и DEV-строка

**Файлы:**
- Изменить: `app/settings.tsx`

**Интерфейсы:**
- Использует: `settings.reflectionOn`, `setReflectionOn`, `devReflect`, `setDevReflect` (задача 4);
  ключи `settings.reflection` / `on` / `off` / `reflectNow` (задача 5).

- [ ] **Шаг 1: Добавить строки**

В `app/settings.tsx` добавить селекторы стора рядом с остальными:

```tsx
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const setReflectionOn = useApp((s) => s.setReflectionOn);
  const devReflect = useApp((s) => s.devReflect);
  const setDevReflect = useApp((s) => s.setDevReflect);
```

После `FadeUp index={1}` (язык) добавить строку тумблера — порядок по product-spec §5,
«Напоминания» встанут между ними в задаче 06б:

```tsx
        <FadeUp index={2}>
          <SettingsRow
            icon="moon-outline"
            label={tr('settings.reflection')}
            value={reflectionOn ? tr('settings.on') : tr('settings.off')}
            onPress={() => setReflectionOn(!reflectionOn)}
          />
        </FadeUp>
```

Существующий DEV-блок сдвинуть на индекс 3 и дополнить второй строкой:

```tsx
        {__DEV__ && (
          <>
            <FadeUp index={3}>
              <SettingsRow
                icon="refresh"
                label={tr('settings.resetToday')}
                value="DEV"
                onPress={resetToday}
              />
            </FadeUp>
            <FadeUp index={4}>
              <SettingsRow
                icon="time-outline"
                label={tr('settings.reflectNow')}
                value={devReflect ? 'DEV · ВКЛ' : 'DEV'}
                onPress={() => setDevReflect(!devReflect)}
              />
            </FadeUp>
          </>
        )}
```

- [ ] **Шаг 2: Проверить**

Запустить: `npx tsc --noEmit`
Ожидается: пусто.

В браузере: профиль → шестерёнка.
1. Строка «Вечерняя рефлексия · Вкл», тап переключает на «Выкл» и обратно.
2. Строка «Рефлексия: показать сейчас · DEV» включается.
3. С включённой DEV-строкой вернуться на «Сегодня» (карта дня должна быть открыта) — блок
   рефлексии виден в любое время суток.
4. Выключить тумблер «Вечерняя рефлексия» при включённой DEV-строке — блок ИСЧЕЗ
   (тумблер главнее dev-обхода).
5. Вернуть тумблер во «Вкл».

- [ ] **Шаг 3: Коммит**

```bash
git add app/settings.tsx
git commit -m "feat: тумблер вечерней рефлексии и DEV-показ блока (spec 06а)"
```

---

### Задача 14: Синхронизация документации и финальная проверка

**Файлы:**
- Изменить: `docs/design-system.md`, `docs/product-spec.md`, `docs/backlog.md`, `CLAUDE.md`
- Изменить: `docs/specs/06a-evening-reflection.md` (статус и отчёт)
- Создать: `docs/screenshots/06a/` (скриншоты веб-проверки)

- [ ] **Шаг 1: `docs/design-system.md` §5**

Дополнить пункт «Кнопки рефлексии» (сейчас он обрывается на «блок заменяется строкой»):

```markdown
**Кнопки рефлексии** — три равные (flex 1), зазор 7, отступ сверху 10, бордер `line`, radius 12,
паддинг 9×4, текст 11px по центру; ВЫБРАННАЯ — бордер `frame`, фон `chipBg`, текст `accent`
(как активный чип). После выбора кнопки сворачиваются в строку «Записано в дневник · <ответ> ✓»
(12.5px 700, ls 0.5, `accent`) со второй строкой-кнопкой «изменить можно до полуночи»
(10.5px `accent`, пунктирное подчёркивание `frame`), возвращающей кнопки: ответ правится
до полуночи (logic-spec §3). Смена состояний — прозрачность 180 мс, высота меняется без анимации.
```

Дополнить пункт «Карта месяца (шапка дневника)» строкой:

```markdown
Под статистикой — «Отозвалось X из Y дней» (10.5 `muted`) и трёхсегментная полоска: высота 4,
radius 2, отступ сверху 8, сегменты долями ✓/≈/✗ цветами `success`/`accent`/`muted` встык
на подложке `line`. Обе строки — только при наличии ответов. Карточка показывается, если есть
карта месяца ИЛИ хотя бы один ответ (иначе сводка рефлексии не показалась бы никогда).
```

Дополнить пункт «Строка дневника» — отметка: `✓` `success`, `≈` `accent`, `✗` `muted`, 12px,
справа; красного нет намеренно, «не отозвалась» — не ошибка.

- [ ] **Шаг 2: `docs/product-spec.md` §1**

В абзаце «Рефлексия 🔨(06)» заменить «три кнопки (Сбылось/Отчасти/Мимо)» на
«три кнопки (Отозвалась/Отчасти/Не отозвалась)» и снять пометку 🔨(06) на ✅, оставив
🔨(06б) у пуша. Добавить фразу: «блок живёт внутри той же панели, что и заметка о дне:
до 18:00 это "Заметка о дне", после — "Как прошёл день" с вопросом и кнопками над плашкой».

В §5 у строки «Настройки пушей 🔨(06)» заменить номер на 06б.

- [ ] **Шаг 3: Прогнать полную проверку**

```bash
npx tsc --noEmit
npm test
```
Ожидается: типы чистые; 8 сьютов, все зелёные (moon, dates, cardOfDay, cardSearch, scrollAware,
journal, reflection, phrases).

- [ ] **Шаг 4: Веб-проверка 6а — скриншоты**

Запустить `npx expo start --web`, открыть браузером в размере 390×844 и снять в ОБЕИХ темах:
«Сегодня» до ответа, «Сегодня» после ответа, «Профиль» с чипами и полоской, страницу карты
с «отзывалась N», экран настроек. Положить в `docs/screenshots/06a/`. Сверить с
`docs/design-reference.html` по чек-листу `docs/ui-verification.md`; расхождения либо исправить,
либо перечислить в отчёте спеки с причиной.

- [ ] **Шаг 5: Веб-проверка 6б — прокликивание**

Пройти по каждому интерактивному элементу изменённых экранов: три кнопки рефлексии, строка
возврата кнопок, плашка заметки, чипы-фильтры, стрелки месяцев, строки записей (тап и долгий тап),
обе строки настроек, DEV-строки. Консоль браузера — без ошибок и предупреждений.

- [ ] **Шаг 6: Отчёт в спеке и отметки в бэклоге**

В `docs/specs/06a-evening-reflection.md` поменять статус на «ГОТОВО (веб-проверка пройдена),
ждёт лайв-проверки», отметить чек-лист «Готово, когда» и дописать раздел с отклонениями,
если они были.

В `docs/backlog.md` пометить 06а как `[~]` (сделано, ждёт лайв-проверки). Обновить раздел
«Статус» в `CLAUDE.md`: что выросло общего (`FilterChips`, `pickPhrase`, `reflection.ts`),
ловушка поверхностного слияния persist, число тестов.

- [ ] **Шаг 7: Коммит и push**

```bash
git add docs CLAUDE.md
git commit -m "docs: задача 06а — синхронизация доков и отчёт о веб-проверке"
git push
```

- [ ] **Шаг 8: Лайв-проверка**

Отдать Артёму на iPhone: хаптика ответа, читаемость свёрнутой строки и подписи «изменить можно
до полуночи», прокрутка ленты чипов до края, полоска распределения на реальном экране.
Задача закрыта только после его «ок» + push.

---

## Самопроверка плана

- **Покрытие спеки.** §1 данные → задачи 1 и 4. §2 journal.ts → 1. §3 reflection.ts → 2.
  §4 phrases.ts → 3. §5 контент → 3. §6 «Сегодня» → 6. §7 дневник → 8, 9, 10, 11. §8 страница
  карты → 12. §9 настройки → 13. §10 тексты → 5. Расхождения с макетом → 14 (доки).
- **Порядок.** Чистые модули и стор идут раньше UI, поэтому каждый экран собирается из уже
  готовых и протестированных функций. Вынос `FilterChips` (7) и расшивка отступов профиля (8)
  идут ДО чипов в профиле (9) — иначе лента обрежется, и это спишут на баг компонента.
- **Имена сверены между задачами:** `canEditEntry`, `outcomeStats`, `filterEntries`,
  `filterCounts`, `JOURNAL_FILTERS`, `OUTCOME_MARK`, `reflectionVisible`, `REFLECT_HOUR`,
  `pickPhrase`, `setOutcome`, `setReflectionOn`, `setDevReflect`, `settings.reflectionOn`,
  `stats` (проп `MonthCard`), `resonated` (поле `CardHistory`).
- **Ловушки, отмеченные в шагах:** старый тест `cardHistory` падает без `resonated: 0`;
  локальная переменная `stats` в `MonthCard` конфликтует с новым пропом; `MonthCard` возвращал
  `null` без карты месяца; лента чипов не может лежать внутри `FadeUp` с `st.pad`;
  `keyboardShouldPersistTaps` нельзя потерять при выносе чипов; persist сливает `settings`
  поверхностно.
