# План 46 — коллекция-альбом

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ sub-skill — superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans; задача за задачей, шаги с чекбоксами `- [ ]`.
> Модель сабагентов — **sonnet** (механическая реализация по точному коду ниже), ревью — сессия.

**Цель:** экран «Альбом» (`/collection`) с прогрессом «Открыто N из 78», сеткой открытых/закрытых
карт по секциям и строками нетронутых мастей; вход со вкладки «Карты»; всё выводится из
пройденных уроков, ничего нового не хранится.

**Архитектура:** чистый модуль `src/lib/collection.ts` (секции, прогресс, режим секции) под
тестами → три общих компонента (`StarBack` — вынос из `SpreadCard`/`SpreadRow`; `CardCell` —
вынос ячейки из справочника + режим «закрыто»; `CountRow` — строка-счётчик) → экран
`app/collection.tsx` (FlatList с типизированными элементами) под гардом онбординга → строка-вход
на «Картах» → документы и макет → веб-проверка 6а/6б.

**Стек:** Expo SDK 54 (НЕ обновлять), expo-router v6, zustand, reanimated, expo-image, jest-expo.

**Спека:** `docs/specs/46-collection.md` — план аргументирует от неё; исполнитель читает обе.

## Глобальные ограничения

- Язык комментариев и коммитов — русский; никаких упоминаний ИИ/Claude в коде, коммитах, доках.
- После КАЖДОГО шага с кодом — `npx tsc --noEmit` чистый; перед каждым коммитом с логикой — `npm test` зелёный.
- Цвета ТОЛЬКО из `useTheme()`/`theme.ts` — хардкод запрещён (исключение: `CardBackSurface`, он уже есть).
- `pointerEvents` — только внутри `style`, не пропом.
- Persist version НЕ поднимать (схема стора не меняется, остаётся 10); `backup.ts` не трогать.
- Новые UI-строки — сразу в `ru` И `en` в `src/lib/i18n.ts`; контент карт в коде не выдумывать.
- Правило DRY: «сначала выносы, потом новый код» — задачи 2–3 идут ДО экрана.
- Ветка `feat/46-collection`, коммиты по задачам; push после зелёных тестов.
- ⚠️ typedRoutes: `router.push('/collection')` не скомпилируется, пока нет файла `app/collection.tsx`
  и Metro не пересобрал `.expo/types/router.d.ts` — поэтому экран (задача 5) идёт РАНЬШЕ входа (задача 6);
  если `tsc` всё ещё не видит маршрут — один раз поднять `npx expo start --web` и остановить.

---

### Задача 0: ветка

- [ ] **Шаг 1:** `git checkout -b feat/46-collection` (от актуального `main`, рабочее дерево чистое).

---

### Задача 1: чистый модуль `src/lib/collection.ts` (TDD)

**Файлы:**
- Создать: `src/lib/collection.ts`
- Тест: `src/lib/__tests__/collection.test.ts`

**Интерфейсы:**
- Потребляет: `TarotCard` из `src/lib/content.ts` (`id`, `arcana: 'major'|'minor'`, `suit: 'wands'|'cups'|'swords'|'pentacles'|null`, `number`), `learnedCardIds(course, lessonsProgress): Set<string>` из `src/lib/courseProgress.ts`.
- Производит (для задач 5–6):
  - `type CollectionGroup = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'`
  - `const COLLECTION_GROUPS: readonly CollectionGroup[]`
  - `interface CollectionSection { group: CollectionGroup; cards: TarotCard[]; open: number; total: number }`
  - `groupOf(card: TarotCard): CollectionGroup`
  - `collectionSections(deck: readonly TarotCard[], learned: ReadonlySet<string>): CollectionSection[]`
  - `collectionProgress(sections: readonly CollectionSection[]): { open: number; total: number }`
  - `type SectionMode = 'grid' | 'row'`; `sectionMode(s: CollectionSection): SectionMode`

- [ ] **Шаг 1: написать падающий тест** `src/lib/__tests__/collection.test.ts`:

```ts
/** Коллекция-альбом (спека 46): секции, прогресс, режим секции — на РЕАЛЬНОЙ колоде и курсе,
 *  чтобы тест заодно был контрактом данных (22 старших + 4×14, m2l1–m2l4 = 8 старших макета). */
import {
  COLLECTION_GROUPS,
  collectionProgress,
  collectionSections,
  groupOf,
  sectionMode,
  type CollectionSection,
} from '../collection';
import { cards, course } from '../content';
import { learnedCardIds, type LessonProgressMap } from '../courseProgress';

const none = new Set<string>();
const byId = (id: string) => cards.find((c) => c.id === id)!;
const done = (...ids: string[]): LessonProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

describe('collectionSections', () => {
  it('пять секций в порядке экрана, тоталы 22 + 14×4 = 78', () => {
    const s = collectionSections(cards, none);
    expect(s.map((x) => x.group)).toEqual([...COLLECTION_GROUPS]);
    expect(s.map((x) => x.total)).toEqual([22, 14, 14, 14, 14]);
    expect(collectionProgress(s)).toEqual({ open: 0, total: 78 });
  });

  it('каждая карта колоды ровно в одной секции', () => {
    const all = collectionSections(cards, none).flatMap((x) => x.cards.map((c) => c.id));
    expect(all.length).toBe(cards.length);
    expect(new Set(all).size).toBe(cards.length);
  });

  it('внутри секции карты идут по возрастанию number: Дурак…Мир, Туз…Король', () => {
    const s = collectionSections(cards, none);
    for (const sec of s) {
      const nums = sec.cards.map((c) => c.number);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }
    const [major, wands] = s;
    expect(major.cards[0].id).toBe('fool');
    expect(major.cards[21].id).toBe('world');
    expect(wands.cards[0].id).toBe('w01');
    expect(wands.cards[13].id).toBe('w14');
  });

  it('open считает карты секции из множества; чужие id не считаются', () => {
    const learned = new Set(['fool', 'magician', 'w01', 'w02', 'w03', 'no-such-card']);
    const s = collectionSections(cards, learned);
    expect(s.map((x) => x.open)).toEqual([2, 3, 0, 0, 0]);
    expect(collectionProgress(s)).toEqual({ open: 5, total: 78 });
  });

  it('состояние макета: пройдены m2l1–m2l4 → открыто 8 из 78, старшие 8 из 22, масти по нулям', () => {
    const learned = learnedCardIds(course, done('m2l1', 'm2l2', 'm2l3', 'm2l4'));
    const s = collectionSections(cards, learned);
    expect(collectionProgress(s)).toEqual({ open: 8, total: 78 });
    expect(s[0]).toMatchObject({ group: 'major', open: 8, total: 22 });
    expect(s.slice(1).map((x) => x.open)).toEqual([0, 0, 0, 0]);
  });

  it('порядок секций не зависит от того, какие открыты (секция растёт на месте)', () => {
    const learned = learnedCardIds(course, done('m4l1')); // Жезлы 1–5
    const s = collectionSections(cards, learned);
    expect(s.map((x) => x.group)).toEqual([...COLLECTION_GROUPS]);
    expect(s.map(sectionMode)).toEqual(['row', 'grid', 'row', 'row', 'row']);
    expect(s[1].open).toBe(5);
  });
});

describe('sectionMode', () => {
  const sec = (open: number): CollectionSection => ({ group: 'cups', cards: [], open, total: 14 });
  it('ни одной открытой — строка, хотя бы одна — сетка', () => {
    expect(sectionMode(sec(0))).toBe('row');
    expect(sectionMode(sec(1))).toBe('grid');
    expect(sectionMode(sec(14))).toBe('grid');
  });
});

describe('groupOf', () => {
  it('старший аркан → major, младший → его масть', () => {
    expect(groupOf(byId('fool'))).toBe('major');
    expect(groupOf(byId('w01'))).toBe('wands');
    expect(groupOf(byId('c01'))).toBe('cups');
    expect(groupOf(byId('s01'))).toBe('swords');
    expect(groupOf(byId('p01'))).toBe('pentacles');
  });
});
```

- [ ] **Шаг 2: убедиться, что тест падает.** `npx jest src/lib/__tests__/collection.test.ts` → FAIL «Cannot find module '../collection'».

- [ ] **Шаг 3: реализация** `src/lib/collection.ts`:

```ts
/** Коллекция-альбом (спека 46, logic-spec §13): чистые функции над колодой и множеством изученных
 *  карт. Ничего не хранится — альбом целиком выводится из `learnedCardIds` (то же множество, что
 *  бейдж «ИЗУЧЕНО ✓» справочника и колода тренажёра): «открыто» = «изучено», правило одно на три места. */
import type { TarotCard } from './content';

/** Секции альбома в порядке экрана: старшие арканы, затем масти в порядке чипов справочника и курса М4. */
export type CollectionGroup = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
export const COLLECTION_GROUPS: readonly CollectionGroup[] = ['major', 'wands', 'cups', 'swords', 'pentacles'];

export interface CollectionSection {
  group: CollectionGroup;
  /** карты секции по возрастанию `number` (старшие 0–21, младшие 1–14: Туз … Король) */
  cards: TarotCard[];
  /** сколько из них изучено */
  open: number;
  total: number;
}

/** Секция карты: старший аркан → 'major', младший → его масть. У младшего масть есть всегда
 *  (контракт-тест колоды); `?? 'major'` — только чтобы не ронять экран на битых данных. */
export function groupOf(card: TarotCard): CollectionGroup {
  return card.arcana === 'major' ? 'major' : (card.suit ?? 'major');
}

export function collectionSections(
  deck: readonly TarotCard[],
  learned: ReadonlySet<string>,
): CollectionSection[] {
  return COLLECTION_GROUPS.map((group) => {
    const cards = deck.filter((c) => groupOf(c) === group).sort((a, b) => a.number - b.number);
    const open = cards.filter((c) => learned.has(c.id)).length;
    return { group, cards, open, total: cards.length };
  });
}

/** «Открыто N из 78» — сумма по секциям (а не размер множества: чужих id в нём не считаем). */
export function collectionProgress(sections: readonly CollectionSection[]): { open: number; total: number } {
  return sections.reduce(
    (acc, s) => ({ open: acc.open + s.open, total: acc.total + s.total }),
    { open: 0, total: 0 },
  );
}

/** Режим секции на экране (решение спеки 46, вопрос 7): хотя бы одна открытая карта — сетка
 *  с заголовком «НАЗВАНИЕ · N ИЗ M», ни одной — компактная строка «Название · 0 ИЗ M». */
export type SectionMode = 'grid' | 'row';
export function sectionMode(s: CollectionSection): SectionMode {
  return s.open > 0 ? 'grid' : 'row';
}
```

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/collection.test.ts` → PASS (9 тестов). `npx tsc --noEmit` чистый.
      ⚠️ Если падает тест «состояние макета» — проверить `content/course.json`: у m2l1–m2l4 по 2 старших
      аркана, вместе 8 (на 19.08 так). Не подгонять тест — разобраться.

- [ ] **Шаг 5: коммит**

```bash
git add src/lib/collection.ts src/lib/__tests__/collection.test.ts
git commit -m "feat: коллекция — чистый модуль секций и прогресса альбома + тесты (spec 46)"
```

---

### Задача 2: вынос `StarBack` (рубашка со звездой) + перевод `SpreadCard`/`SpreadRow`

**Файлы:**
- Создать: `src/components/StarBack.tsx`
- Изменить: `src/components/SpreadCard.tsx` (строки 8–12 импорты, 41–47 `back`, 61 `st.star`), `src/components/SpreadRow.tsx` (строки 8, 16 импорты, 59–64 закрытая ветка, 94 `st.star`)

**Интерфейсы:**
- Потребляет: `CardBackSurface` (`src/components/CardBackSurface.tsx`, рисует SVG-градиент в `StyleSheet.absoluteFill`).
- Производит: `StarBack({ starSize }: { starSize: number })` — фрагмент «поверхность + центрированная ✶ цветом accent»; рендерить ВНУТРИ контейнера с `overflow: 'hidden'` и заданными размерами.

- [ ] **Шаг 1: создать** `src/components/StarBack.tsx`:

```tsx
/** Рубашка со звездой ✶ — поверхность `CardBackSurface` + центрированная ✶ цветом accent.
 *  До спеки 46 связка жила копиями в SpreadCard и SpreadRow, третьим местом стала бы закрытая
 *  ячейка коллекции (и четвёртым — мини-рубашка строки масти) — вынесена по правилу «2+ раза».
 *  Звезда центрируется ЗДЕСЬ, а не родителем: у закрытой ячейки и мини-рубашки центрирующих
 *  стилей нет. Размер звезды задаёт вызывающий — у каждого места свой (20 / 13 / 17 / 9).
 *  ✶ отсутствует в Manrope, поэтому обычный Text без fontFamily (правило Txt.tsx). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';

export function StarBack({ starSize }: { starSize: number }) {
  const t = useTheme();
  return (
    <>
      <CardBackSurface />
      <View style={st.center}>
        <Text style={{ fontSize: starSize, color: t.accent }}>✶</Text>
      </View>
    </>
  );
}

const st = StyleSheet.create({
  // поверх SVG-поверхности; событий не ловит — нажатие идёт родителю (pointerEvents в стиле, не пропом)
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
```

- [ ] **Шаг 2: `SpreadCard.tsx`** — заменить проп `back`:

```tsx
      back={<StarBack starSize={20} />}
```
  Убрать из импортов `Text` (из `react-native` остаётся `StyleSheet`) и `CardBackSurface`; добавить
  `import { StarBack } from './StarBack';`; удалить `star: { fontSize: 20 },` из `st`. `useTheme` остаётся
  (нужен для `t.glow`). Комментарий шапки файла: «Рубашка — `StarBack` (поверхность + звезда ✶)».

- [ ] **Шаг 3: `SpreadRow.tsx`** — закрытая ветка превью:

```tsx
            {open ? (
              <Image source={cardImages[card.cardId]} style={[st.img, card.reversed && st.rev]} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <StarBack starSize={13} />
            )}
```
  Убрать `Text` из импорта `react-native` (остаются `StyleSheet, View`) и импорт `CardBackSurface`;
  добавить `import { StarBack } from './StarBack';`; удалить `star: { fontSize: 13 },` из `st`.

- [ ] **Шаг 4:** `npx tsc --noEmit` чистый; `npm test` зелёный (логика не менялась).
      Грепом убедиться, что `CardBackSurface` больше не импортируется в `SpreadCard`/`SpreadRow`
      (`grep -n CardBackSurface src/components/Spread*.tsx` → пусто).

- [ ] **Шаг 5: коммит**

```bash
git add src/components/StarBack.tsx src/components/SpreadCard.tsx src/components/SpreadRow.tsx
git commit -m "refactor: StarBack — рубашка со звездой вынесена из SpreadCard/SpreadRow (spec 46)"
```

---

### Задача 3: вынос `CardCell` из справочника + режим «закрыто»

**Файлы:**
- Создать: `src/components/CardCell.tsx`
- Изменить: `app/(tabs)/cards.tsx` (удалить локальную `Cell` строки 47–82, константы `COLS/GAP/CELL_W` строки 30–33, стили `cell/imWrap/im/name` строки 244–255; импорты)

**Интерфейсы:**
- Производит: `CardCell({ card, lang, from, badge?, closed? })`, константы `GRID_COLS = 3`, `GRID_GAP = 11`, `CELL_W`.

- [ ] **Шаг 1: создать** `src/components/CardCell.tsx`:

```tsx
/** Ячейка сетки карт (`.gc` эталона, design-system §5): миниатюра с рамкой и тенью, скелетон до
 *  загрузки, подпись-название 9.5/600. Жила локально в справочнике; второе место — альбом коллекции
 *  (спека 46), где добавился режим «закрыто»: рубашка-плейсхолдер `StarBack` при opacity .42 и
 *  подпись «· · ·» вместо названия — карта скрыта до изучения, нажимать нечего, поэтому БЕЗ
 *  PressableScale (пружина обещала бы переход, прецедент ReviewPanel).
 *  Позицию картинки меряем на нажатии — с неё начнётся перелёт на страницу карты (пункт 6
 *  motion-spec); `from` уходит параметром маршрута, по нему страница подписывает кнопку «назад». */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { setCardOrigin } from '../lib/cardTransition';
import type { TarotCard } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CornerBadge } from './CornerBadge';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

const { width: W } = Dimensions.get('window');
/** Сетка карт: 3 колонки, зазор 11 в обе стороны (`.grid` эталона), поля экрана 24 — общие для
 *  справочника и альбома, иначе ячейки двух экранов разъехались бы по ширине. */
export const GRID_COLS = 3;
export const GRID_GAP = 11;
export const CELL_W = (W - spacing.xl * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

/** Подпись закрытой ячейки — типографический знак, а не текст интерфейса (в i18n не нужен). */
const CLOSED_LABEL = '· · ·';

export function CardCell({
  card,
  lang,
  from,
  badge,
  closed,
}: {
  card: TarotCard;
  lang: Lang;
  /** откуда открыта страница карты — подпись кнопки «назад» (BACK_TITLES в app/card/[id].tsx) */
  from: 'cards' | 'collection';
  /** текст углового бейджа («ИЗУЧЕНО ✓» в справочнике); не задан — бейджа нет */
  badge?: string;
  /** закрытая карта альбома: рубашка вместо картинки, «· · ·» вместо названия, не нажимается */
  closed?: boolean;
}) {
  const t = useTheme();
  const imRef = React.useRef<View>(null);
  const [loaded, setLoaded] = React.useState(false);

  if (closed) {
    return (
      <View style={st.cell}>
        {/* рамка и тень остаются в полной силе — гаснет только плейсхолдер внутри (`.gc.closed .ph`:
            opacity .42; grayscale(.4) эталона не воспроизводим — решение спеки 46) */}
        <View style={[st.imWrap, { borderColor: t.line }]}>
          <View style={[StyleSheet.absoluteFill, st.closedIm]}>
            <StarBack starSize={17} />
          </View>
        </View>
        {/* `.gc.closed small`: opacity .5 */}
        <Txt style={[st.name, st.closedName, { color: t.muted }]}>{CLOSED_LABEL}</Txt>
      </View>
    );
  }

  return (
    <PressableScale
      onPressIn={() =>
        imRef.current?.measureInWindow((x, y, w, h) => {
          if (w) setCardOrigin(card.id, { x, y, w, h });
        })
      }
      onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id, from } })}
      style={st.cell}
    >
      <View ref={imRef} style={[st.imWrap, { borderColor: t.line }]}>
        <Image
          source={cardImages[card.id]}
          style={st.im}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          onLoad={() => setLoaded(true)}
        />
        {!loaded && <Skeleton style={StyleSheet.absoluteFill} />}
        {!!badge && <CornerBadge label={badge} />}
      </View>
      <Txt numberOfLines={2} style={[st.name, { color: t.muted }]}>
        {inLang(card.name, lang)}
      </Txt>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  cell: { width: CELL_W },
  imWrap: {
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    aspectRatio: 0.58,
    // .gc .im: тень по прямоугольнику миниатюры (design-system §4)
    boxShadow: '0px 8px 20px rgba(0,0,0,0.28)',
  },
  im: { width: '100%', height: '100%' },
  closedIm: { opacity: 0.42 },
  // бейдж «ИЗУЧЕНО ✓» — общий CornerBadge (эталон `.st2`, design-system §5)
  name: { fontSize: 9.5, textAlign: 'center', marginTop: 5, fontWeight: '600', letterSpacing: 0.3, lineHeight: 12 },
  closedName: { opacity: 0.5 },
});
```

- [ ] **Шаг 2: `app/(tabs)/cards.tsx`** — перевести на `CardCell`:
  1. Удалить локальную функцию `Cell` (вместе с её комментарием «Ячейка сетки…») и константы
     `COLS`, `GAP`, `CELL_W`; вместо них `import { CardCell, CELL_W, GRID_COLS, GRID_GAP } from '../../src/components/CardCell';`.
  2. Убрать ставшие ненужными импорты: `Image` (expo-image), `CornerBadge`, `PressableScale`, `Skeleton`,
     `cardImages`, `setCardOrigin`, `inLang` и `type Lang` (если больше нигде не используются — проверить
     грепом в файле; `router` остаётся, он нужен задаче 6). `Dimensions` — убрать, если `W` больше не нужен.
  3. Заменить использования: `toRows(..., COLS)` → `toRows(..., GRID_COLS)`; `ItemSeparatorComponent`
     высота `GAP` → `GRID_GAP`; в `renderItem`:
     ```tsx
              {row.map((c) => (
                <CardCell key={c.id} card={c} lang={lang} from="cards" badge={learned.has(c.id) ? tr('cards.learned') : undefined} />
              ))}
              {row.length < GRID_COLS &&
                Array.from({ length: GRID_COLS - row.length }, (_, i) => (
                  <View key={`gap-${i}`} style={{ width: CELL_W }} />
                ))}
     ```
  4. В `st`: `row: { flexDirection: 'row', gap: GRID_GAP }`; удалить `cell`, `imWrap`, `im`, `name`
     (переехали в `CardCell`). Остальные стили не трогать.

- [ ] **Шаг 3:** `npx tsc --noEmit` чистый; `npm test` зелёный.

- [ ] **Шаг 4: коммит**

```bash
git add src/components/CardCell.tsx "app/(tabs)/cards.tsx"
git commit -m "refactor: CardCell — ячейка сетки карт вынесена из справочника, режим «закрыто» для альбома (spec 46)"
```

---

### Задача 4: i18n-ключи, подпись «назад» страницы карты, компонент `CountRow`

**Файлы:**
- Изменить: `src/lib/i18n.ts` (ru: `cards` строки 41–46, `card` строка 51, после блока `review` ~строка 296; en: `cards` 318–323, `card` 328, после `review` ~531), `app/card/[id].tsx:48-54` (`BACK_TITLES`)
- Создать: `src/components/CountRow.tsx`

**Интерфейсы:**
- Производит: ключи `cards.collection`, `card.backCollection`, `collection.{overline,title,opened,ofTotal,major,hint}`;
  `CountRow({ icon?, title, count, total, chevron?, onPress?, style? })`.

- [ ] **Шаг 1: i18n ru** — в объекте `cards` после `subtitle` добавить `collection: "Коллекция",`;
      в объекте `card` после `backReview: "Тренажёр",` добавить `backCollection: "Коллекция",`;
      после блока `review: { … },` (перед закрывающей `}` объекта `translation`) добавить:

```ts
      // альбом коллекции (спека 46). «из 78» / «ИЗ 14» — число без склоняемого слова, плюрализация не нужна
      collection: {
        overline: "КОЛЛЕКЦИЯ", title: "Альбом",
        opened: "Открыто {{open}} из {{total}}",
        ofTotal: "{{open}} ИЗ {{total}}",
        major: "Старшие арканы",
        hint: "Карты открываются по мере прохождения уроков курса",
      },
```

- [ ] **Шаг 2: i18n en** — симметрично: `cards.collection: "Collection"`, `card.backCollection: "Collection"`, блок:

```ts
      collection: {
        overline: "COLLECTION", title: "Album",
        opened: "Collected {{open}} of {{total}}",
        ofTotal: "{{open}} OF {{total}}",
        major: "Major Arcana",
        hint: "Cards open as you complete course lessons",
      },
```

- [ ] **Шаг 3: `app/card/[id].tsx`** — в `BACK_TITLES` добавить строку `collection: 'card.backCollection',`.

- [ ] **Шаг 4: создать** `src/components/CountRow.tsx`:

```tsx
/** Строка-счётчик `.suitrow` эталона (спека 46, design-system §5): слева иконка Ionicons ИЛИ
 *  мини-рубашка `StarBack` 22×36, название, справа «N ИЗ M» капсом с трекингом; опционально шеврон
 *  и onPress. Пять мест одной разметки: четыре строки мастей альбома (без иконки — мини-рубашка,
 *  «14 закрытых карт») и вход «Коллекция» на «Картах» (иконка albums-outline, шеврон, тап → альбом).
 *  Без onPress — обычный View, не PressableScale: пружина обещала бы переход, которого нет
 *  (прецедент ReviewPanel). Глифы мастей 🜂🜄🜁🜃 макета не используются: системный шрифт iOS их
 *  не гарантирует (решение спеки 46). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

export function CountRow({
  icon,
  title,
  count,
  total,
  chevron,
  onPress,
  style,
}: {
  /** иконка слева; не задана — мини-рубашка со звездой */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  count: number;
  total: number;
  chevron?: boolean;
  onPress?: () => void;
  /** внешние отступы — задаёт вызывающий (8 между строками мастей, 14 у входа на «Картах») */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const body = (
    <>
      {icon ? (
        <Ionicons name={icon} size={17} color={t.accent} />
      ) : (
        <View style={[st.mini, { borderColor: t.line }]}>
          <StarBack starSize={9} />
        </View>
      )}
      <Txt style={[st.title, { color: t.text }]}>{title}</Txt>
      <Txt style={[st.count, { color: t.muted }]}>{tr('collection.ofTotal', { open: count, total })}</Txt>
      {chevron && <Ionicons name="chevron-forward" size={14} color={t.muted} />}
    </>
  );
  const box = [st.row, { backgroundColor: t.panel, borderColor: t.line }, style];

  return onPress ? (
    <PressableScale onPress={onPress} style={box}>
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  // .suitrow: ряд, gap 12, panel + line, radius 13, паддинг 11/14
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 14 },
  // мини-рубашка вместо глифа `.sg`: пропорция карты, radius 4, бордер line
  mini: { width: 22, height: 36, borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  title: { flex: 1, fontSize: 12.5, fontWeight: '600' }, // .st3
  count: { fontSize: 10, fontWeight: '700', letterSpacing: 1 }, // .sc2
});
```

- [ ] **Шаг 5:** `npx tsc --noEmit` чистый; `npm test` зелёный (сьюты i18n читают ресурсы — новые ключи им не мешают).

- [ ] **Шаг 6: коммит**

```bash
git add src/lib/i18n.ts "app/card/[id].tsx" src/components/CountRow.tsx
git commit -m "feat: коллекция — строки ru/en, подпись «назад · Коллекция», компонент CountRow (spec 46)"
```

---

### Задача 5: экран альбома `app/collection.tsx` + маршрут под гардом

**Файлы:**
- Создать: `app/collection.tsx`
- Изменить: `app/_layout.tsx:139` (после `<Stack.Screen name="review" …/>`)

**Интерфейсы:**
- Потребляет: задачи 1, 3, 4 (`collectionSections`, `collectionProgress`, `sectionMode`; `CardCell`, `GRID_*`, `CELL_W`; `CountRow`; ключи `collection.*`), `ProgressBar`/`PROGRESS_EASE` (`src/components/ProgressBar.tsx`), `toRows` (`src/lib/cardSearch.ts`), `learnedCardIds`, `useBackHaptic` (`src/lib/useBackHaptic.ts`), `transparentHeader` (`src/theme/navHeader.ts`).

- [ ] **Шаг 1: создать** `app/collection.tsx`:

```tsx
/** Альбом коллекции (спека 46; product-spec §3 «Коллекция»; logic-spec §13): панель «Открыто N из 78»
 *  с полосой, затем секции в порядке COLLECTION_GROUPS — сетка (есть открытые карты: заголовок
 *  «НАЗВАНИЕ · N ИЗ M» + ряды CardCell, закрытые — рубашки) или строка CountRow (ни одной открытой).
 *  Всё выводится из learnedCardIds, ничего не хранится. Список — FlatList с типизированными
 *  элементами: до 78 миниатюр, нужна виртуализация, как в справочнике. Каскад появления — шапка 0,
 *  панель 1, первый экран секций 2 (строки мастей 3, `.d4`/`.d5` эталона), дальше без анимации
 *  (правило тела списков, задача 17). */
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardCell, CELL_W, GRID_COLS, GRID_GAP } from '../src/components/CardCell';
import { CountRow } from '../src/components/CountRow';
import { FadeUp } from '../src/components/FadeUp';
import { PROGRESS_EASE, ProgressBar } from '../src/components/ProgressBar';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { toRows } from '../src/lib/cardSearch';
import {
  collectionProgress,
  collectionSections,
  sectionMode,
  type CollectionSection,
} from '../src/lib/collection';
import { cards, course, type TarotCard } from '../src/lib/content';
import { learnedCardIds } from '../src/lib/courseProgress';
import { useLang } from '../src/lib/i18n';
import { useBackHaptic } from '../src/lib/useBackHaptic';
import { useApp } from '../src/store/useApp';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

/** Элементы списка: заголовок секции-сетки, ряд ≤3 карт, строка секции без открытых. */
type Item =
  | { kind: 'header'; key: string; section: CollectionSection }
  | { kind: 'row'; key: string; cards: TarotCard[]; first: boolean }
  | { kind: 'suit'; key: string; section: CollectionSection; afterGrid: boolean };

const FILL_DELAY = 400; // полоса прогресса — тайминг LevelCard (эталон fill2: задержка .4s, ход 1.4s)
const FILL_MS = 1400;
/** Сколько элементов после панели прогресса участвуют в каскаде появления — примерно первый экран. */
const FADE_ITEMS = 6;

function buildItems(sections: readonly CollectionSection[]): Item[] {
  const items: Item[] = [];
  let prevGrid = false;
  for (const s of sections) {
    if (sectionMode(s) === 'grid') {
      items.push({ kind: 'header', key: `h-${s.group}`, section: s });
      toRows(s.cards, GRID_COLS).forEach((row, i) =>
        items.push({ kind: 'row', key: `r-${s.group}-${i}`, cards: row, first: i === 0 }),
      );
      prevGrid = true;
    } else {
      items.push({ kind: 'suit', key: `s-${s.group}`, section: s, afterGrid: prevGrid });
      prevGrid = false;
    }
  }
  return items;
}

/** Отступ элемента от предыдущего — значения эталона: заголовок секции `.date margin-top:18`,
 *  первый ряд сетки `.grid margin-top:10`, ряды между собой — зазор сетки, строки мастей 8
 *  (`.suitrow`) и 16 после сетки (`.fadeup d5`). Первый элемент после панели — всегда 18. */
function topGap(item: Item, index: number): number {
  if (index === 0) return 18;
  if (item.kind === 'header') return 18;
  if (item.kind === 'row') return item.first ? 10 : GRID_GAP;
  return item.afterGrid ? 16 : 8;
}

export default function CollectionScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  useBackHaptic();

  // одно множество с бейджем «ИЗУЧЕНО ✓» справочника и колодой тренажёра (решение спеки 46, вопрос 6)
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const learned = React.useMemo(() => learnedCardIds(course, lessonsProgress), [lessonsProgress]);
  const sections = React.useMemo(() => collectionSections(cards, learned), [learned]);
  const { open, total } = collectionProgress(sections);
  const items = React.useMemo(() => buildItems(sections), [sections]);

  const fill = useSharedValue(0);
  React.useEffect(() => {
    fill.value = withDelay(
      FILL_DELAY,
      withTiming(total ? open / total : 0, { duration: FILL_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, open, total]);

  // название секции: старшие — свой ключ, масти — подписи чипов справочника (одно слово на два экрана)
  const sectionTitle = (s: CollectionSection) => (s.group === 'major' ? tr('collection.major') : tr(`cards.${s.group}`));
  const ofTotal = (s: CollectionSection) => tr('collection.ofTotal', { open: s.open, total: s.total });

  const renderItem = ({ item, index }: ListRenderItemInfo<Item>) => {
    let body: React.ReactNode;
    if (item.kind === 'header') {
      // `.date` влево: капс через toUpperCase (прецедент SpreadRow)
      body = (
        <Txt style={[st.section, { color: t.muted }]}>
          {`${sectionTitle(item.section).toUpperCase()} · ${ofTotal(item.section)}`}
        </Txt>
      );
    } else if (item.kind === 'row') {
      body = (
        <View style={st.row}>
          {item.cards.map((c) => (
            <CardCell key={c.id} card={c} lang={lang} from="collection" closed={!learned.has(c.id)} />
          ))}
          {/* добивка неполного ряда, чтобы карты не растягивались на всю ширину */}
          {item.cards.length < GRID_COLS &&
            Array.from({ length: GRID_COLS - item.cards.length }, (_, i) => (
              <View key={`gap-${i}`} style={{ width: CELL_W }} />
            ))}
        </View>
      );
    } else {
      body = <CountRow title={sectionTitle(item.section)} count={item.section.open} total={item.section.total} />;
    }
    const content = <View style={{ marginTop: topGap(item, index) }}>{body}</View>;
    return index < FADE_ITEMS ? <FadeUp index={item.kind === 'suit' ? 3 : 2}>{content}</FadeUp> : content;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.cards') }} />
      <ScreenBg />
      <FlatList
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // как урок, страница карты и тренажёр: insets.top + высота системной шапки
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
        ListHeaderComponent={
          <>
            <FadeUp index={0}>
              <Txt style={[st.overline, { color: t.muted }]}>{tr('collection.overline')}</Txt>
              <Txt style={[st.title, { color: t.head }]}>{tr('collection.title')}</Txt>
            </FadeUp>
            <FadeUp index={1}>
              {/* .colprog: panel + line, radius 15, паддинг 12/15, отступ 14; строка Cormorant 600 16 head;
                  полоса 6/3 с отступом 8, заливка открыто/всего */}
              <View style={[st.prog, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.progText, { color: t.head }]}>{tr('collection.opened', { open, total })}</Txt>
                <ProgressBar progress={fill} radius={3} style={st.bar} />
              </View>
              {/* подсказка только пока ничего не открыто: экран не пуст (структура альбома видна),
                  поэтому не EmptyState — решение спеки 46 */}
              {open === 0 && <Txt style={[st.hint, { color: t.muted }]}>{tr('collection.hint')}</Txt>}
            </FadeUp>
          </>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  // значения — CSS `#v-collection` эталона: .date/.h2/.colprog/.colbar/.grid/.suitrow
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  prog: { borderWidth: 1, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15, marginTop: 14 }, // .colprog
  progText: { fontFamily: fonts.displaySemi, fontSize: 16 }, // .colprog b — Cormorant 600
  bar: { height: 6, marginTop: 8 }, // .colbar
  hint: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', alignSelf: 'center', maxWidth: 270, marginTop: 18 },
  section: { fontSize: 9.5, letterSpacing: 3.5 }, // .date слева — заголовок секции-сетки
  row: { flexDirection: 'row', gap: GRID_GAP },
});
```

- [ ] **Шаг 2: `app/_layout.tsx`** — после строки `<Stack.Screen name="review" options={transparentHeader(t)} />` добавить:

```tsx
          {/* альбом коллекции (спека 46): корневой стек поверх таба «Карты», прозрачная шапка с
              подписью «Карты» на кнопке назад (ставит сам экран); объявлен здесь, чтобы не пройти
              мимо гарда онбординга (урок 09 — незаявленный файловый маршрут роутер добавляет сам) */}
          <Stack.Screen name="collection" options={transparentHeader(t)} />
```

- [ ] **Шаг 3:** `npx tsc --noEmit` чистый (если ругается на тип `Item` в `FlatList` — явно `<FlatList<Item> …>`;
      если не видит маршрут `collection` — поднять и остановить `npx expo start --web`, чтобы Metro
      пересобрал `.expo/types/router.d.ts`). `npm test` зелёный.

- [ ] **Шаг 4: коммит**

```bash
git add app/collection.tsx app/_layout.tsx
git commit -m "feat: экран альбома коллекции — прогресс, секции сеткой/строкой, маршрут под гардом (spec 46)"
```

---

### Задача 6: вход «Коллекция · N ИЗ 78 ›» на вкладке «Карты»

**Файлы:**
- Изменить: `app/(tabs)/cards.tsx` (шапка `ListHeaderComponent`, `FadeUp index={0}`; импорты; стили)

- [ ] **Шаг 1:** импорты — добавить `import { CountRow } from '../../src/components/CountRow';`
      и `import { collectionProgress, collectionSections } from '../../src/lib/collection';`
      (`router` из `expo-router` уже импортирован — проверить, после задачи 3 он мог остаться неиспользуемым; теперь нужен).

- [ ] **Шаг 2:** в теле `CardsScreen` после `const learned = useMemo(...)` добавить:

```tsx
  // вход в альбом коллекции (спека 46): «открыто» считается тем же множеством, что бейджи «ИЗУЧЕНО ✓»
  const opened = useMemo(() => collectionProgress(collectionSections(cards, learned)).open, [learned]);
```

- [ ] **Шаг 3:** в `ListHeaderComponent` внутри `<FadeUp index={0} style={st.pad}>` после заголовка `cards.title`:

```tsx
              <CountRow
                icon="albums-outline"
                title={tr('cards.collection')}
                count={opened}
                total={cards.length}
                chevron
                onPress={() => router.push('/collection')}
                style={st.collection}
              />
```

- [ ] **Шаг 4:** в `st` добавить `collection: { marginTop: 14 }, // вход в альбом: отступ от заголовка, как .colprog`.

- [ ] **Шаг 5:** `npx tsc --noEmit` чистый; `npm test` зелёный.

- [ ] **Шаг 6: коммит**

```bash
git add "app/(tabs)/cards.tsx"
git commit -m "feat: вход в альбом коллекции на вкладке «Карты» (spec 46)"
```

---

### Задача 7: документы и макет

**Файлы:**
- Изменить: `docs/product-spec.md` (§3, после абзаца про бейдж «Изучено ✓»), `docs/logic-spec.md` (новый §13 в конце), `docs/design-system.md` (§5, заменить абзац «Закрытая карта коллекции»), `docs/design-reference.html` (`#v-cards`, `#v-collection`, CSS), `AGENTS.md` (раздел «Архитектура», после абзаца SRS), `docs/backlog.md` (задача 46 в конец списка задач перед «Вопросы Артёму…»; вопросы 5–7 пометить решёнными).

- [ ] **Шаг 1: product-spec §3** — после абзаца «Скелетоны при первом рендере…» добавить:

```markdown
**Коллекция-альбом ✅ (46):** под заголовком «78 карт» строка-вход «Коллекция · N ИЗ 78 ›» (всегда,
и при нуле — ноль и есть крючок) → отдельный экран «Альбом» («назад · Карты»): панель «Открыто N
из 78» с золотой полосой → секции в постоянном порядке старшие → Жезлы → Кубки → Мечи → Пентакли;
секция, в которой открыта хотя бы одна карта, — сетка 3 колонки с заголовком «СТАРШИЕ АРКАНЫ · 8 ИЗ 22»
(открытые — картинка + название, тап → страница карты с «назад · Коллекция»; закрытые — рубашка ✶
при opacity .42 и подпись «· · ·», не нажимаются); секция без открытых — компактная строка
«Жезлы · 0 ИЗ 14» с мини-рубашкой слева (не нажимается). Карту открывает ТОЛЬКО пройденный урок
(`learnedCardIds`) — то же множество, что бейдж «ИЗУЧЕНО ✓» и колода тренажёра. Пока ничего не
открыто — под панелью подсказка «Карты открываются по мере прохождения уроков курса». Уровней
мастерства карты нет (хвост в бэклоге).
```

- [ ] **Шаг 2: logic-spec** — в конец файла:

```markdown
## 13. Коллекция-альбом (спека 46, 19.08)

Ничего не хранится: «открыто» = `learnedCardIds(course, lessonsProgress)` — множество карт пройденных
уроков, общее с бейджем «ИЗУЧЕНО ✓» справочника и колодой тренажёра (§12). Секции `collectionSections`
(`src/lib/collection.ts`): пять групп в порядке старшие → wands → cups → swords → pentacles, карты
внутри по возрастанию `number`; `open` — число карт секции в множестве (чужие id не считаются),
прогресс — сумма по секциям (78). Режим секции `sectionMode`: `open > 0` → сетка, иначе строка.
Тест-кейсы: тоталы 22/14/14/14/14; m2l1–m2l4 → 8 из 78 (состояние макета); m4l1 → Жезлы сеткой
между старшими-строкой и остальными мастями-строками (порядок секций не меняется).
```

- [ ] **Шаг 3: design-system §5** — заменить абзац «**Закрытая карта коллекции** — …» на:

```markdown
**Коллекция (спека 46).** Вход на «Картах» — `CountRow` под заголовком «78 карт» (отступ 14): панель
panel/line radius 13, паддинг 11/14, иконка `albums-outline` 17 accent + «Коллекция» 12.5/600 text +
«N ИЗ 78» 10/700 ls1 muted + `chevron-forward` 14 muted. **Экран «Альбом»:** Overline «КОЛЛЕКЦИЯ»
9.5/ls3.5 + «Альбом» Display 28; панель прогресса `.colprog` — panel/line, radius 15, паддинг 12/15,
отступ 14, строка «Открыто N из 78» Cormorant 600 16 head, полоса 6/3 (`ProgressBar`, заливка от 0 при
входе: задержка 400, ход 1400, PROGRESS_EASE) с отступом 8; подсказка при нуле 12.5 muted по центру.
Заголовок секции-сетки — Overline 9.5/ls3.5 muted влево, капс («СТАРШИЕ АРКАНЫ · 8 ИЗ 22»), отступ 18;
сетка как в справочнике (3 колонки, зазор 11, отступ 10 от заголовка). **Закрытая карта** — ячейка
сетки: рамка и тень полные, внутри рубашка-плейсхолдер `StarBack` (✶ 17) при opacity .42 (grayscale(.4)
макета не воспроизводим — RN-фильтры на iOS частичны, разница неразличима), подпись «· · ·» muted
opacity .5; не нажимается. **Строка масти** — тот же `CountRow` без иконки: слева мини-рубашка
`StarBack` 22×36 radius 4 (вместо глифов 🜂🜄🜁🜃 макета — системный шрифт iOS их не гарантирует),
«Жезлы» 12.5/600 + «0 ИЗ 14»; строки через 8, после сетки — 16; не нажимается.
```

- [ ] **Шаг 4: design-reference.html** — (а) в `#v-cards` сразу после `<div class="h2 fadeup d1">78 карт</div>` вставить:

```html
    <div class="suitrow colentry fadeup d1" onclick="show('v-collection')"><svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M7 5h10"/></svg><span class="st3">Коллекция</span><span class="sc2">8 ИЗ 78</span><svg viewBox="0 0 24 24" class="chev"><path d="M9 5l7 7-7 7"/></svg></div>
```
  и в CSS рядом с `.suitrow` (строка ~544):
```css
.colentry{margin-top:14px;cursor:pointer}
.colentry svg{width:17px;height:17px;stroke:var(--accent);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.colentry .chev{width:14px;height:14px;stroke:var(--muted)}
```
  (б) **только если решение по глифам не откачено Артёмом** — в `#v-collection` заменить четыре
  `<span class="sg">🜂</span>` / `🜄` / `🜁` / `🜃` на `<span class="mini">✶</span>` и добавить CSS:
```css
.suitrow .mini{width:22px;height:36px;border-radius:4px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;
color:var(--accent);font-family:var(--serif);font-size:9px;background:radial-gradient(90% 90% at 50% 30%,#1b2450,#0c1130)}
[data-mode="light"] .suitrow .mini{background:radial-gradient(90% 90% at 50% 30%,#f2e8cd,#e2d4ac)}
```
  Проверить в браузере: `file:///…/docs/design-reference.html`, демобар «Карты» — строка видна, клик ведёт в коллекцию.

- [ ] **Шаг 5: AGENTS.md** — после абзаца «**SRS** — …» добавить:

```markdown
**Коллекция** — `src/lib/collection.ts` (чистые функции: секции альбома, прогресс «N из 78», режим секции сетка/строка; спека 46), экран `app/collection.tsx` (под гардом онбординга, вход — строка «Коллекция» на табе «Карты»); «открыто» = `learnedCardIds` — то же множество, что бейдж «ИЗУЧЕНО ✓» и колода тренажёра. Общие компоненты из задачи 46 — `CardCell` (ячейка сетки карт, режим «закрыто»), `StarBack` (рубашка со звездой), `CountRow` (строка-счётчик).
```

- [ ] **Шаг 6: backlog** — запись задачи 46 и пометка вопросов 5–7 решёнными уже внесены при написании
      спеки (19.08); проверить, что они на месте, и при расхождении с реализацией (например, откат решения
      по глифам) поправить формулировку.

- [ ] **Шаг 7: коммит**

```bash
git add docs/product-spec.md docs/logic-spec.md docs/design-system.md docs/design-reference.html AGENTS.md docs/backlog.md
git commit -m "docs: коллекция — product/logic/design-system, вход и строки мастей в макете, AGENTS, бэклог (spec 46)"
```

---

### Задача 8: веб-проверка 6а/6б (Playwright) и отчёт

**Файлы:**
- Создать: скриншоты в `docs/screenshots/46/`; отчёт — раздел «Отчёт веб-проверки» в `docs/specs/46-collection.md`.
- Скрипт — в scratchpad сессии (в репо не коммитится), запуск по памятке AGENTS.md:
  `NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node <скрипт>`.

- [ ] **Шаг 1:** убедиться, что dev-сервер отдаёт веб: `http://localhost:8081` (если нет — `npx expo start --web` в фоне).

- [ ] **Шаг 2:** скрипт (каркас; сид — через `goto → evaluate → reload`, НЕ `addInitScript`):

```js
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'docs/screenshots/46';
fs.mkdirSync(OUT, { recursive: true });
const lesson = { done: true, errors: 0, ts: 1 };
const SEEDS = {
  empty: { profile: { onboarded: true, name: 'Тест' }, lessonsProgress: {} },
  m2: { profile: { onboarded: true, name: 'Тест' }, lessonsProgress: { m2l1: lesson, m2l2: lesson, m2l3: lesson, m2l4: lesson } },
  m4: { profile: { onboarded: true, name: 'Тест' }, lessonsProgress: { m2l1: lesson, m2l2: lesson, m2l3: lesson, m2l4: lesson, m4l1: lesson } },
};
async function seed(page, state, theme) {
  await page.goto('http://localhost:8081/');
  await page.evaluate(({ state, theme }) => {
    localStorage.setItem('arcanum-app', JSON.stringify({ state: { ...state, themeMode: theme }, version: 10 }));
  }, { state, theme });
  await page.reload();
  await page.waitForTimeout(1500);
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const results = [];
  const check = (name, ok, note = '') => { results.push({ name, ok, note }); console.log(ok ? 'OK  ' : 'FAIL', name, note); };

  for (const theme of ['dark', 'light']) {
    // 1. пусто: вход 0 ИЗ 78, альбом с подсказкой и пятью строками
    await seed(page, SEEDS.empty, theme);
    await page.getByText('Карты', { exact: true }).last().click();
    await page.waitForTimeout(800);
    check(`вход на «Картах» 0 ИЗ 78 (${theme})`, await page.getByText('0 ИЗ 78').count() === 1);
    await page.screenshot({ path: `${OUT}/cards-entry-${theme}.png` });
    await page.getByText('Коллекция', { exact: true }).first().click();
    await page.waitForTimeout(2500); // полоса и каскад
    check(`альбом пустой: «Открыто 0 из 78» (${theme})`, await page.getByText('Открыто 0 из 78').count() === 1);
    check(`подсказка при нуле (${theme})`, await page.getByText('Карты открываются по мере').count() === 1);
    check(`пять строк «0 ИЗ …» (${theme})`, await page.getByText(/^0 ИЗ (22|14)$/).count() === 5);
    check(`ячеек сетки нет (${theme})`, await page.getByText('· · ·').count() === 0);
    await page.screenshot({ path: `${OUT}/collection-empty-${theme}.png` });

    // 2. состояние макета: m2l1–m2l4 → 8 из 78
    await seed(page, SEEDS.m2, theme);
    await page.getByText('Карты', { exact: true }).last().click();
    await page.waitForTimeout(800);
    check(`вход 8 ИЗ 78 (${theme})`, await page.getByText('8 ИЗ 78').count() === 1);
    await page.getByText('Коллекция', { exact: true }).first().click();
    await page.waitForTimeout(2500);
    check(`«Открыто 8 из 78» (${theme})`, await page.getByText('Открыто 8 из 78').count() === 1);
    check(`заголовок «СТАРШИЕ АРКАНЫ · 8 ИЗ 22» (${theme})`, await page.getByText('СТАРШИЕ АРКАНЫ · 8 ИЗ 22').count() === 1);
    check(`подсказки нет (${theme})`, await page.getByText('Карты открываются по мере').count() === 0);
    check(`14 закрытых «· · ·» в видимой части или ниже (${theme})`, await page.getByText('· · ·').count() >= 1);
    check(`четыре строки мастей 0 ИЗ 14 (${theme})`, await page.getByText('0 ИЗ 14').count() === 4);
    await page.screenshot({ path: `${OUT}/collection-m2-${theme}.png` });
    // ширина полосы ≈ 10.26% дорожки
    // только листовые div: RN-web рендерит Txt как div, а View-обёртки повторяют тот же textContent
    const ratio = await page.evaluate(() => {
      const leaf = [...document.querySelectorAll('div')].filter((d) => d.children.length === 0);
      const el = leaf.find((d) => d.textContent === 'Открыто 8 из 78');
      const panel = el && el.parentElement; if (!panel) return null;
      const track = panel.lastElementChild; const fill = track && track.firstElementChild;
      return fill ? fill.getBoundingClientRect().width / track.getBoundingClientRect().width : null;
    });
    check(`полоса ≈ 8/78 (${theme})`, ratio !== null && Math.abs(ratio - 8 / 78) < 0.01, `ratio=${ratio}`);
  }

  // 3. клики (тёмная тема): открытая ячейка → страница карты «назад · Коллекция»; закрытая — ничего
  await seed(page, SEEDS.m2, 'dark');
  await page.getByText('Карты', { exact: true }).last().click();
  await page.getByText('Коллекция', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.getByText('Дурак', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  check('страница карты из альбома, назад подписан «Коллекция»', (await page.getByText('Коллекция', { exact: true }).count()) >= 1 && (await page.getByText('Общее значение').count()) === 1);
  await page.screenshot({ path: `${OUT}/card-from-collection-dark.png` });
  await page.goBack(); await page.waitForTimeout(800);
  check('возврат в альбом', await page.getByText('Открыто 8 из 78').count() === 1);
  const urlBefore = page.url();
  await page.getByText('· · ·').first().click({ force: true }); await page.waitForTimeout(500);
  check('закрытая ячейка — ничего не происходит', page.url() === urlBefore && (await page.getByText('Открыто 8 из 78').count()) === 1);
  await page.getByText('Жезлы', { exact: true }).first().click({ force: true }); await page.waitForTimeout(500);
  check('строка масти — ничего не происходит', page.url() === urlBefore);

  // 4. m4l1 → Жезлы сеткой между старшими и остальными строками
  await seed(page, SEEDS.m4, 'dark');
  await page.goto('http://localhost:8081/collection'); await page.waitForTimeout(2000);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('div')].filter((d) => d.children.length === 0).map((d) => d.textContent)
      .filter((s) => /^(СТАРШИЕ АРКАНЫ|ЖЕЗЛЫ) · \d+ ИЗ \d+$|^(Кубки|Мечи|Пентакли)$/.test(s || '')));
  check('порядок секций: старшие-сетка, ЖЕЗЛЫ · 5 ИЗ 14 сетка, Кубки/Мечи/Пентакли строки', JSON.stringify(order) === JSON.stringify(['СТАРШИЕ АРКАНЫ · 8 ИЗ 22', 'ЖЕЗЛЫ · 5 ИЗ 14', 'Кубки', 'Мечи', 'Пентакли']), JSON.stringify(order));
  await page.screenshot({ path: `${OUT}/collection-m4-dark.png`, fullPage: true });

  // 5. гард: /collection до онбординга → онбординг
  await page.goto('http://localhost:8081/');
  await page.evaluate(() => localStorage.setItem('arcanum-app', JSON.stringify({ state: { profile: { onboarded: false } }, version: 10 })));
  await page.goto('http://localhost:8081/collection'); await page.waitForTimeout(1500);
  check('прямой /collection до онбординга → онбординг', await page.getByText('Открыто').count() === 0);

  // 6. расклады после выноса StarBack: рубашка со звездой на доске
  await seed(page, SEEDS.m2, 'dark');
  await page.getByText('Расклады', { exact: true }).last().click(); await page.waitForTimeout(800);
  await page.getByText('Три карты').first().click(); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/spread-starback-after-dark.png` });
  check('рубашки расклада со звездой ✶', await page.getByText('✶').count() >= 1);

  console.log('\nКонсоль, ошибок:', errors.length, errors.slice(0, 5));
  console.log(results.filter((r) => !r.ok).length === 0 ? 'ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : 'ЕСТЬ ПАДЕНИЯ');
  await browser.close();
})();
```
  ⚠️ Тексты-признаки брать ИЗ `i18n.ts`, не из памяти (урок 28а).
  ⚠️ `FlatList` виртуализован: при первом рендере в DOM могут быть не все элементы (initialNumToRender 10) —
  если счётчик строк мастей или порядок секций вышли короче ожидаемого, прокрутить список вниз
  (`page.mouse.wheel(0, 2000)`), подождать и перечитать DOM, а не считать это падением. Селекторы табов/кнопок — уточнить
  по факту (`getByText('Карты').last()` — таб-бар внизу; если клик попадает в другой «Карты», искать по роли).
  ⚠️ Правило проекта: сначала прогнать проверку на СЛОМАННОМ коде — например, временно вернуть
  `sectionMode` всегда `'row'` — и убедиться, что проверки 2–4 краснеют; вернуть код.

- [ ] **Шаг 3:** сверить скриншоты с макетом по `docs/ui-verification.md` (демобар «Коллекция» в
      `design-reference.html`, 390×844, обе темы): композиция, Cormorant у «Альбом» и «Открыто…»,
      золото полосы, отступы 24, рубашки закрытых ячеек при .42, «· · ·», строки мастей с мини-рубашкой.
      Расхождения — исправить или перечислить в отчёте с причиной.

- [ ] **Шаг 4:** консоль без красных ошибок (warning `props.pointerEvents is deprecated` из
      `@react-navigation/elements` — известный, не наш).

- [ ] **Шаг 5:** записать в `docs/specs/46-collection.md` раздел «## Отчёт веб-проверки (дата)»: таблица
      «проверка → ожидание → факт → ✓/✗», список скриншотов, расхождения с макетом и причины, число тестов.

- [ ] **Шаг 6: коммит**

```bash
git add docs/screenshots/46 docs/specs/46-collection.md
git commit -m "docs: отчёт веб-проверки 6а/6б альбома коллекции и скриншоты (spec 46)"
```

---

### Задача 9: финал — ревью, push, лайв-проверка, закрытие

- [ ] **Шаг 1:** `npm test` — записать итоговое число тестов (ожидание: 1295 + 9 = 1304 в 36 сьютах)
      и `npx tsc --noEmit` чистый.
- [ ] **Шаг 2:** финальное ревью ветки (свежим взглядом, по чек-листу спеки «готово, когда…»): DRY —
      `grep -rn "CardBackSurface" src app` должен находить только `CardBack.tsx`, `CardCorners.tsx`,
      `StarBack.tsx` (и сам файл); `grep -rn "fontSize: 9.5, textAlign: 'center', marginTop: 5" src app` —
      только `CardCell.tsx`.
- [ ] **Шаг 3:** `git push -u origin feat/46-collection`.
- [ ] **Шаг 4:** отправить Артёму сценарий лайв-проверки из спеки (раздел «Сценарий лайв-проверки»).
      ⚠️ Только когда ВСЕ правки лежат в рабочем дереве и запушены (урок 44).
- [ ] **Шаг 5:** после ✓ Артёма — merge в `main` (`git merge --no-ff feat/46-collection`), push; отметить
      задачу 46 `[x]` в `docs/backlog.md`, обновить «Статус» в `CLAUDE.md` (абзац про 46: что сделано,
      новое общее — `CardCell`/`StarBack`/`CountRow`/`collection.ts`, число тестов, persist version не менялась,
      уроки), `AGENTS.md` — число тестов в строке `npm test`.

---

## Самопроверка плана (выполнена при написании)

- Покрытие спеки: А (задача 1), Б — `StarBack` (2), `CardCell` (3), `CountRow` (4); В — вход (6), экран и
  маршрут (5), i18n и `BACK_TITLES` (4); Г — документы и макет (7); приёмка — веб-проверка (8), лайв и
  закрытие (9). Persist/бэкап не трогаются нигде — соответствует спеке.
- Имена сквозные: `collectionSections`/`collectionProgress`/`sectionMode`/`COLLECTION_GROUPS` (1 → 5, 6);
  `CardCell`/`GRID_COLS`/`GRID_GAP`/`CELL_W` (3 → 5, 6); `StarBack({ starSize })` (2 → 3, 4);
  `CountRow({ icon?, title, count, total, chevron?, onPress?, style? })` (4 → 5, 6); ключи
  `collection.ofTotal/opened/major/hint/overline/title`, `cards.collection`, `card.backCollection` (4 → 5, 6).
- Порядок: экран (5) раньше входа (6) из-за typedRoutes.
