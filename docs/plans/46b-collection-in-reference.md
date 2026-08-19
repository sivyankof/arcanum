# План 46б — альбом внутри справочника

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ sub-skill — superpowers:subagent-driven-development
> (или executing-plans); задача за задачей, шаги с чекбоксами. Модель сабагентов — sonnet.

**Цель:** убрать отдельный экран альбома и показать прогресс изучения прямо в справочнике: панель
«Изучено N из 78» под активным чипом, приглушённые неизученные карты, чип-фильтр «Изучено».

**Архитектура:** правки в чистой логике (`cardSearch.ts` — фильтр `'learned'`; `collection.ts` —
`filterProgress` вместо `sectionMode`) → один экран `app/(tabs)/cards.tsx` (панель, фильтр,
`dimmed`) → удаление `app/collection.tsx`, маршрута, `CountRow`, лишних ключей → доки и макет →
веб-проверка. Ветка та же — `feat/46-collection` (поверх 58e23d4).

**Спека:** `docs/specs/46-collection.md`, раздел «46б — альбом внутри справочника».

## Глобальные ограничения

- Комментарии и коммиты по-русски; без упоминаний ИИ; без трейлеров `Co-Authored-By`.
- `npx tsc --noEmit` чистый после каждой задачи; `npm test` зелёный перед коммитом.
- Цвета только из `useTheme()`; `pointerEvents` только в style; persist/бэкап не трогать (version 10).
- Новые UI-строки — ru И en. Ничего не запирать: тап по любой карте открывает страницу.
- Значения: панель `.colprog` (panel/line, radius 15, паддинг 12/15, отступ 14; Cormorant 600 16 head;
  полоса 6/3, отступ 8; заливка при входе задержка 400 / ход 1400, при смене чипа 600, `PROGRESS_EASE`,
  `ReduceMotion.System`); приглушение картинки `DIM_OPACITY = 0.55`.

---

### Задача 1: логика — фильтр «Изучено» и `filterProgress` (TDD)

**Файлы:** изменить `src/lib/cardSearch.ts`, `src/lib/collection.ts`, `src/lib/__tests__/cardSearch.test.ts`, `src/lib/__tests__/collection.test.ts`.

**Интерфейсы (производит):** `CardFilter` += `'learned'`; `CARD_FILTERS` (7 значений, `'learned'` последний);
`filterCards(list, { query, filter, lang, learned? })`; `filterProgress(sections, filter): { open; total }`;
`sectionMode`/`SectionMode` удалены.

- [ ] **Шаг 1: падающие тесты.** В `cardSearch.test.ts` внутри `describe('filterCards', …)` (после теста
  «фильтр и запрос складываются…») добавить:

```ts
  it('фильтр «Изучено» оставляет только карты из множества изученных (порядок колоды)', () => {
    const learned = new Set(['w01', 'fool', 'no-such-card']);
    expect(filterCards(cards, { ...all, filter: 'learned', learned }).map((c) => c.id)).toEqual(['fool', 'w01']);
  });

  it('«Изучено» без множества — пусто', () => {
    expect(filterCards(cards, { ...all, filter: 'learned' })).toHaveLength(0);
  });

  it('«Изучено» и запрос складываются', () => {
    const learned = new Set(['fool', 'magician']);
    expect(filterCards(cards, { ...all, filter: 'learned', learned, query: 'дурак' }).map((c) => c.id)).toEqual(['fool']);
  });
```
  В `collection.test.ts`: из импорта убрать `sectionMode`, добавить `filterProgress`; в тесте «порядок
  секций не зависит…» строку `expect(s.map(sectionMode)).toEqual(['row', 'grid', 'row', 'row', 'row']);`
  заменить на `expect(s.map((x) => x.open)).toEqual([0, 5, 0, 0, 0]);`; блок `describe('sectionMode', …)`
  удалить целиком и на его месте добавить:

```ts
describe('filterProgress', () => {
  const learned = learnedCardIds(course, done('m2l1', 'm2l2', 'm2l3', 'm2l4', 'm4l1'));
  const s = collectionSections(cards, learned);

  it('«Все» и «Изучено» — вся колода', () => {
    expect(filterProgress(s, 'all')).toEqual({ open: 13, total: 78 });
    expect(filterProgress(s, 'learned')).toEqual({ open: 13, total: 78 });
  });

  it('группа — её секция', () => {
    expect(filterProgress(s, 'major')).toEqual({ open: 8, total: 22 });
    expect(filterProgress(s, 'wands')).toEqual({ open: 5, total: 14 });
    expect(filterProgress(s, 'cups')).toEqual({ open: 0, total: 14 });
  });
});
```

- [ ] **Шаг 2:** `npx jest src/lib/__tests__/cardSearch.test.ts src/lib/__tests__/collection.test.ts` → FAIL
  (нет `'learned'` в типе / нет `filterProgress`).

- [ ] **Шаг 3: реализация.** `src/lib/cardSearch.ts`:

```ts
/** Фильтр по аркану/масти: 'all' — вся колода; 'learned' — только изученные (карты пройденных
 *  уроков, спека 46б): множество приходит извне, сам модуль про курс не знает. */
export type CardFilter = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles' | 'learned';

export const CARD_FILTERS: CardFilter[] = ['all', 'major', 'wands', 'cups', 'swords', 'pentacles', 'learned'];
```
  и `filterCards`:

```ts
export function filterCards(
  list: TarotCard[],
  { query, filter, lang, learned }: { query: string; filter: CardFilter; lang: Lang; learned?: ReadonlySet<string> },
): TarotCard[] {
  const byFilter =
    filter === 'all'
      ? list
      : filter === 'learned'
        ? list.filter((c) => learned?.has(c.id) ?? false)
        : filter === 'major'
          ? list.filter((c) => c.arcana === 'major')
          : list.filter((c) => c.suit === filter);
  const q = normalize(query);
  return q ? byFilter.filter((c) => matchesQuery(c, q, lang)) : byFilter;
}
```
  `src/lib/collection.ts`: удалить `SectionMode`/`sectionMode` (с комментарием); добавить
  `import type { CardFilter } from './cardSearch';` и:

```ts
/** Число под активным чипом справочника (спека 46б): «Все»/«Изучено» — вся колода, группа — её секция. */
export function filterProgress(
  sections: readonly CollectionSection[],
  filter: CardFilter,
): { open: number; total: number } {
  if (filter === 'all' || filter === 'learned') return collectionProgress(sections);
  const s = sections.find((x) => x.group === filter);
  return s ? { open: s.open, total: s.total } : { open: 0, total: 0 };
}
```
  Обновить шапку-комментарий файла: «альбом» → «прогресс изучения в справочнике». Если `tsc` найдёт
  другие места, где `CardFilter` индексирует объект (`Record<CardFilter, …>`) — дописать ключ `learned`
  (расширение объединения ломает литералы — урок задачи 27).

- [ ] **Шаг 4:** удалить `app/collection.tsx` (он импортирует `sectionMode` и перестал бы компилироваться;
  экран по спеке 46б уходит) и его `Stack.Screen` в `app/_layout.tsx` (блок с комментарием «альбом
  коллекции (спека 46)…» — четыре строки). Оба сьюта PASS; `npx tsc --noEmit` чистый (`cards.tsx` пока
  зовёт `filterCards` без `learned` — поле опционально, это законно до задачи 2); `npm test` зелёный.

- [ ] **Шаг 5: коммит** — `git add src/lib/cardSearch.ts src/lib/collection.ts src/lib/__tests__/cardSearch.test.ts src/lib/__tests__/collection.test.ts app/_layout.tsx && git rm app/collection.tsx && git commit -m "feat: фильтр «Изучено» и прогресс под чипом; экран альбома удалён (spec 46б)"`.

---

### Задача 2: справочник — панель прогресса, приглушение, чип; удаление остатков альбома

**Файлы:** изменить `src/components/CardCell.tsx`, `app/(tabs)/cards.tsx`, `src/lib/i18n.ts`, `app/card/[id].tsx`; удалить `src/components/CountRow.tsx`.

- [ ] **Шаг 1: `CardCell.tsx`** — заменить режим `closed` на `dimmed`, убрать проп `from` (потребитель один):
  - шапка-комментарий: «Вынесена из справочника задачей 46; режим `dimmed` (спека 46б) — неизученная карта:
    картинка приглушена до opacity .55, рамка/тень/подпись как у всех, бейджа нет; тап открывает страницу,
    как у любой карты — ничего не запирается.»
  - удалить импорт `StarBack`, константу `CLOSED_LABEL`, ветку `if (closed) {…}`, стили `closedIm`/`closedName`;
  - добавить `export const DIM_OPACITY = 0.55; // приглушение картинки неизученной карты (спека 46б, вариант «а»)`;
  - пропсы: `{ card, lang, badge, dimmed }: { card: TarotCard; lang: Lang; badge?: string; dimmed?: boolean }`
    (комментарии: badge — «текст углового бейджа («ИЗУЧЕНО ✓»); не задан — бейджа нет», dimmed —
    «неизученная карта — картинка приглушена»);
  - `onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id, from: 'cards' } })}`;
  - `<Image … style={[st.im, dimmed && st.dim]} …/>`; в `st` добавить `dim: { opacity: DIM_OPACITY },`.
  `CardGridRow` и константы сетки не трогать.

- [ ] **Шаг 2: `i18n.ts`** — ru `cards`: удалить `collection: "Коллекция",`; после `learned: "ИЗУЧЕНО ✓",` добавить
```ts
        learnedFilter: "Изучено", learnedCount: "Изучено {{open}} из {{total}}",
        learnedCountIn: "{{label}} · изучено {{open}} из {{total}}",
        learnedEmpty: "Изученные карты появятся здесь после первого урока курса",
```
  en `cards`: удалить `collection: "Collection",`; после `learned: "LEARNED ✓",` добавить
```ts
        learnedFilter: "Learned", learnedCount: "Learned {{open}} of {{total}}",
        learnedCountIn: "{{label}} · learned {{open}} of {{total}}",
        learnedEmpty: "Learned cards will appear here after your first lesson",
```
  Удалить в обоих языках `backCollection` из `card` и весь блок `collection: {…}` (в ru — вместе с его комментарием).
  `app/card/[id].tsx`: удалить строку `collection: 'card.backCollection',` из `BACK_TITLES`.

- [ ] **Шаг 3: `app/(tabs)/cards.tsx`.**
  - Импорты: убрать `CountRow`; `collectionProgress` → `filterProgress` (оставить `collectionSections`);
    добавить `import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';`
    (default `Animated` уже импортирован — объединить в один импорт), `import { PROGRESS_EASE, ProgressBar } from '../../src/components/ProgressBar';`;
    `React` import: `import React, { useEffect, useMemo, useRef, useState } from 'react';`; `router` — убрать, если
    больше не используется (грепом).
  - Константы после `BODY_STEP`:
```ts
/** Заливка панели прогресса: при входе — от нуля с задержкой (тайминг LevelCard), при смене чипа —
 *  перетекание к новому значению без задержки. */
const FILL_DELAY = 400;
const FILL_MS = 1400;
const FILL_SWITCH_MS = 600;
```
  - `Filters.label`: `const label = (f: CardFilter) => tr(f === 'all' ? 'cards.all' : f === 'learned' ? 'cards.learnedFilter' : \`cards.${f}\`);`
  - В `CardsScreen`: блок `lessonsProgress`/`learned` ПЕРЕНЕСТИ выше `rows`; `rows` считать с `learned`:
```ts
  const rows = useMemo(
    () => toRows(filterCards(cards, { query, filter, lang, learned }), GRID_COLS),
    [query, filter, lang, learned],
  );
```
  - Вместо `opened`:
```ts
  // панель прогресса (спека 46б): «Изучено N из M» под активным чипом — то же множество, что бейджи
  const sections = useMemo(() => collectionSections(cards, learned), [learned]);
  const progress = filterProgress(sections, filter);
  const chipLabel = filter === 'all' || filter === 'learned' ? null : tr(`cards.${filter}`);
  const progressText = chipLabel
    ? tr('cards.learnedCountIn', { label: chipLabel, ...progress })
    : tr('cards.learnedCount', progress);
  const ratio = progress.total ? progress.open / progress.total : 0;
  const fill = useSharedValue(0);
  const firstFill = useRef(true);
  useEffect(() => {
    const first = firstFill.current;
    firstFill.current = false;
    fill.value = withDelay(
      first ? FILL_DELAY : 0,
      withTiming(ratio, { duration: first ? FILL_MS : FILL_SWITCH_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, ratio]);
```
  - В шапке вместо `<CountRow …/>`:
```tsx
              {/* панель прогресса изучения (`.colprog`, спека 46б): строка под активным чипом + полоса */}
              <View style={[st.prog, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.progText, { color: t.head }]}>{progressText}</Txt>
                <ProgressBar progress={fill} radius={3} style={st.bar} />
              </View>
```
  - `renderItem`: `<CardCell key={c.id} card={c} lang={lang} badge={learned.has(c.id) ? tr('cards.learned') : undefined} dimmed={!learned.has(c.id)} />`.
  - Футер: `{tr(filter === 'learned' ? 'cards.learnedEmpty' : 'cards.empty')}`.
  - Стили: удалить `collection`; добавить
```ts
  // .colprog: панель прогресса под заголовком
  prog: { borderWidth: 1, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15, marginTop: 14 },
  progText: { fontFamily: fonts.displaySemi, fontSize: 16 }, // .colprog b — Cormorant 600
  bar: { height: 6, marginTop: 8 }, // .colbar
```
  - Комментарий над `learned`: «карты пройденных уроков — бейдж «ИЗУЧЕНО ✓», приглушение, чип «Изучено»
    и панель прогресса (спеки 08/46б)».

- [ ] **Шаг 4:** `git rm src/components/CountRow.tsx`; грепом убедиться: `CountRow`, `backCollection`,
  `cards.collection`, `collection.ofTotal`, `sectionMode`, `closed=` нигде не остались (`grep -rn` по `src app`).
- [ ] **Шаг 5:** `npx tsc --noEmit`; `npm test`.
- [ ] **Шаг 6: коммит** — `git add -A src/components/CardCell.tsx "app/(tabs)/cards.tsx" src/lib/i18n.ts "app/card/[id].tsx" && git commit -m "feat: прогресс изучения в справочнике — панель под чипом, приглушение неизученных, чип «Изучено»; CountRow удалён (spec 46б)"` (убедиться, что удаление `CountRow.tsx` попало в индекс).

---

### Задача 3: документы и макет

**Файлы:** `docs/product-spec.md`, `docs/logic-spec.md`, `docs/design-system.md`, `docs/ui-verification.md`, `AGENTS.md`, `docs/design-reference.html`.

- [ ] **Шаг 1: product-spec §3** — абзац «**Коллекция-альбом ✅ (46):** …» заменить на:
```markdown
**Прогресс изучения в справочнике ✅ (46/46б):** под заголовком «78 карт» панель «Изучено N из 78»
с золотой полосой — она следует за активным чипом («Старшие · изучено 8 из 22»); неизученные карты
видны, но приглушены (картинка opacity .55, без бейджа), изученные — полный цвет + «ИЗУЧЕНО ✓»; чип
«Изучено» показывает только изученные (при нуле — подпись «Изученные карты появятся здесь после
первого урока курса»). Тап по любой карте открывает страницу — ничего не запирается (решение 19.08:
справочник — причина №1 открыть приложение; карта дня и расклады ведут на неизученные карты). Карту
«изучает» ТОЛЬКО пройденный урок (`learnedCardIds`) — то же множество, что колода тренажёра.
Отдельного экрана-альбома нет: первая редакция 46 (экран `/collection`) снята на лайв-проверке как
дубль справочника. Уровни мастерства и момент «переворота» изученных карт — хвосты в бэклоге.
```
- [ ] **Шаг 2: logic-spec §13** — заменить раздел целиком на:
```markdown
## 13. Прогресс изучения в справочнике (спека 46/46б, 19.08)

Ничего не хранится: «изучено» = `learnedCardIds(course, lessonsProgress)` — множество карт пройденных
уроков, общее с бейджем «ИЗУЧЕНО ✓» и колодой тренажёра (§12). `collectionSections`
(`src/lib/collection.ts`): пять групп старшие → wands → cups → swords → pentacles, карты по `number`;
`open` — число карт секции в множестве; `collectionProgress` — сумма (78). `filterProgress(sections,
filter)` — число под активным чипом справочника: «Все»/«Изучено» → вся колода, группа → её секция.
Фильтр `'learned'` в `filterCards` оставляет карты из множества; запрос складывается как у других
фильтров; ввод поиска сбрасывает чип на «Все». Тест-кейсы: тоталы 22/14/14/14/14; m2l1–m2l4 → 8 из 78,
старшие 8 из 22; +m4l1 → «Жезлы» 5 из 14, «Изучено» 13 карт.
```
- [ ] **Шаг 3: design-system §5** — блок «**Коллекция (спека 46).** …» заменить на:
```markdown
**Прогресс изучения в справочнике (спека 46б).** Панель под заголовком «78 карт» (отступ 14):
panel/line, radius 15, паддинг 12/15; строка «Изучено N из 78» / «Старшие · изучено 8 из 22»
Cormorant 600 16 head; полоса 6/3 (`ProgressBar`, отступ 8) — заливка от 0 при входе (задержка 400,
ход 1400, PROGRESS_EASE), при смене чипа перетекает за 600. **Неизученная карта** — обычная ячейка
сетки, картинка opacity .55 (`DIM_OPACITY`), рамка/тень/подпись как у всех, бейджа нет; изученная —
полный цвет + «ИЗУЧЕНО ✓». Чип «Изучено» — седьмой в ленте, тот же `FilterChips`. Ничего не
запирается. Пустое состояние чипа «Изучено» — подпись 12.5 muted по центру (`cards.learnedEmpty`).
```
- [ ] **Шаг 4: ui-verification.md** — в пункте «Карты: каждый фильтр…» после «(78/22/14/14/14/14)» добавить
  «, «Изучено» — число изученных; панель «Изучено N из M» следует за чипом; неизученные приглушены».
- [ ] **Шаг 5: AGENTS.md** — абзац «**Коллекция** — …» заменить на:
```markdown
**Прогресс изучения** — `src/lib/collection.ts` (чистые функции: секции колоды по группам, прогресс «N из 78», `filterProgress` под активным чипом справочника; спека 46/46б) + фильтр `'learned'` в `src/lib/cardSearch.ts`; показывается на табе «Карты» (панель + приглушение неизученных + чип «Изучено»). Отдельного экрана альбома нет (первая редакция 46 снята как дубль справочника). Общие компоненты из задачи 46 — `CardCell`/`CardGridRow` (ячейка и ряд сетки карт), `StarBack` (рубашка со звездой, расклады).
```
- [ ] **Шаг 6: design-reference.html** (точечные Edit по уникальным фрагментам; файл с длинными строками — не перечитывать целиком):
  1. В `#v-cards` строку `<div class="suitrow colentry fadeup d1" …>…</div>` заменить на
     `<div class="colprog fadeup d1"><b>Изучено 8 из 78</b><div class="colbar"><i></i></div></div>`.
  2. В `.seg` экрана `#v-cards` (`<button class="on">Все</button>…<button>Пентакли</button>`) добавить
     `<button>Изучено</button>` после «Пентакли».
  3. Перенести `const OPENED = [...]` из блока «этап 4: коллекция» ВЫШЕ строки `const grid=document.getElementById('grid');`
     (иначе TDZ). В шаблоне сетки: `<img src="…" ${OPENED.includes(c.id)?'':'class="dim"'}>` и бейдж
     `${OPENED.includes(c.id)?'<span class="st2">ИЗУЧЕНО ✓</span>':''}` вместо `c.id==='fool'?…`.
     Добавить CSS `.gc img.dim{opacity:.55}` рядом с `.gc img{…}`.
  4. Удалить: блок `<div class="view" id="v-collection">…</div>` целиком; кнопку демобара
     `<button onclick="demo('collection',this)">Коллекция</button>`; ветку `else if(mode==='collection'){ show('v-collection'); }`
     в `demo()`; JS-блок `const colgrid … .join('');` (комментарий «этап 4: коллекция» оставить над OPENED);
     CSS `.gc.closed .ph{…}`, `.gc.closed small{…}`, `.suitrow{…}`, `.suitrow .sg/.st3/.sc2{…}`,
     `.colentry{…}` (3 правила), `.suitrow .mini{…}` и его light-вариант. `.colprog`/`.colbar` ОСТАЮТСЯ
     (теперь они у `#v-cards`). Грепом: `v-collection`, `colgrid`, `suitrow`, `colentry`, `.mini` — 0 вхождений;
     `OPENED` объявлен один раз и раньше первого использования.
- [ ] **Шаг 7: коммит** — `git add docs/product-spec.md docs/logic-spec.md docs/design-system.md docs/ui-verification.md AGENTS.md docs/design-reference.html && git commit -m "docs: прогресс изучения в справочнике — product/logic/design-system, макет без альбома, AGENTS (spec 46б)"`.

---

### Задача 4: веб-проверка 6а/6б и отчёт

- [ ] **Шаг 1:** обновить скрипт `scratchpad/webcheck-46.js` (dev-сервер Артёма на 8081; сиды как раньше;
  тексты-признаки из `i18n.ts`). Проверки по состояниям:
  - empty (обе темы): вкладка «Карты»: панель «Изучено 0 из 78»; ширина заливки 0; бейджей «ИЗУЧЕНО ✓» 0;
    opacity картинки у «Дурак» = 0.55 (найти листовой div «Дурак» → подняться до ячейки → `img` →
    минимальная computed opacity по цепочке предков внутри ячейки); чип «Изучено» → футер
    «Изученные карты появятся здесь после первого урока курса»; скриншоты `cards-progress-empty-{dark,light}.png`,
    `cards-learned-empty-dark.png`.
  - m2 (обе темы): «Изучено 8 из 78», полоса ≈ 8/78; бейджей 8 (в DOM — прокрутить при необходимости);
    «Дурак» opacity 1, «Туз Жезлов» opacity 0.55; чип «Старшие» → «Старшие · изучено 8 из 22» и ratio ≈ 8/22;
    чип «Изучено» → ровно 8 названий-карт в сетке; скриншоты `cards-progress-{dark,light}.png`,
    `cards-learned-filter-dark.png`.
  - m4 (тёмная): чип «Жезлы» → «Жезлы · изучено 5 из 14»; «Изучено» → 13; набрать в поиске «д» → чип «Все»,
    панель «Изучено 13 из 78».
  - гард/маршрут: `goto('/collection')` → НЕТ панели/альбома (маршрут удалён): признак — отсутствие
    «Изучено» И присутствие чего-то от страницы not-found ИЛИ онбординга… проще: пропустить, маршрут
    удалён физически (проверяется `ls app/collection.tsx` → нет) — в отчёте так и написать.
  - клики: «Дурак» (m2) → страница карты, «назад · Карты»; расклад «Три карты» → рубашки ✶.
  - макет: скриншот `mockup-cards-dark.png` (после правок), `mockup-cards-light.png`.
  - Красный прогон: временно `DIM_OPACITY = 1` в `CardCell.tsx` → проверки opacity 0.55 обязаны упасть;
    вернуть (`git checkout -- src/components/CardCell.tsx`).
- [ ] **Шаг 2:** сверка с макетом глазами (ui-verification.md), консоль без ошибок.
- [ ] **Шаг 3:** раздел «## Отчёт веб-проверки 46б (19.08)» в конец спеки: таблица проверок, скриншоты,
  расхождения, консоль, красный/зелёный прогон, `npm test`/`tsc`.
- [ ] **Шаг 4: коммит** — `git add docs/screenshots/46 docs/specs/46-collection.md && git commit -m "docs: отчёт веб-проверки 46б и скриншоты (spec 46б)"`.

---

### Задача 5: финал

- [ ] финальное ревью ветки (opus) по диапазону 58e23d4..HEAD; волна правок при необходимости; push;
  сценарий лайв-проверки 46б (спека) — Артёму; после ✓ — merge `--no-ff` в main, push, бэклог `[x]`,
  `CLAUDE.md` «Статус» (46+46б одним абзацем, уроки: дефект постановки — «вход там, где всё уже открыто»,
  дубль информации; тестов ≈1307 в 36 сьютах — уточнить по факту), `AGENTS.md` число тестов.
