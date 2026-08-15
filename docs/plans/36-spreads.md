# План 36 · Расклады: интерактив «разложить»

> **Для исполнителя (Opus 5):** выполнять по задачам через superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans. Чекбоксы `- [ ]` — трекинг шагов.
> Сабагентам ВСЕГДА указывать модель явно: реализация по готовому коду задач 1–13 — `sonnet`;
> ревью между задачами, веб-проверка (задача 15) и финальное ревью ветки — Opus.

**Цель:** тап по раскладу открывает полный цикл (вопрос → тасование → открытие тапом → значения →
«Состав расклада» без ИИ → сохранить в дневник / уйти без сохранения → «Сохранено ✓» + «Разложить
заново»); сохранённый расклад — вторая запись дневника с режимом просмотра.

**Архитектура:** чистые модули `spread.ts` (тасование, типы), `composition.ts` (правила состава),
`spreadLayout.ts` (геометрия — один источник для мини-схемы списка и доски ≤5), расширение
`journal.ts` (единая лента дня + расклада) и `backup.ts` (`spreadsHistory`, persist v9). Экран —
один компонент `SpreadScreen` (`mode: 'play' | 'view'`) на два маршрута: играем во ВЛОЖЕННОМ стеке
таба `app/(tabs)/spreads/[id]` (таб-бар виден, черновик = состояние экрана), смотрим сохранённый
из дневника по корневому `app/spread/[ts]`. Компоненты плоские в `src/components/` с префиксом
`Spread*` (конвенция репозитория; в спеке путь `src/components/spread/…` — читать как плоский).

**Стек:** Expo SDK 54 (НЕ обновлять), React Native, expo-router (вложенный Stack в Tabs),
react-native-reanimated (переворот, fade), expo-image, zustand/persist, react-i18next, jest-expo.
Новых пакетов НЕТ.

**Спека:** `docs/specs/36-spreads.md` — «Решения брейншторма» и «Что делаем» А–В читать перед работой.

## Глобальные ограничения

- Ветка `feat/36-spreads` от `main`; merge только после лайв-проверки Артёма (CLAUDE.md, процесс).
- После КАЖДОГО шага с правкой кода — `npx tsc --noEmit` чист. `npm test` зелёный перед каждым
  коммитом (на старте ветки: 767 тестов в 26 сьютах).
- Комментарии в коде и сообщения коммитов — русские, без упоминаний ИИ и без трейлеров.
- Цвета ТОЛЬКО из `useTheme()`; хардкод запрещён (исключение — `BACK_COLORS` рубашки, уже
  существующее в `CardBack.tsx`, переезжает как есть). Значения из спеки Б (радиусы, кегли,
  отступы) — буквально.
- Тексты контента — только из `cards.json` / `spreads.json` / `composition.json` через `inLang`;
  язык — только `useLang()` (контракт-тест `langSources.test.ts` краснеет на инлайн-юнионе
  `'ru' | 'en'` и на касте `i18n.language.startsWith`).
- UI-строки — сразу в оба языка `src/lib/i18n.ts` (ru и en); число перед склоняемым словом в новых
  строках не ставить (logic-spec §10).
- `Math.random`/`Date.now` в тестах не использовать напрямую: у `dealSpread` rng — параметр;
  в тестах на долю перевёрнутых допускается `Math.random` по умолчанию (10 000 карт, порог ±3 п.п.
  = 6.5σ — не флейки).
- Persist: `SCHEMA_VERSION` → **9** (задача 6). Ветку `migrate` НЕ добавлять: `spreadsHistory` —
  ключ ВЕРХНЕГО уровня, дефолт `[]` доливается поверхностным слиянием.
- `pointerEvents` — только внутри стиля; `Alert.alert` не использовать (веб-заглушка) — только
  `ConfirmDialog`.
- Каждый новый маршрут корневого стека — под гардом `onboarded` в `app/_layout.tsx`.

---

### Задача 0: ветка

- [ ] **Шаг 0.1:** `git checkout main && git pull && git checkout -b feat/36-spreads`
- [ ] **Шаг 0.2:** `npx tsc --noEmit` чист, `npm test` — 767 зелёных (зафиксировать число в отчёте).

---

### Задача 1: `content/composition.json` — нормализация, `rankNames`, две правки + контракт-тест

**Файлы:**
- Изменить: `content/composition.json`
- Тест: `src/lib/__tests__/compositionContent.test.ts`

**Интерфейсы (даёт дальше):** форма файла — у ключей `majors`, `reversed`, `neutral`,
`suit.<wands|cups|swords|pentacles>`, `ranks.<aces|tens|courts|generic>` объект `{ variants: {ru,en}[] }`;
`rankNames: Record<'2'..'9', {ru, en}>`; `_comment` — строка.

- [ ] **Шаг 1.1: тест (красный).** Создать `src/lib/__tests__/compositionContent.test.ts`:

```ts
/** Контракт content/composition.json (спека 36): у каждого правила состава есть варианты на обоих
 *  канонических языках, у номиналов 2–9 — имена для плейсхолдера {rank}. Ловит опечатку редактора
 *  до того, как composition.ts вернёт пустую строку на экране. */
import compositionJson from '../../../content/composition.json';

type V = { ru: string; en: string };
type Node = { variants: V[] };
const json = compositionJson as unknown as {
  majors: Node;
  reversed: Node;
  neutral: Node;
  suit: Record<'wands' | 'cups' | 'swords' | 'pentacles', Node>;
  ranks: Record<'aces' | 'tens' | 'courts' | 'generic', Node>;
  rankNames: Record<string, V>;
};

const filled = (v: V) => typeof v.ru === 'string' && v.ru.trim().length > 0 && typeof v.en === 'string' && v.en.trim().length > 0;

const NODES: [string, Node][] = [
  ['majors', json.majors],
  ['reversed', json.reversed],
  ['neutral', json.neutral],
  ...(['wands', 'cups', 'swords', 'pentacles'] as const).map((s) => [`suit.${s}`, json.suit[s]] as [string, Node]),
  ...(['aces', 'tens', 'courts', 'generic'] as const).map((r) => [`ranks.${r}`, json.ranks[r]] as [string, Node]),
];

describe('composition.json — контракт (спека 36)', () => {
  it.each(NODES)('%s: массив variants с ru и en', (_key, node) => {
    expect(Array.isArray(node.variants)).toBe(true);
    expect(node.variants.length).toBeGreaterThan(0);
    for (const v of node.variants) expect(filled(v)).toBe(true);
  });

  it('rankNames: номиналы 2–9 на обоих языках', () => {
    for (let r = 2; r <= 9; r++) expect(filled(json.rankNames[String(r)])).toBe(true);
  });

  it('плейсхолдеры только из набора {x} {n} {rank}', () => {
    const all = NODES.flatMap(([, node]) => node.variants.flatMap((v) => [v.ru, v.en]));
    for (const text of all) {
      for (const m of text.matchAll(/\{(\w+)\}/g)) expect(['x', 'n', 'rank']).toContain(m[1]);
    }
  });
});
```

- [ ] **Шаг 1.2:** `npx jest src/lib/__tests__/compositionContent.test.ts` — красный (у `ranks.*` нет `variants`,
  нет `rankNames`).

- [ ] **Шаг 1.3: правка `composition.json`.** Секцию `ranks` заменить на:

```json
 "ranks": {
  "aces": {
   "variants": [
    {
     "ru": "В раскладе {x} туза — сразу несколько начал. Какое из них ваше?",
     "en": "{x} Aces in this spread — several beginnings at once. Which one is yours?"
    }
   ]
  },
  "tens": {
   "variants": [
    {
     "ru": "{x} десятки — несколько историй подходят к завершению. Какую пора отпустить с благодарностью?",
     "en": "{x} Tens — several stories are reaching completion. Which one is ready to be released with gratitude?"
    }
   ]
  },
  "courts": {
   "variants": [
    {
     "ru": "Придворных карт в раскладе — {x}: вокруг вашего вопроса много людей и ролей. Чья роль здесь главная?",
     "en": "{x} court cards — many people and roles surround your question. Whose role matters most here?"
    }
   ]
  },
  "generic": {
   "variants": [
    {
     "ru": "Номинал «{rank}» повторяется {x} раза — тема настойчиво возвращается. Что она хочет от вас?",
     "en": "The rank “{rank}” repeats {x} times — the theme keeps returning. What does it want from you?"
    }
   ]
  }
 },
 "rankNames": {
  "2": { "ru": "Двойка", "en": "Two" },
  "3": { "ru": "Тройка", "en": "Three" },
  "4": { "ru": "Четвёрка", "en": "Four" },
  "5": { "ru": "Пятёрка", "en": "Five" },
  "6": { "ru": "Шестёрка", "en": "Six" },
  "7": { "ru": "Семёрка", "en": "Seven" },
  "8": { "ru": "Восьмёрка", "en": "Eight" },
  "9": { "ru": "Девятка", "en": "Nine" }
 },
```

  Кроме того: в `suit.pentacles.variants[1].ru` заменить «разговор о устойчивости» → «разговор об
  устойчивости». В `_comment` дописать в конец: « Числительные: {x} у aces/tens/generic не больше 4
  (в колоде 4 туза, 4 десятки, 4 карты номинала), у courts — до 10, поэтому фраза courts не ставит
  число перед склоняемым словом.» Остальные ключи (`majors`, `suit`, `reversed`, `neutral`) не трогать.
  ⚠️ Русская фраза courts переписана: старая «{x} придворные карты» ломалась с x ≥ 5 («5 придворные
  карты»), а в кельтском кресте придворных бывает до 10 — класс бага hf-02.

- [ ] **Шаг 1.4:** тест зелёный; `python scripts/check_canon.py --scope cards --only 3` НЕ трогает
  composition.json (просто убедиться, что конвейер не читает файл: grep `composition` по `scripts/` пуст).
- [ ] **Шаг 1.5: коммит** `content: composition.json — variants у номиналов, rankNames, безопасная форма courts (spec 36)`.

---

### Задача 2: `Spread` в `content.ts`, `src/lib/spread.ts` (типы, тасование, константы), `normalizeText`

**Файлы:**
- Изменить: `src/lib/content.ts` (типизация `spreads`, `spreadById`)
- Изменить: `src/lib/journal.ts` (`normalizeText`, `normalizeNote` через него)
- Создать: `src/lib/spread.ts`
- Тест: `src/lib/__tests__/spread.test.ts`

**Интерфейсы (даёт дальше):**
- `content.ts`: `interface Spread { id: string; free: boolean; cards: number; name: Localized; description: Localized; positions: Localized[] }`;
  `spreads: Spread[]`; `spreadById: Map<string, Spread>`.
- `journal.ts`: `normalizeText(text: string, max: number): string`.
- `spread.ts`: `interface DrawnCard { cardId: string; reversed: boolean }`;
  `interface SpreadDraw { ts: number; date: string; spreadId: string; cards: DrawnCard[]; question?: string; note?: string }`;
  `SPREADS_MAX = 100`, `QUESTION_MAX = 200`, `REVERSED_P = 0.3`;
  `dealSpread(count: number, rng?: () => number): DrawnCard[]`;
  `normalizeQuestion(text: string): string`;
  `cardMeaning(cardId: string, reversed: boolean, lang: Lang): { text: string; todo: boolean }`.

- [ ] **Шаг 2.1: `content.ts`.** После `CourseModule` добавить и заменить строку `spreads`:

```ts
/** Расклад каталога (content/spreads.json, спека 36): позиции — в порядке открытия/сохранения,
 *  их ровно `cards`; геометрия на экране живёт не здесь, а в src/lib/spreadLayout.ts. */
export interface Spread {
  id: string;
  /** freemium-флаг: false = PREMIUM-бейдж в списке; в v1 не блокирует (product-spec §4) */
  free: boolean;
  cards: number;
  name: Localized;
  description: Localized;
  positions: Localized[];
}
```
  и `export const spreads = (spreadsJson as any).spreads as Spread[];`, а после `cardById`:
  `export const spreadById = new Map(spreads.map((s) => [s.id, s]));`.

- [ ] **Шаг 2.2: `journal.ts`.** Заменить `normalizeNote`:

```ts
/** Текст перед записью в стор: пробелы по краям срезаем, лишнее сверх лимита отбрасываем.
 *  Общий для заметки дня, заметки и вопроса расклада (спека 36). */
export function normalizeText(text: string, max: number): string {
  return text.trim().slice(0, max);
}

/** Заметка карты дня — normalizeText с лимитом NOTE_MAX. */
export function normalizeNote(text: string): string {
  return normalizeText(text, NOTE_MAX);
}
```

- [ ] **Шаг 2.3: тест (красный).** Создать `src/lib/__tests__/spread.test.ts`:

```ts
import { cardById, spreads } from '../content';
import { NOTE_MAX, normalizeText } from '../journal';
import { cardMeaning, dealSpread, normalizeQuestion, QUESTION_MAX, REVERSED_P, SPREADS_MAX } from '../spread';

/** Линейный конгруэнтный генератор — детерминированный rng для тестов вместо Math.random. */
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

describe('dealSpread — тасование (logic-spec §1а)', () => {
  it('константы схемы (logic-spec §7)', () => {
    expect(SPREADS_MAX).toBe(100);
    expect(QUESTION_MAX).toBe(200);
    expect(REVERSED_P).toBe(0.3);
  });

  it('1000 раскладов «Кельтский крест» — внутри расклада карты не повторяются и все из колоды', () => {
    for (let i = 0; i < 1000; i++) {
      const d = dealSpread(10);
      expect(d).toHaveLength(10);
      expect(new Set(d.map((c) => c.cardId)).size).toBe(10);
      for (const c of d) expect(cardById.has(c.cardId)).toBe(true);
    }
  });

  it('доля перевёрнутых по 10 000 картам — 30 % ± 3 п.п.', () => {
    let reversed = 0;
    for (let i = 0; i < 1000; i++) reversed += dealSpread(10).filter((c) => c.reversed).length;
    const share = reversed / 10000;
    expect(share).toBeGreaterThan(0.27);
    expect(share).toBeLessThan(0.33);
  });

  it('rng выше порога — все прямые, ниже — все перевёрнутые', () => {
    expect(dealSpread(5, () => 0.5).every((c) => !c.reversed)).toBe(true);
    expect(dealSpread(5, () => 0.1).every((c) => c.reversed)).toBe(true);
  });

  it('один и тот же сид даёт один и тот же расклад', () => {
    expect(dealSpread(7, lcg(7))).toEqual(dealSpread(7, lcg(7)));
    expect(dealSpread(7, lcg(7))).not.toEqual(dealSpread(7, lcg(8)));
  });

  it('у каждого расклада каталога позиций ровно cards', () => {
    for (const s of spreads) expect(s.positions).toHaveLength(s.cards);
  });
});

describe('normalizeQuestion / normalizeText', () => {
  it('срезает пробелы и лишнее сверх лимита', () => {
    expect(normalizeQuestion('  вопрос  ')).toBe('вопрос');
    expect(normalizeQuestion('а'.repeat(QUESTION_MAX + 5))).toHaveLength(QUESTION_MAX);
    expect(normalizeText('  x ', NOTE_MAX)).toBe('x');
  });
});

describe('cardMeaning — текст значения для позиции', () => {
  it('прямая — general, перевёрнутая — reversed, todo-блок помечается', () => {
    const fool = cardById.get('fool')!;
    expect(cardMeaning('fool', false, 'ru')).toEqual({ text: fool.content.general.ru, todo: false });
    expect(cardMeaning('fool', true, 'en')).toEqual({ text: fool.content.reversed.en, todo: false });
    // испанского текста нет — фолбэк на английский (inLang)
    expect(cardMeaning('fool', false, 'es').text).toBe(fool.content.general.en);
    expect(cardMeaning('нет-такой', false, 'ru')).toEqual({ text: '', todo: true });
  });
});
```

- [ ] **Шаг 2.4:** `npx jest src/lib/__tests__/spread.test.ts` — красный (модуля нет).

- [ ] **Шаг 2.5: `src/lib/spread.ts`:**

```ts
/** Расклады: запись, тасование, лимиты и текст позиции (спека 36, logic-spec §1а/§7).
 *  Чистый модуль без react/expo — целиком под юнит-тестами (spread.test.ts). */
import { cardById, cards } from './content';
import { inLang, type Lang } from './lang';
import { normalizeText } from './journal';

/** Карта в позиции расклада. Порядок в массиве = порядок позиций spreads.json. */
export interface DrawnCard {
  cardId: string;
  reversed: boolean;
}

/** Сохранённый расклад (logic-spec §1а). `ts` — момент тасования в мс и одновременно идентификатор
 *  записи: раскладов в один день может быть несколько, дата ключом не годится. */
export interface SpreadDraw {
  ts: number;
  date: string; // YYYY-MM-DD, локальный день тасования
  spreadId: string;
  cards: DrawnCard[];
  question?: string;
  note?: string;
}

/** Предел истории раскладов (logic-spec §7): старые отрезаются. */
export const SPREADS_MAX = 100;
/** Предел длины вопроса к раскладу; заметка — NOTE_MAX из journal.ts. */
export const QUESTION_MAX = 200;
/** Вероятность перевёрнутой карты в раскладе (logic-spec §1а). */
export const REVERSED_P = 0.3;

export function normalizeQuestion(text: string): string {
  return normalizeText(text, QUESTION_MAX);
}

/** Тасуем все 78 (Фишер–Йетс), берём первые count — карта не может выпасть дважды в одном раскладе;
 *  каждой независимо reversed с вероятностью REVERSED_P. rng — параметр ради детерминированных
 *  тестов; в приложении — Math.random (криптостойкость не нужна). */
export function dealSpread(count: number, rng: () => number = Math.random): DrawnCard[] {
  const ids = cards.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count).map((cardId) => ({ cardId, reversed: rng() < REVERSED_P }));
}

/** Текст значения позиции: general у прямой, reversed у перевёрнутой (product-spec §4).
 *  Блок со статусом todo (или неизвестная карта) → todo: true, экран показывает «Текст готовится». */
export function cardMeaning(cardId: string, reversed: boolean, lang: Lang): { text: string; todo: boolean } {
  const block = cardById.get(cardId)?.content[reversed ? 'reversed' : 'general'];
  if (!block || block.status === 'todo') return { text: '', todo: true };
  return { text: inLang(block, lang), todo: false };
}
```

- [ ] **Шаг 2.6:** тест зелёный; `npx tsc --noEmit` чист (в `app/(tabs)/spreads.tsx` `s: any` пока
  остаётся — не трогать, файл уйдёт в задаче 8).
- [ ] **Шаг 2.7: коммит** `feat: тип Spread, тасование раскладов и normalizeText (spec 36)`.

---

### Задача 3: `pickVariant` в `phrases.ts` + `src/lib/composition.ts` (правила состава)

**Файлы:**
- Изменить: `src/lib/phrases.ts`
- Создать: `src/lib/composition.ts`
- Тест: `src/lib/__tests__/composition.test.ts` (плюс `phrases.test.ts` остаётся зелёным без правок)

**Интерфейсы (даёт дальше):**
- `phrases.ts`: `pickVariant(variants: Localized[], seedKey: string, lang: Lang, vars?: Record<string, string | number>): string`.
- `composition.ts`: `type Suit = 'wands' | 'cups' | 'swords' | 'pentacles'`;
  `type ObservationKey = 'majors' | \`suit.${Suit}\` | 'reversed' | 'ranks.aces' | 'ranks.tens' | 'ranks.courts' | 'ranks.generic' | 'neutral'`;
  `interface Observation { key: ObservationKey; vars: Record<string, number> }`;
  `analyzeSpread(cards: DrawnCard[]): Observation[]`; `compositionTexts(obs: Observation[], dateISO: string, lang: Lang): string[]`.

- [ ] **Шаг 3.1: `phrases.ts` — выделить выборщик.** Заменить `pickPhrase` на:

```ts
/** Выбор варианта из готового списка: hash(seedKey) % число вариантов, плейсхолдеры {card},
 *  {name}, {n}, {x}, {rank} подставляются ПОСЛЕ выбора (logic-spec §9). Неизвестный плейсхолдер
 *  остаётся в тексте как есть — это заметно при вычитке, в отличие от тихого «undefined».
 *  Общий для phrases.json (pickPhrase) и composition.json (composition.ts, спека 36). */
export function pickVariant(
  variants: Localized[],
  seedKey: string,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  if (variants.length === 0) return '';
  const text = inLang(variants[fnv1a32(seedKey) % variants.length], lang);
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Вариант системной фразы по ключу phrases.json: сид — дата и ключ, поэтому в течение дня
 *  формулировка стабильна, назавтра, как правило, другая. */
export function pickPhrase(
  key: string,
  dateISO: string,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  return pickVariant(variantsAt(key), `${dateISO}:${key}`, lang, vars);
}
```
  Сид `${dateISO}:${key}` тот же, что был, — `phrases.test.ts` обязан остаться зелёным без правок.

- [ ] **Шаг 3.2: тест (красный).** Создать `src/lib/__tests__/composition.test.ts`:

```ts
import { analyzeSpread, compositionTexts, type Observation } from '../composition';
import type { DrawnCard } from '../spread';

// имена id — из content/cards.json: старшие по имени, младшие <масть><номер> (w/c/s/p + 01..14)
const c = (cardId: string, reversed = false): DrawnCard => ({ cardId, reversed });
const keys = (obs: Observation[]) => obs.map((o) => o.key);

describe('analyzeSpread — правила состава (logic-spec §1б, спека 36 А)', () => {
  it('1. все три карты старшие → одно наблюдение majors {3, 3}', () => {
    const obs = analyzeSpread([c('empress'), c('justice', true), c('fool')]);
    expect(obs).toEqual([{ key: 'majors', vars: { x: 3, n: 3 } }]);
  });

  it('2. Двойка и Пятёрка Кубков + Туз Мечей → suit.cups (2 из 3 младших)', () => {
    expect(keys(analyzeSpread([c('c02'), c('c05', true), c('s01')]))).toEqual(['suit.cups']);
  });

  it('3. кельтский крест: 5 старших, 3 Жезла, 2 Кубка, 5 перевёрнутых → majors, suit.wands, reversed', () => {
    const cards = [
      c('fool', true), c('magician', true), c('empress', true), c('sun', true), c('moon', true),
      c('w03'), c('w05'), c('w07'), c('c02'), c('c04'),
    ];
    const obs = analyzeSpread(cards);
    expect(keys(obs)).toEqual(['majors', 'suit.wands', 'reversed']);
    expect(obs[0].vars).toEqual({ x: 5, n: 10 });
    expect(obs[2].vars).toEqual({ x: 5, n: 10 });
  });

  it('4. два туза и две придворные → одно наблюдение ranks.aces (равенство — по порядку правил)', () => {
    const obs = analyzeSpread([c('w01'), c('c01'), c('s03'), c('p11'), c('w12')]);
    expect(obs).toEqual([{ key: 'ranks.aces', vars: { x: 2 } }]);
  });

  it('5. две Двойки + Луна → ranks.generic с номером', () => {
    expect(analyzeSpread([c('w02'), c('c02'), c('moon')])).toEqual([
      { key: 'ranks.generic', vars: { x: 2, rank: 2 } },
    ]);
  });

  it('6. ничего не сработало → neutral', () => {
    expect(analyzeSpread([c('fool'), c('w03'), c('c07')])).toEqual([{ key: 'neutral', vars: {} }]);
  });

  it('7. три Пятёрки разных мастей + две старшие → только ranks.generic {3, 5}', () => {
    expect(analyzeSpread([c('c05'), c('s05'), c('w05'), c('moon'), c('sun')])).toEqual([
      { key: 'ranks.generic', vars: { x: 3, rank: 5 } },
    ]);
  });

  it('масть при ничьей лидеров не срабатывает; одна младшая карта — тоже нет', () => {
    expect(keys(analyzeSpread([c('c02'), c('s02'), c('fool'), c('sun'), c('w03')]))).not.toContain('suit.cups');
    expect(keys(analyzeSpread([c('c02'), c('fool'), c('sun')]))).not.toContain('suit.cups');
  });

  it('половина перевёрнутых при чётном числе карт срабатывает', () => {
    expect(keys(analyzeSpread([c('w03', true), c('c07', true), c('fool'), c('p09')]))).toContain('reversed');
  });

  it('пустой вход → neutral, не падает', () => {
    expect(analyzeSpread([])).toEqual([{ key: 'neutral', vars: {} }]);
  });
});

describe('compositionTexts — тексты из composition.json', () => {
  const obs = analyzeSpread([c('w02'), c('c02'), c('moon')]);

  it('одна дата — один и тот же текст 100 раз, плейсхолдеры подставлены', () => {
    const texts = new Set(Array.from({ length: 100 }, () => compositionTexts(obs, '2026-08-15', 'ru')[0]));
    expect(texts.size).toBe(1);
    const t = [...texts][0];
    expect(t).toContain('Двойка');
    expect(t).not.toMatch(/\{/);
  });

  it('английский берёт английское имя номинала', () => {
    expect(compositionTexts(obs, '2026-08-15', 'en')[0]).toContain('Two');
  });

  it('majors подставляет x и n', () => {
    const t = compositionTexts([{ key: 'majors', vars: { x: 2, n: 3 } }], '2026-08-15', 'ru')[0];
    expect(t).toMatch(/2/);
    expect(t).toMatch(/3/);
    expect(t).not.toMatch(/\{/);
  });

  it('за 30 дней у majors чередуются разные варианты', () => {
    const texts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        compositionTexts([{ key: 'majors', vars: { x: 2, n: 3 } }], `2026-08-${String(i + 1).padStart(2, '0')}`, 'ru')[0],
      ),
    );
    expect(texts.size).toBeGreaterThan(1);
  });
});
```
  ⚠️ Перед запуском проверить id младших карт в `content/cards.json` (grep `"id": "w02"`, `"c05"`,
  `"p11"`, `"w12"`, `"s01"`): если схема id иная — поправить фикстуры теста, не код.

- [ ] **Шаг 3.3:** тест красный (модуля нет).

- [ ] **Шаг 3.4: `src/lib/composition.ts`:**

```ts
/** «Состав расклада» — офлайн-наблюдения без ИИ (logic-spec §1б, спека 36 А). Чистый модуль:
 *  правила отдают КЛЮЧИ и числа, тексты берутся из content/composition.json детерминированно
 *  (hash(дата расклада + ключ) — при повторном открытии из дневника текст не меняется).
 *  Тон текстов — редактор; здесь только арифметика. */
import compositionJson from '../../content/composition.json';
import { cardById, type TarotCard } from './content';
import { inLang, type Lang, type Localized } from './lang';
import { pickVariant } from './phrases';
import type { DrawnCard } from './spread';

export type Suit = NonNullable<TarotCard['suit']>;
export type ObservationKey =
  | 'majors'
  | `suit.${Suit}`
  | 'reversed'
  | 'ranks.aces'
  | 'ranks.tens'
  | 'ranks.courts'
  | 'ranks.generic'
  | 'neutral';

export interface Observation {
  key: ObservationKey;
  /** x — счёт, n — знаменатель (число карт), rank — номер номинала у generic */
  vars: Record<string, number>;
}

const SUITS: Suit[] = ['wands', 'cups', 'swords', 'pentacles'];
const RANK_ACE = 1;
const RANK_TEN = 10;
const COURT_FROM = 11; // Паж 11 · Рыцарь 12 · Королева 13 · Король 14

/** Правило 4: одно наблюдение о номиналах — группа с наибольшим счётом; при равенстве
 *  порядок aces → tens → courts → номиналы 2–9 по возрастанию (порядок добавления кандидатов). */
function rankObservation(minors: TarotCard[]): Observation | null {
  const count = (pred: (c: TarotCard) => boolean) => minors.filter(pred).length;
  const candidates: Observation[] = [];
  const aces = count((c) => c.number === RANK_ACE);
  if (aces >= 2) candidates.push({ key: 'ranks.aces', vars: { x: aces } });
  const tens = count((c) => c.number === RANK_TEN);
  if (tens >= 2) candidates.push({ key: 'ranks.tens', vars: { x: tens } });
  const courts = count((c) => c.number >= COURT_FROM);
  if (courts >= 2) candidates.push({ key: 'ranks.courts', vars: { x: courts } });
  for (let rank = 2; rank < RANK_TEN; rank++) {
    const k = count((c) => c.number === rank);
    if (k >= 2) candidates.push({ key: 'ranks.generic', vars: { x: k, rank } });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cand) => (cand.vars.x > best.vars.x ? cand : best));
}

/** Наблюдения по правилам 1–4 в этом порядке (все сработавшие, 1–4 штуки);
 *  ничего не сработало → одно neutral. Пороги — спека 36 А. */
export function analyzeSpread(drawn: DrawnCard[]): Observation[] {
  const cards = drawn.map((d) => cardById.get(d.cardId)).filter((c): c is TarotCard => !!c);
  const n = cards.length;
  const out: Observation[] = [];

  // 1. Старшие арканы — не меньше половины карт
  const majors = cards.filter((c) => c.arcana === 'major').length;
  if (n > 0 && majors * 2 >= n) out.push({ key: 'majors', vars: { x: majors, n } });

  // 2. Одна масть — единственный лидер, не меньше двух карт и не меньше половины младших
  const minors = cards.filter((c) => c.arcana === 'minor');
  if (minors.length >= 2) {
    const bySuit = SUITS.map((s) => ({ s, k: minors.filter((c) => c.suit === s).length }));
    const best = Math.max(...bySuit.map((b) => b.k));
    const leaders = bySuit.filter((b) => b.k === best);
    if (best >= 2 && best * 2 >= minors.length && leaders.length === 1) {
      out.push({ key: `suit.${leaders[0].s}`, vars: { x: best, n: minors.length } });
    }
  }

  // 3. Перевёрнутых — не меньше половины
  const reversed = drawn.filter((d) => d.reversed).length;
  if (n > 0 && reversed * 2 >= n) out.push({ key: 'reversed', vars: { x: reversed, n } });

  // 4. Совпадение номиналов (только младшие)
  const rank = rankObservation(minors);
  if (rank) out.push(rank);

  return out.length > 0 ? out : [{ key: 'neutral', vars: {} }];
}

type VariantsNode = { variants: Localized[] };
const json = compositionJson as unknown as {
  majors: VariantsNode;
  reversed: VariantsNode;
  neutral: VariantsNode;
  suit: Record<Suit, VariantsNode>;
  ranks: Record<'aces' | 'tens' | 'courts' | 'generic', VariantsNode>;
  rankNames: Record<string, Localized>;
};

function variantsFor(key: ObservationKey): Localized[] {
  if (key.startsWith('suit.')) return json.suit[key.slice('suit.'.length) as Suit].variants;
  if (key.startsWith('ranks.')) return json.ranks[key.slice('ranks.'.length) as 'aces'].variants;
  return json[key as 'majors' | 'reversed' | 'neutral'].variants;
}

/** Тексты наблюдений: вариант — fnv1a(дата:ключ) % число вариантов (logic-spec §9),
 *  {rank} — имя номинала на языке из rankNames, {x}/{n} — числа. */
export function compositionTexts(obs: Observation[], dateISO: string, lang: Lang): string[] {
  return obs.map((o) => {
    const vars: Record<string, string | number> = { ...o.vars };
    if (o.vars.rank !== undefined) vars.rank = inLang(json.rankNames[String(o.vars.rank)], lang);
    return pickVariant(variantsFor(o.key), `${dateISO}:${o.key}`, lang, vars);
  });
}
```

- [ ] **Шаг 3.5:** `npx jest src/lib/__tests__/composition.test.ts src/lib/__tests__/phrases.test.ts` — зелёные;
  `npx tsc --noEmit` чист.
- [ ] **Шаг 3.6: коммит** `feat: правила «Состава расклада» и общий выборщик вариантов (spec 36)`.

---

### Задача 4: `src/lib/spreadLayout.ts` — геометрия раскладов

**Файлы:**
- Создать: `src/lib/spreadLayout.ts`
- Тест: `src/lib/__tests__/spreadLayout.test.ts`

**Интерфейсы (даёт дальше):**
- `interface Pt { x: number; y: number }`; `SPREAD_LAYOUTS: Record<string, Pt[]>`;
- `MINI = { cellW: 13, cellH: 20, stepX: 19, stepY: 22, boxW: 52, boxH: 64 }`;
  `miniCells(spreadId: string): { left: number; top: number }[]`;
- `BOARD = { cardW: 88, cardH: 150, gap: 10, labelH: 48 }`;
  `interface BoardLayout { cardW: number; cardH: number; width: number; height: number; cells: { left: number; top: number }[] }`;
  `boardLayout(spreadId: string, availWidth: number): BoardLayout`;
- `isBoard(cards: number): boolean` (≤5 — доска, иначе лента).

- [ ] **Шаг 4.1: тест (красный).** `src/lib/__tests__/spreadLayout.test.ts`:

```ts
import { spreads } from '../content';
import { BOARD, boardLayout, isBoard, MINI, miniCells, SPREAD_LAYOUTS } from '../spreadLayout';

describe('SPREAD_LAYOUTS — контракт с spreads.json', () => {
  it('у каждого расклада каталога раскладка ровно на cards позиций', () => {
    for (const s of spreads) expect(SPREAD_LAYOUTS[s.id]).toHaveLength(s.cards);
  });
});

describe('miniCells — мини-схема списка (макет .diag, ячейка 13×20)', () => {
  it('три карты — ряд 0/19/38, как в макете', () => {
    expect(miniCells('three-card')).toEqual([{ left: 0, top: 0 }, { left: 19, top: 0 }, { left: 38, top: 0 }]);
  });
  it('«На отношения» — крест макета: боковые между рядами (y 0.5 → 11), центр колонки 19', () => {
    expect(miniCells('relationship')).toEqual([
      { left: 0, top: 11 }, { left: 38, top: 11 }, { left: 19, top: 0 }, { left: 19, top: 22 }, { left: 19, top: 44 },
    ]);
  });
  it('кельтский крест — координаты макета (пересекающая карта смещена на 6px)', () => {
    const cells = miniCells('celtic-cross');
    expect(cells[0]).toEqual({ left: 14, top: 16 });
    expect(cells[1]).toEqual({ left: 20, top: 16 });
    expect(cells[4]).toEqual({ left: 0, top: 16 });
    expect(cells[9]).toEqual({ left: 44, top: 36 });
  });
  it('подкова — дуга макета', () => {
    expect(miniCells('horseshoe')).toEqual([
      { left: 0, top: 0 }, { left: 6, top: 20 }, { left: 16, top: 32 }, { left: 28, top: 36 },
      { left: 40, top: 32 }, { left: 50, top: 20 }, { left: 56, top: 0 },
    ]);
  });
  it('коробка макета 52×64', () => {
    expect(MINI.boxW).toBe(52);
    expect(MINI.boxH).toBe(64);
  });
});

describe('boardLayout — доска ≤5 карт', () => {
  const AVAIL = 390 - 48; // экран 390 минус два отступа 24

  it('три карты в ряд: карта 88×150, ширина 284, высота карта + подпись', () => {
    const l = boardLayout('three-card', AVAIL);
    expect(l.cardW).toBe(88);
    expect(l.cardH).toBe(150);
    expect(l.width).toBe(284);
    expect(l.height).toBe(150 + BOARD.labelH);
    expect(l.cells.map((c) => c.left)).toEqual([0, 98, 196]);
  });

  it('четыре в ряд не влезают в 342 → карта уменьшается до 78×133 с сохранением пропорции', () => {
    const l = boardLayout('month-ahead', AVAIL);
    expect(l.cardW).toBe(78);
    expect(l.cardH).toBe(133);
    expect(l.width).toBeLessThanOrEqual(AVAIL);
  });

  it('крест «На отношения»: три колонки, три ряда, шаг ряда включает полосу подписи', () => {
    const l = boardLayout('relationship', AVAIL);
    expect(l.width).toBe(284);
    expect(l.height).toBe(2 * (150 + BOARD.labelH) + 150 + BOARD.labelH);
    expect(l.cells[3]).toEqual({ left: 98, top: 150 + BOARD.labelH }); // «Что мешает» — центр
  });

  it('«Выбор из двух»: колонки на 0.2 и 1.8, «Вы» снизу по центру', () => {
    const l = boardLayout('choice', AVAIL);
    expect(l.width).toBeCloseTo(1.8 * 98 + 88, 5);
    expect(l.cells[0]).toEqual({ left: 98, top: 2 * (150 + BOARD.labelH) });
  });

  it('isBoard: до 5 карт — доска, 7 и 10 — лента', () => {
    expect(isBoard(3)).toBe(true);
    expect(isBoard(5)).toBe(true);
    expect(isBoard(7)).toBe(false);
    expect(isBoard(10)).toBe(false);
  });
});
```
- [ ] **Шаг 4.2:** тест красный.

- [ ] **Шаг 4.3: `src/lib/spreadLayout.ts`:**

```ts
/** Геометрия раскладов (спека 36 А): ОДИН источник для мини-схемы в списке (макет `.diag`,
 *  ячейка 13×20) и для доски ≤5 карт на экране (карта 88×150). Координаты — в дробных единицах
 *  «карта + зазор»: x вправо, y вниз, по точке на позицию в порядке spreads.json. Значения
 *  переведены из макета `SPS[].pos` (шаг колонки 19 = 13 + 6, шаг ряда 22 = 20 + 2).
 *  У раскладов 7–10 карт раскладка нужна только мини-схеме: на экране у них лента. */

export interface Pt {
  x: number;
  y: number;
}

const row = (n: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));

export const SPREAD_LAYOUTS: Record<string, Pt[]> = {
  'card-of-day': [{ x: 0, y: 0 }],
  'three-card': row(3),
  'situation-action-outcome': row(3),
  'month-ahead': row(4),
  // Вы · Партнёр · Соединяет · Мешает · Куда — крест, боковые карты между верхним и средним рядом
  relationship: [{ x: 0, y: 0.5 }, { x: 2, y: 0.5 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
  // Вы (снизу по центру) · A даст · A цена · B даст · B цена — две колонки над развилкой
  choice: [{ x: 1, y: 2 }, { x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 1.8, y: 0 }, { x: 1.8, y: 1 }],
  horseshoe: [
    { x: 0, y: 0 }, { x: 0.316, y: 0.909 }, { x: 0.842, y: 1.455 }, { x: 1.474, y: 1.636 },
    { x: 2.105, y: 1.455 }, { x: 2.632, y: 0.909 }, { x: 2.947, y: 0 },
  ],
  'celtic-cross': [
    { x: 0.737, y: 0.727 }, { x: 1.053, y: 0.727 }, { x: 0.737, y: 0 }, { x: 0.737, y: 1.545 },
    { x: 0, y: 0.727 }, { x: 1.474, y: 0.727 },
    { x: 2.316, y: 0 }, { x: 2.316, y: 0.545 }, { x: 2.316, y: 1.091 }, { x: 2.316, y: 1.636 },
  ],
};

/** Мини-схема списка: ячейка и шаги из макета `.sp .diag` / `.ccmap`. */
export const MINI = { cellW: 13, cellH: 20, stepX: 19, stepY: 22, boxW: 52, boxH: 64 } as const;

export function miniCells(spreadId: string): { left: number; top: number }[] {
  return (SPREAD_LAYOUTS[spreadId] ?? []).map((p) => ({
    left: Math.round(p.x * MINI.stepX),
    top: Math.round(p.y * MINI.stepY),
  }));
}

/** Доска на экране: карта `.s3card` 88×150, зазор `.s3row` 10, полоса подписи под картой
 *  (позиция до 2 строк 8.5px + имя карты) — 48. Шаг ряда включает полосу, иначе подписи
 *  наезжали бы на ряд ниже у креста «На отношения». */
export const BOARD = { cardW: 88, cardH: 150, gap: 10, labelH: 48 } as const;

export interface BoardLayout {
  cardW: number;
  cardH: number;
  width: number;
  height: number;
  cells: { left: number; top: number }[];
}

/** Не влезает в availWidth — уменьшаем карту с сохранением пропорции 88:150 (четыре в ряд
 *  на экране 390 → 78×133); зазор и полоса подписи не меняются. */
export function boardLayout(spreadId: string, availWidth: number): BoardLayout {
  const pts = SPREAD_LAYOUTS[spreadId] ?? [];
  const maxX = Math.max(0, ...pts.map((p) => p.x));
  const maxY = Math.max(0, ...pts.map((p) => p.y));
  const full = maxX * (BOARD.cardW + BOARD.gap) + BOARD.cardW;
  const cardW = full <= availWidth ? BOARD.cardW : Math.floor((availWidth - maxX * BOARD.gap) / (maxX + 1));
  const cardH = Math.round((cardW * BOARD.cardH) / BOARD.cardW);
  const stepX = cardW + BOARD.gap;
  const stepY = cardH + BOARD.labelH;
  return {
    cardW,
    cardH,
    width: maxX * stepX + cardW,
    height: maxY * stepY + cardH + BOARD.labelH,
    cells: pts.map((p) => ({ left: p.x * stepX, top: p.y * stepY })),
  };
}

/** ≤5 карт — геометрическая доска; 7–10 — лента позиций (product-spec §4 п.3). */
export const isBoard = (cards: number): boolean => cards <= 5;
```

- [ ] **Шаг 4.4:** тест зелёный (если `toBeCloseTo` у `choice` спорит с плавающей точкой — оставить
  `toBeCloseTo(264.4, 5)`); `tsc` чист.
- [ ] **Шаг 4.5: коммит** `feat: геометрия раскладов — мини-схема и доска (spec 36)`.

---

### Задача 5: `journal.ts` — единая лента дня и расклада

**Файлы:**
- Изменить: `src/lib/journal.ts`
- Тест: `src/lib/__tests__/journal.test.ts` (расширить; `filterEntries`/`filterCounts` заменяются)

**Интерфейсы (даёт дальше):**
- `type JournalEntry = { kind: 'day'; entry: DailyDraw } | { kind: 'spread'; entry: SpreadDraw }`;
- `journalKey(e: JournalEntry): string` — `d:<date>` / `s:<ts>`;
- `journalMonths(history: DailyDraw[], spreads: SpreadDraw[]): string[]`;
- `journalOfMonth(history: DailyDraw[], spreads: SpreadDraw[], month: string): JournalEntry[]`;
- `filterJournal(entries: JournalEntry[], filter: JournalFilter): JournalEntry[]`;
- `journalCounts(entries: JournalEntry[]): Record<JournalFilter, number>`;
- `monthsWithEntries(history)` остаётся (= `journalMonths(history, [])`); `filterEntries`/`filterCounts` УДАЛЯЮТСЯ.

- [ ] **Шаг 5.1: тесты (красный).** В `journal.test.ts` заменить импорты `filterCounts, filterEntries`
  на `filterJournal, journalCounts, journalKey, journalMonths, journalOfMonth, type JournalEntry` и
  `import type { SpreadDraw } from '../spread';`; добавить фикстуру и блок:

```ts
/** Сохранённый расклад — короткая запись для тестов ленты. */
const sp = (ts: number, date: string, question?: string, note?: string): SpreadDraw => ({
  ts,
  date,
  spreadId: 'three-card',
  cards: [{ cardId: 'fool', reversed: false }, { cardId: 'sun', reversed: true }, { cardId: 'moon', reversed: false }],
  ...(question ? { question } : {}),
  ...(note ? { note } : {}),
});
const asDay = (e: DailyDraw): JournalEntry => ({ kind: 'day', entry: e });

describe('единая лента дня и расклада (спека 36)', () => {
  const history = [d('2026-08-14', 'fool', 'заметка дня'), o('2026-08-13', 'sun', 'no')];
  const spreads = [sp(2, '2026-08-14', 'вопрос'), sp(1, '2026-08-14'), sp(3, '2026-07-02', undefined, 'заметка')];

  it('journalMonths: месяцы обеих историй, новые первыми, без дублей', () => {
    expect(journalMonths(history, spreads)).toEqual(['2026-08', '2026-07']);
    expect(journalMonths([], [sp(9, '2026-06-01')])).toEqual(['2026-06']);
  });

  it('journalOfMonth: по дате убыв., внутри дня запись дня первой, расклады по ts убыв.', () => {
    const items = journalOfMonth(history, spreads, '2026-08');
    expect(items.map(journalKey)).toEqual(['d:2026-08-14', 's:2', 's:1', 'd:2026-08-13']);
  });

  it('filterJournal: ответы — только дни; «с заметкой» — день с заметкой или расклад с заметкой/вопросом', () => {
    const items = journalOfMonth(history, spreads, '2026-08');
    expect(filterJournal(items, 'no').map(journalKey)).toEqual(['d:2026-08-13']);
    expect(filterJournal(items, 'note').map(journalKey)).toEqual(['d:2026-08-14', 's:2']);
    expect(filterJournal(items, 'all')).toBe(items);
  });

  it('journalCounts: «Все» считает и расклады', () => {
    const items = journalOfMonth(history, spreads, '2026-08');
    expect(journalCounts(items)).toEqual({ all: 4, yes: 0, partly: 0, no: 1, note: 2 });
  });

  it('journalKey уникален у двух раскладов одного дня', () => {
    expect(journalKey({ kind: 'spread', entry: sp(1, '2026-08-14') })).not.toBe(
      journalKey({ kind: 'spread', entry: sp(2, '2026-08-14') }),
    );
  });

  it('старые вызовы фильтров переписаны на ленту: тот же ответ по дням', () => {
    const items = history.map(asDay);
    expect(filterJournal(items, 'note').map(journalKey)).toEqual(['d:2026-08-14']);
    expect(journalCounts(items).all).toBe(2);
  });
});
```
  Существующие тесты на `filterEntries`/`filterCounts` переписать через `filterJournal(entries.map(asDay), …)`
  и `journalCounts(entries.map(asDay))` — те же ожидания.

- [ ] **Шаг 5.2:** тест красный.

- [ ] **Шаг 5.3: `journal.ts`.** Добавить `import type { SpreadDraw } from './spread';` (тип-импорт —
  цикла в рантайме нет: spread.ts импортирует из journal только `normalizeText`). Заменить
  `monthsWithEntries`, удалить `filterEntries`/`filterCounts`, добавить:

```ts
/** Запись единой ленты дневника (спека 36): карта дня или сохранённый расклад. */
export type JournalEntry = { kind: 'day'; entry: DailyDraw } | { kind: 'spread'; entry: SpreadDraw };

/** Ключ строки списка: дата у дня больше не уникальна (в день бывает несколько раскладов). */
export function journalKey(e: JournalEntry): string {
  return e.kind === 'day' ? `d:${e.entry.date}` : `s:${e.entry.ts}`;
}

/** Месяцы, в которых есть записи любого вида, новые первыми: `['2026-08', '2026-07']`.
 *  Навигатор дневника листает только их — пустых месяцев в ленте не бывает. */
export function journalMonths(history: DailyDraw[], spreads: SpreadDraw[]): string[] {
  const months = new Set([...history, ...spreads].map((x) => monthOf(x.date)));
  return [...months].sort().reverse();
}

/** Только дни (карточка месяца, тесты старых вызовов). */
export function monthsWithEntries(history: DailyDraw[]): string[] {
  return journalMonths(history, []);
}

/** Лента месяца: по дате убыв.; внутри одного дня — запись дня первой (утренний ритуал),
 *  затем расклады по ts убыв. (свежий выше). */
export function journalOfMonth(history: DailyDraw[], spreads: SpreadDraw[], month: string): JournalEntry[] {
  const days: JournalEntry[] = entriesOfMonth(history, month).map((entry) => ({ kind: 'day', entry }));
  const sp: JournalEntry[] = spreads
    .filter((s) => monthOf(s.date) === month)
    .map((entry) => ({ kind: 'spread', entry }));
  return [...days, ...sp].sort((a, b) => {
    if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === 'day' ? -1 : 1;
    if (a.kind === 'spread' && b.kind === 'spread') return b.entry.ts - a.entry.ts;
    return 0;
  });
}

/** Записи ленты под фильтром: ответы — только дни; «с заметкой» — день с заметкой или расклад,
 *  где пользователь что-то написал (заметка ИЛИ вопрос). */
export function filterJournal(entries: JournalEntry[], filter: JournalFilter): JournalEntry[] {
  if (filter === 'all') return entries;
  if (filter === 'note') {
    return entries.filter((e) => (e.kind === 'day' ? !!e.entry.note : !!(e.entry.note || e.entry.question)));
  }
  return entries.filter((e) => e.kind === 'day' && e.entry.outcome === filter);
}

/** Числа для чипов-фильтров. Чип с нулём не показывается, поэтому счёт нужен заранее. */
export function journalCounts(entries: JournalEntry[]): Record<JournalFilter, number> {
  return {
    all: entries.length,
    yes: filterJournal(entries, 'yes').length,
    partly: filterJournal(entries, 'partly').length,
    no: filterJournal(entries, 'no').length,
    note: filterJournal(entries, 'note').length,
  };
}
```

- [ ] **Шаг 5.4:** `npx jest src/lib/__tests__/journal.test.ts` зелёный. `npx tsc --noEmit` — упадёт
  в `app/(tabs)/profile.tsx` на удалённых `filterCounts/filterEntries`: временно (до задачи 13) заменить
  там `filterCounts(entries)` → `journalCounts(entries.map((entry) => ({ kind: 'day' as const, entry })))`
  и `filterEntries(entries, filter)` → `filterJournal(entries.map(…), filter).map((e) => e.entry as DailyDraw)`
  — минимальная правка импортов и двух строк, поведение прежнее; задача 13 перепишет экран целиком.
- [ ] **Шаг 5.5:** `tsc` чист, `npm test` зелёный. **Коммит** `feat: единая лента дневника — дни и расклады (spec 36)`.

---

### Задача 6: XP, стор, бэкап — `spreadsHistory`, `saveSpread`, persist v9

**Файлы:**
- Изменить: `src/lib/xp.ts`, `src/lib/backup.ts`, `src/store/useApp.ts`
- Тест: `src/lib/__tests__/backup.test.ts` (расширить), `src/lib/__tests__/xp.test.ts` (одна строка)

**Интерфейсы (даёт дальше):**
- `xp.ts`: `XP_SPREAD = 5`.
- `backup.ts`: `BackupState.spreadsHistory: SpreadDraw[]`; `SCHEMA_VERSION = 9`; `PERSIST_DEFAULTS.spreadsHistory`.
- `useApp.ts`: `spreadsHistory: SpreadDraw[]`; `saveSpread: (draw: SpreadDraw) => number` (начисленный XP; 0 при повторе `ts`).

- [ ] **Шаг 6.1: `xp.ts`.** Под `XP_REFLECT` добавить `export const XP_SPREAD = 5;` и поправить шапку
  («расклад целиком +5 при сохранении в дневник, спека 36»). В `xp.test.ts` (если есть блок констант)
  добавить `expect(XP_SPREAD).toBe(5)`; иначе — новый `it`.

- [ ] **Шаг 6.2: тесты бэкапа (красный).** В `backup.test.ts`: в `VALID` добавить поле

```ts
  spreadsHistory: [
    {
      ts: 1755100000000,
      date: '2026-08-14',
      spreadId: 'three-card',
      cards: [{ cardId: 'fool', reversed: false }, { cardId: 'magician', reversed: true }, { cardId: 'sun', reversed: false }],
      question: 'Стоит ли менять работу?',
      note: 'Колесо в настоящем',
    },
  ],
```
  и новый блок (рядом с тестами `parseBackup`; хелпер сборки файла — тот, что уже используется в файле,
  обычно `const file = (state) => JSON.stringify(buildBackup(state, SCHEMA_VERSION, AT))`):

```ts
describe('parseBackup — расклады (спека 36)', () => {
  const withSpreads = (spreadsHistory: unknown) =>
    parseBackup(JSON.stringify({ ...buildBackup(VALID, SCHEMA_VERSION, AT), state: { ...VALID, spreadsHistory } }), SCHEMA_VERSION);

  it('валидный расклад проходит и сохраняется', () => {
    const r = withSpreads(VALID.spreadsHistory);
    expect(r.ok && r.state.spreadsHistory).toEqual(VALID.spreadsHistory);
  });

  it('файл v8 без spreadsHistory доливается пустым списком', () => {
    const { spreadsHistory: _drop, ...old } = VALID;
    const raw = { ...buildBackup(VALID, 8, AT), schemaVersion: 8, state: old };
    const r = parseBackup(JSON.stringify(raw), SCHEMA_VERSION);
    expect(r.ok && r.state.spreadsHistory).toEqual([]);
  });

  const base = VALID.spreadsHistory[0];
  it.each([
    ['чужой spreadId', { ...base, spreadId: 'nope' }],
    ['число карт не совпадает с раскладом', { ...base, cards: base.cards.slice(0, 2) }],
    ['дубль карты внутри расклада', { ...base, cards: [base.cards[0], base.cards[0], base.cards[2]] }],
    ['чужой cardId', { ...base, cards: [{ cardId: 'нет', reversed: false }, base.cards[1], base.cards[2]] }],
    ['reversed не boolean', { ...base, cards: [{ cardId: 'fool', reversed: 1 }, base.cards[1], base.cards[2]] }],
    ['ts не число', { ...base, ts: '1' }],
    ['дата не ISO', { ...base, date: '14.08.2026' }],
    ['вопрос длиннее QUESTION_MAX', { ...base, question: 'в'.repeat(QUESTION_MAX + 1) }],
    ['заметка длиннее NOTE_MAX', { ...base, note: 'з'.repeat(NOTE_MAX + 1) }],
  ])('битый расклад: %s → corrupt', (_name, draw) => {
    expect(withSpreads([draw])).toEqual({ ok: false, error: 'corrupt' });
  });

  it('больше SPREADS_MAX раскладов → corrupt', () => {
    const many = Array.from({ length: SPREADS_MAX + 1 }, (_, i) => ({ ...base, ts: base.ts + i }));
    expect(withSpreads(many)).toEqual({ ok: false, error: 'corrupt' });
  });
});
```
  Импорты: `import { QUESTION_MAX, SPREADS_MAX } from '../spread';`. Существующий тест на
  `SCHEMA_VERSION` (если он проверяет число 8) → 9. Если существующие тесты перечисляют ключи
  `PERSIST_DEFAULTS`/`BACKUP_KEYS` буквально или сравнивают дефолты `toEqual` целиком — добавить
  туда `spreadsHistory: []` (ожидания меняются осознанно: поле новое).

- [ ] **Шаг 6.3:** тест красный (тип `VALID` не знает `spreadsHistory`, `tsc` ругается — нормально).

- [ ] **Шаг 6.4: `backup.ts`.** Импорты: `import { spreadById } from './content'` (в строке с `cardById`),
  `import { QUESTION_MAX, SPREADS_MAX, type SpreadDraw } from './spread';`. `SCHEMA_VERSION = 9` с
  комментарием «v8 → v9 (спека 36): `spreadsHistory` — ключ верхнего уровня, дефолт `[]` доливается
  сам». В `BackupState` после `history`: `spreadsHistory: SpreadDraw[];`. В `PERSIST_DEFAULTS` после
  `history`: `spreadsHistory: Object.freeze([]) as unknown as SpreadDraw[],`. Валидация — после `isDraw`:

```ts
const isDrawnCard = (v: unknown): boolean =>
  isObj(v) && isStr(v.cardId) && cardById.has(v.cardId) && isBool(v.reversed);

// расклад сверяем с каталогом: чужой spreadId или число карт не по раскладу — чужой/битый файл;
// дубль карты внутри расклада невозможен по построению (Фишер–Йетс, logic-spec §1а)
const isSpreadDraw = (v: unknown): boolean => {
  if (!isObj(v) || !isCount(v.ts) || !isISODay(v.date) || !isStr(v.spreadId)) return false;
  const spread = spreadById.get(v.spreadId);
  if (!spread || !Array.isArray(v.cards) || v.cards.length !== spread.cards || !v.cards.every(isDrawnCard)) return false;
  const ids = new Set((v.cards as { cardId: string }[]).map((c) => c.cardId));
  return (
    ids.size === v.cards.length &&
    orAbsent(v.question, (x) => isStr(x) && x.length <= QUESTION_MAX) &&
    orAbsent(v.note, (x) => isStr(x) && x.length <= NOTE_MAX)
  );
};
```
  и в `validState` после проверки `history`:
  `Array.isArray(s.spreadsHistory) && s.spreadsHistory.length <= SPREADS_MAX && s.spreadsHistory.every(isSpreadDraw) &&`.

- [ ] **Шаг 6.5: `useApp.ts`.** Импорты: `import { SPREADS_MAX, type SpreadDraw } from '../lib/spread';`,
  `XP_SPREAD` к `reflectXp, XP_DRAW`. В `AppState` после `history`:

```ts
  /** Сохранённые расклады (спека 36, logic-spec §7): новые сверху, не больше SPREADS_MAX.
   *  Несохранённый черновик сюда не попадает никогда — он живёт только в состоянии экрана. */
  spreadsHistory: SpreadDraw[];
```
  и в экшенах: `/** Сохранение расклада в дневник (спека 36): +5 XP; повтор того же ts ничего не пишет. */ saveSpread: (draw: SpreadDraw) => number;`.
  Реализация после `setOutcome`:

```ts
      // Сохранение расклада (спека 36). Идемпотентно по ts: двойной тап по «Сохранить» и повторный
      // вызов из-за перерисовки не должны дублировать запись и XP. Срез до SPREADS_MAX — как history.
      saveSpread: (draw) => {
        const { spreadsHistory, xp } = get();
        if (spreadsHistory.some((s) => s.ts === draw.ts)) return 0;
        set({ spreadsHistory: [draw, ...spreadsHistory].slice(0, SPREADS_MAX), xp: xp + XP_SPREAD });
        return XP_SPREAD;
      },
```
  В комментарии `version` персиста дописать: `// v8 → v9: spreadsHistory (спека 36) — ключ ВЕРХНЕГО
  уровня, дефолт [] доливается поверхностным слиянием, ветка миграции не нужна.` и «Следующая задача,
  меняющая схему, поднимает до 10».

- [ ] **Шаг 6.6:** `npx tsc --noEmit` чист (тип-контроль `backupCovers` доволен: поле в `BackupState`);
  `npm test` зелёный (backup: новые кейсы; старые тесты — `VALID` расширен).
- [ ] **Шаг 6.7: коммит** `feat: spreadsHistory в сторе и бэкапе, saveSpread +5 XP, persist v9 (spec 36)`.

---

### Задача 7: строки i18n (ru + en)

**Файлы:**
- Изменить: `src/lib/i18n.ts`

- [ ] **Шаг 7.1: ru.** После секции `spreads` добавить:

```ts
      // экран расклада (спека 36). Числительные не ставятся перед склоняемым словом (logic-spec §10):
      // «РАСКЛАД · N КАРТ» собирается из overline + spreads.cards капсом
      spread: {
        overline: "РАСКЛАД",
        hint: "Подумайте о своём вопросе и откройте карты по одной",
        question: "+ Ваш вопрос (необязательно)…",
        deal: "РАЗЛОЖИТЬ КАРТЫ",
        progress: "Открыто {{done}} из {{total}} · открывайте в своём темпе",
        tapToOpen: "Нажмите, чтобы открыть",
        reversedName: "{{name}} (перевёрнутая)",
        composition: "СОСТАВ РАСКЛАДА",
        noteLabel: "ЗАМЕТКА",
        notePlaceholder: "+ Что откликнулось…",
        save: "СОХРАНИТЬ В ДНЕВНИК",
        savedBtn: "СОХРАНЕНО В ДНЕВНИК ✓",
        again: "↺ РАЗЛОЖИТЬ ЗАНОВО",
        leaveTitle: "Уйти без сохранения?",
        leaveText: "Расклад исчезнет",
        leave: "Уйти", stay: "Остаться",
      },
```
  В `journal` добавить `spreadTag: "РАСКЛАД",`; в `card` добавить `backSpread: "Расклад",`.

- [ ] **Шаг 7.2: en.** Симметрично:

```ts
      spread: {
        overline: "SPREAD",
        hint: "Think of your question and open the cards one by one",
        question: "+ Your question (optional)…",
        deal: "LAY OUT THE CARDS",
        progress: "{{done}} of {{total}} open · take your time",
        tapToOpen: "Tap to open",
        reversedName: "{{name}} (reversed)",
        composition: "SPREAD COMPOSITION",
        noteLabel: "NOTE",
        notePlaceholder: "+ What resonated…",
        save: "SAVE TO JOURNAL",
        savedBtn: "SAVED TO JOURNAL ✓",
        again: "↺ LAY OUT AGAIN",
        leaveTitle: "Leave without saving?",
        leaveText: "The spread will disappear",
        leave: "Leave", stay: "Stay",
      },
```
  `journal.spreadTag: "SPREAD"`, `card.backSpread: "Spread"`.

- [ ] **Шаг 7.3:** `tsc` чист, `npm test` зелёный (тест `i18nPlurals` не задет). **Коммит**
  `feat: строки экрана расклада ru/en (spec 36)`.

---

### Задача 8: `CardBackSurface`, `SpreadDiagram`, список в папке `spreads/`, таб-бар по префиксу

**Файлы:**
- Создать: `src/components/CardBackSurface.tsx`; Изменить: `src/components/CardBack.tsx`
- Создать: `src/components/SpreadDiagram.tsx`
- Удалить: `app/(tabs)/spreads.tsx`; Создать: `app/(tabs)/spreads/_layout.tsx`, `app/(tabs)/spreads/index.tsx`,
  `app/(tabs)/spreads/[id].tsx` (пока заглушка — наполнится в задаче 12)
- Изменить: `app/(tabs)/_layout.tsx` (префикс пути), `src/lib/useTabScrollToTop.ts` (цепочка родителей)

**Интерфейсы (даёт дальше):** `CardBackSurface(): JSX` (absoluteFill-градиент рубашки, без эмблемы);
`SpreadDiagram({ spreadId }: { spreadId: string })`.

- [ ] **Шаг 8.1: `CardBackSurface.tsx`:**

```tsx
/** Поверхность рубашки — радиальный градиент `.backpat` эталона со смещённым вверх центром
 *  (`radial-gradient(95% 95% at 50% 28%)`); expo-linear-gradient такого не умеет, рисуем
 *  прямоугольник в react-native-svg. Общая для карты дня (CardBack — с эмблемой и словом ARCANUM)
 *  и карт расклада (SpreadCard/SpreadRow — только звезда ✶), спека 36. */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

/** Цвета рубашки из `.backpat` эталона. Не токены дизайн-системы, а два оттенка одной поверхности. */
export const BACK_COLORS = {
  dark: ['#1d2752', '#0c1130'],
  light: ['#f4ead0', '#e4d6b0'],
} as const;

const GRAD_ID = 'cardBackGlow';

export function CardBackSurface() {
  const t = useTheme();
  const [from, to] = BACK_COLORS[t.mode];
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={GRAD_ID} cx="50%" cy="28%" rx="95%" ry="95%">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${GRAD_ID})`} />
    </Svg>
  );
}
```
  В `CardBack.tsx`: удалить `BACK_COLORS`, `GRAD_ID`, импорт `Svg…` и `StyleSheet`-использование
  для Svg; вместо блока `<Svg …>…</Svg>` — `<CardBackSurface />` (импорт `./CardBackSurface`);
  строку `const [from, to] = …` убрать; комментарий шапки сократить (градиент описан в новом файле).

- [ ] **Шаг 8.2: `SpreadDiagram.tsx`:**

```tsx
/** Мини-схема позиций расклада в списке — блок `.sp .diag` эталона: коробка 52×64, ячейки 13×20
 *  radius 3 с рамкой frame на фоне chipBg по координатам из spreadLayout (спека 36). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MINI, miniCells } from '../lib/spreadLayout';
import { useTheme } from '../theme/useTheme';

export function SpreadDiagram({ spreadId }: { spreadId: string }) {
  const t = useTheme();
  return (
    <View style={st.box}>
      {miniCells(spreadId).map((c, i) => (
        <View key={i} style={[st.cell, { left: c.left, top: c.top, borderColor: t.frame, backgroundColor: t.chipBg }]} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: MINI.boxW, height: MINI.boxH },
  cell: { position: 'absolute', width: MINI.cellW, height: MINI.cellH, borderWidth: 1, borderRadius: 3 },
});
```

- [ ] **Шаг 8.3: папка маршрутов.** Удалить `app/(tabs)/spreads.tsx`. Создать `app/(tabs)/spreads/_layout.tsx`:

```tsx
/** Вложенный стек таба «Расклады» (спека 36): список → экран расклада. Таб-бар остаётся виден,
 *  между табами можно ходить — экран расклада не размонтируется, черновик живёт в его состоянии. */
import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../src/theme/useTheme';

export const unstable_settings = { initialRouteName: 'index' };

export default function SpreadsLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="index" />
      {/* шапка расклада — нативная прозрачная, как у страницы карты: свой заголовок не нужен,
          имя расклада уже в теле экрана; подпись «назад» ставит сам экран */}
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: '',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTintColor: t.accent,
        }}
      />
    </Stack>
  );
}
```
  Создать `app/(tabs)/spreads/[id].tsx` — ВРЕМЕННАЯ заглушка (наполнится в задаче 12):

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { spreadById } from '../../../src/lib/content';
import { useTheme } from '../../../src/theme/useTheme';

export default function SpreadPlayRoute() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!spreadById.get(id ?? '')) return <Redirect href="/spreads" />;
  return <View style={{ flex: 1, backgroundColor: t.bg }} />;
}
```
  Создать `app/(tabs)/spreads/index.tsx`:

```tsx
/** Каталог раскладов (product-spec §4): панель `.sp` = мини-схема позиций + имя + описание + PREMIUM.
 *  Тап — экран расклада во вложенном стеке этого таба (спека 36); «Карта дня» ведёт на «Сегодня». */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../../src/components/FadeUp';
import { PressableScale } from '../../../src/components/PressableScale';
import { ScreenBg } from '../../../src/components/ScreenBg';
import { SpreadDiagram } from '../../../src/components/SpreadDiagram';
import { Txt } from '../../../src/components/Txt';
import { spreads, type Spread } from '../../../src/lib/content';
import { hapticTap } from '../../../src/lib/haptics';
import { useLang } from '../../../src/lib/i18n';
import { inLang } from '../../../src/lib/lang';
import { useTabTopRef } from '../../../src/lib/useTabScrollToTop';
import { fonts, spacing } from '../../../src/theme/theme';
import { useTheme } from '../../../src/theme/useTheme';

export default function SpreadsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const scrollRef = useTabTopRef<ScrollView>();

  const open = (s: Spread) => {
    hapticTap();
    // «Карта дня» раскладом не играется — это ритуал главного экрана (product-spec §4)
    if (s.id === 'card-of-day') router.navigate('/');
    else router.push({ pathname: '/spreads/[id]', params: { id: s.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.sub, { color: t.muted }]}>{tr('spreads.overline')}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('spreads.title')}</Txt>
        </FadeUp>

        {spreads.map((s, si) => (
          <FadeUp key={s.id} index={1 + si}>
            <PressableScale onPress={() => open(s)} style={[st.item, { backgroundColor: t.panel, borderColor: t.line }]}>
              <SpreadDiagram spreadId={s.id} />
              <View style={st.tx}>
                <Txt style={[st.name, { color: t.head }]}>{inLang(s.name, lang)}</Txt>
                <Txt style={[st.desc, { color: t.muted }]}>
                  {tr('spreads.cards', { count: s.cards })} · {inLang(s.description, lang)}
                </Txt>
              </View>
              {!s.free && (
                <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                  <Txt style={{ color: t.accent, fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' }}>
                    {tr('spreads.premium')}
                  </Txt>
                </View>
              )}
            </PressableScale>
          </FadeUp>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
  // `.sp` эталона: radius 17, паддинг 15×17, отступ 12, ряд gap 14
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 17,
    paddingVertical: 15,
    paddingHorizontal: 17,
    marginTop: 12,
  },
  tx: { flex: 1 },
  name: { fontFamily: fonts.displaySemi, fontSize: 17 }, // `.sp .tx b`
  desc: { fontSize: 10, lineHeight: 15, marginTop: 3 }, // `.sp .tx small`
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
```

- [ ] **Шаг 8.4: таб-бар по префиксу (`app/(tabs)/_layout.tsx`).** Над `ROUTES` добавить:

```ts
/** Активна ли вкладка для текущего пути: сам маршрут таба или экран, вложенный в него
 *  (`/spreads/three-card` — по-прежнему «Расклады», спека 36); «/» — только точное совпадение. */
function tabActive(pathname: string, path: string): boolean {
  return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
}
```
  В `TabIcon`: `const active = tabActive(usePathname(), path);`. В `TabBarBackground`:
  `const idx = Math.max(0, ROUTES.findIndex((r) => tabActive(pathname, r.path)));`.

- [ ] **Шаг 8.5: `useTabScrollToTop.ts` — цепочка родителей.** Тип и эффект:

```ts
type TabNavigation = {
  addListener: (event: 'tabPress', cb: () => void) => () => void;
  isFocused: () => boolean;
  getParent: () => TabNavigation | undefined;
};

export function useTabScrollToTop(scrollToTop: () => void) {
  const nav = useNavigation() as unknown as TabNavigation;

  // `tabPress` эмитит таб-навигатор на СВОЙ маршрут; экран внутри вложенного стека (список
  // раскладов, спека 36) получает навигацию стека, поэтому подписываемся по всей цепочке
  // родителей — как useScrollToTop React Navigation. Фокус проверяем у самого экрана: при
  // открытом раскладе список не сфокусирован и к началу не едет
  React.useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let current: TabNavigation | undefined = nav;
    while (current) {
      unsubscribes.push(current.addListener('tabPress', () => { if (nav.isFocused()) scrollToTop(); }));
      current = current.getParent();
    }
    return () => unsubscribes.forEach((u) => u());
  }, [nav, scrollToTop]);
}
```

- [ ] **Шаг 8.6:** `npx tsc --noEmit` чист (typedRoutes может потребовать перезапуска dev-сервера,
  чтобы `.expo/types/router.d.ts` увидел `/spreads/[id]` — запустить `npx expo start --web` на минуту).
  `npm test` зелёный. Быстрая веб-проверка: список показывает мини-схемы (у трёх карт — ряд, у кельта —
  крест со «столбом»), тап по «Три карты» уводит на пустой экран с нативной шапкой и кнопкой назад,
  таб-бар остаётся, подсветка вкладки — на «Расклады»; тап по «Карта дня» — на «Сегодня».
- [ ] **Шаг 8.7: коммит** `feat: список раскладов с мини-схемами во вложенном стеке таба, рубашка вынесена в CardBackSurface (spec 36)`.

---

### Задача 9: `SpreadCard` (переворот) и `SpreadBoard` (доска ≤5)

**Файлы:**
- Создать: `src/components/SpreadCard.tsx`, `src/components/SpreadBoard.tsx`

**Интерфейсы (даёт дальше):**
- `SpreadCard({ cardId, reversed, open, width, height, animateFlip?, onPress })`
- `SpreadBoard({ spread, draw, opened, lang, onOpen(i), onPressCard(cardId), animateFlip })`

- [ ] **Шаг 9.1: `SpreadCard.tsx`:**

```tsx
/** Карта расклада на доске (`.s3card` эталона, design-system §5): 88×150 (или уменьшенная), radius 10,
 *  бордер frame, тень glow. Рубашка — поверхность CardBackSurface + звезда ✶; лицо — изображение
 *  (перевёрнутая — вверх ногами). Открытие — 3D-переворот 500 мс тем же приёмом, что у карты дня
 *  (две грани, rotateY 0→180 / 180→360, backfaceVisibility hidden). В просмотре сохранённого
 *  (animateFlip=false) карта сразу лежит лицом. Тень — на внешней обёртке: overflow hidden граней
 *  срезал бы её (схема CtaButton). */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cardImages } from '../lib/cardImages';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';
import { PressableScale } from './PressableScale';

const FLIP_MS = 500; // product-spec §4 п.2

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
  const flip = useSharedValue(open ? 1 : 0);

  React.useEffect(() => {
    if (!open) {
      flip.value = 0;
      return;
    }
    flip.value = animateFlip ? withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }) : 1;
  }, [open, animateFlip, flip]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));

  return (
    <PressableScale onPress={onPress} style={[st.wrap, { width, height, boxShadow: `0px 10px 26px ${t.glow}` }]}>
      <Animated.View style={[st.face, { borderColor: t.frame }, backStyle]}>
        <CardBackSurface />
        {/* ✶ отсутствует в Manrope — обычный Text без fontFamily (правило Txt.tsx) */}
        <Text style={[st.star, { color: t.accent }]}>✶</Text>
      </Animated.View>
      <Animated.View style={[st.face, { borderColor: t.frame }, frontStyle]}>
        <Image
          source={cardImages[cardId]}
          style={[st.img, reversed && st.reversed]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  wrap: { borderRadius: 10 },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 20 },
  img: { width: '100%', height: '100%' },
  reversed: { transform: [{ rotate: '180deg' }] },
});
```

- [ ] **Шаг 9.2: `SpreadBoard.tsx`:**

```tsx
/** Доска расклада ≤5 карт (`.s3row` эталона + геометрия spreadLayout, спека 36): позиции —
 *  абсолютно по boardLayout, под каждой картой подпись позиции (до 2 строк) и, после открытия,
 *  имя карты. Карты входят каскадом FadeUp (≤5 элементов, motion-spec §4). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { cardById, type Spread } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import type { SpreadDraw } from '../lib/spread';
import { boardLayout } from '../lib/spreadLayout';
import { spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { FadeUp } from './FadeUp';
import { SpreadCard } from './SpreadCard';
import { Txt } from './Txt';

export function SpreadBoard({
  spread,
  draw,
  opened,
  lang,
  onOpen,
  onPressCard,
  animateFlip,
}: {
  spread: Spread;
  draw: SpreadDraw;
  opened: boolean[];
  lang: Lang;
  onOpen: (index: number) => void;
  onPressCard: (cardId: string) => void;
  animateFlip: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { width } = useWindowDimensions();
  const lay = React.useMemo(() => boardLayout(spread.id, width - 2 * spacing.xl), [spread.id, width]);

  return (
    <View style={[st.board, { width: lay.width, height: lay.height }]}>
      {lay.cells.map((cell, i) => {
        const c = draw.cards[i];
        const card = cardById.get(c.cardId);
        const name = card ? inLang(card.name, lang) : c.cardId;
        return (
          // подпись обязана быть шириной с карту: собственная обёртка нужной ширины
          // с alignItems center (правило обёрток design-system §5)
          <FadeUp key={i} index={i + 1} style={[st.col, { left: cell.left, top: cell.top, width: lay.cardW }]}>
            <SpreadCard
              cardId={c.cardId}
              reversed={c.reversed}
              open={opened[i]}
              width={lay.cardW}
              height={lay.cardH}
              animateFlip={animateFlip}
              onPress={() => (opened[i] ? onPressCard(c.cardId) : onOpen(i))}
            />
            <Txt numberOfLines={2} style={[st.label, { color: t.muted }]}>
              {inLang(spread.positions[i], lang).toUpperCase()}
            </Txt>
            {opened[i] && (
              <Txt numberOfLines={1} style={[st.name, { color: t.head }]}>
                {c.reversed ? tr('spread.reversedName', { name }) : name}
              </Txt>
            )}
          </FadeUp>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  board: { alignSelf: 'center', marginTop: 22 }, // `.s3row` margin-top 22, по центру
  col: { position: 'absolute', alignItems: 'center' },
  label: { fontSize: 8.5, letterSpacing: 1.5, textAlign: 'center', marginTop: 7 }, // `.s3col small`
  name: { fontSize: 8.5, letterSpacing: 1.5, textAlign: 'center', marginTop: 1 }, // `.s3col small b`
});
```

- [ ] **Шаг 9.3:** `npx tsc --noEmit` чист. **Коммит** `feat: SpreadCard с переворотом и доска SpreadBoard (spec 36)`.

---

### Задача 10: `SpreadMeaning`, `SpreadCells`, `SpreadRow` (лента 7–10)

**Файлы:**
- Создать: `src/components/SpreadMeaning.tsx`, `src/components/SpreadCells.tsx`, `src/components/SpreadRow.tsx`

**Интерфейсы (даёт дальше):**
- `MeaningPanel({ title, paragraphs, todo?, accentBorder?, style? })`
- `SpreadCells({ total, opened })`
- `SpreadRow({ index, position, card, open, lang, onOpen, onPress })`

- [ ] **Шаг 10.1: `SpreadMeaning.tsx`:**

```tsx
/** Панель значения позиции / состава расклада (`.posmean` эталона, спека 36): panel/line radius 13,
 *  паддинг 11×13, заголовок 8.5px ls 2 accent, текст Cormorant 13.5/21. Появление — opacity 0→1
 *  и сдвиг 8→0 за 450 мс при монтировании (`.posmean.show`). accentBorder — рамка frame для
 *  «СОСТАВА РАСКЛАДА» (`#s3comp`). Панель монтируется в момент открытия карты, поэтому анимация
 *  висит на монтировании, а не на фокусе. */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

const ENTER_MS = 450;
const SHIFT = 8;

export function MeaningPanel({
  title,
  paragraphs,
  todo,
  accentBorder,
  style,
}: {
  title: string;
  paragraphs: string[];
  /** блок карты со статусом todo — «Текст готовится» курсивом цветом muted */
  todo?: boolean;
  accentBorder?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const v = useSharedValue(0);

  React.useEffect(() => {
    v.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [v]);

  const anim = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * SHIFT }],
  }));

  return (
    <Animated.View style={[st.panel, { backgroundColor: t.panel, borderColor: accentBorder ? t.frame : t.line }, anim, style]}>
      <Txt style={[st.title, { color: t.accent }]}>{title}</Txt>
      {paragraphs.map((p, i) => (
        <Txt key={i} style={[st.p, { color: todo ? t.muted : t.text }, todo && st.todo, i > 0 && st.gap]}>
          {p}
        </Txt>
      ))}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 13, marginTop: 9 },
  title: { fontSize: 8.5, letterSpacing: 2 },
  p: { fontFamily: fonts.display, fontSize: 13.5, lineHeight: 21, marginTop: 4 },
  gap: { marginTop: 6 },
  todo: { fontStyle: 'italic' },
});
```

- [ ] **Шаг 10.2: `SpreadCells.tsx`:**

```tsx
/** Ряд ячеек прогресса над лентой 7–10 карт (`.ccmap` эталона, design-system §5): 13×20 radius 3,
 *  зазор 4, перенос, ширина ≤200, по центру; открытая — фон chipBg + бордер frame, переход 300 мс. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MINI } from '../lib/spreadLayout';
import { useTheme } from '../theme/useTheme';

function Cell({ open }: { open: boolean }) {
  const t = useTheme();
  const v = useSharedValue(open ? 1 : 0);
  React.useEffect(() => {
    v.value = withTiming(open ? 1 : 0, { duration: 300 });
  }, [open, v]);
  // прозрачное «золото» вместо 'transparent': иначе интерполяция шла бы через чёрный
  const clear = `${t.accent}00`;
  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [clear, t.chipBg]),
    borderColor: interpolateColor(v.value, [0, 1], [t.line, t.frame]),
  }));
  return <Animated.View style={[st.cell, anim]} />;
}

export function SpreadCells({ total, opened }: { total: number; opened: boolean[] }) {
  return (
    <View style={st.row}>
      {Array.from({ length: total }, (_, i) => (
        <Cell key={i} open={!!opened[i]} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, maxWidth: 200, alignSelf: 'center', marginTop: 14 },
  cell: { width: MINI.cellW, height: MINI.cellH, borderWidth: 1, borderRadius: 3 },
});
```

- [ ] **Шаг 10.3: `SpreadRow.tsx`:**

```tsx
/** Строка позиции в ленте 7–10 карт (`.ccrow` эталона, design-system §5): мини-карта 34×56 +
 *  «N · ПОЗИЦИЯ» + (закрытая) «Нажмите, чтобы открыть» / (открытая) имя, ключевые слова и — решение
 *  брейншторма 36 — абзац значения под рядом на всю ширину панели. Тап по закрытой открывает,
 *  по открытой ведёт на страницу карты. Подмена содержимого при открытии — fade 250 мс. */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cardImages } from '../lib/cardImages';
import { cardById } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { cardMeaning, type DrawnCard } from '../lib/spread';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function SpreadRow({
  index,
  position,
  card,
  open,
  lang,
  onOpen,
  onPress,
}: {
  index: number;
  position: string;
  card: DrawnCard;
  open: boolean;
  lang: Lang;
  onOpen: () => void;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const data = cardById.get(card.cardId);
  const name = data ? inLang(data.name, lang) : card.cardId;
  const shownName = card.reversed ? tr('spread.reversedName', { name }) : name;
  const keywords = data ? inLang(data.keywords, lang).join(' · ') : '';
  const meaning = cardMeaning(card.cardId, card.reversed, lang);

  const v = useSharedValue(1);
  React.useEffect(() => {
    if (!open) return;
    v.value = 0;
    v.value = withTiming(1, { duration: 250 });
  }, [open, v]);
  const fade = useAnimatedStyle(() => ({ opacity: v.value }));

  return (
    <PressableScale onPress={open ? onPress : onOpen} style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
      <Animated.View style={fade}>
        <View style={st.line}>
          <View style={[st.thumb, { borderColor: t.frame }]}>
            {open ? (
              <Image source={cardImages[card.cardId]} style={[st.img, card.reversed && st.rev]} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <>
                <CardBackSurface />
                <Text style={[st.star, { color: t.accent }]}>✶</Text>
              </>
            )}
          </View>
          <View style={st.texts}>
            <Txt style={[st.pos, { color: t.accent }]}>{`${index + 1} · ${position.toUpperCase()}`}</Txt>
            {open ? (
              <>
                <Txt style={[st.name, { color: t.head }]}>{shownName}</Txt>
                {!!keywords && <Txt style={[st.keys, { color: t.muted }]}>{keywords}</Txt>}
              </>
            ) : (
              <Txt style={[st.closed, { color: t.muted }]}>{tr('spread.tapToOpen')}</Txt>
            )}
          </View>
        </View>
        {open && (
          <Txt style={[st.meaning, { color: meaning.todo ? t.muted : t.text }, meaning.todo && st.todo]}>
            {meaning.todo ? tr('card.soon') : meaning.text}
          </Txt>
        )}
      </Animated.View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  thumb: { width: 34, height: 56, borderRadius: 5, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  rev: { transform: [{ rotate: '180deg' }] },
  star: { fontSize: 13 },
  texts: { flex: 1 },
  pos: { fontSize: 8.5, letterSpacing: 1.8 },
  name: { fontFamily: fonts.display, fontSize: 15, marginTop: 1 },
  keys: { fontSize: 10.5, marginTop: 2 },
  closed: { fontSize: 12, marginTop: 1 },
  meaning: { fontFamily: fonts.display, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  todo: { fontStyle: 'italic' },
});
```

- [ ] **Шаг 10.4:** `tsc` чист. **Коммит** `feat: панель значения, ячейки прогресса и строка позиции ленты (spec 36)`.

---

### Задача 11: `SpreadFields` — поле вопроса, панель заметки с CTA и ссылкой «Разложить заново»; `disabled` у `CtaButton`

**Файлы:**
- Изменить: `src/components/CtaButton.tsx` (проп `disabled`)
- Создать: `src/components/SpreadFields.tsx`

**Интерфейсы (даёт дальше):**
- `CtaButton({ label, onPress, style?, disabled? })` — `disabled` гасит нажатие и ставит opacity 0.75.
- `QuestionField({ value, onChange, editable })`
- `NotePanel({ value, onChange, editable, showActions, saved, onSave, onAgain })`

- [ ] **Шаг 11.1: `CtaButton`.** Добавить проп `disabled?: boolean` и передать
  `disabled={disabled}` в `PressableScale`, в массив стилей — `disabled && st.disabled`, где
  `disabled: { opacity: 0.75 }` (макет `s3saved`: `opacity:.75`).

- [ ] **Шаг 11.2: `SpreadFields.tsx`:**

```tsx
/** Поля экрана расклада (спека 36): вопрос (`.qfield`), панель заметки (`.mean` + `.rnote`) с CTA
 *  и ссылкой «↺ Разложить заново». Пунктир = «можно написать», сплошной = «написано»/только чтение
 *  (паттерн NotePlate). Ввод — инлайн TextInput: на шаге настроя экран короткий, а у заметки
 *  клавиатуру отодвигает ScrollView (automaticallyAdjustKeyboardInsets). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { NOTE_MAX } from '../lib/journal';
import { QUESTION_MAX } from '../lib/spread';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CtaButton } from './CtaButton';
import { Txt } from './Txt';

// в браузере сфокусированное поле получает системную обводку — рядом с рамкой панели она читается второй
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

export function QuestionField({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (text: string) => void;
  editable: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const filled = value.length > 0;
  return (
    <View style={[st.q, { backgroundColor: t.panel, borderColor: t.line, borderStyle: filled || !editable ? 'solid' : 'dashed' }]}>
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={QUESTION_MAX}
          placeholder={tr('spread.question')}
          placeholderTextColor={t.muted}
          textAlignVertical="top"
          style={[st.qInput, { color: t.text }, noOutline]}
        />
      ) : (
        <Txt style={[st.qText, { color: t.text }]}>{value}</Txt>
      )}
    </View>
  );
}

export function NotePanel({
  value,
  onChange,
  editable,
  showActions,
  saved,
  onSave,
  onAgain,
}: {
  value: string;
  onChange: (text: string) => void;
  editable: boolean;
  /** play — CTA и ссылка; view — только текст */
  showActions: boolean;
  saved: boolean;
  onSave: () => void;
  onAgain: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const v = useSharedValue(0);
  React.useEffect(() => {
    v.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }); // `.mean.show`
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 12 }] }));
  const filled = value.length > 0;

  return (
    <Animated.View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }, anim]}>
      <Txt style={[st.label, { color: t.accent }]}>{tr('spread.noteLabel')}</Txt>
      <View style={[st.field, { borderColor: t.line, borderStyle: filled || !editable ? 'solid' : 'dashed' }]}>
        {editable ? (
          <TextInput
            value={value}
            onChangeText={onChange}
            multiline
            maxLength={NOTE_MAX}
            placeholder={tr('spread.notePlaceholder')}
            placeholderTextColor={t.muted}
            textAlignVertical="top"
            style={[st.input, { color: t.text }, noOutline]}
          />
        ) : (
          <Txt style={[st.text, { color: filled ? t.text : t.muted }]}>{filled ? value : tr('journal.noNote')}</Txt>
        )}
      </View>
      {showActions && <CtaButton label={saved ? tr('spread.savedBtn') : tr('spread.save')} onPress={onSave} disabled={saved} />}
      {showActions && saved && (
        <Pressable onPress={onAgain} style={st.againWrap} hitSlop={8}>
          {/* пунктирное подчёркивание frame — как «изменить можно до полуночи» в Reflection */}
          <Txt style={[st.again, { color: t.accent, borderBottomColor: t.frame }]}>{tr('spread.again')}</Txt>
        </Pressable>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // `.qfield`: panel + пунктир line, radius 13, паддинг 11×14, отступ 12, 12px
  q: { borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 14, marginTop: 12 },
  qInput: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, padding: 0, minHeight: 17 },
  qText: { fontSize: 12, lineHeight: 17 },
  // `.mean`: radius 18, паддинг 16×18, отступ 14
  panel: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, marginTop: 14 },
  label: { fontSize: 8.5, letterSpacing: 3 },
  // `.rnote`: пунктир line radius 11, паддинг 10×13, отступ 9, 11.5px
  field: { borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13, marginTop: 9 },
  input: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, padding: 0, minHeight: 32 },
  text: { fontSize: 11.5, lineHeight: 16 },
  againWrap: { alignSelf: 'center', marginTop: 10 },
  again: { fontSize: 11.5, letterSpacing: 1, borderBottomWidth: 1, borderStyle: 'dashed' },
});
```

- [ ] **Шаг 11.3:** `tsc` чист. **Коммит** `feat: поля вопроса и заметки расклада, disabled у CtaButton (spec 36)`.

---

### Задача 12: `SpreadScreen` + маршруты play/view + подписи «назад»

**Файлы:**
- Создать: `src/components/SpreadScreen.tsx`
- Изменить: `app/(tabs)/spreads/[id].tsx` (заглушка → экран), Создать: `app/spread/[ts].tsx`
- Изменить: `app/_layout.tsx` (маршрут под гардом), `app/card/[id].tsx` (`BACK_TITLES.spread`)

- [ ] **Шаг 12.1: `SpreadScreen.tsx`:**

```tsx
/** Экран расклада (спека 36, product-spec §4) — один компонент на два маршрута:
 *  play — app/(tabs)/spreads/[id] (вложенный стек таба: таб-бар виден, черновик = состояние экрана,
 *  ничего не персистится, закрыл приложение — пропал), view — app/spread/[ts] (просмотр сохранённого
 *  из дневника: всё открыто, только чтение). Стадии play: setup (вопрос + CTA «Разложить») → dealt
 *  (открываем тапом в любом порядке) → все открыты (состав + заметка + «Сохранить») → saved
 *  («Сохранено ✓» + «Разложить заново»). Гейт ухода — beforeRemove, как у заметки дня. */
import { router, Stack, useNavigation } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyzeSpread, compositionTexts } from '../lib/composition';
import { cardById, type Spread } from '../lib/content';
import { formatDayMonth, localDateISO } from '../lib/dates';
import { hapticReveal, hapticSuccess, hapticTap } from '../lib/haptics';
import { useLang } from '../lib/i18n';
import { normalizeNote } from '../lib/journal';
import { inLang } from '../lib/lang';
import { cardMeaning, dealSpread, normalizeQuestion, type DrawnCard, type SpreadDraw } from '../lib/spread';
import { isBoard } from '../lib/spreadLayout';
import { useApp } from '../store/useApp';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ConfirmDialog } from './ConfirmDialog';
import { CtaButton } from './CtaButton';
import { FadeUp } from './FadeUp';
import { Rule } from './Rule';
import { ScreenBg } from './ScreenBg';
import { SpreadBoard } from './SpreadBoard';
import { SpreadCells } from './SpreadCells';
import { NotePanel, QuestionField } from './SpreadFields';
import { MeaningPanel } from './SpreadMeaning';
import { SpreadRow } from './SpreadRow';
import { Txt } from './Txt';

export function SpreadScreen({
  spread,
  mode,
  saved,
}: {
  spread: Spread;
  mode: 'play' | 'view';
  /** сохранённый расклад — только для mode='view' */
  saved?: SpreadDraw;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const saveSpread = useApp((s) => s.saveSpread);

  const view = mode === 'view';
  const n = spread.cards;
  const [question, setQuestion] = React.useState(saved?.question ?? '');
  const [draw, setDraw] = React.useState<SpreadDraw | null>(saved ?? null);
  const [opened, setOpened] = React.useState<boolean[]>(() => (saved ? Array(n).fill(true) : []));
  // порядок открытия: блоки значений на доске идут в нём (макет appendChild); в view — по позициям
  const [order, setOrder] = React.useState<number[]>(() => (saved ? Array.from({ length: n }, (_, i) => i) : []));
  const [note, setNote] = React.useState(saved?.note ?? '');
  const [isSaved, setSaved] = React.useState(view);
  const [asking, setAsking] = React.useState(false);
  // действие навигации, задержанное вопросом «уйти без сохранения?»
  const pending = React.useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const leaving = React.useRef(false);

  const dealt = draw !== null;
  const openedCount = opened.filter(Boolean).length;
  const allOpen = dealt && openedCount === n;
  // гейт ухода: открыта хотя бы одна карта и расклад не сохранён; setup, ноль открытых, saved — свободно
  const dirty = !view && dealt && openedCount >= 1 && !isSaved;

  // перехватываем кнопку «назад», свайп и popToTop по повторному тапу на таб (спека 36)
  React.useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirty || leaving.current) return;
        e.preventDefault();
        pending.current = e.data.action;
        setAsking(true);
      }),
    [navigation, dirty],
  );

  const composition = React.useMemo(
    () => (draw && allOpen ? compositionTexts(analyzeSpread(draw.cards), draw.date, lang) : []),
    [draw, allOpen, lang],
  );

  const onDeal = () => {
    hapticReveal();
    setQuestion(normalizeQuestion(question)); // вопрос фиксируется ДО карт — расклад честный
    setDraw({ ts: Date.now(), date: localDateISO(), spreadId: spread.id, cards: dealSpread(n) });
    setOpened(Array(n).fill(false));
    setOrder([]);
  };
  const onOpen = (i: number) => {
    if (opened[i]) return;
    hapticTap();
    setOpened((prev) => prev.map((o, k) => k === i || o));
    setOrder((prev) => [...prev, i]);
  };
  const onCard = (cardId: string) => router.push({ pathname: '/card/[id]', params: { id: cardId, from: 'spread' } });
  const onSave = () => {
    if (!draw || isSaved) return;
    hapticSuccess();
    const q = normalizeQuestion(question);
    const nt = normalizeNote(note);
    saveSpread({ ...draw, ...(q ? { question: q } : {}), ...(nt ? { note: nt } : {}) });
    setSaved(true);
  };
  // «Разложить заново» — чистый лист, включая вопрос (тот же вопрос заново = тасовать до ответа)
  const onAgain = () => {
    hapticTap();
    setDraw(null);
    setOpened([]);
    setOrder([]);
    setQuestion('');
    setNote('');
    setSaved(false);
  };

  const nameOf = (c: DrawnCard) => {
    const card = cardById.get(c.cardId);
    const nm = card ? inLang(card.name, lang) : c.cardId;
    return c.reversed ? tr('spread.reversedName', { name: nm }) : nm;
  };
  const positionOf = (i: number) => inLang(spread.positions[i], lang);

  const overline = [
    tr('spread.overline'),
    tr('spreads.cards', { count: n }).toUpperCase(),
    ...(view && draw ? [formatDayMonth(draw.date, lang).toUpperCase()] : []),
  ].join(' · ');
  const board = isBoard(n);
  // после тасования пустое поле вопроса прячется: писать уже нельзя, показывать нечего
  const showQuestion = !dealt || question.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr(view ? 'card.backProfile' : 'spreads.title') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // insets.top + высота прозрачной системной шапки (64), как на странице карты
          paddingTop: insets.top + 64,
          paddingHorizontal: spacing.xl,
          paddingBottom: view ? 60 : 120, // в play под экраном таб-бар
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.overline, { color: t.muted }]}>{overline}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{inLang(spread.name, lang)}</Txt>
          <Rule />
        </FadeUp>

        {!view && (!dealt || board) && (
          <FadeUp index={1}>
            <Txt style={[st.hint, { color: t.muted }]}>{tr('spread.hint')}</Txt>
          </FadeUp>
        )}

        {showQuestion && (
          <FadeUp index={1}>
            <QuestionField value={question} onChange={setQuestion} editable={!dealt} />
          </FadeUp>
        )}

        {!dealt && (
          <FadeUp index={2}>
            <CtaButton label={tr('spread.deal')} onPress={onDeal} />
          </FadeUp>
        )}

        {draw && board && (
          <>
            <SpreadBoard
              spread={spread}
              draw={draw}
              opened={opened}
              lang={lang}
              onOpen={onOpen}
              onPressCard={onCard}
              animateFlip={!view}
            />
            {order.map((i) => {
              const c = draw.cards[i];
              const m = cardMeaning(c.cardId, c.reversed, lang);
              return (
                <MeaningPanel
                  key={i}
                  title={`${positionOf(i)} · ${nameOf(c)}`.toUpperCase()}
                  paragraphs={[m.todo ? tr('card.soon') : m.text]}
                  todo={m.todo}
                />
              );
            })}
          </>
        )}

        {draw && !board && (
          <>
            <FadeUp index={1}>
              <SpreadCells total={n} opened={opened} />
              {!view && (
                <Txt style={[st.progress, { color: t.muted }]}>
                  {tr('spread.progress', { done: openedCount, total: n })}
                </Txt>
              )}
            </FadeUp>
            {/* строки входят одним блоком: >8 элементов каскадом не оживляем (motion-spec §4) */}
            <FadeUp index={2}>
              {draw.cards.map((c, i) => (
                <SpreadRow
                  key={i}
                  index={i}
                  position={positionOf(i)}
                  card={c}
                  open={!!opened[i]}
                  lang={lang}
                  onOpen={() => onOpen(i)}
                  onPress={() => onCard(c.cardId)}
                />
              ))}
            </FadeUp>
          </>
        )}

        {draw && allOpen && (
          <>
            <MeaningPanel title={tr('spread.composition')} paragraphs={composition} accentBorder style={st.composition} />
            <NotePanel
              value={note}
              onChange={setNote}
              editable={!isSaved}
              showActions={!view}
              saved={isSaved}
              onSave={onSave}
              onAgain={onAgain}
            />
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={asking}
        title={tr('spread.leaveTitle')}
        message={tr('spread.leaveText')}
        confirmLabel={tr('spread.leave')}
        cancelLabel={tr('spread.stay')}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          leaving.current = true;
          if (pending.current) navigation.dispatch(pending.current);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  overline: { fontSize: 9.5, letterSpacing: 3, textAlign: 'center' }, // `.date`
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // `.h2`
  hint: { fontSize: 12, textAlign: 'center', marginTop: 6 },
  progress: { fontSize: 10.5, textAlign: 'center', marginTop: 8 },
  composition: { marginTop: 14 },
});
```

- [ ] **Шаг 12.2: `app/(tabs)/spreads/[id].tsx`** — заменить заглушку:

```tsx
/** Маршрут игры в расклад (спека 36): вложенный стек таба «Расклады». Каждый вход из списка —
 *  новый экземпляр экрана, то есть всегда новый расклад с шага «Настрой» (product-spec §4). */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SpreadScreen } from '../../../src/components/SpreadScreen';
import { spreadById } from '../../../src/lib/content';

export default function SpreadPlayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spread = spreadById.get(id ?? '');
  // «Карта дня» раскладом не играется (список ведёт на «Сегодня»), чужой id — назад в список
  if (!spread || spread.id === 'card-of-day') return <Redirect href="/spreads" />;
  return <SpreadScreen key={spread.id} spread={spread} mode="play" />;
}
```

- [ ] **Шаг 12.3: `app/spread/[ts].tsx`:**

```tsx
/** Просмотр сохранённого расклада из дневника (спека 36): корневой стек, а не вложенный в таб —
 *  иначе тап в профиле переключал бы таб на «Расклады», а «назад» вёл бы в список, не в дневник. */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { SpreadScreen } from '../../src/components/SpreadScreen';
import { spreadById } from '../../src/lib/content';
import { useApp } from '../../src/store/useApp';

export default function SpreadViewRoute() {
  const { ts } = useLocalSearchParams<{ ts: string }>();
  const saved = useApp((s) => s.spreadsHistory.find((d) => d.ts === Number(ts)));
  const spread = saved ? spreadById.get(saved.spreadId) : undefined;

  // записи нет (уехала за лимит 100 или сменилась импортом, пока экран был в стеке) — назад без диалогов
  React.useEffect(() => {
    if (!saved || !spread) router.back();
  }, [saved, spread]);

  if (!saved || !spread) return null;
  return <SpreadScreen spread={spread} mode="view" saved={saved} />;
}
```

- [ ] **Шаг 12.4: `app/_layout.tsx`.** Внутри `<Stack.Protected guard={onboarded}>` после `lesson/[id]`:

```tsx
          {/* просмотр сохранённого расклада (спека 36): корневой стек поверх любого таба, та же
              прозрачная шапка, что у страницы карты; объявлен здесь, чтобы не пройти мимо гарда */}
          <Stack.Screen
            name="spread/[ts]"
            options={{
              title: '',
              headerTransparent: true,
              headerStyle: { backgroundColor: 'transparent' },
              headerShadowVisible: false,
              headerTintColor: t.accent,
            }}
          />
```

- [ ] **Шаг 12.5: `app/card/[id].tsx`.** В `BACK_TITLES` добавить `spread: 'card.backSpread',` (комментарий
  над таблицей дополнить: «со страницы расклада — «Расклад»»). В `src/lib/haptics.ts` поправить
  комментарии к `hapticReveal` («переворот карты дня и тасование расклада») и `hapticSuccess`
  («…и сохранение расклада в дневник») — код не меняется.

- [ ] **Шаг 12.6:** `npx tsc --noEmit` чист (typedRoutes: `/spread/[ts]` появится после перезапуска
  dev-сервера, если `tsc` ругается на `pathname` — запустить `npx expo start --web` на минуту).
  `npm test` зелёный. Быстрая веб-проверка вручную (полная — задача 15): «Три карты» → вопрос → CTA →
  три рубашки → тап → переворот → блок значения → после третьей состав + заметка + CTA → сохранить →
  «Сохранено ✓» + ссылка → «Разложить заново» → чистый лист; назад при открытых картах → диалог.
- [ ] **Шаг 12.7: коммит** `feat: экран расклада — игра и просмотр, маршруты и подписи назад (spec 36)`.

---

### Задача 13: дневник — `JournalRow` для расклада и единая лента в профиле

**Файлы:**
- Изменить: `src/components/TabIcons.tsx` (проп `size`), `src/components/JournalRow.tsx`, `app/(tabs)/profile.tsx`

- [ ] **Шаг 13.1: `TabIcons.tsx`.** `TabIcon({ name, color, size = SIZE })` — проп `size?: number`, `Frame`
  получает `size` и ставит `width={size} height={size}` (глиф масштабируется viewBox'ом).

- [ ] **Шаг 13.2: `JournalRow.tsx`** — принимает `JournalEntry`:

```tsx
/** Строка дневника (`.jrow` эталона, design-system §5). Два вида записи (спека 36):
 *  день — мини-карта + дата + первая строка заметки, справа отметка рефлексии; тап — страница карты,
 *  долгий тап по СЕГОДНЯШНЕЙ — экран заметки (прошлые фиксируются в полночь, logic-spec §3);
 *  расклад — рамка с веером карт (глиф таба «Карты», не эмодзи 🃏 из макета — правило задачи 16) +
 *  дата «· РАСКЛАД» + «Имя · «вопрос или заметка»», справа ✦; тап — просмотр расклада. */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { spreadById } from '../lib/content';
import { formatEntryDate } from '../lib/dates';
import { hapticTap } from '../lib/haptics';
import { OUTCOME_COLOR, OUTCOME_MARK, type JournalEntry } from '../lib/journal';
import { inLang, type Lang } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { TabIcon } from './TabIcons';
import { Txt } from './Txt';

export function JournalRow({
  item,
  lang,
  onPress,
  onEdit,
}: {
  item: JournalEntry;
  lang: Lang;
  onPress: () => void;
  /** Только у сегодняшней записи дня; у раскладов и прошлых дней не задан. */
  onEdit?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  if (item.kind === 'spread') {
    const s = item.entry;
    const name = inLang(spreadById.get(s.spreadId)?.name ?? { ru: s.spreadId, en: s.spreadId }, lang);
    const text = s.note || s.question;
    return (
      <PressableScale onPress={onPress} style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
        <View style={[st.thumbClip, st.fan, { borderColor: t.frame }]}>
          <TabIcon name="cards" color={t.accent} size={16} />
        </View>
        <View style={st.texts}>
          <Txt style={[st.date, { color: t.muted }]}>
            {`${formatEntryDate(s.date, lang).toUpperCase()} · ${tr('journal.spreadTag')}`}
          </Txt>
          <Txt numberOfLines={1} style={[st.note, { color: text ? t.text : t.muted }]}>
            {text ? `${name} · «${text}»` : name}
          </Txt>
        </View>
        {/* ✦ отсутствует в Manrope — обычный Text (правило Txt.tsx) */}
        <Text style={[st.mark, { color: t.accent }]}>✦</Text>
      </PressableScale>
    );
  }

  const entry = item.entry;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={
        onEdit &&
        (() => {
          hapticTap();
          onEdit();
        })
      }
      style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      <View style={[st.thumbClip, { borderColor: t.frame }]}>
        <Image source={cardImages[entry.cardId]} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <View style={st.texts}>
        <Txt style={[st.date, { color: t.muted }]}>{formatEntryDate(entry.date, lang).toUpperCase()}</Txt>
        <Txt numberOfLines={1} style={[st.note, { color: entry.note ? t.text : t.muted }]}>
          {entry.note ?? tr('journal.noNote')}
        </Txt>
      </View>
      {entry.outcome && (
        <Txt style={[st.mark, { color: t[OUTCOME_COLOR[entry.outcome]] }]}>{OUTCOME_MARK[entry.outcome]}</Txt>
      )}
    </PressableScale>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: radius.m + 1, // 13 — как `.jrow`
    paddingVertical: 9,
    paddingHorizontal: spacing.m,
    marginTop: spacing.s,
  },
  thumbClip: { width: 30, height: 48, borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  fan: { alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '100%', height: '100%' },
  texts: { flex: 1 },
  date: { fontSize: 9, letterSpacing: 1.5 },
  note: { fontSize: 12, marginTop: 1 },
  mark: { fontSize: 12 },
});
```

- [ ] **Шаг 13.3: `profile.tsx`.** Импорты из `journal`: `entriesOfMonth, filterJournal, journalCounts,
  journalKey, journalMonths, journalOfMonth, JOURNAL_FILTERS, monthSummary, OUTCOME_MARK, outcomeStats,
  type JournalEntry, type JournalFilter` (убрать `DailyDraw`, `monthsWithEntries` и временные правки задачи 5).
  Правки тела:
  - `const listRef = useTabTopRef<FlatList<JournalEntry>>();`
  - `const spreadsHistory = useApp((s) => s.spreadsHistory);`
  - `const months = React.useMemo(() => journalMonths(history, spreadsHistory), [history, spreadsHistory]);`
  - `entries`/`summary`/`stats` (дневные, для карточки месяца) — без изменений;
  - `const items = React.useMemo(() => (month ? journalOfMonth(history, spreadsHistory, month) : []), [history, spreadsHistory, month]);`
  - `const counts = React.useMemo(() => journalCounts(items), [items]);`
  - `const shown = React.useMemo(() => filterJournal(items, filter), [items, filter]);`
  - `openSpread`: `const openSpread = (ts: number) => router.push({ pathname: '/spread/[ts]', params: { ts: String(ts) } });`
  - `FlatList` `data={shown}`, `keyExtractor={journalKey}`, `renderItem`:

```tsx
        renderItem={({ item, index }) => {
          const row = (
            <JournalRow
              item={item}
              lang={lang}
              onPress={() => (item.kind === 'day' ? openCard(item.entry.cardId) : openSpread(item.entry.ts))}
              // правится только сегодняшняя запись дня (logic-spec §3); у раскладов правки нет
              onEdit={
                item.kind === 'day' && item.entry.date === today
                  ? () => router.push({ pathname: '/note/[date]', params: { date: item.entry.date } })
                  : undefined
              }
            />
          );
          return index < BODY_ROWS ? (
            <FadeUp index={BODY_STEP} style={st.pad}>{row}</FadeUp>
          ) : (
            <View style={st.pad}>{row}</View>
          );
        }}
```
  - `ListEmptyComponent`: `entries.length === 0` → `items.length === 0`.
  - `MonthNav`/`MonthCard` условие оставить `month && summary &&` — при месяце только с раскладами
    `summary.count === 0`, `MonthCard` сама вернёт `null` (нет карты месяца и ответов), навигатор виден.

- [ ] **Шаг 13.4:** `tsc` чист, `npm test` зелёный. Веб: сохранить расклад → в профиле строка с веером,
  «· РАСКЛАД», «Три карты · «вопрос»», ✦; тап → просмотр (всё открыто, только чтение, назад → профиль);
  фильтр «С заметкой N» считает расклад с вопросом; два расклада в день — две строки.
- [ ] **Шаг 13.5: коммит** `feat: расклады в дневнике — строка с веером и режим просмотра (spec 36)`.

---

### Задача 14: документы

**Файлы:** `docs/logic-spec.md`, `docs/product-spec.md`, `docs/design-system.md`, `docs/backlog.md`

- [ ] **Шаг 14.1: `logic-spec.md`.**
  - §1а: заменить `SpreadDraw = {date, spreadId, cards: [{position, cardId, reversed}], note?}` на
    `SpreadDraw = {ts, date, spreadId, cards: [{cardId, reversed}] (в порядке позиций), question?, note?}`
    — `ts` (мс тасования) = идентификатор записи (в день бывает несколько раскладов); дописать
    «Реализовано ✅ (спека 36): `src/lib/spread.ts` — `dealSpread(count, rng)`; тест-кейсы там же».
  - §1б: после списка правил дописать абзац «**Точные пороги (спека 36):** majors — `2·m ≥ n`; масть —
    младших ≥2, лидер единственный, `best ≥ 2` и `2·best ≥ младших`; reversed — `2·r ≥ n`; номиналы —
    ОДНО наблюдение на правило: группы aces/tens/courts (все придворные вместе)/generic 2–9, счёт ≥2,
    побеждает наибольший, при равенстве aces → tens → courts → номиналы по возрастанию. Наблюдений
    может быть от 1 до 4 (все сработавшие по порядку); нейтральную не добиваем — «Преобладают Кубки» +
    «Состав ровный» противоречили бы друг другу. Реализовано ✅: `src/lib/composition.ts`
    (`analyzeSpread`/`compositionTexts`), выбор варианта — общий `pickVariant` (§9), `{rank}` — из
    `rankNames` composition.json».
  - §4: «расклад целиком +5» → «расклад +5 — при **сохранении в дневник** (не при открытии всех карт:
    иначе XP фармится циклом «открыл → ушёл без сохранения», спека 36)».
  - §7: в схеме `version: 8` → `9`, `spreadsHistory: SpreadDraw[100]` уже стоит; добавить абзац
    «**36 подняла `version` до 9** ради `spreadsHistory` — ключ ВЕРХНЕГО уровня, дефолт `[]` доливается
    поверхностным слиянием сам, `migrate` не менялся; бэкап валидирует каждую запись против каталога
    раскладов и колоды (`isSpreadDraw`). Следующая задача, меняющая схему, поднимает до 10.»
- [ ] **Шаг 14.2: `product-spec.md` §4.** Заголовок «✅→📋» → «✅ (36, реализовано 15.08)»; «мини-схема
  позиций 🔨» → «✅»; в п.1 дописать «после «Разложить карты» вопрос фиксируется — задан ДО карт»;
  п.3: «миниатюра схемы сверху» → «ряд ячеек прогресса сверху (открытые подсвечены) + «Открыто X из N»»;
  п.4: «в ленте 7–10 абзац значения — под строкой в той же панели (решение 15.08)»; п.5: «+5 XP
  при сохранении»; жизненный цикл: «Разложить заново» = чистый лист, включая вопрос; «Сохранённый
  расклад в дневнике»: иконка-веер = глиф таба «Карты», ✦ справа, просмотр — вопрос и заметка только
  чтение; фильтр «с заметкой» ловит расклад с заметкой ИЛИ вопросом.
- [ ] **Шаг 14.3: `design-system.md` §5.** После «Строка позиции расклада» дописать: «открытая строка
  несёт под рядом абзац значения (Cormorant 13.5/21, отступ 8, вся ширина панели) — спека 36»;
  новые абзацы: «**Доска расклада ≤5** — карта 88×150, зазор 10, полоса подписи под картой 48
  (позиция 8.5/ls 1.5 muted до 2 строк + имя head), шаг ряда = карта + 48; не влезает — карта
  уменьшается с сохранением пропорции (четыре в ряд — 78×133); отступ сверху 22, доска по центру»;
  «**Поле вопроса расклада** — panel, пунктир line radius 13, паддинг 11×14, отступ 12, 12px; после
  тасования — сплошной, только чтение; CTA «Разложить карты» под ним (отступ 14)»; «**Панель состава**
  — `.posmean` с бордером frame, отступ 14, абзацы Cormorant 13.5/21 с зазором 6»; «**Панель заметки
  расклада** — panel/line radius 18, паддинг 16×18, отступ 14; подпись 8.5/ls 3 accent; поле пунктир
  line radius 11, паддинг 10×13, 11.5px»; «**Мини-схема в списке раскладов** — коробка 52×64, ячейки
  13×20 radius 3 бордер frame фон chipBg по `spreadLayout.miniCells`»; «**Строка расклада в
  дневнике** — та же `.jrow`; вместо мини-карты рамка 30×48 (frame, radius 4) с глифом веера 16px
  accent; дата + « · РАСКЛАД»; «Имя · «текст»»; справа ✦ accent 12px».
- [ ] **Шаг 14.4: `backlog.md`.** Запись 36 уже ссылается на спеку и план (дописано при написании
  спеки); добавить строку «ГОТОВО В КОДЕ <дата>: … тестов, веб-проверка …, ждёт лайв-проверки»
  по образцу записи 27 (статус `[x]` — только после лайв-проверки, задача 15).
- [ ] **Шаг 14.5: коммит** `docs: logic-spec/product-spec/design-system/backlog под задачу 36`.

---

### Задача 15: веб-проверка 6а/6б → лайв-проверка → merge

- [ ] **Шаг 15.1: 6а.** `npx expo start --web`; Playwright (MCP или скрипт) с вьюпортом 390×844 —
  проверить `window.innerWidth === 390` замером; онбординг пройти или засеять состояние (⚠️ ловушка
  спеки 39: `addInitScript` выполняется на каждой навигации — перерегистрировать сид снятым состоянием
  после каждого шага, меняющего стор). Скриншоты в `docs/screenshots/36/`, обе темы: `list-*`
  (список с мини-схемами), `setup-*` («Три карты», вопрос введён), `three-open-*` (три открыты, одна
  перевёрнутая), `three-final-*` (состав + заметка + CTA), `three-saved-*` («Сохранено ✓» + ссылка),
  `celtic-closed-*`, `celtic-open-*` (2–3 открыты с абзацами), `month-*` («На месяц» четыре в ряд),
  `relationship-*` (крест), `view-*` (просмотр из дневника), `journal-*` (строка расклада), плюс кадры
  макета `mockup-spread3-*`, `mockup-spread10-*` из `docs/design-reference.html` (`show('v-spread3')`).
  Сверить по `docs/ui-verification.md`; расхождения — исправить или перечислить с причиной. Ожидаемые
  ЗАКОННЫЕ расхождения с макетом (флаги спеки В): CTA «Разложить» на шаге настроя, переворот вместо fade,
  абзац значения в строке ленты, поле вопроса и рула на кельте, overline «РАСКЛАД · 3 КАРТЫ»,
  подписи под картами в две строки у креста.
- [ ] **Шаг 15.2: 6б.** Прокликать: каждую панель списка (7 играбельных + «Карта дня» → «Сегодня»);
  на «Три карты» — вопрос (200 знаков режет), CTA, три тапа в произвольном порядке (первый открывает,
  повторный по открытой → страница карты с «‹ Расклад»), состав (1–4 абзаца, текст стабилен при
  повторном заходе из дневника), заметка, «Сохранить» (XP +5 в профиле, кнопка неактивна, ссылка
  появилась), «Разложить заново» (пусто, вопрос пуст), назад при открытых → диалог: «Остаться» держит,
  «Уйти» уводит без записи; переход на другой таб и обратно — карты на месте; повторный тап по табу
  «Расклады» при открытом раскладе → диалог; «Кельтский крест» — ячейки и «Открыто X из 10» растут,
  строки; «На месяц» — четыре карты влезли; «На отношения»/«Выбор» — подписи не наезжают; профиль —
  строка, фильтры, тап → просмотр, назад → профиль; экспорт → сброс → импорт возвращает расклады;
  консоль без НАШИХ ошибок (warning `pointerEvents` из react-navigation — известный, не наш).
- [ ] **Шаг 15.3:** отчёт в конец `docs/specs/36-spreads.md` (что сделано, замеры, расхождения, ловушки);
  `npm test` — итоговое число тестов и сьютов; коммит `docs: отчёт веб-проверки 36`; `git push -u origin feat/36-spreads`.
- [ ] **Шаг 15.4: 6в — лайв-проверка Артёма на iPhone:** вибрации (Heavy при тасовании, Light при
  открытии, Success при сохранении), переворот, клавиатура у поля заметки (поле не перекрыто),
  свайп назад с гейтом, повторный тап по табу, кельт целиком, дневник → просмотр → назад.
- [ ] **Шаг 15.5:** после ✓ — merge в `main`, `git push`, backlog `[x]`, статус в CLAUDE.md (раздел
  «Статус»: задача 36 закрыта, новое общее — `spread.ts`, `composition.ts`, `spreadLayout.ts`,
  `pickVariant`, `CardBackSurface`, `Spread*`-компоненты, `JournalEntry`, persist v9 → «следующая
  задача, меняющая схему, поднимает до 10»), CLAUDE.md-предупреждения из отчёта.

---

## Самопроверка плана (сделана при написании)

- Покрытие спеки: А (данные) — задачи 1–6; Б (экраны) — 8–13; В (документы) — 14; критерии приёмки — 15.
- Типы согласованы: `Spread`/`spreadById` (2) ← 8, 12, 13; `SpreadDraw`/`DrawnCard`/`dealSpread`/
  `cardMeaning`/`normalizeQuestion` (2) ← 3, 6, 9, 10, 12; `pickVariant` (3) ← 3; `analyzeSpread`/
  `compositionTexts` (3) ← 12; `boardLayout`/`miniCells`/`MINI`/`isBoard` (4) ← 8, 9, 10, 12;
  `JournalEntry`/`journalKey`/`journalMonths`/`journalOfMonth`/`filterJournal`/`journalCounts` (5) ← 13;
  `saveSpread`/`spreadsHistory` (6) ← 12, 13; i18n-ключи (7) ← 8–13; `CardBackSurface` (8) ← 9, 10;
  `CtaButton.disabled` (11) ← 11; `TabIcon.size` (13) ← 13.
- Плейсхолдеров «TBD/позже/аналогично» нет; каждый шаг с кодом несёт код.
