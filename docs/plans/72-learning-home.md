# Учебный главный экран (72) — детальный план

> **Для исполнителя:** план идёт задача за задачей, шаги помечены `- [ ]`. Исполнение —
> skill `superpowers:subagent-driven-development` (свежий сабагент на задачу, ревью между задачами;
> сабагентам модель указывать ЯВНО: реализация — sonnet, тривиальные правки — haiku) либо
> `superpowers:executing-plans`. Спека — `docs/specs/72-learning-home.md`, читать вместе с планом.
> Шаг 0 процесса: `docs/lessons.md` §1 (стор), §2 (веб ≠ натив), §4 (вёрстка), §5 (навигация),
> §7 (i18n), §8 (тесты), §9 (веб-проверка), §12 (процесс).

**Цель:** первое впечатление от приложения — учебный курс (урок-герой, игра на узнавание символов,
вкладки Learn/Practice), а не гадание с лунной астрологией; новая сборка iOS заметно отличается от
отклонённой (Apple 4.3(b), Extended Review).

**Архитектура:** маршруты вкладок не меняются. Нынешний экран карты дня переезжает файлом в стек
(`app/daily.tsx`), на его месте — новый экран «Учёба» из трёх панелей общей геометрии `moduleBox`.
Вся новая логика — чистые функции под тестами (`nextLessonSummary`, `nextLessonState`,
`fragmentGame.ts`); экраны только рисуют. Игра берёт фрагменты из `content/fragments.json` и кропает
существующие сканы стилем (файлы картинок не режутся). Persist не меняется (12).

**Стек:** Expo SDK 54, expo-router v6, react-native-reanimated, react-i18next, zustand, jest-expo,
Playwright из кэша npx, Python 3.10+ с Pillow (скрипты). Новых пакетов нет; `package.json`/`app.json`
не трогаются.

**Ветка:** `feat/72-learning-home` от `main`; в `main` не вливается до лайв-проверки 6в.

## Глобальные ограничения

- SDK не обновлять; `npm install` не нужен. Комментарии в коде — русские, без упоминаний ИИ;
  коммиты — русские, без трейлеров Co-Authored-By.
- После КАЖДОГО шага с кодом — `npx tsc --noEmit`; перед каждым коммитом — `npm test` (в отчёте
  «упало N из M»). Стейджить поимённо (`git add <путь>`), не `-A`.
- Цвета только из `useTheme()`; размеры — из design-system / существующих стилей, новых чисел не
  выдумывать сверх указанных в плане.
- Любая UI-строка — сразу в ЧЕТЫРЕ языка `src/lib/i18n.ts`; никаких тернаров по языку; текущий язык —
  только `useLang()`; многоязычный контент — только `inLang`.
- Любой НОВЫЙ маршрут корневого стека вписывается в `app/_layout.tsx` под `Stack.Protected guard={onboarded}`.
- PowerShell не трогает UTF-8-файлы: правки — Edit/Write или python. В `python -c "…"` не писать
  обратные кавычки — многострочное только файлом.
- DRY проверяется грепом по ВСЕМУ проекту; перед новым компонентом — `ls src/components src/lib`.
- Тест обязан краснеть на сломанном коде: у каждой задачи с тестами есть шаг мутации.
- Веб-проверка: dev-сервер заново с `--clear` на каждое состояние кода; сид `goto → evaluate → reload`;
  `click({ force: true })` на качающихся элементах; вьюпорт 390×844.
- Тексты карт и курса не трогаем. Фразы `content/phrases.json` — только после «ок» редактора (задача 16).

## Карта файлов

| Файл | Действие | Ответственность |
|---|---|---|
| `src/lib/courseProgress.ts` | правка | + `nextLessonSummary`, `nextLessonState` |
| `src/lib/useReviewSummary.ts` | новый | сводка «Повторения» с днём по фокусу/AppState (2 потребителя) |
| `src/theme/navHeader.ts` | правка | + `STACK_HEADER_H`, `stackTopPad` |
| `src/lib/i18n.ts` | правка | `tabs.*`, `home.*`, `ob.*`, `today.*`, `game.*`, `paywall.*`, `card.backToday`, − `moon.day` |
| `src/components/TabIcons.tsx`, `app/(tabs)/_layout.tsx` | правка | значки `learn`/`practice`, подписи |
| `src/components/StatsPills.tsx` | новый | ряд «серия + уровень» + строка заморозки (Учёба и Карта дня) |
| `src/components/NextLessonCard.tsx` | новый | герой «следующий урок» |
| `src/components/DailyCardRow.tsx` | новый | компактная строка «Карта дня» |
| `app/daily.tsx` | перенос из `app/(tabs)/index.tsx` | экран карты дня в стеке |
| `app/(tabs)/index.tsx` | новый | экран «Учёба» |
| `src/components/MoonRow.tsx`, `app/(tabs)/spreads/index.tsx`, `app/moon.tsx` | правка | луна без дня, вход из «Практики» |
| `app/onboarding.tsx` | правка | два шага |
| `src/lib/purchasesEnv.ts`, `app/paywall.tsx` | правка | `STORE_NAME` |
| `content/fragments.json`, `src/lib/content.ts` | новый / правка | данные игры |
| `src/lib/fragmentGame.ts` | новый | сессия, геометрия, счёт |
| `scripts/fragment_sheet.py` | новый | контакт-лист фрагментов |
| `src/components/OptionButton.tsx` | новый (вынос из урока) | вариант ответа (урок + игра) |
| `src/components/FragmentPanel.tsx`, `app/fragment.tsx` | новый | вход и экран игры |
| `src/store/useApp.ts` | правка | экшен `gainFragmentXp` (persist не меняется) |
| `docs/design-reference.html`, `scripts/check_60_mock.js` | правка | макет |
| `scripts/check_72_web.js`, `scripts/shoot_72.js` | новый | 6б / 6а |
| `scripts/check_56_web.js`, `scripts/shoot_56.js`, `scripts/check_62_web.js` | правка | регресс |
| `scripts/shoot_63.js`, `docs/store/captions.json`, `docs/store-listing.md` | правка | витрина |
| product-spec / design-system / logic-spec / CLAUDE / AGENTS / changelog / lessons / backlog / release-checklist | правка | синхронизация |

---

### Задача 0: ветка и поведение в product-spec (правится ПЕРВЫМ)

**Файлы:** `docs/product-spec.md`, `docs/design-system.md`, `docs/logic-spec.md`, `docs/specs/72-learning-home.md`

- [ ] **Шаг 1.** `git checkout -b feat/72-learning-home`.
- [ ] **Шаг 2.** Уточнение спеки 72, раздел 3, первый пункт списка отличий: заменить на
  «нет `MoonRow`; ряд пилюль ОСТАЁТСЯ (салют серии `burst` — локальное состояние этого экрана,
  запускается из `onDraw`); ряд вынесен в общий `StatsPills` — второй потребитель — «Учёба»».
- [ ] **Шаг 3.** `docs/product-spec.md`:
  - §0 «Онбординг» — два шага (заставка + дисклеймер → «Как устроен курс» + имя → «Учёба»); дата
    рождения и аркан — только через Настройки/Профиль (§5);
  - §1 переименовать в «1. Учёба (главный экран)»: композиция сверху вниз — дата → «Учёба» → Rule →
    пилюли → герой «следующий урок» (4 состояния: start / continue / locked → пейвол / done →
    тренажёр) → «Повторение» → «Угадай карту» → строка «Карта дня» (3 состояния) ;
  - новый §1б «Карта дня» — прежний текст §1 без строки луны; вход — строка на «Учёбе» и пункт
    «Карта дня» в ленте «Практики»; «назад → Учёба»; CTA «Изучить карту»;
  - новый §1в «Игра „Угадай карту“» — механика, 10 вопросов, +1 XP за верный, без persist, бесплатная,
    22 старших аркана;
  - §1а: «вход — строка луны на вкладке „Практика“, „назад → Практика“»; строка без номера лунного дня;
  - §4: вкладка называется «Практика»; сверху строка луны и панель игры; «Карта дня» → `/daily`.
- [ ] **Шаг 4.** `docs/design-system.md`: таблица типографики — пример Display XL «Учёба»; раздел
  таб-бара — значки «раскрытая книга» и «три карты в ряд»; §5 компоненты — `StatsPills`,
  `NextLessonCard`, `DailyCardRow` (миниатюра 44×76, радиус 11), `FragmentPanel`, `OptionButton`
  (значения — из урока: рамка 1.5, радиус 14, паддинги 13/16, зазор 9, текст 14/20), квадрат фрагмента
  `min(W − 48, 300)`, радиус 16.
- [ ] **Шаг 5.** `docs/logic-spec.md`: §4 XP — строка «игра „Угадай карту“: +`XP_REVIEW` (1) за верный
  ответ»; §6 — «лунный день считается (`lunarDay`), в интерфейсе v1 не выводится (задача 72)».
- [ ] **Шаг 6.** Коммит: `git add docs/product-spec.md docs/design-system.md docs/logic-spec.md docs/specs/72-learning-home.md`
  → `git commit -m "docs: поведение учебного главного экрана и игры в product-spec (spec 72)"`.

---

### Задача 1: `nextLessonSummary` и `nextLessonState` (TDD)

**Файлы:** правка `src/lib/courseProgress.ts`; тест `src/lib/__tests__/courseProgress.test.ts` (дописать в конец).

**Интерфейсы — производит:**
```ts
export interface NextLessonSummary {
  lesson: CourseLesson | null; moduleIndex: number; lessonNumber: number;
  total: number; doneCount: number; pct: number;
}
export function nextLessonSummary(modules: CourseModule[], progress: LessonProgressMap): NextLessonSummary
export type NextLessonState = 'start' | 'continue' | 'locked' | 'done';
export function nextLessonState(s: NextLessonSummary, locked: boolean): NextLessonState
```

- [ ] **Шаг 1: красные тесты.** Дописать (фикстуру модулей собрать по образцу уже стоящих в файле
  тестов `lessonStates`; если там есть хелпер сборки модулей — использовать его, не заводить второй):

```ts
describe('nextLessonSummary (спека 72)', () => {
  // курс 2 модуля: m1 — 3 урока, m2 — 2 урока
  const mods = [
    { id: 'm1', free: true, title: { ru: '', en: '' }, lessons: ['m1l1', 'm1l2', 'm1l3'].map((id) => ({ id, title: { ru: id, en: id }, cards: [] })) },
    { id: 'm2', free: false, title: { ru: '', en: '' }, lessons: ['m2l1', 'm2l2'].map((id) => ({ id, title: { ru: id, en: id }, cards: [] })) },
  ] as unknown as CourseModule[];
  const done = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

  it('пустой прогресс — первый урок, №1, 0 %', () => {
    const s = nextLessonSummary(mods, {});
    expect([s.lesson?.id, s.moduleIndex, s.lessonNumber, s.total, s.doneCount, s.pct]).toEqual(['m1l1', 0, 1, 5, 0, 0]);
  });
  it('пройден первый модуль — сквозной номер, а не номер внутри модуля', () => {
    const s = nextLessonSummary(mods, done('m1l1', 'm1l2', 'm1l3'));
    expect([s.lesson?.id, s.moduleIndex, s.lessonNumber, s.doneCount, s.pct]).toEqual(['m2l1', 1, 4, 3, 60]);
  });
  it('дырка в прогрессе — первый непройденный, doneCount считает всё пройденное', () => {
    const s = nextLessonSummary(mods, done('m1l1', 'm1l3'));
    expect([s.lesson?.id, s.lessonNumber, s.doneCount, s.pct]).toEqual(['m1l2', 2, 2, 40]);
  });
  it('округление обычное: 1 из 3 = 33, 2 из 3 = 67', () => {
    const three = [mods[0]];
    expect(nextLessonSummary(three, done('m1l1')).pct).toBe(33);
    expect(nextLessonSummary(three, done('m1l1', 'm1l2')).pct).toBe(67);
  });
  it('курс пройден — lesson null, последний модуль, 100 %', () => {
    const s = nextLessonSummary(mods, done('m1l1', 'm1l2', 'm1l3', 'm2l1', 'm2l2'));
    expect([s.lesson, s.moduleIndex, s.lessonNumber, s.pct]).toEqual([null, 1, 5, 100]);
  });
  it('пустой курс — без деления на ноль', () => {
    expect(nextLessonSummary([], {})).toEqual({ lesson: null, moduleIndex: 0, lessonNumber: 0, total: 0, doneCount: 0, pct: 0 });
  });
});

describe('nextLessonState (спека 72)', () => {
  const base = { moduleIndex: 0, lessonNumber: 1, total: 5, pct: 0 };
  const lesson = { id: 'm1l1' } as unknown as CourseLesson;
  it('курс пройден — done, даже если передан locked', () => {
    expect(nextLessonState({ ...base, lesson: null, doneCount: 5 }, true)).toBe('done');
  });
  it('закрыт подпиской — locked раньше start/continue', () => {
    expect(nextLessonState({ ...base, lesson, doneCount: 0 }, true)).toBe('locked');
  });
  it('ничего не пройдено — start; иначе continue', () => {
    expect(nextLessonState({ ...base, lesson, doneCount: 0 }, false)).toBe('start');
    expect(nextLessonState({ ...base, lesson, doneCount: 2 }, false)).toBe('continue');
  });
});
```
  Импорты теста дополнить: `nextLessonSummary, nextLessonState` и типы `CourseLesson, CourseModule`.

- [ ] **Шаг 2.** `npx jest src/lib/__tests__/courseProgress.test.ts` → FAIL («nextLessonSummary is not a function»).
- [ ] **Шаг 3: реализация** — в `courseProgress.ts` сразу после `nextLessonId` (импорт типа дополнить
  `CourseLesson`):

```ts
/** Сводка «что учить дальше» для героя экрана «Учёба» (спека 72): первый непройденный урок,
 *  его СКВОЗНОЙ номер по курсу («урок 5 из 32») и общий процент. Правило «первый непройденный» —
 *  то же, что у lessonStates (через nextLessonId), а не вторая копия. */
export interface NextLessonSummary {
  /** null — курс пройден целиком */
  lesson: CourseLesson | null;
  /** модуль урока, с нуля; у пройденного курса — последний модуль */
  moduleIndex: number;
  /** сквозной номер урока по курсу, с единицы; у пройденного курса — total */
  lessonNumber: number;
  total: number;
  doneCount: number;
  /** целые проценты, обычное округление (как moduleProgress) */
  pct: number;
}

export function nextLessonSummary(
  modules: CourseModule[],
  progress: LessonProgressMap,
): NextLessonSummary {
  const flat = modules.flatMap((m, mi) => m.lessons.map((lesson) => ({ lesson, mi })));
  const total = flat.length;
  const doneCount = flat.filter((x) => progress[x.lesson.id]?.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const nextId = nextLessonId(modules, progress);
  const at = flat.findIndex((x) => x.lesson.id === nextId);
  if (at === -1) {
    return { lesson: null, moduleIndex: Math.max(0, modules.length - 1), lessonNumber: total, total, doneCount, pct };
  }
  return { lesson: flat[at].lesson, moduleIndex: flat[at].mi, lessonNumber: at + 1, total, doneCount, pct };
}

export type NextLessonState = 'start' | 'continue' | 'locked' | 'done';

/** Состояние героя. `locked` приходит снаружи (premium.ts — единственный источник решения о доступе). */
export function nextLessonState(s: NextLessonSummary, locked: boolean): NextLessonState {
  if (!s.lesson) return 'done';
  if (locked) return 'locked';
  return s.doneCount === 0 ? 'start' : 'continue';
}
```
- [ ] **Шаг 4.** Тот же jest → PASS; `npx tsc --noEmit` чист.
- [ ] **Шаг 5: мутации** (по одной, после каждой тест обязан покраснеть, затем вернуть):
  `lessonNumber: at + 1` → номер внутри модуля (`modules[flat[at].mi].lessons.indexOf(flat[at].lesson) + 1`);
  `Math.round` → `Math.floor`; в `nextLessonState` поменять местами проверки `locked` и `!s.lesson`.
- [ ] **Шаг 6.** `npm test` → коммит `feat: сводка следующего урока для экрана «Учёба» (spec 72)`
  (`git add src/lib/courseProgress.ts src/lib/__tests__/courseProgress.test.ts`).

---

### Задача 2: общие куски — `useReviewSummary`, `stackTopPad`

**Файлы:** новый `src/lib/useReviewSummary.ts`; правка `app/(tabs)/course.tsx`, `src/theme/navHeader.ts`,
`app/lesson/[id].tsx`, `app/moon.tsx`, `app/paywall.tsx`, `app/review.tsx`, `app/card/[id].tsx`.

**Производит:** `useReviewSummary(): ReviewSummary`; `STACK_HEADER_H = 64`; `stackTopPad(insets: { top: number }): number`.

- [ ] **Шаг 1.** `src/lib/useReviewSummary.ts`:

```ts
/** Сводка «Повторения» для карточки ReviewPanel — общая для табов «Курс» и «Учёба» (спека 72:
 *  второй потребитель). День пересчитывается по фокусу экрана И по возврату из фона: useFocusEffect
 *  не ловит ни полночь, ни сворачивание (урок 06а), а таб может остаться открытым с вечера. */
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { course } from './content';
import { localDateISO } from './dates';
import { deckOrder, reviewSummary, type ReviewSummary } from './review';
import { useAppActive } from './useAppActive';
import { useApp } from '../store/useApp';

export function useReviewSummary(): ReviewSummary {
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  const [today, setToday] = React.useState(() => localDateISO());
  useFocusEffect(React.useCallback(() => setToday(localDateISO()), []));
  useAppActive(() => setToday(localDateISO()));
  return React.useMemo(
    () => reviewSummary(deckOrder(course, lessonsProgress), srs, today, reviewDay),
    [lessonsProgress, srs, reviewDay, today],
  );
}
```
- [ ] **Шаг 2.** `course.tsx`: удалить `srs`, `reviewDay`, `today`/`setToday`, оба эффекта дня и `useMemo`
  `reviewSum`; вместо них `const reviewSum = useReviewSummary();`. Убрать ставшие лишними импорты
  (`localDateISO`, `deckOrder`, `reviewSummary`, `useAppActive`, `useFocusEffect` — каждый только если
  больше не используется в файле: проверить грепом по файлу). Комментарий про день переезжает в хук.
- [ ] **Шаг 3.** `navHeader.ts` — дописать в конец:

```ts
/** Высота системной шапки стек-экрана. Контент под ПРОЗРАЧНОЙ шапкой начинается с этого отступа,
 *  иначе уезжает под кнопку «назад». До задачи 72 число 64 стояло копиями в пяти экранах. */
export const STACK_HEADER_H = 64;

/** paddingTop контента стек-экрана с прозрачной шапкой: safe area + шапка + воздух. */
export function stackTopPad(insets: { top: number }, gap: number = spacing.l): number {
  return insets.top + STACK_HEADER_H + gap;
}
```
  Импорт: `import { spacing, type Theme } from './theme';` (заменить текущий `import type`).
- [ ] **Шаг 4.** Заменить в четырёх экранах `insets.top + 64 + spacing.l` → `stackTopPad(insets)`;
  в `card/[id].tsx` `insets.top + 64` → `stackTopPad(insets, 0)`. Импорт `stackTopPad` рядом с
  `transparentHeader`, если он там есть, иначе отдельной строкой из `src/theme/navHeader`.
  Проверка: `grep -rn "insets.top + 64" app src` → пусто.
- [ ] **Шаг 5.** `npx tsc --noEmit`; `npm test`; веб-глазами: `/course` показывает «Повторение» как раньше.
- [ ] **Шаг 6.** Коммит `refactor: общий хук сводки повторения и отступ под шапку стека (spec 72)`.

---

### Задача 3: вкладки — ключи, значки, подписи

**Файлы:** `src/lib/i18n.ts`, `src/components/TabIcons.tsx`, `app/(tabs)/_layout.tsx`, потребители
`tabs.today`/`tabs.spreads`, `src/lib/__tests__/i18nLangs.test.ts`.

- [ ] **Шаг 1.** `grep -rn "tabs\.today\|tabs\.spreads\|'today'\|'spreads'" app src scripts --include=*.ts --include=*.tsx --include=*.js`
  — выписать всех потребителей ключей и имён значков (ожидаются: `_layout.tsx`, `moon.tsx:83`,
  `paywall.tsx` (таблица источников), `i18nLangs.test.ts:38`, `shoot_63.js:365`).
- [ ] **Шаг 2.** `i18n.ts`, объект `tabs` в четырёх языках — ключи `today`→`learn`, `spreads`→`practice`:
  ru `learn: "Учёба"`, `practice: "Практика"`; en `"Learn"`, `"Practice"`; es `"Aprender"`, `"Práctica"`;
  pt `"Aprender"`, `"Prática"`.
- [ ] **Шаг 3.** `TabIcons.tsx`: `TabIconName = 'learn' | 'course' | 'cards' | 'practice' | 'profile'`;
  case `today` и `spreads` удалить, добавить:

```tsx
    case 'learn': // раскрытая книга
      return (
        <Frame color={color} size={size}>
          <Path d="M12 6.6C10.2 5.2 7.6 4.6 3.6 4.8v13c4-.2 6.6.4 8.4 1.8 1.8-1.4 4.4-2 8.4-1.8v-13c-4-.2-6.6.4-8.4 1.8z" />
          <Path d="M12 6.6v13" />
        </Frame>
      );
    case 'practice': // три карты в ряд — схема расклада «Три карты»
      return (
        <Frame color={color} size={size}>
          <Rect x={2.6} y={7} width={5.4} height={10} rx={1.2} />
          <Rect x={9.3} y={5} width={5.4} height={10} rx={1.2} />
          <Rect x={16} y={7} width={5.4} height={10} rx={1.2} />
        </Frame>
      );
```
  Комментарий в шапке файла дополнить: значки `learn` и `practice` дорисованы задачей 72 (в макет —
  те же контуры, задача 13).
- [ ] **Шаг 4.** `_layout.tsx`: `ROUTES` — `icon: 'learn'` у `/`, `icon: 'practice'` у `/spreads`;
  `Tabs.Screen index` → `title: tr('tabs.learn'), tabBarIcon: icon('learn', '/')`; `spreads` →
  `tr('tabs.practice')`, `icon('practice', '/spreads')`.
- [ ] **Шаг 5.** Остальные потребители из шага 1: `moon.tsx` `headerBackTitle` пока → `tr('tabs.learn')`
  (на «Практику» переведёт задача 7); `paywall.tsx` и прочие — по смыслу строки; тест
  `i18nLangs.test.ts` — `tabs.today` → `tabs.learn`.
- [ ] **Шаг 6: контракт.** В `i18nLangs.test.ts` добавить тест по РЕСУРСАМ (не через `t()` — урок 47б):

```ts
it('подписи вкладок: у каждого языка ровно пять ключей, старых нет (спека 72)', () => {
  for (const lng of Object.keys(resources)) {
    const tabs = (resources as any)[lng].translation.tabs;
    expect(Object.keys(tabs).sort()).toEqual(['cards', 'course', 'learn', 'practice', 'profile']);
  }
});
```
  (имя экспорта ресурсов — как в уже стоящих тестах файла.)
- [ ] **Шаг 7.** `grep -rn "tabs\.today\|tabs\.spreads" app src` → пусто. `tsc`, `npm test`.
  Мутация: вернуть в `ru.tabs` ключ `today` → новый тест красный.
- [ ] **Шаг 8.** Коммит `feat: вкладки «Учёба» и «Практика» — ключи, значки (spec 72)`.

---

### Задача 4: строки главного экрана, карты дня, онбординга, пейвола, игры

**Файлы:** `src/lib/i18n.ts` (только добавления и правки значений; удаления мёртвых ключей — в задачах,
которые снимают потребителя).

- [ ] **Шаг 1.** Новый объект `home` (после `today`) в четырёх языках:

| ключ | ru | en | es | pt |
|---|---|---|---|---|
| `title` | Учёба | Learn | Aprender | Aprender |
| `lessonOf` | МОДУЛЬ {{m}} · УРОК {{n}} ИЗ {{total}} | MODULE {{m}} · LESSON {{n}} OF {{total}} | MÓDULO {{m}} · LECCIÓN {{n}} DE {{total}} | MÓDULO {{m}} · LIÇÃO {{n}} DE {{total}} |
| `ctaStart` | НАЧАТЬ УРОК | START LESSON | EMPEZAR LA LECCIÓN | COMEÇAR A LIÇÃO |
| `ctaContinue` | ПРОДОЛЖИТЬ КУРС | CONTINUE THE COURSE | CONTINUAR EL CURSO | CONTINUAR O CURSO |
| `ctaPremium` | ОТКРЫТЬ PREMIUM | UNLOCK PREMIUM | DESBLOQUEAR PREMIUM | DESBLOQUEAR PREMIUM |
| `ctaReview` | К ТРЕНАЖЁРУ | GO TO THE TRAINER | IR AL ENTRENADOR | IR PARA O TREINO |
| `courseDone` | Курс пройден | Course complete | Curso completado | Curso concluído |
| `dailyHint` | Одна карта в день — так колода запоминается сама | One card a day — the deck sticks on its own | Una carta al día: así la baraja se aprende sola | Uma carta por dia — assim o baralho se fixa sozinho |
| `dailyDrawn` | Карта дня · открыта | Card of the day · flipped | Carta del día · abierta | Carta do dia · aberta |
| `dailyReflect` | Вечерний вопрос к карте ждёт | Your evening question is waiting | Tu pregunta de la noche te espera | Sua pergunta da noite está esperando |

  ⚠️ Слово «урок» в es/pt сверить с уже стоящим `course.lessons` этого языка (lección/lição vs aula) —
  взять ТОТ ЖЕ термин; термины решений 24.08: pt «Treino», es «Entrenador».
- [ ] **Шаг 2.** Правка значений `today.*` и `card.backToday`:

| ключ | ru | en | es | pt |
|---|---|---|---|---|
| `today.tapToReveal` | НАЖМИ, ЧТОБЫ ПЕРЕВЕРНУТЬ | TAP TO FLIP | TOCA PARA GIRAR | TOQUE PARA VIRAR |
| `today.meaning` | ЗНАЧЕНИЕ КАРТЫ | CARD MEANING | SIGNIFICADO DE LA CARTA | SIGNIFICADO DA CARTA |
| `today.continue` | ИЗУЧИТЬ КАРТУ → | STUDY THIS CARD → | ESTUDIAR LA CARTA → | ESTUDAR A CARTA → |
| `card.backToday` | значение `today.title` того же языка (ru «Карта дня», en «Card of the Day», es/pt — как в `today.title`) |

  Комментарий над `tapToReveal` про «подписи „Сегодня“» поправить на «подписи экрана карты дня».
- [ ] **Шаг 3.** `ob.*`: `start` → ru «НАЧАТЬ ОБУЧЕНИЕ» / en «START LEARNING» / es «EMPEZAR A APRENDER» /
  pt «COMEÇAR A APRENDER»; новые:

| ключ | ru | en | es | pt |
|---|---|---|---|---|
| `howTitle` | Как устроен курс | How the course works | Cómo funciona el curso | Como o curso funciona |
| `how1` | 32 урока по пять минут — от устройства колоды до раскладов | 32 five-minute lessons — from how the deck is built to spreads | 32 lecciones de cinco minutos: de la estructura de la baraja a las tiradas | 32 lições de cinco minutos — da estrutura do baralho às tiragens |
| `how2` | После каждого урока — короткая викторина | A short quiz after every lesson | Un breve cuestionario después de cada lección | Um quiz curto depois de cada lição |
| `how3` | Тренажёр сам напомнит, какие карты пора повторить | The trainer reminds you which cards are due for review | El entrenador te recuerda qué cartas toca repasar | O treino lembra quais cartas está na hora de revisar |
| `toCourse` | К ПЕРВОМУ УРОКУ | TO THE FIRST LESSON | A LA PRIMERA LECCIÓN | PARA A PRIMEIRA LIÇÃO |

- [ ] **Шаг 4.** `game.*` (новый объект):

| ключ | ru | en | es | pt |
|---|---|---|---|---|
| `overline` | ИГРА | GAME | JUEGO | JOGO |
| `title` | Угадай карту | Guess the Card | Adivina la carta | Adivinhe a carta |
| `sub` | Узнайте аркан по детали рисунка | Name the arcana from a detail of its art | Reconoce el arcano por un detalle del dibujo | Reconheça o arcano por um detalhe do desenho |
| `question` | Какая это карта? | Which card is this? | ¿Qué carta es? | Que carta é esta? |
| `resultLine` | ВЕРНО {{right}} ИЗ {{total}} | {{right}} OF {{total}} CORRECT | {{right}} DE {{total}} CORRECTAS | {{right}} DE {{total}} CORRETAS |
| `again` | Ещё раз | Play again | Otra vez | De novo |

  «ДАЛЬШЕ» и «ГОТОВО» — существующие `lesson.next` и `review.done` (не дублировать).
- [ ] **Шаг 5.** `paywall.legal` и `paywall.restoreNoneText`: литералы магазинов → `{{store}}`.
  ru: «…пока вы её не отмените в настройках {{store}} — не позже…», «У этого аккаунта {{store}} нет…»;
  en: «…cancel it in your {{store}} settings…»; es: «…en los ajustes de {{store}}…»;
  pt: «…nas configurações da loja ({{store}})…» (род у «App Store» и «Google Play» разный — скобки
  снимают согласование). `interpolation.escapeValue` уже `false` (i18n.ts:1490) — «/» не экранируется.
- [ ] **Шаг 6.** `npx tsc --noEmit`; `npm test` (структурные тесты i18n требуют одинаковый набор ключей
  во всех языках — если красные, сверить четыре блока). Коммит `feat: строки учебного экрана, игры и онбординга на четырёх языках (spec 72)`.

---

### Задача 5: `StatsPills`, `NextLessonCard`, `DailyCardRow`

**Файлы:** новые `src/components/StatsPills.tsx`, `NextLessonCard.tsx`, `DailyCardRow.tsx`.

**Потребляет:** `NextLessonSummary`, `NextLessonState` (задача 1); `moduleBox` из `ModuleHeader.tsx`;
строки `home.*` (задача 4).

- [ ] **Шаг 1.** `StatsPills.tsx` — перенос разметки `index.tsx:444-460` и стилей `pills/pillStreak/pillXp/freezeRow/freezeText`:

```tsx
/** Ряд «серия + уровень» и строка «серию спасла заморозка» (`.pills` эталона). Вынесен задачей 72:
 *  ряд стоит на «Учёбе» и на экране карты дня. `burst` — счётчик салютов огонька: его ведёт экран
 *  карты дня из onDraw, «Учёба» салют не играет. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet } from 'react-native';
import { localDateISO } from '../lib/dates';
import { useLang } from '../lib/i18n';
import { pickPhrase } from '../lib/phrases';
import { levelFromXp } from '../lib/xp';
import { useApp } from '../store/useApp';
import { useTheme } from '../theme/useTheme';
import { FadeUp } from './FadeUp';
import { StreakPill } from './StreakPill';
import { Txt } from './Txt';
import { XpPill } from './XpPill';

export function StatsPills({ index, burst = 0 }: { index: number; burst?: number }) {
  const t = useTheme();
  const lang = useLang();
  const streak = useApp((s) => s.streak);
  const freezeSpentDate = useApp((s) => s.freezeSpentDate);
  const lvl = levelFromXp(useApp((s) => s.xp));
  const todayISO = localDateISO();
  return (
    <>
      <FadeUp index={index} style={st.pills}>
        <StreakPill streak={streak} burst={burst} style={st.pillStreak} />
        <XpPill level={lvl.level} progress={lvl.progress} style={st.pillXp} />
      </FadeUp>
      {/* весь день спасения (спека 10); тот же индекс каскада — появляется вместе с пилюлями */}
      {freezeSpentDate === todayISO && (
        <FadeUp index={index} style={st.freezeRow}>
          <Ionicons name="snow" size={12} color={t.accent} />
          <Txt style={[st.freezeText, { color: t.muted }]}>{pickPhrase('freeze.saved', todayISO, lang)}</Txt>
        </FadeUp>
      )}
    </>
  );
}

const st = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pillStreak: { flex: 1 },
  pillXp: { flex: 1.5 },
  freezeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  freezeText: { fontSize: 12 },
});
```
- [ ] **Шаг 2.** `NextLessonCard.tsx`:

```tsx
/** Герой экрана «Учёба» (спека 72): следующий урок курса — «МОДУЛЬ 1 · УРОК 1 ИЗ 32», название,
 *  полоса прогресса курса, CTA. Состояние и подписи приходят снаружи: компонент не знает ни про
 *  подписку, ни про маршруты. Геометрия панели — общий moduleBox (ModuleHeader, ReviewPanel). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import type { NextLessonState, NextLessonSummary } from '../lib/courseProgress';
import type { Lang } from '../lib/lang';
import { inLang } from '../lib/lang';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CtaButton } from './CtaButton';
import { moduleBox } from './ModuleHeader';
import { PremiumBadge } from './PremiumBadge';
import { PROGRESS_EASE, ProgressBar } from './ProgressBar';
import { Txt } from './Txt';

const CTA_KEY: Record<NextLessonState, string> = {
  start: 'home.ctaStart',
  continue: 'home.ctaContinue',
  locked: 'home.ctaPremium',
  done: 'home.ctaReview',
};

export function NextLessonCard({
  summary,
  state,
  lang,
  onPress,
}: {
  summary: NextLessonSummary;
  state: NextLessonState;
  lang: Lang;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const fill = useSharedValue(0);
  React.useEffect(() => {
    fill.value = withTiming(summary.pct / 100, { duration: 900, easing: PROGRESS_EASE });
  }, [fill, summary.pct]);

  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={st.overlineRow}>
        <Txt style={[st.overline, { color: t.accent }]}>
          {summary.lesson
            ? tr('home.lessonOf', { m: summary.moduleIndex + 1, n: summary.lessonNumber, total: summary.total })
            : tr('course.title').toUpperCase()}
        </Txt>
        {state === 'locked' && <PremiumBadge style={st.badge} />}
      </View>
      <Txt style={[st.title, { color: t.head }]}>
        {summary.lesson ? inLang(summary.lesson.title, lang) : tr('home.courseDone')}
      </Txt>
      <View style={st.barRow}>
        <ProgressBar progress={fill} radius={3} style={st.bar} />
        <Txt style={[st.pct, { color: t.muted }]}>{summary.pct}%</Txt>
      </View>
      <CtaButton label={tr(CTA_KEY[state])} onPress={onPress} style={st.cta} />
    </View>
  );
}

const st = StyleSheet.create({
  // колонка, а не ряд moduleBox: у героя содержимое идёт сверху вниз
  box: { ...moduleBox, flexDirection: 'column', alignItems: 'stretch', gap: 0, marginTop: spacing.l },
  overlineRow: { flexDirection: 'row', alignItems: 'center' },
  overline: { fontSize: 9.5, letterSpacing: 2.5, fontWeight: '600' }, // как у ModuleHeader
  badge: { marginLeft: 8 },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, marginTop: 4 }, // Display M
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  bar: { flex: 1, height: 6 },
  pct: { fontSize: 13 },
  cta: { marginTop: 14 },
});
```
  ⚠️ Перед записью сверить сигнатуру `ProgressBar` (`progress: SharedValue<number>`, `radius`, `colors`,
  `style`) и как `XpPill` задаёт высоту/анимацию — повторить ЕГО приём (длительность, easing), а не
  числа из этого листинга, если они расходятся. `Lang` импортировать оттуда же, откуда его берёт
  `ModuleHeader` (`../lib/content`).
- [ ] **Шаг 3.** `DailyCardRow.tsx`:

```tsx
/** Компактная строка «Карта дня» на экране «Учёба» (спека 72): миниатюра + две строки + шеврон,
 *  тап ведёт на экран карты дня. Три состояния: не открыта (рубашка), открыта (лицо и имя),
 *  вечером ждёт рефлексия (подстрочник цветом accent). */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages, type TarotCard } from '../lib/content';
import { inLang, type Lang } from '../lib/lang';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

const THUMB_W = 44;
const THUMB_H = 76;

export function DailyCardRow({
  card,
  reflect,
  lang,
  onPress,
}: {
  /** открытая сегодня карта; null — ещё не открыта */
  card: TarotCard | null;
  /** вечерний вопрос доступен и ещё без ответа */
  reflect: boolean;
  lang: Lang;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const sub = !card ? tr('home.dailyHint') : reflect ? tr('home.dailyReflect') : tr('home.dailyDrawn');
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      <View style={[st.thumb, { borderColor: t.frame }]}>
        {card ? (
          <Image source={cardImages[card.id]} style={st.img} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <StarBack starSize={13} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={[st.title, { color: t.head }]}>{card ? inLang(card.name, lang) : tr('today.title')}</Txt>
        <Txt style={[st.sub, { color: card && reflect ? t.accent : t.muted }]}>{sub}</Txt>
      </View>
      <Ionicons name="chevron-forward-outline" size={14} color={t.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  box: { ...moduleBox, marginTop: 12 },
  thumb: { width: THUMB_W, height: THUMB_H, borderRadius: 11, borderWidth: 1, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26 },
  sub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
```
- [ ] **Шаг 4.** `npx tsc --noEmit` чист (компоненты пока никем не используются — это нормально).
  Коммит `feat: компоненты экрана «Учёба» — пилюли, герой урока, строка карты дня (spec 72)`.

---

### Задача 6: перенос карты дня в `/daily` и новый экран «Учёба»

**Файлы:** `git mv "app/(tabs)/index.tsx" app/daily.tsx`; новый `app/(tabs)/index.tsx`; `app/_layout.tsx`;
`app/(tabs)/spreads/index.tsx` (только ссылка `card-of-day`).

- [ ] **Шаг 1.** `git mv "app/(tabs)/index.tsx" app/daily.tsx` — история файла сохраняется.
- [ ] **Шаг 2.** Правки `app/daily.tsx`:
  - все импорты `'../../src/…'` → `'../src/…'`;
  - компонент `TodayScreen` → `DailyScreen`; шапку-комментарий файла (если есть) — «экран карты дня
    (стек, спека 72; до 72 — первая вкладка)»;
  - удалить: импорт `MoonRow`, `moonInfo`, блок `<FadeUp index={1}><MoonRow …/></FadeUp>`, переменную
    `moon`; импорт и использование `useTabTopRef` (`scrollRef` и `ref={scrollRef}` убрать);
  - ряд пилюль и строку заморозки (бывшие `index.tsx:444-460`) заменить на
    `<StatsPills index={1} burst={burst} />`; удалить ставшие лишними: импорты `StreakPill`, `XpPill`,
    `Ionicons` (если больше не нужен), `pickPhrase`, `levelFromXp`, селекторы `streak`… ⚠️ `streak`
    может читаться в `onDraw` (веха 7-го дня) — удалять только то, что после замены не используется
    (`tsc` с `noUnusedLocals` подскажет; если флаг выключен — грепом по файлу); стили
    `pills/pillStreak/pillXp/freezeRow/freezeText` удалить;
  - индексы каскада: шапка 0, `StatsPills` 1, сцена карты 2;
  - добавить первой строкой JSX внутри корневого `View`:
    `<Stack.Screen options={{ headerBackTitle: tr('tabs.learn') }} />` (импорт `Stack` из `expo-router`);
  - `paddingTop: insets.top + spacing.xl` → `paddingTop: stackTopPad(insets)`;
  - в тексте `console.warn('[today] …')` → `'[daily] …'`.
- [ ] **Шаг 3.** `app/_layout.tsx`, внутри `Stack.Protected guard={onboarded}` после `moon`:

```tsx
          {/* карта дня (спека 72): до 72 жила первой вкладкой, теперь стек поверх «Учёбы»; объявлена
              здесь, чтобы не пройти мимо гарда онбординга (урок 09) */}
          <Stack.Screen name="daily" options={transparentHeader(t)} />
```
- [ ] **Шаг 4.** Новый `app/(tabs)/index.tsx`:

```tsx
/** Экран «Учёба» — первая вкладка (спека 72): следующий урок курса, «Повторение», игра «Угадай
 *  карту» и компактная строка карты дня. До задачи 72 первой вкладкой была карта дня (app/daily.tsx). */
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyCardRow } from '../../src/components/DailyCardRow';
import { FadeUp } from '../../src/components/FadeUp';
import { NextLessonCard } from '../../src/components/NextLessonCard';
import { ReviewPanel } from '../../src/components/ReviewPanel';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { StatsPills } from '../../src/components/StatsPills';
import { Txt } from '../../src/components/Txt';
import { cardById, course } from '../../src/lib/content';
import { nextLessonState, nextLessonSummary } from '../../src/lib/courseProgress';
import { formatEntryDate, localDateISO } from '../../src/lib/dates';
import { useLang } from '../../src/lib/i18n';
import { lessonLocked } from '../../src/lib/premium';
import { reflectionVisible } from '../../src/lib/reflection';
import { useAppActive } from '../../src/lib/useAppActive';
import { useReviewSummary } from '../../src/lib/useReviewSummary';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function LearnScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const scrollRef = useTabTopRef<ScrollView>();

  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const premium = useApp((s) => s.premium);
  const drawn = useApp((s) => s.todayDraw());
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const devReflect = useApp((s) => s.devReflect);
  const reviewSum = useReviewSummary();

  // час (вечерняя рефлексия) и дата шапки — по фокусу таба и по возврату из фона (правило 06а)
  const [now, setNow] = React.useState(() => new Date());
  useFocusEffect(React.useCallback(() => setNow(new Date()), []));
  useAppActive(() => setNow(new Date()));

  const summary = React.useMemo(() => nextLessonSummary(course, lessonsProgress), [lessonsProgress]);
  const state = nextLessonState(
    summary,
    !!summary.lesson && lessonLocked(summary.lesson.id, course, premium),
  );
  const onHero = () => {
    if (state === 'done') router.push('/review');
    else if (state === 'locked') router.push({ pathname: '/paywall', params: { from: 'course' } });
    else router.push(`/lesson/${summary.lesson!.id}`);
  };

  const reflect =
    reflectionVisible({ drawn: !!drawn, hour: now.getHours(), enabled: reflectionOn, devForce: __DEV__ && devReflect }) &&
    !drawn?.outcome;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.date, { color: t.muted }]}>
            {formatEntryDate(localDateISO(now), lang, 'long').toUpperCase()}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('home.title')}</Txt>
          <Rule />
        </FadeUp>
        <StatsPills index={1} />
        <FadeUp index={2}>
          <NextLessonCard summary={summary} state={state} lang={lang} onPress={onHero} />
        </FadeUp>
        <FadeUp index={3} style={st.panels}>
          <ReviewPanel summary={reviewSum} onPress={() => router.push('/review')} />
          {/* панель игры «Угадай карту» встаёт сюда задачей 12 плана */}
          <DailyCardRow
            card={drawn ? cardById.get(drawn.cardId) ?? null : null}
            reflect={reflect}
            lang={lang}
            onPress={() => router.push('/daily')}
          />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  date: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
  panels: { marginTop: 12 },
});
```
  ⚠️ `ReviewPanel` несёт собственный `marginBottom: spacing.m` и при состоянии `hidden` возвращает
  `null` — проверить на вебе оба случая, зазоры между панелями обязаны быть равными (12); если нет —
  выровнять `marginTop` у `DailyCardRow`, а не править `ReviewPanel` (его делит «Курс»).
- [ ] **Шаг 5.** `spreads/index.tsx`: `router.navigate('/')` → `router.push('/daily')`; комментарий
  «ритуал главного экрана» → «у карты дня свой экран (спека 72)»; шапка файла — «„Карта дня“ ведёт на /daily».
- [ ] **Шаг 6.** Запустить dev-сервер (`npx expo start --web --clear`), если `tsc` ругается на
  `router.push('/daily')` — типы маршрутов (`.expo/types/router.d.ts`) перегенерируются после старта
  сервера (урок 07). `npx tsc --noEmit` чист.
- [ ] **Шаг 7: веб-глазами, 390×844.** `/` — «Учёба», герой «МОДУЛЬ 1 · УРОК 1 ИЗ 32», CTA открывает
  `m1l1`; строка «Карта дня» → `/daily`, переворот работает, «ИЗУЧИТЬ КАРТУ →» → страница карты →
  «назад» → `/daily` → «назад» → «Учёба»; «Практика» → «Карта дня» → `/daily`. Консоль без ошибок.
- [ ] **Шаг 8.** `npm test`; коммит `feat: экран «Учёба» первой вкладкой, карта дня — отдельный экран /daily (spec 72)`
  (`git add "app/(tabs)/index.tsx" app/daily.tsx app/_layout.tsx "app/(tabs)/spreads/index.tsx"`).

---

### Задача 7: луна — без лунного дня, вход из «Практики»

**Файлы:** `src/components/MoonRow.tsx`, `app/(tabs)/spreads/index.tsx`, `app/moon.tsx`, `src/lib/i18n.ts`.

- [ ] **Шаг 1.** `MoonRow.tsx`: удалить проп `day` и строку `<Txt …>{` · ${tr('moon.day', …)}`}</Txt>`;
  шапка-комментарий: «Строка луны „☽ Растущая луна“ — на вкладке „Практика“ и в шапке лунного
  календаря; номер лунного дня снят задачей 72 (фазы — астрономия, нумерованные дни — астрология)».
- [ ] **Шаг 2.** `app/moon.tsx`: `<MoonRow phase={moon.phase} />`; `headerBackTitle` → `tr('tabs.practice')`.
  `grep -n "lunarDay\|\.day\b\|moon\.day" app/moon.tsx src/components` — любой другой вывод лунного
  дня в интерфейсе снять (сетка календаря показывает числа месяца — это НЕ лунные дни, не трогать).
- [ ] **Шаг 3.** `spreads/index.tsx`: импорт `MoonRow`, `moonInfo` (`src/lib/moon`); после `FadeUp index={0}`:

```tsx
        {/* вход в лунный календарь (спека 72: строка переехала с главного экрана). `now` уже
            обновляется по возврату из фона — им же считаем фазу; DEV-подмена «сейчас» уважается */}
        <FadeUp index={1}>
          <MoonRow phase={moonInfo(devNow ?? now).phase} onPress={() => router.push('/moon')} />
        </FadeUp>
```
  Индексы каскада ленты сдвинуть: `index={Math.min(2 + si, 8)}`. Добавить пересчёт `now` по фокусу
  таба: `useFocusEffect(React.useCallback(() => setNow(new Date()), []))` (импорт из `expo-router`).
- [ ] **Шаг 4.** `i18n.ts`: удалить `moon.day` из четырёх языков; комментарий над `moon` поправить
  («строка на вкладке „Практика“»). `grep -rn "moon\.day" app src` → пусто.
- [ ] **Шаг 5.** Корневой `_layout.tsx`: комментарий у `moon` — «поверх таба „Практика“, подпись „Практика“».
- [ ] **Шаг 6.** `tsc`, `npm test` (тесты `moon.test.ts` про `lunarDay` остаются зелёными — функция не тронута).
  Веб: «Практика» → строка луны без «лунный день» → `/moon` → «назад» = «Практика». Коммит
  `feat: луна — вход из «Практики», лунный день снят с интерфейса (spec 72)`.

---

### Задача 8: онбординг — два шага

**Файлы:** `app/onboarding.tsx`, `src/lib/i18n.ts`.

- [ ] **Шаг 1.** `onboarding.tsx`:
  - `step: 1 | 2`; удалить состояния `birthDate`, `pickerOpen`, `hover`/`hoverStyle`, ветку `next === 3`
    в `goStep` (останется `goStep(2)`), `arcana`, весь блок `step === 3`, `<DatePicker …/>`, стили
    `overline/reveal/revealImg/cardName/fieldValue`, константы `CARD_WIDTH/CARD_HEIGHT`; импорты
    `DatePicker`, `Image`, `cardImages`, `cardById`, `birthArcanaId`, `formatFullDate`, `inLang`,
    `pingPong`, `hapticSuccess`, `router` — каждый только если больше не используется;
  - `finish`: `const finish = () => completeOnboarding(name);` — комментарий про гард сохранить, абзац
    про переход на страницу аркана удалить;
  - шаг 2 целиком:

```tsx
            {step === 2 && (
              <>
                <FadeUp index={0}>
                  <Txt style={[st.h2, { color: t.head }]}>{tr('ob.howTitle')}</Txt>
                </FadeUp>
                {(['ob.how1', 'ob.how2', 'ob.how3'] as const).map((key, i) => (
                  <FadeUp key={key} index={1 + i} style={st.fieldWrap}>
                    <View style={[st.how, { backgroundColor: t.panel, borderColor: t.line }]}>
                      <Ionicons name={HOW_ICONS[i]} size={18} color={t.accent} />
                      <Txt style={[st.howTxt, { color: t.text }]}>{tr(key)}</Txt>
                    </View>
                  </FadeUp>
                ))}
                <FadeUp index={4} style={st.fieldWrap}>
                  <View style={[st.field, { backgroundColor: t.panel, borderColor: t.line }]}>
                    <Txt style={[st.fieldLabel, { color: t.accent }]}>{tr('ob.nameLabel')}</Txt>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={tr('ob.namePlaceholder')}
                      placeholderTextColor={t.muted}
                      autoCorrect={false}
                      returnKeyType="done"
                      style={[st.fieldInput, { color: t.head }]}
                    />
                  </View>
                </FadeUp>
                <FadeUp index={5} style={st.ctaWrap}>
                  <CtaButton label={tr('ob.toCourse')} onPress={finish} />
                </FadeUp>
              </>
            )}
```
    с константой `const HOW_ICONS = ['school-outline', 'help-circle-outline', 'sync-outline'] as const;`
    (Ionicons; `sync-outline` — тот же значок, что у панели «Повторение») и стилями
    `how: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 12 }`,
    `howTxt: { flex: 1, fontSize: 14, lineHeight: 20 }`; точки — `([1, 2] as const)`.
- [ ] **Шаг 2.** `i18n.ts`: для каждого из `ob.aboutTitle`, `ob.aboutLead`, `ob.birthLabel`,
  `ob.birthPlaceholder`, `ob.pickTitle`, `ob.openArcana`, `ob.continue`, `ob.learnMore` —
  `grep -rn "ob\.<ключ>" app src`; ноль потребителей → удалить из четырёх языков; есть потребитель
  (например, настройки берут `ob.pickTitle`) → оставить и записать в отчёт.
- [ ] **Шаг 3.** Профиль без даты рождения: открыть на вебе `/profile` с сидом без `profile.birthDate`.
  Если `BirthArcanaCard` уже показывает приглашение указать дату — ничего не делать. Если карточки нет
  вовсе — добавить в `BirthArcanaCard` пустое состояние: та же панель, текст существующим ключом
  настроек (`settings.birthDate`) + шеврон, тап → `router.push('/settings')`; строк новых не заводить.
- [ ] **Шаг 4.** `tsc`, `npm test`. Веб: сброс стора (`localStorage.clear()` → reload) → онбординг
  2 шага, 2 точки → «К ПЕРВОМУ УРОКУ» → «Учёба» с героем «НАЧАТЬ УРОК»; дата рождения нигде не спрошена.
- [ ] **Шаг 5.** Коммит `feat: онбординг про курс — два шага, дата рождения только в настройках (spec 72)`.

---

### Задача 9: имя магазина на пейволе

**Файлы:** `src/lib/purchasesEnv.ts`, `app/paywall.tsx`, `src/lib/__tests__/purchases.test.ts`.

- [ ] **Шаг 1.** `purchasesEnv.ts` — дописать:

```ts
/** Имя магазина в текстах пейвола (спека 72; Apple 2.3.10 — в iOS-сборке не называть чужой магазин).
 *  Не переводится. На вебе магазина нет — называем оба. */
export const STORE_NAME: string =
  Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'App Store / Google Play';
```
- [ ] **Шаг 2.** `paywall.tsx`: `tr('paywall.legal', { store: STORE_NAME })`; диалог «покупок не найдено» —
  найти место, где текст берётся по ключу из таблицы (`text: 'paywall.restoreNoneText'`), и передать
  `{ store: STORE_NAME }` в вызов `tr` этого текста.
- [ ] **Шаг 3.** Контракт в `purchases.test.ts` (рядом с «цен в коде нет», по РЕСУРСАМ четырёх языков):

```ts
it('строки пейвола не называют магазин литералом — только {{store}} (спека 72)', () => {
  for (const lng of Object.keys(resources)) {
    const flat = JSON.stringify((resources as any)[lng].translation.paywall);
    expect(flat).not.toMatch(/Google Play|App Store/);
  }
});
```
  Мутация: вернуть «Google Play» в `en.paywall.legal` → красный.
- [ ] **Шаг 4.** `tsc`, `npm test`; `scripts/check_62_web.js` — 58 из 58 (если сценарий сверял текст
  `legal` литералом — обновить ожидание на «App Store / Google Play»). Коммит
  `fix: пейвол называет магазин своей платформы (spec 72)`.

---

### Задача 10: `fragmentGame.ts` (TDD)

**Файлы:** новый `src/lib/fragmentGame.ts`; тест `src/lib/__tests__/fragmentGame.test.ts`.

**Производит:**
```ts
export interface FragmentBox { cx: number; cy: number; size: number }
export type FragmentPool = Record<string, FragmentBox[]>;
export interface FragmentQuestion { cardId: string; box: FragmentBox; options: string[]; correct: number }
export const FRAGMENT_SESSION = 10; export const FRAGMENT_OPTIONS = 4;
export const CARD_RATIO = 1.72;          // высота / ширина скана (замер 18.09: 1.719–1.721)
export const FRAGMENT_TOP = 0.10;        // верхняя запретная полоса (номер аркана; замер: до 0.092)
export const FRAGMENT_BOTTOM = 0.10;     // нижняя полоса с именем (замер по 21 карте: до 0.088)
export const FRAGMENT_SIZE_MIN = 0.22; export const FRAGMENT_SIZE_MAX = 0.45;
export function boxEdges(box: FragmentBox, ratio?: number): { left: number; right: number; top: number; bottom: number }
export function buildFragmentSession(pool: FragmentPool, rng?: () => number, size?: number): FragmentQuestion[]
export function fragmentLayout(box: FragmentBox, view: number, ratio?: number, t?: number): { width: number; height: number; left: number; top: number }
export function sessionScore(log: readonly boolean[]): { right: number; total: number; xp: number }
```

- [ ] **Шаг 1: красные тесты** — `fragmentGame.test.ts`:

```ts
import {
  boxEdges, buildFragmentSession, fragmentLayout, sessionScore,
  CARD_RATIO, FRAGMENT_OPTIONS, type FragmentPool,
} from '../fragmentGame';
import { XP_REVIEW } from '../xp';

// детерминированный генератор (LCG) — тест не зависит от Math.random
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pool = (n: number): FragmentPool =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, [
    { cx: 0.3, cy: 0.3, size: 0.3 }, { cx: 0.6, cy: 0.6, size: 0.3 },
  ]]));

describe('buildFragmentSession', () => {
  it('10 вопросов, карта не повторяется, у каждого 4 разных варианта', () => {
    const qs = buildFragmentSession(pool(22), lcg(1));
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.cardId)).size).toBe(10);
    for (const q of qs) expect(new Set(q.options).size).toBe(FRAGMENT_OPTIONS);
  });
  it('correct указывает на карту вопроса при любом сиде (класс дефекта 29/31)', () => {
    for (let seed = 1; seed <= 50; seed++)
      for (const q of buildFragmentSession(pool(22), lcg(seed))) expect(q.options[q.correct]).toBe(q.cardId);
  });
  it('верный ответ не прилипает к одной позиции', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) buildFragmentSession(pool(22), lcg(seed)).forEach((q) => seen.add(q.correct));
    expect(seen.size).toBe(FRAGMENT_OPTIONS);
  });
  it('фрагмент вопроса принадлежит его карте', () => {
    const p = pool(22);
    for (const q of buildFragmentSession(p, lcg(7))) expect(p[q.cardId]).toContain(q.box);
  });
  it('детерминизм: один сид — одна сессия', () => {
    expect(buildFragmentSession(pool(22), lcg(3))).toEqual(buildFragmentSession(pool(22), lcg(3)));
  });
  it('пул меньше размера сессии — вопросов столько, сколько карт; меньше 4 карт — пусто', () => {
    expect(buildFragmentSession(pool(6), lcg(1))).toHaveLength(6);
    expect(buildFragmentSession(pool(3), lcg(1))).toEqual([]);
    expect(buildFragmentSession({}, lcg(1))).toEqual([]);
  });
  it('карта без фрагментов в сессию не попадает', () => {
    const p = { ...pool(5), empty: [] };
    for (let seed = 1; seed <= 20; seed++)
      expect(buildFragmentSession(p, lcg(seed)).some((q) => q.cardId === 'empty')).toBe(false);
  });
});

describe('boxEdges и fragmentLayout', () => {
  it('квадрат в пикселях: высота в долях = size / ratio', () => {
    const e = boxEdges({ cx: 0.5, cy: 0.5, size: 0.4 });
    expect(e.right - e.left).toBeCloseTo(0.4);
    expect(e.bottom - e.top).toBeCloseTo(0.4 / CARD_RATIO);
  });
  it('t = 0: фрагмент заполняет квадрат, центр фрагмента в центре квадрата', () => {
    const r = fragmentLayout({ cx: 0.5, cy: 0.5, size: 0.25 }, 300);
    expect(r.width).toBeCloseTo(1200);
    expect(r.height).toBeCloseTo(1200 * CARD_RATIO);
    expect(r.left + 0.5 * r.width).toBeCloseTo(150);
    expect(r.top + 0.5 * r.height).toBeCloseTo(150);
  });
  it('t = 0: у края скана картинка не оголяет квадрат', () => {
    const r = fragmentLayout({ cx: 0.05, cy: 0.05, size: 0.3 }, 300);
    expect(r.left).toBeLessThanOrEqual(0);
    expect(r.top).toBeLessThanOrEqual(0);
    expect(r.left + r.width).toBeGreaterThanOrEqual(300);
  });
  it('t = 1: карта целиком вписана по высоте и стоит по центру', () => {
    const r = fragmentLayout({ cx: 0.2, cy: 0.8, size: 0.3 }, 300, CARD_RATIO, 1);
    expect(r.height).toBeCloseTo(300);
    expect(r.width).toBeCloseTo(300 / CARD_RATIO);
    expect(r.top).toBeCloseTo(0);
    expect(r.left).toBeCloseTo((300 - 300 / CARD_RATIO) / 2);
  });
});

describe('sessionScore', () => {
  it('считает верные и XP по XP_REVIEW', () => {
    expect(sessionScore([true, false, true])).toEqual({ right: 2, total: 3, xp: 2 * XP_REVIEW });
    expect(sessionScore([])).toEqual({ right: 0, total: 0, xp: 0 });
  });
});
```
- [ ] **Шаг 2.** `npx jest src/lib/__tests__/fragmentGame.test.ts` → FAIL (модуля нет).
- [ ] **Шаг 3: реализация** `src/lib/fragmentGame.ts`:

```ts
/** Игра «Угадай карту по фрагменту» (спека 72) — чистая логика: сборка сессии, геометрия кропа,
 *  счёт. Ни одного импорта react/expo. Фрагмент задаётся центром и стороной квадрата в ДОЛЯХ скана:
 *  cx/cy — доли ширины/высоты, size — доля ШИРИНЫ (квадрат в пикселях ⇒ по высоте он size / ratio). */
import { shuffle } from './shuffle';
import { XP_REVIEW } from './xp';

export interface FragmentBox { cx: number; cy: number; size: number }
export type FragmentPool = Record<string, FragmentBox[]>;
export interface FragmentQuestion {
  cardId: string;
  box: FragmentBox;
  /** id карт-вариантов, перемешаны */
  options: string[];
  /** индекс верного варианта в options */
  correct: number;
}

export const FRAGMENT_SESSION = 10;
export const FRAGMENT_OPTIONS = 4;
/** высота / ширина скана; замер 18.09 по 22 старшим арканам: 1.719–1.721 (страж пропорции — cardAssets.test) */
export const CARD_RATIO = 1.72;
/** Запретные полосы: вверху напечатан номер аркана, внизу — имя карты (иначе ответ виден в кадре —
 *  дефект задачи 58). Замер 18.09: линия рамки над подписью не выше 0.088 высоты (21 карта из 22),
 *  верхняя — до 0.092; берём 0.10 с обеих сторон. */
export const FRAGMENT_TOP = 0.1;
export const FRAGMENT_BOTTOM = 0.1;
/** меньше — каша из пикселей при увеличении, больше — узнаётся вся композиция */
export const FRAGMENT_SIZE_MIN = 0.22;
export const FRAGMENT_SIZE_MAX = 0.45;

/** Края квадрата в долях скана. */
export function boxEdges(box: FragmentBox, ratio: number = CARD_RATIO) {
  const halfW = box.size / 2;
  const halfH = box.size / ratio / 2;
  return { left: box.cx - halfW, right: box.cx + halfW, top: box.cy - halfH, bottom: box.cy + halfH };
}

/** Сессия: карты без повтора, у карты случайный фрагмент, три дистрактора — другие карты пула.
 *  Верный индекс ВЫЧИСЛЯЕТСЯ после перемешивания, а не хранится рядом (задачи 29/31). */
export function buildFragmentSession(
  pool: FragmentPool,
  rng: () => number = Math.random,
  size: number = FRAGMENT_SESSION,
): FragmentQuestion[] {
  const ids = Object.keys(pool).filter((id) => pool[id].length > 0);
  if (ids.length < FRAGMENT_OPTIONS) return [];
  return shuffle(ids, rng)
    .slice(0, size)
    .map((cardId) => {
      const boxes = pool[cardId];
      const box = boxes[Math.floor(rng() * boxes.length)];
      const others = shuffle(ids.filter((id) => id !== cardId), rng).slice(0, FRAGMENT_OPTIONS - 1);
      const options = shuffle([cardId, ...others], rng);
      return { cardId, box, options, correct: options.indexOf(cardId) };
    });
}

/** Прямоугольник картинки внутри квадратного окна со стороной `view` (overflow: hidden).
 *  t = 0 — фрагмент заполняет окно; t = 1 — карта целиком вписана по высоте и стоит по центру;
 *  между ними — линейно (экран ведёт t анимацией «отъезда»). */
export function fragmentLayout(box: FragmentBox, view: number, ratio: number = CARD_RATIO, t: number = 0) {
  const w0 = view / box.size;
  const h0 = w0 * ratio;
  // центр фрагмента — в центр окна; у края скана прижимаем, чтобы окно не оголилось
  const left0 = Math.min(0, Math.max(view - w0, view / 2 - box.cx * w0));
  const top0 = Math.min(0, Math.max(view - h0, view / 2 - box.cy * h0));
  const h1 = view;
  const w1 = view / ratio;
  const left1 = (view - w1) / 2;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { width: mix(w0, w1), height: mix(h0, h1), left: mix(left0, left1), top: mix(top0, 0) };
}

export function sessionScore(log: readonly boolean[]) {
  const right = log.filter(Boolean).length;
  return { right, total: log.length, xp: right * XP_REVIEW };
}
```
  ⚠️ Сверить сигнатуру `shuffle` (`src/lib/shuffle.ts:4` — `shuffle<T>(items, rng = Math.random)`).
- [ ] **Шаг 4.** jest → PASS; `tsc` чист.
- [ ] **Шаг 5: мутации** (по одной): `correct: options.indexOf(cardId)` → `correct: 0`; убрать
  `.filter((id) => id !== cardId)`; в `fragmentLayout` убрать прижим `Math.min/Math.max`;
  `box.size / ratio` → `box.size` в `boxEdges`. Каждая обязана уронить хотя бы один тест.
- [ ] **Шаг 6.** Коммит `feat: логика игры «Угадай карту по фрагменту» (spec 72)`.

---

### Задача 11: данные фрагментов, контакт-лист, контракт

**Файлы:** новый `content/fragments.json`, `scripts/fragment_sheet.py`, `src/lib/__tests__/fragments.test.ts`;
правка `src/lib/content.ts`, `AGENTS.md` (описание скрипта).

- [ ] **Шаг 1.** `scripts/fragment_sheet.py` (Python 3.10, Pillow; запуск из корня, без аргументов):
  читает `content/fragments.json` и `content/cards.json`; для каждого фрагмента вырезает квадрат
  (`left = (cx − size/2)·W`, `top = cy·H − size·W/2`, сторона `size·W`), масштабирует до 300×300
  (LANCZOS), подписывает `id #n · cx cy size` и складывает сеткой 6 в ряд в
  `docs/screenshots/72/fragments-sheet.jpg` (q88). Сам проверяет и печатает ОШИБКИ (код 1): квадрат
  вылез за скан; верх < 0.10 или низ > 0.90 высоты; `size` вне 0.22–0.45; id нет в колоде. Печатает
  итог «фрагментов N, карт M из 22». JSON читать/писать как в репозитории не нужно — скрипт только читает.
- [ ] **Шаг 2: разметка.** Для каждого из 22 старших арканов открыть скан (`assets/cards/<файл>` —
  Read показывает картинку) и выбрать ДВЕ детали: узнаваемые, однозначные, без надписей и номера,
  **без нагих фигур** (Звезда, Солнце, Влюблённые, Дьявол, Суд, Мир — только предметы/животные/
  архитектура/небесные тела), не перекрывающиеся больше чем наполовину. Ориентиры (не обязательные):
  Шут — собака, узелок; Маг — стол с предметами, лемниската; Жрица — свиток, колонна; Императрица —
  щит с Венерой, корона из звёзд; Император — бараньи головы трона, держава; Иерофант — ключи, тиара;
  Влюблённые — ангел (крылья и облако), дерево со змеем; Колесница — сфинкс, балдахин со звёздами;
  Сила — голова льва, венок; Отшельник — фонарь, посох; Колесо — колесо с буквами НЕЛЬЗЯ (надпись) ⇒
  сфинкс на колесе, крылатый бык; Справедливость — весы, меч; Повешенный — нимб, перекладина;
  Смерть — флаг с розой, конь; Умеренность — чаши, ирисы; Дьявол — перевёрнутая пентаграмма, факел;
  Башня — корона, молния; Звезда — большая звезда, птица на дереве; Луна — рак, башни; Солнце —
  лик солнца, подсолнухи; Суд — труба с флагом, горы; Мир — венок НЕ брать (фигура) ⇒ орёл, лев в углах.
  Записать в `content/fragments.json` (indent 1, `ensure_ascii` не нужен — кириллицы нет), формат:
  `{ "fool": [ { "cx": 0.62, "cy": 0.31, "size": 0.34 }, … ], … }` — ключи в порядке колоды.
- [ ] **Шаг 3.** `python scripts/fragment_sheet.py` → ошибок 0, «фрагментов 44, карт 22 из 22»;
  открыть `docs/screenshots/72/fragments-sheet.jpg` и просмотреть КАЖДЫЙ квадрат глазами; неудачные
  переразметить и повторить.
- [ ] **Шаг 4.** `src/lib/content.ts`: `import fragmentsJson from '../../content/fragments.json';`
  (путь — как у соседних импортов JSON) и
  `export const fragments = fragmentsJson as Record<string, { cx: number; cy: number; size: number }[]>;`
  с комментарием «фрагменты карт для игры „Угадай карту“ (спека 72); тип повторяет FragmentBox
  структурно, чтобы content.ts не зависел от fragmentGame.ts».
- [ ] **Шаг 5: контракт** `src/lib/__tests__/fragments.test.ts`:

```ts
import { cards, fragments } from '../content';
import {
  boxEdges, FRAGMENT_BOTTOM, FRAGMENT_SIZE_MAX, FRAGMENT_SIZE_MIN, FRAGMENT_TOP,
} from '../fragmentGame';

const majors = cards.filter((c) => c.arcana === 'major').map((c) => c.id);

describe('content/fragments.json (спека 72)', () => {
  it('у каждого старшего аркана не меньше двух фрагментов', () => {
    expect(majors).toHaveLength(22);
    for (const id of majors) expect([id, (fragments[id] ?? []).length >= 2]).toEqual([id, true]);
  });
  it('все id существуют в колоде', () => {
    const ids = new Set(cards.map((c) => c.id));
    for (const id of Object.keys(fragments)) expect([id, ids.has(id)]).toEqual([id, true]);
  });
  it('квадрат внутри скана, вне полос номера и имени, размер в допуске', () => {
    for (const [id, boxes] of Object.entries(fragments))
      boxes.forEach((b, i) => {
        const e = boxEdges(b);
        const ok =
          e.left >= 0 && e.right <= 1 && e.top >= FRAGMENT_TOP && e.bottom <= 1 - FRAGMENT_BOTTOM &&
          b.size >= FRAGMENT_SIZE_MIN && b.size <= FRAGMENT_SIZE_MAX;
        expect([`${id}#${i}`, ok]).toEqual([`${id}#${i}`, true]);
      });
  });
  it('фрагменты одной карты перекрываются меньше чем наполовину', () => {
    for (const [id, boxes] of Object.entries(fragments))
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxEdges(boxes[i]);
          const b = boxEdges(boxes[j]);
          const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const smaller = Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top));
          expect([`${id} ${i}/${j}`, (w * h) / smaller < 0.5]).toEqual([`${id} ${i}/${j}`, true]);
        }
  });
});
```
  Мутации (на копии значения в JSON, по одной, затем вернуть): `cy: 0.95` у одного фрагмента; лишний
  ключ `"nope": [...]`; удалить второй фрагмент у одной карты; второй фрагмент = копия первого.
- [ ] **Шаг 6.** `AGENTS.md`, список контент-конвейера — абзац про `scripts/fragment_sheet.py`
  (что рисует, что проверяет, что глазами: узнаваемость, нагота, надписи).
- [ ] **Шаг 7. ⛔ Стоп-точка:** показать Артёму `docs/screenshots/72/fragments-sheet.jpg` — «ок» его и
  редактора ОБЯЗАТЕЛЕН до сборки; правки по замечаниям → шаги 3 и 5 заново.
- [ ] **Шаг 8.** `tsc`, `npm test`; коммит `feat: фрагменты 22 старших арканов для игры + контакт-лист (spec 72)`
  (`git add content/fragments.json scripts/fragment_sheet.py src/lib/content.ts src/lib/__tests__/fragments.test.ts docs/screenshots/72/fragments-sheet.jpg AGENTS.md`).

---

### Задача 12: экран игры, `OptionButton`, входы, XP

**Файлы:** новые `src/components/OptionButton.tsx`, `src/components/FragmentPanel.tsx`, `app/fragment.tsx`;
правка `app/lesson/[id].tsx`, `src/store/useApp.ts`, `app/_layout.tsx`, `app/(tabs)/index.tsx`,
`app/(tabs)/spreads/index.tsx`.

- [ ] **Шаг 1: вынос варианта ответа.** `OptionButton.tsx`:

```tsx
/** Вариант ответа (`.opt` эталона): панель с рамкой; верный — рамка и тинт success, неверный
 *  выбранный — рамка danger и приглушение. Вынесен из экрана урока задачей 72 — второй потребитель
 *  (игра «Угадай карту»). Значения — прежние значения урока. */
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export type OptionState = 'idle' | 'ok' | 'no';

export function OptionButton({ label, state, onPress }: { label: string; state: OptionState; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        st.opt,
        { backgroundColor: t.panel, borderColor: t.line },
        // фон верного — success с альфой 0.12 (1F), как rgba(90,160,126,.12) эталона
        state === 'ok' && { borderColor: t.success, backgroundColor: `${t.success}1F` },
        state === 'no' && { borderColor: t.danger, opacity: 0.6 },
      ]}
    >
      <Txt style={[st.optTxt, { color: t.text }]}>{label}</Txt>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  opt: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, marginTop: 9 },
  optTxt: { fontSize: 14, lineHeight: 20 },
});
```
  В `lesson/[id].tsx` блок `step.question.options.map(...)` →
  `<OptionButton key={i} label={inLang(o, lang)} state={optState(i) ?? 'idle'} onPress={() => onPick(i)} />`
  (посмотреть, что возвращает `optState` — привести к `'idle' | 'ok' | 'no'`), стили `opt`/`optTxt`
  удалить. Веб-регресс: урок `m1l1` — викторина выглядит и работает как раньше.
- [ ] **Шаг 2: XP.** `useApp.ts` — в интерфейс (рядом с `reviewCard`):
  `/** Игра «Угадай карту» (спека 72): +XP_REVIEW за верный ответ. Persist не меняется — поле xp уже есть. */`
  `gainFragmentXp: () => void;` и реализация рядом с `reviewCard`:
  `gainFragmentXp: () => set({ xp: get().xp + XP_REVIEW }),` (импорт `XP_REVIEW` из `../lib/xp`, если ещё нет).
  Проверить `backup.test.ts`/контракты стора: экшен не поле — версия схемы НЕ меняется.
- [ ] **Шаг 3.** `FragmentPanel.tsx`:

```tsx
/** Вход в игру «Угадай карту» (спека 72) — панель той же геометрии, что шапка модуля и «Повторение».
 *  Стоит на «Учёбе» и первым блоком ленты «Практики». */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function FragmentPanel({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={{ flex: 1 }}>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('game.overline')}</Txt>
        <Txt style={[st.title, { color: t.head }]}>{tr('game.title')}</Txt>
        <Txt style={[st.sub, { color: t.muted }]}>{tr('game.sub')}</Txt>
      </View>
      <Ionicons name="search-outline" size={18} color={t.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  box: moduleBox,
  overline: { fontSize: 8.5, letterSpacing: 2 }, // как у ReviewPanel
  title: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 }, // строка ReviewPanel
  sub: { fontSize: 12, marginTop: 2 },
});
```
- [ ] **Шаг 4.** `app/fragment.tsx`:

```tsx
/** Игра «Угадай карту по фрагменту» (спека 72): увеличенный квадрат скана + четыре названия.
 *  После ответа квадрат «отъезжает» до целой карты. Сессия — 10 вопросов, итог — ResultPanel.
 *  Вся логика — src/lib/fragmentGame.ts; экран только рисует и ведёт анимацию. */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { FadeUp } from '../src/components/FadeUp';
import { OptionButton } from '../src/components/OptionButton';
import { ResultPanel } from '../src/components/ResultPanel';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { cardById, cardImages, fragments } from '../src/lib/content';
import { buildFragmentSession, fragmentLayout, sessionScore } from '../src/lib/fragmentGame';
import { hapticSuccess, hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { inLang } from '../src/lib/lang';
import { useApp } from '../src/store/useApp';
import { glowShadow } from '../src/theme/glow';
import { stackTopPad } from '../src/theme/navHeader';
import { fonts, radius, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

const VIEW = Math.min(Dimensions.get('window').width - 48, 300);
const ZOOM_MS = 300;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export default function FragmentScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const gainFragmentXp = useApp((s) => s.gainFragmentXp);

  const [questions, setQuestions] = React.useState(() => buildFragmentSession(fragments));
  const [at, setAt] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [log, setLog] = React.useState<boolean[]>([]);
  const zoom = useSharedValue(0); // 0 — фрагмент, 1 — карта целиком

  const q = questions[at];
  const finished = at >= questions.length;
  const from0 = q ? fragmentLayout(q.box, VIEW, undefined, 0) : null;
  const to1 = q ? fragmentLayout(q.box, VIEW, undefined, 1) : null;
  const imgStyle = useAnimatedStyle(() => {
    if (!from0 || !to1) return {};
    const mix = (a: number, b: number) => a + (b - a) * zoom.value;
    return { width: mix(from0.width, to1.width), height: mix(from0.height, to1.height), left: mix(from0.left, to1.left), top: mix(from0.top, to1.top) };
  }, [from0?.width, from0?.left, from0?.top, to1?.width]);

  const onPick = (i: number) => {
    if (picked !== null || !q) return;
    const right = i === q.correct;
    setPicked(i);
    setLog((l) => [...l, right]);
    if (right) { hapticSuccess(); gainFragmentXp(); } else hapticTap();
    zoom.value = withTiming(1, { duration: ZOOM_MS, easing: EASE, reduceMotion: ReduceMotion.System });
  };
  const onNext = () => { zoom.value = 0; setPicked(null); setAt((n) => n + 1); };
  const onAgain = () => { zoom.value = 0; setQuestions(buildFragmentSession(fragments)); setAt(0); setPicked(null); setLog([]); };

  const score = sessionScore(log);
  const optState = (i: number) =>
    picked === null ? 'idle' : i === q!.correct ? 'ok' : i === picked ? 'no' : 'idle';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr(from === 'practice' ? 'tabs.practice' : 'tabs.learn') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{ paddingTop: stackTopPad(insets), paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {finished ? (
          <ResultPanel
            gained={score.xp}
            title={tr('game.overline')}
            zeroTitle={tr('game.title')}
            line={tr('game.resultLine', { right: score.right, total: score.total })}
            lineFirst
            cta={{ label: tr('review.done'), onPress: () => router.back() }}
            footer={
              <Pressable onPress={onAgain} hitSlop={8} style={st.again}>
                <Txt style={[st.againTxt, { color: t.accent }]}>{tr('game.again')}</Txt>
              </Pressable>
            }
          />
        ) : (
          // key: новый вопрос = свежий монтаж, каскад и картинка не «доезжают» с прошлого
          <View key={at}>
            <FadeUp index={0}>
              <Txt style={[st.counter, { color: t.muted }]}>{`${at + 1} / ${questions.length}`}</Txt>
              <View style={[st.frame, glowShadow(t.glow, t.accent, 16, 0.35)]}>
                <View style={[st.clip, { borderColor: t.frame, backgroundColor: t.bg }]}>
                  <Animated.View style={[st.abs, imgStyle]}>
                    <Image source={cardImages[q.cardId]} style={st.fill} contentFit="fill" cachePolicy="memory-disk" />
                  </Animated.View>
                </View>
              </View>
              <Txt style={[st.q, { color: t.head }]}>
                {picked === null ? tr('game.question') : inLang(cardById.get(q.cardId)!.name, lang)}
              </Txt>
            </FadeUp>
            <FadeUp index={1}>
              {q.options.map((id, i) => (
                <OptionButton key={id} label={inLang(cardById.get(id)!.name, lang)} state={optState(i)} onPress={() => onPick(i)} />
              ))}
              {picked !== null && <CtaButton label={tr('lesson.next')} onPress={onNext} style={{ marginTop: spacing.xl }} />}
            </FadeUp>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  counter: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  frame: { alignSelf: 'center', marginTop: spacing.l, borderRadius: radius.l },
  clip: { width: VIEW, height: VIEW, borderRadius: radius.l, borderWidth: 1, overflow: 'hidden' },
  abs: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
  q: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, textAlign: 'center', marginTop: spacing.l },
  again: { marginTop: 10 },
  againTxt: { fontSize: 10.5, letterSpacing: 1, textAlign: 'center' },
});
```
  ⚠️ Сверить перед записью: `radius.l` = 16 (иначе взять токен радиуса 16); сигнатуру `glowShadow`
  (так её зовёт онбординг); стиль ссылки «Ещё» в `ReviewResult` (`st.more`/`moreTxt`) — если совпадает
  с `again`/`againTxt`, вынести общий `LinkLine` НЕ нужно (два потребителя по три строки) — но числа
  взять оттуда. Пустая сессия (`questions.length === 0`, пул < 4 карт) попадает в ветку `finished` с
  «0 из 0» — для 1.0 недостижимо (пул 22), отдельную ветку не заводим.
- [ ] **Шаг 5.** `app/_layout.tsx` под гардом:
  `{/* игра «Угадай карту» (спека 72): корневой стек, прозрачная шапка; под гардом онбординга (урок 09) */}`
  `<Stack.Screen name="fragment" options={transparentHeader(t)} />`.
- [ ] **Шаг 6: входы.** `app/(tabs)/index.tsx` — на месте комментария-закладки:
  `<FragmentPanel onPress={() => router.push({ pathname: '/fragment', params: { from: 'learn' } })} />`
  (отступ сверху 0 — `ReviewPanel` несёт свой `marginBottom`; при `hidden` «Повторения» панель игры
  встаёт первой — зазоры проверить на вебе в обоих случаях). `spreads/index.tsx` — после строки луны:
  `<FadeUp index={2}><View style={{ marginTop: spacing.l }}><FragmentPanel onPress={() => router.push({ pathname: '/fragment', params: { from: 'practice' } })} /></View></FadeUp>`,
  индексы ленты → `Math.min(3 + si, 8)`; у первого элемента ленты проверить зазор до панели (12).
- [ ] **Шаг 7.** `tsc`, `npm test`. Веб 390×844: с «Учёбы» и с «Практики» игра открывается; 10 вопросов;
  верный/неверный подсвечены; картинка отъезжает до целой карты без рывка и без «оголённого» фона;
  итог «ВЕРНО N ИЗ 10», XP в пилюле «Учёбы» вырос на N; «Ещё раз» — новая сессия; `/fragment` при
  сброшенном онбординге уводит в онбординг. Консоль чистая.
- [ ] **Шаг 8.** Замер высоты «Учёбы»: на 390×844 без скролла видны герой, «Повторение», «Угадай карту»;
  строка «Карта дня» — хотя бы заголовком. Не помещается → НЕ ужимать отступы, снять кадр и поднять
  флаг Артёму (варианты: поднять строку карты дня над игрой / убрать подстрочник у панели игры).
- [ ] **Шаг 9.** Коммит `feat: игра «Угадай карту по фрагменту» — экран, входы, XP (spec 72)`.

---

### Задача 13: макет `design-reference.html`

**Файлы:** `docs/design-reference.html`, `scripts/check_60_mock.js`.

- [ ] **Шаг 1.** Прочитать блоки: `v-today` (~821), `.nav` (~1458–1463), `TAB_OF` (~1490), `show('v-today')`
  (~1661, ~1968), кнопки «назад · СЕГОДНЯ» (~1267, ~1310), `v-spreads`, `v-onboarding`.
- [ ] **Шаг 2.** `v-today` → переименовать в `v-daily` (без `.moonrow`; кнопка «‹ УЧЁБА» по образцу
  `v-moon`); новый `v-home`: дата, «Учёба», `.rule`, `.pills`, герой (класс `.mhead` + внутри overline
  «МОДУЛЬ 1 · УРОК 1 ИЗ 32», название, `.xline`, `.btn` «НАЧАТЬ УРОК»), `.revcard`, панель игры
  (`.revcard` с «ИГРА / Угадай карту / Узнайте аркан по детали рисунка»), строка карты дня (`.mhead` с
  миниатюрой 44×76). Новый `v-fragment`: счётчик, квадрат 300 (`overflow:hidden`, `border-radius:16px`,
  фоновая картинка карты с `background-size`/`background-position` под фрагмент), вопрос, четыре `.opt`.
- [ ] **Шаг 3.** `.nav`: подписи «Учёба»/«Практика», `data-v="v-home"`; svg-контуры — те же пути, что в
  `TabIcons.tsx` (задача 3). `TAB_OF`, дефолтный `show('v-home')`, кнопки «назад» — перевести;
  `v-spreads`: `.moonrow` без «лунный день» + панель игры над лентой; `v-onboarding`: два шага
  («НАЧАТЬ ОБУЧЕНИЕ»; «Как устроен курс» + три строки + имя + «К ПЕРВОМУ УРОКУ»), две точки.
  `grep -n "лунный день\|v-today\|НАЖМИ, ЧТОБЫ ОТКРЫТЬ\|ПРОДОЛЖИТЬ ПУТЬ" docs/design-reference.html` → пусто.
- [ ] **Шаг 4.** `scripts/check_60_mock.js` — обновить ожидания (id экранов, подписи nav), добавить
  проверки: есть `v-home`, `v-daily`, `v-fragment`; в макете нет «лунный день». Прогон зелёный,
  затем мутация (вернуть «Сегодня» в nav) → красный.
- [ ] **Шаг 5.** Коммит `docs: макет — «Учёба», карта дня, игра, два шага онбординга (spec 72)`.

---

### Задача 14: веб-проверка 6а/6б

**Файлы:** новые `scripts/check_72_web.js`, `scripts/shoot_72.js`; правка `scripts/check_56_web.js`,
`scripts/shoot_56.js`.

- [ ] **Шаг 1.** `scripts/check_72_web.js` — по образцу `scripts/check_62_web.js` (запуск, сид
  `goto → evaluate → reload`, счётчик «N из M», код выхода 1 при провале). Сид-хелпер: состояние
  `arcanum-app` версии 12 с `onboarded`, `lessonsProgress`, `premium`, `history`. Проверки:
  1. свежий стор → онбординг: 2 точки, нет текста «рожд»/«birth», CTA шага 2 → «Учёба»;
  2. `/` (start): «УЧЁБА», «МОДУЛЬ 1 · УРОК 1 ИЗ 32», «НАЧАТЬ УРОК» → URL `/lesson/m1l1`;
  3. сид 4 урока → «УРОК 5 ИЗ 32», «ПРОДОЛЖИТЬ КУРС» → `/lesson/m2l1`;
  4. сид m1+m2 пройдены, без premium → «ОТКРЫТЬ PREMIUM» → `/paywall`; с premium → `/lesson/m3l1`;
  5. сид 32 урока → «Курс пройден», CTA → `/review`;
  6. строка «Карта дня» → `/daily`; на `/daily` нет «лун»; `click({force:true})` по карте → имя карты;
     «ИЗУЧИТЬ КАРТУ →» → `/card/…`; назад → `/daily`; назад → `/`; строка на «Учёбе» теперь с именем карты;
  7. таб-бар: тексты «Учёба, Курс, Карты, Практика, Профиль»; нет «Сегодня», «Расклады»-как-подписи-таба;
  8. «Практика»: строка луны есть, regexp `/лунный день|lunar day|día lunar|dia lunar/i` по
     `document.body.innerText` на `/`, `/spreads`, `/moon`, `/daily` → нет (в 4 языках: сменить
     `settings.lang` сидом); строка луны → `/moon`; «Карта дня» в ленте → `/daily`;
  9. игра: с «Учёбы» → `/fragment`; 4 варианта; клик → ровно один вариант с рамкой success; «ДАЛЬШЕ»;
     пройти 10 → «ВЕРНО N ИЗ 10»; XP в сторе вырос ровно на N; «Ещё раз» → счётчик «1 / 10»;
     вход с «Практики» → назад возвращает на `/spreads`;
  10. гард: стор без `onboarded` → `goto('/daily')` и `goto('/fragment')` → онбординг;
  11. пейвол: текст содержит «App Store / Google Play» один раз, нет двойного упоминания;
  12. консоль: 0 ошибок/warning (кроме известных артефактов Fast Refresh — перезагрузка и повтор).
- [ ] **Шаг 2: красный прогон.** На ветке сделать по очереди три мутации кода и убедиться, что падают
  РОВНО ожидаемые проверки: убрать `<Stack.Screen name="daily" …/>` из-под гарда (п. 10); в `onHero`
  подставить `/lesson/m1l1` константой (п. 3, 4); вернуть `MoonRow` на «Учёбу» с текстом лунного дня
  (п. 8). Записать в отчёт «упало K из M» по каждой. Вернуть код, зелёный прогон «M из M».
- [ ] **Шаг 3.** `scripts/shoot_72.js` — по образцу `scripts/shoot_59.js`: кадры 390×844 в обеих темах в
  `docs/screenshots/72/`: `home-start`, `home-continue`, `home-locked`, `home-done`, `daily-closed`,
  `daily-open`, `practice`, `fragment-question`, `fragment-answered`, `fragment-result`, `onboarding-1`,
  `onboarding-2`. Сверка по `docs/ui-verification.md`: «приложение = макет» И «макет = спека»;
  расхождения — исправить или перечислить в отчёте.
- [ ] **Шаг 4.** `scripts/check_56_web.js`: пары таб-цикла → `['Курс','МОДУЛЬ'], ['Карты','ИЗУЧЕНО'],
  ['Практика','ПРАКТИКА'], ['Профиль','ВАШ ПУТЬ'], ['Учёба','УЧЁБА']`; `scripts/shoot_56.js`: пара
  `today` → `{ name:'home', route:'/', mock:'v-home', marker:'УЧЁБА' }` + новые пары
  `{ name:'daily', route:'/daily', mock:'v-daily', marker:'КАРТА ДНЯ' }`,
  `{ name:'fragment', route:'/fragment', mock:'v-fragment', marker: <текст game.question в верхнем регистре, если экран так рисует; иначе как на экране> }`.
  Прогон обоих — зелёные («N из N» в отчёт). `scripts/check_62_web.js` — 58 из 58.
- [ ] **Шаг 5.** Коммит `test: веб-проверка учебного экрана и игры, регресс 56/62 (spec 72)`.

---

### Задача 15: витрина и тексты сторов

**Файлы:** `scripts/shoot_63.js`, `docs/store/captions.json`, `docs/store-listing.md`, `docs/store/feature.html`
(если нужно), `docs/store/google/**`, `docs/store/apple/**`, `docs/store/feature/**`.

- [ ] **Шаг 1.** `captions.json` → ключи `screens` в порядке `home, course, quiz, fragment, trainer,
  detail, spread, home-light`; ru — из таблицы спеки §8; en: «Learn tarot from scratch / Five-minute
  lessons, step by step», «A 32-lesson course / 6 modules, quizzes, progress» (как было), «A quiz after
  every lesson / 160 questions with explanations», «Guess the card / A game on the deck's symbols»,
  trainer/detail — как было, «Practice spreads / Three cards, Celtic Cross and more», light — как было;
  es/pt — по смыслу тех же пар (лимиты 25/46 проверит `store_assets.py verify`; термины — решения 24.08).
- [ ] **Шаг 2.** `shoot_63.js`, массив `SCREENS` в том же порядке:
  `home` (route `/`, сид: пройден m1 ⇒ герой «ПРОДОЛЖИТЬ КУРС», карта дня открыта; check: текст
  `home.title` + «5» в overline героя); `course` — как было; `quiz` (route `/lesson/m1l2`; prepare:
  жать `lesson.next`, пока не появится вопрос, выбрать вариант с индексом `correct` из
  `content/course.json`; check: текст вопроса + `lesson.explainRight`); `fragment` (route `/fragment`;
  check: 4 варианта + квадрат `img[src*="cards/"]:visible`); `trainer`, `detail`, `spread` — как было,
  но `DETAIL_CARD = 'hermit'` (не в списке наготы, не «Луна»); `home-light` — `home` с
  `extra: { themeMode: 'light' }`. Кадры `today`, `moon`, `today-light` удалить; `i18nText(lang,'tabs',key)`
  — ключи `learn/course/cards/practice/profile`. Сценарный страж наготы по id сида — оставить.
- [ ] **Шаг 3.** Сначала красный: временно сломать `check` у `home` (ждать «КАРТА ДНЯ») → прогон падает
  с именем кадра; вернуть.
- [ ] **Шаг 4.** `docs/store/feature.html` — если в тексте/картинке «карта дня»/луна — заменить на учебное
  (слоган из `captions.tagline` остаётся).
- [ ] **Шаг 5.** ОДИН связный прогон: `node scripts/shoot_63.js --store google` и `--store apple`
  (NODE_PATH — по AGENTS.md), затем `python scripts/store_assets.py feature` и `verify`;
  `npx jest src/lib/__tests__/storeAssets.test.ts`. Старые файлы кадров (`01-today.jpg`, `06-moon.jpg`, …)
  удалить из обоих наборов (`git rm`). Просмотреть все 8 кадров ru глазами.
- [ ] **Шаг 6.** `docs/store-listing.md` (четыре языка): ключевые слова без `луна/moon/luna/lua`,
  `таролог`, `интуиция` — вместо них ru `викторина,тренажёр,символы`, en `study,course,symbols`
  (es/pt — в пределах 100 символов, считать ТЕСТОМ, не глазами); короткое описание Google — «…и
  тренажёр памяти» вместо «…и карта дня»; промо — курс, викторины, игра «Угадай карту», тренажёр (без
  «лунный календарь»); описание — абзац про игру после тренажёра, абзац про карту дня/календарь — ниже
  и нейтрально («календарь новолуний и полнолуний»); «Категории»: вторичная — **Справочники (Reference)**;
  таблица фактов — пересверить числа; **Review Notes** — переписать по структуре спеки §8 (≤4000
  символов, считать python-ом `len()`), ACCESS: «2-step onboarding (intro with disclaimer → how the
  course works, optional name) → Learn tab»; вкладки Learn · Course · Cards · Practice · Profile;
  «Moon calendar: the moon row on Practice»; «birth date: optional, in Settings».
  `npx jest src/lib/__tests__/storeListing.test.ts` зелёный («N из N» в отчёт).
- [ ] **Шаг 7.** Коммит `feat: витрина — восемь кадров с учебным экраном и игрой, тексты без лунной темы (spec 72)`.

---

### Задача 16: фразы пушей (необязательная, ждёт редактора)

- [ ] **Шаг 1.** В `docs/editor-questions.md` — вопрос редактору: `push.winback` «Луна скучала. Ваша
  карта ждёт» и `streak_milestone` «Постоянство — тоже магия» расходятся с content-guide («без
  эзотерического жаргона»); предложения: «Колода соскучилась по повторению», «Постоянство — половина
  мастерства» (+ en/es/pt). Коммит `docs: вопрос редактору о двух фразах пушей (spec 72)`.
- [ ] **Шаг 2 (только после ответа).** Правка `content/phrases.json` скриптом с сохранением формата
  (indent 1), затем `npm test` и корпусные проверки фраз. Сборку не блокирует.

---

### Задача 17: синхронизация, сборки, сабмит

- [ ] **Шаг 1.** Финальные грепы: `tabs\.(today|spreads)` = 0; `moon\.day` = 0; `insets.top + 64` = 0 вне
  `navHeader.ts`; `lunar day|лунный день` в `app/ src/` = 0 (кроме комментариев `moon.ts`/тестов);
  `Google Play|App Store` в `paywall.*` ресурсах = 0.
- [ ] **Шаг 2.** `npx tsc --noEmit`; `npm test` («упало 0 из M», новое M — в CLAUDE.md и AGENTS.md);
  `PYTHONIOENCODING=utf-8 python scripts/check_easignore.py` (новый `content/fragments.json` обязан
  ехать в архив; `docs/screenshots/72/` — нет).
- [ ] **Шаг 3.** Доки: `CLAUDE.md` («Структура»: табы Учёба/Курс/Карты/Практика/Профиль, `app/daily.tsx`,
  `app/fragment.tsx`, `content/fragments.json`; «Общие модули»: `StatsPills`, `NextLessonCard`,
  `DailyCardRow`, `FragmentPanel`, `OptionButton`, `fragmentGame`, `useReviewSummary`, `stackTopPad`/
  `STACK_HEADER_H`, `STORE_NAME`; «Статус» — коротко); `AGENTS.md` (упоминания `MoonRow` на «Сегодня»,
  «вход — строка луны»); `docs/changelog.md` (запись о задаче); `docs/lessons.md` (новые ⚠️ по темам);
  `docs/backlog.md` (72 — «код сделан, ждёт 6в»; кандидаты 18.09 — отдельными строками);
  `docs/release-checklist.md` (сабмит №3: что заливать в ASC).
- [ ] **Шаг 4.** `git push -u origin feat/72-learning-home`.
- [ ] **Шаг 5.** iOS `preview`: `npx eas-cli@latest build -p ios --profile preview` → ссылка Артёму.
  **Сценарий 6в** (отправлять, когда сборка готова): удалить приложение → установить → онбординг 2 шага
  → «Учёба»: герой, хаптика CTA → урок 1 целиком → герой «УРОК 2 ИЗ 32» → «Угадай карту»: 10 вопросов,
  **резкость фрагмента**, плавность «отъезда», хаптика верного → «Карта дня»: переворот, искры, «назад»
  → «Практика»: луна без лунного дня → календарь → «назад» = «Практика» → пейвол: в тексте только
  «App Store» → язык en/es/pt: таб-бар и герой не обрезаются.
- [ ] **Шаг 6.** После «ок» Артёма: merge в `main`, `npx eas-cli@latest build -p ios --profile production`
  (buildNumber 4) → IPA заливает Артём (`! npx eas-cli@latest submit -p ios --latest`).
- [ ] **Шаг 7. ASC** (автоматизацией, Resubmit — только Артём): сборка 4 в версии 1.0; кадры 6,9″ ×
  4 языка (8 штук, порядок 01→08); описание/промо/ключевые слова × 4; вторичная категория Reference;
  Review Notes. Сверка побайтово с `store-listing.md` после сохранения.
- [ ] **Шаг 8.** Чек-лист сабмита Артёму → его «ок» → Resubmit жмёт Артём. Записать в спеку 69/72 и
  CLAUDE.md дату и состав отправки.

---

## Самопроверка плана по спеке

| Раздел спеки | Задача |
|---|---|
| 1. Навигация | 3 |
| 2. «Учёба», 2.1 | 1, 5, 6 (+ панель игры — 12) |
| 3. Карта дня `/daily`, строки `today.*`, ссылки | 4, 6 |
| 4. Луна, лунный день | 7 |
| 5. Онбординг | 4, 8 |
| 6. Пейвол `STORE_NAME` | 4, 9 |
| 7. Фразы (редактор) | 16 |
| 8. Витрина, Review Notes | 15, 17 |
| 9. Сборка и отправка | 17 |
| 10. Игра | 4, 10, 11, 12 |
| 11. Макет и документы | 0, 13, 17 |
| DRY (`useReviewSummary`, `stackTopPad`, `StatsPills`, `OptionButton`) | 2, 5, 12 |
| Критерии приёмки 6а/6б | 14; 6в — 17 |

Отличие плана от буквы спеки (внесено в спеку задачей 0): ряд пилюль остаётся и на `/daily` — салют
серии `burst` живёт локальным состоянием этого экрана.
