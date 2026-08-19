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
в стор через `reviewCard`. Две чистые функции добавляются в `review.ts` (`reviewCardState`,
`nextSessionSize`) — под тестами. Макет `v-trainer` дорисовывается Cowork-сессией ПАРАЛЛЕЛЬНО
(бриф отправлен 19.08); задача 13 сверяет значения с CSS макета после его коммита.

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
| `src/lib/review.ts` | + `ReviewCardState`, `reviewCardState(sum)`, `nextSessionSize(sum)` | правка |
| `src/lib/__tests__/review.test.ts` | + тесты двух функций (состояния, потолок, согласие с `buildSession`) | правка |
| `src/lib/i18n.ts` | + `review.*` (ru, en), `card.backReview` | правка |
| `src/lib/__tests__/i18nPlurals.test.ts` | + CASES `review.due` 1/3/12 | правка |
| `src/components/KeywordChips.tsx` | золотые чипы слов (`.kws` эталона), вынос со страницы карты | новый |
| `app/card/[id].tsx` | чипы → `KeywordChips`; `BACK_TITLES.review` | правка |
| `src/components/MeaningPanel.tsx` | панель `.mean` (бокс + Overline), вынос с «Сегодня» | новый |
| `src/theme/glow.ts` | + `faceShadow(glow)` (был `FACE_SHADOW` в index.tsx) | правка |
| `app/(tabs)/index.tsx` | `MeaningPanel`, `faceShadow` вместо локальных | правка |
| `src/components/CardBack.tsx` | + проп `content` — замена зоны эмблемы | правка |
| `src/components/FlipCard.tsx` | общий 3D-переворот (из SpreadCard), `FLIP_MS` | новый |
| `src/components/SpreadCard.tsx` | тонкая обёртка над `FlipCard` | правка |
| `src/components/ResultPanel.tsx` | панель итога: въезд, Success, катящийся XP, line, CTA, footer | новый |
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
  `git status` — чисто. (Коммит макета от Cowork может прийти в main позже — его подтянет задача 13.)

---

### Задача 1: `review.ts` — `reviewCardState` и `nextSessionSize`

**Файлы:**
- Правка: `src/lib/review.ts` (после `reviewSummary`)
- Тест: `src/lib/__tests__/review.test.ts`

**Интерфейсы:**
- Потребляет: `ReviewSummary`, `SESSION_MAX`, `buildSession` (есть с 45а).
- Производит: `type ReviewCardState = 'hidden' | 'due' | 'new' | 'done'`;
  `reviewCardState(s: ReviewSummary): ReviewCardState`; `nextSessionSize(s: ReviewSummary): number`.
  Их берут `ReviewPanel` (задача 8) и экран (задача 11).

- [ ] **Шаг 1: тесты (красные).** В конец `review.test.ts` (хелперы `deck`, `overdue`, `T`,
  `REVIEW_DAY_DEFAULT`, `lcg` уже объявлены в шапке файла; импорт дополнить именами
  `nextSessionSize`, `reviewCardState`, `type ReviewSummary`):

```ts
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
  (и `nextSessionSize`).

- [ ] **Шаг 3: реализация.** В `src/lib/review.ts` после `reviewSummary`:

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

- [ ] **Шаг 4:** `npx jest src/lib/__tests__/review.test.ts` → PASS; `npx tsc --noEmit` чисто.
- [ ] **Шаг 5:** `git add src/lib/review.ts src/lib/__tests__/review.test.ts` →
  `git commit -m "feat: состояние карточки повторения и размер следующей порции (spec 45)"`.

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

**Производит:** `KeywordChips({ words: readonly string[]; style?: StyleProp<ViewStyle> })`.
Потребители: страница карты (сейчас), панель «ЗНАЧЕНИЕ» тренажёра (задача 11).

- [ ] **Шаг 1: компонент.**

```tsx
/** Золотые чипы ключевых слов (`.kws` эталона, design-system §5): 4 слова витрины под названием
 *  на странице карты и в панели «ЗНАЧЕНИЕ» тренажёра (спека 45) — второе появление, вынесено по
 *  правилу «2+ раза». Слова приходят уже на нужном языке (inLang снаружи). */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function KeywordChips({ words, style }: { words: readonly string[]; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[st.row, style]}>
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

**Производит:** `ResultPanel({ gained, zeroTitle?, line, cta: {label, onPress}, onCounted?, children?, footer? })`.
Потребители: `LessonResult` (сейчас), `ReviewResult` (задача 10).

- [ ] **Шаг 1: `ResultPanel.tsx`.**

```tsx
/** Панель итога (`.lresult` эталона, motion-spec §16): въезжает fade+up 500 мс → хаптика Success →
 *  счётчик «+N XP» катится (55 мс/шаг); когда счётчик докатился — зовёт onCounted (финал урока по нему
 *  запускает полосу модуля и конфетти). Общая часть LessonResult (урок) и ReviewResult (тренажёр,
 *  спека 45) — вынесена по правилу «2+ раза». Порядок содержимого фиксирован: XP (или zeroTitle при
 *  gained 0) → line → children → CTA → footer. Порядок важен: footer у урока — слой конфетти, и он обязан
 *  лежать ПОВЕРХ CTA, как раньше. Reduce motion: счётчик мгновенный (motion-spec §16). */
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
  zeroTitle,
  line,
  cta,
  onCounted,
  children,
  footer,
}: {
  gained: number;
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
        <Txt style={[st.overline, { color: t.muted }]}>{tr('review.panelTitle')}</Txt>
        <Txt style={[st.line, { color: tappable ? t.head : t.success }]}>{line}</Txt>
      </View>
      <Ionicons name="sync-outline" size={18} color={tappable ? t.accent : t.muted} />
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
  // та же панель, что шапка модуля; отступ снизу — до шапки первого модуля
  box: { ...moduleBox, marginBottom: spacing.m },
  overline: { fontSize: 9.5, letterSpacing: 2.5, fontWeight: '600' },
  line: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
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
- Потребляет: `FlipCard` (задача 6), `CardBack` с `content` и `faceShadow` (задача 5), `Direction`
  из `review.ts`, `cardImages`.
- Производит: `ReviewFlashcard({ cardId, direction, revealed, keywords, sentence, hint, onPress })`,
  `REVIEW_CARD_W = 190`, `REVIEW_CARD_H = 330`. Потребитель — экран (задача 11).

- [ ] **Шаг 1: компонент.**

```tsx
/** Флеш-карта тренажёра (спека 45, раздел В): карта 190×330 (`.ringwrap` эталона `#v-trainer`) на
 *  общем FlipCard. Направление toMeaning — лицо с самого начала, переворота нет (open + animateFlip
 *  false): образ и название — вопрос, ответ — панель «ЗНАЧЕНИЕ» у экрана. Направление toCard —
 *  рубашка CardBack, в зоне эмблемы 4 ключевых слова столбиком + первое предложение общего значения
 *  (БЕЗ названия — оно и есть ответ) + подпись «ВСПОМНИТЕ КАРТУ · НАЖМИТЕ»; тап → 3D-переворот
 *  FLIP_MS → лицо. Плашка названия, панель и кнопки — у экрана, здесь только карта. Уголков нет:
 *  они — знак ритуала карты дня (design-system §5). */
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
import { Txt } from './Txt';

// `.ringwrap` тренажёра в эталоне: 190×330 (карта дня — 216×378, масштаб ≈ 0.88)
export const REVIEW_CARD_W = 190;
export const REVIEW_CARD_H = 330;

export function ReviewFlashcard({
  cardId,
  direction,
  revealed,
  keywords,
  sentence,
  hint,
  onPress,
}: {
  cardId: string;
  direction: Direction;
  /** ответ открыт (toCard — переворот сделан) */
  revealed: boolean;
  /** 4 слова витрины — на рубашке в направлении toCard, уже на языке интерфейса */
  keywords: readonly string[];
  /** первое предложение general (promptSentence); '' — блок todo, на рубашке только слова */
  sentence: string;
  /** подпись на рубашке («ВСПОМНИТЕ КАРТУ · НАЖМИТЕ») */
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
            hint={hint}
            content={
              <View style={st.words}>
                {keywords.map((k) => (
                  <Txt key={k} style={[st.kw, { color: t.head }]}>
                    {k}
                  </Txt>
                ))}
                {!!sentence && <Txt style={[st.sentence, { color: t.text }]}>{sentence}</Txt>}
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
  // ⚠️ предварительные значения — задача 13 сверяет их с CSS дорисованного макета (#v-trainer .emb)
  words: { alignItems: 'center', paddingHorizontal: 22 },
  kw: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, letterSpacing: 1, textAlign: 'center' },
  sentence: { fontFamily: fonts.display, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 10 },
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
import { spacing } from '../theme/theme';
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
  more: { marginTop: spacing.m },
  moreTxt: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
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
  // первое предложение общего значения через blockText: при todo — только чипы (keywords у всех 78
  // вычитаны, «Текст готовится» на флеш-карте не бывает)
  const meaning = card ? blockText(card.content.general, lang) : { text: '', todo: true };
  const sentence = meaning.todo ? '' : promptSentence(meaning.text);

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
                sentence={sentence}
                hint={tr('review.hintCard')}
                onPress={onReveal}
              />
            </View>

            {/* toMeaning: название — часть вопроса, видно сразу; подпись под картой зовёт нажать */}
            {head.direction === 'toMeaning' && (
              <Txt style={[st.plate, { color: t.head }]}>{inLang(card.name, lang).toUpperCase()}</Txt>
            )}
            {head.direction === 'toMeaning' && !revealed && (
              <Pressable onPress={onReveal} hitSlop={8}>
                <Txt style={[st.hint, { color: t.muted }]}>{tr('review.hintMeaning')}</Txt>
              </Pressable>
            )}

            {revealed && (
              <Animated.View style={revealStyle}>
                {/* toCard: название — ответ, появляется вместе с панелью после переворота */}
                {head.direction === 'toCard' && (
                  <Txt style={[st.plate, { color: t.head }]}>{inLang(card.name, lang).toUpperCase()}</Txt>
                )}
                <MeaningPanel title={tr('review.meaning')} style={{ marginTop: spacing.m }}>
                  <KeywordChips words={keywords} style={{ marginTop: 10 }} />
                  {!!sentence && <Txt style={[st.sentence, { color: t.text }]}>{sentence}</Txt>}
                  <Pressable
                    onPress={() => router.push(`/card/${card.id}?from=review`)}
                    hitSlop={8}
                    style={{ alignSelf: 'flex-start' }}
                  >
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
  // ⚠️ предварительные значения по CSS текущего макета (.date/.h2/.tcount/.plate/.mean/.gradebtns) —
  // задача 13 сверяет с дорисованным #v-trainer
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  count: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: spacing.l }, // .tcount
  cardWrap: { alignSelf: 'center', marginTop: spacing.l }, // .ringwrap margin-top 16
  plate: { fontFamily: fonts.display, fontSize: 17, letterSpacing: 3, textAlign: 'center', marginTop: 10 }, // .plate b 17/ls3
  hint: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', marginTop: 10 },
  sentence: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22, marginTop: 10 },
  link: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 10 },
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

### Задача 13: сверка с дорисованным макетом (после коммита Cowork)

**Файлы:** `docs/design-reference.html` (чтение), правки значений в `app/review.tsx`,
`src/components/ReviewFlashcard.tsx`, `ReviewPanel.tsx`, `ReviewResult.tsx` по необходимости;
`docs/design-system.md` (если макет уточнил числа).

Предусловие: в `main` лежит коммит Cowork «docs: макет — тренажёр по спеке 45 …». Если его ещё
нет — задачу 14 выполнять ПО ТЕКУЩЕМУ макету нельзя (сверка была бы с четырьмя кнопками): дождаться.

- [ ] **Шаг 1:** `git fetch && git merge main` в ветку (конфликтов быть не должно — Cowork трогает
  только `docs/`).
- [ ] **Шаг 2: сверить по списку** (правило 6а-0: при конфликте макета со спекой/design-system —
  права спека; расхождение — флагом в отчёт, не копировать):
  - `#v-trainer .gradebtns` → три кнопки, gap/паддинг/кегль/цвета (ожидаем 6 / 9×2 / 10×700 /
    danger–text–success) ↔ `st.grades/grade/gradeTxt`;
  - рубашка `toCard`: кегли и отступы слов и предложения в `.emb` ↔ `ReviewFlashcard st.kw/sentence/words`;
    подпись `.emb small` (8.5/ls2 muted — уже в `CardBack.hint`);
  - подпись под картой `toMeaning` («ВСПОМНИТЕ ЗНАЧЕНИЕ · НАЖМИТЕ») ↔ `st.hint`;
  - плашка названия (`#trname`) ↔ `st.plate`; счётчик `.tcount` ↔ `st.count`;
  - панель «ЗНАЧЕНИЕ»: чипы / предложение (`#trtext`) / ссылка «Страница карты →» ↔ `st.sentence/link`;
  - карточка «Повторение» в `#v-course` (overline, кегль строки, иконка, цвет done) ↔ `ReviewPanel`;
  - панель результата (`.lresult`-образец: строка, «+X XP», CTA «ГОТОВО», «Ещё N») ↔ `ReviewResult`;
    кегль «+X XP» в приложении 36 против 34 макета — решение задачи 08, не трогать;
  - пустое состояние: макет рисует `#trempty` 64×104 пунктиром — приложение берёт общий
    `EmptyState` (design-system §7, уже в четырёх местах) → расхождение ОСОЗНАННОЕ, записать в отчёт.
- [ ] **Шаг 3:** внести правки значений; снять пометки «⚠️ предварительные значения» в комментариях
  стилей; если макет уточнил числа против design-system §5 — обновить §5.
- [ ] **Шаг 4:** `npx tsc --noEmit`; `git commit -m "feat: значения тренажёра по дорисованному макету (spec 45)"`
  (если правок не было — коммита нет, так и записать в отчёт).

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
  (`[x]` — кроме лайв-проверки), добавить раздел **«Отчёт 45б (дата)»** по образцу отчёта 45а:
  сделано (файлы, выносы, чем отличается от плана), тесты (число и разбивка: `review.test.ts` +7,
  `i18nPlurals.test.ts` +3 — перепроверить прогоном каждого файла), веб-проверка (что прошло,
  скриншоты, консоль), расхождения с макетом (список из задачи 13/14), **сценарий лайв-проверки
  для Артёма** (переворот toCard, хаптика у трёх кнопок, «Ещё N» после «Состарить на день» × нужное,
  карточка на курсе в трёх состояниях, «назад» со страницы карты — «Тренажёр», регрессия: расклад
  «Три карты», финал урока, карта дня, чипы на странице карты).
- [ ] **Шаг 2: product-spec §2.** «**Повторение 🔨(45)**» → «**Повторение ✅(45)**»; последнее
  предложение абзаца «Тренажёр» («Часть 45а … ✅; экраны — 45б после дорисовки макета») →
  «Обе части ✅ (45а — логика/стор/DEV, 45б — экраны)».
- [ ] **Шаг 3: design-system §5.** В абзаце «Оценки повторения» снять фразу «Макет пока рисует
  четыре — хвост дорисовки в бэклоге»; если задача 13 уточнила числа — записать их. Добавить строку
  про общие компоненты, появившиеся в задаче: `FlipCard` (переворот), `ResultPanel` (панель итога),
  `MeaningPanel` (`.mean`), `KeywordChips` (`.kws`) — по одной строке, где сейчас перечислены `Block`
  и `ModalPanel`.
- [ ] **Шаг 4: logic-spec §12.** Одной строкой: «Карточка курса: `reviewCardState` (hidden/due/new/
  done по приоритету), ссылка «Ещё N» — `nextSessionSize = min(SESSION_MAX, due + newAvailable)`
  (совпадение с `buildSession` под тестом)».
- [ ] **Шаг 5: backlog.** Задача 45: статус «45б СДЕЛАНА (дата): экраны, веб-проверка 6а/6б ✓,
  ждёт лайв-проверки Артёма; ветка `feat/45b-review-screens`». После лайв-проверки — `[x]` и
  строка «ЗАКРЫТА».
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
  задачи 9, 11 ✓; toCard рубашка со словами + предложением без названия + подпись, переворот 500
  (`SpreadCard`-механика = `FlipCard`) — задачи 5, 6, 9 ✓; `blockText` при todo — только чипы ✓;
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
целиком; единственные «уточнить позже» — значения стилей, помеченные «⚠️ предварительные», с явной
задачей 13 на их сверку — это не пробел плана, а зависимость от параллельной Cowork-работы.

**Согласованность имён:** `reviewCardState`/`nextSessionSize` (задача 1) ← `ReviewPanel` (8),
экран (11); `FlipCard`/`FLIP_MS` (6) ← `SpreadCard` (6), `ReviewFlashcard` (9), экран (11);
`ResultPanel({gained, zeroTitle, line, cta, onCounted, children, footer})` (7) ← `LessonResult` (7),
`ReviewResult` (10); `CardBack.content` + `faceShadow` (5) ← `ReviewFlashcard` (9); `KeywordChips`
(3), `MeaningPanel` (4) ← экран (11); `moduleBox` (8) ← `ReviewPanel` (8); ключи i18n (2) ←
8, 10, 11; `BACK_TITLES.review` (11) ← ссылка «Страница карты →» с `?from=review` (11) ✓.

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
