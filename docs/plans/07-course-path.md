# План реализации 07 · Экран курса = «путь»

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ СКИЛЛ: superpowers:subagent-driven-development
> (рекомендуется) или superpowers:executing-plans — выполнять план задача за задачей.
> Шаги размечены чекбоксами (`- [ ]`) для отслеживания.

**Цель:** таб «Курс» = извилистая тропа с узлами-уроками (done/current/locked) по эталону
`#v-course`, все 6 модулей одной лентой; узлы ведут на заглушку `/lesson/[id]`.

**Архитектура:** чистая логика состояний и геометрии — `src/lib/courseProgress.ts` (юнит-тесты),
прогресс — новое поле `lessonsProgress` в zustand-сторе (persist v4), UI — три новых компонента
(`PathNode`, `CoursePath`, `ModuleHeader`) + переписанный `app/(tabs)/course.tsx` + новый
стековый экран `app/lesson/[id].tsx`.

**Стек:** Expo SDK 54, react-native-svg 15.12.1 (уже в зависимостях — `npm install` НЕ нужен),
Reanimated 4, expo-router v6, zustand/persist, jest-expo.

**Спека:** `docs/specs/07-course-path.md` — план аргументирует от неё, исполнитель читает обе.

## Глобальные ограничения

- SDK НЕ обновлять, версии пакетов не трогать; новых зависимостей в этой задаче нет.
- Цвета ТОЛЬКО из `src/theme/theme.ts` — хардкод запрещён (кроме токенов, добавляемых в саму тему).
- Комментарии в коде и сообщения коммитов — русские. Никаких упоминаний ИИ-инструментов.
- После КАЖДОЙ задачи: `npx tsc --noEmit` — чисто; перед push: `npm test` — зелёный.
- `Math.random` в логике/рендере запрещён (детерминизм); `Alert.alert` запрещён (пустышка в вебе).
- Интерфейсный текст — через `Txt` (вес шрифта → семейство Manrope); заголовки — `fontFamily: fonts.display/displaySemi`.
- Тени: прямоугольные свечения — проп `boxShadow`; старые `shadow*`-пропы не использовать.
- Все пользовательские строки — в `src/lib/i18n.ts`, обязательно в ОБА языка; русские числительные — плюрализацией `_one/_few/_many`.
- Ветка `feat/07-course-path` уже создана — работать в ней.
- Бесконечные анимации — только с `reduceMotion: ReduceMotion.System`.

---

### Задача 1: Типы курса в content.ts

**Файлы:**
- Изменить: `src/lib/content.ts` (строка 27 и блок интерфейсов)

**Интерфейсы:**
- Использует: `Lang`, `CardContentBlock` (уже в файле).
- Отдаёт дальше: `CourseModule`, `CourseLesson` — их импортируют задачи 2, 5–9.

- [ ] **Шаг 1: Добавить типы и типизировать `course`**

После интерфейса `TarotCard` (перед строкой `export const cards = ...`) вставить:

```ts
/** Урок курса. theory написана пока только у М1–М2 — у остальных уроков поля нет вовсе;
 *  форма блока та же, что у блоков карты ({ru, en, status}), поэтому тип переиспользуем. */
export interface CourseLesson {
  id: string; // "m1l1"
  title: Record<Lang, string>;
  /** id карт, разбираемых в уроке; пустой у вводных и практических уроков */
  cards: string[];
  theory?: CardContentBlock;
}

export interface CourseModule {
  id: string; // "m1"
  /** freemium-флаг: false = премиальный модуль (М3+). В v1 не блокирует — только замок в шапке */
  free: boolean;
  title: Record<Lang, string>;
  lessons: CourseLesson[];
}
```

Строку `export const course = (courseJson as any).modules as any[];` заменить на:

```ts
export const course = (courseJson as any).modules as CourseModule[];
```

- [ ] **Шаг 2: Проверить типы**

Выполнить: `npx tsc --noEmit`
Ожидание: чисто. (Текущий `course.tsx` обращается только к `m.id/m.title/m.free/m.lessons` —
всё есть в типе.)

- [ ] **Шаг 3: Коммит**

```
git add src/lib/content.ts
git commit -m "feat: типы модулей и уроков курса в content.ts (spec 07)"
```

---

### Задача 2: courseProgress.ts — чистая логика (TDD)

**Файлы:**
- Создать: `src/lib/courseProgress.ts`
- Создать: `src/lib/__tests__/courseProgress.test.ts`

**Интерфейсы:**
- Использует: `CourseModule` из задачи 1.
- Отдаёт дальше: `LessonProgress`, `LessonProgressMap` (задача 3 — стор), `LessonState`
  (задачи 5–6), `lessonStates`, `moduleProgress`, `moduleCardCount`, `nodeXs`, `nextLessonId`
  (задачи 6–8, 10) — сигнатуры ниже, менять нельзя.

- [ ] **Шаг 1: Написать падающие тесты**

Создать `src/lib/__tests__/courseProgress.test.ts` целиком:

```ts
import type { CourseModule } from '../content';
import { course } from '../content';
import {
  lessonStates,
  moduleCardCount,
  moduleProgress,
  nextLessonId,
  nodeXs,
  type LessonProgressMap,
} from '../courseProgress';

// Фабрика модулей: fx('a', 2) — модуль "a" с уроками a1, a2; cardsPerLesson карт в каждом
const fx = (id: string, lessons: number, cardsPerLesson = 0): CourseModule => ({
  id,
  free: true,
  title: { ru: id, en: id },
  lessons: Array.from({ length: lessons }, (_, i) => ({
    id: `${id}${i + 1}`,
    title: { ru: `${id}${i + 1}`, en: `${id}${i + 1}` },
    cards: Array.from({ length: cardsPerLesson }, (_, c) => `card-${c}`),
  })),
});

const done = (...ids: string[]): LessonProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

const MODULES = [fx('a', 2), fx('b', 3)];

describe('lessonStates — сквозная блокировка (решение брейншторма 07)', () => {
  it('пустой прогресс: первый урок курса current, все прочие locked', () => {
    expect(lessonStates(MODULES, {})).toEqual({
      a1: 'current', a2: 'locked', b1: 'locked', b2: 'locked', b3: 'locked',
    });
  });

  it('после первого урока current переезжает на второй', () => {
    expect(lessonStates(MODULES, done('a1'))).toEqual({
      a1: 'done', a2: 'current', b1: 'locked', b2: 'locked', b3: 'locked',
    });
  });

  it('граница модулей сквозная: закрыт весь "a" — current в начале "b"', () => {
    expect(lessonStates(MODULES, done('a1', 'a2'))).toEqual({
      a1: 'done', a2: 'done', b1: 'current', b2: 'locked', b3: 'locked',
    });
  });

  it('всё пройдено — current нет ни у кого', () => {
    const states = lessonStates(MODULES, done('a1', 'a2', 'b1', 'b2', 'b3'));
    expect(Object.values(states)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('«дырка» не ломает правило: done не по порядку остаётся done, current — первый не-done', () => {
    expect(lessonStates(MODULES, done('a2'))).toEqual({
      a1: 'current', a2: 'done', b1: 'locked', b2: 'locked', b3: 'locked',
    });
  });
});

describe('nextLessonId', () => {
  it('пустой прогресс → первый урок', () => {
    expect(nextLessonId(MODULES, {})).toBe('a1');
  });
  it('всё пройдено → null', () => {
    expect(nextLessonId(MODULES, done('a1', 'a2', 'b1', 'b2', 'b3'))).toBeNull();
  });
});

describe('moduleProgress — процент для шапки модуля', () => {
  const b = MODULES[1]; // 3 урока
  it('0 из 3 → 0%', () => {
    expect(moduleProgress(b, {})).toEqual({ done: 0, total: 3, pct: 0 });
  });
  it('обычное округление: 1/3 → 33, 2/3 → 67', () => {
    expect(moduleProgress(b, done('b1')).pct).toBe(33);
    expect(moduleProgress(b, done('b1', 'b2')).pct).toBe(67);
  });
  it('3 из 3 → 100%', () => {
    expect(moduleProgress(b, done('b1', 'b2', 'b3')).pct).toBe(100);
  });
  it('чужие уроки не считаются', () => {
    expect(moduleProgress(b, done('a1', 'a2')).done).toBe(0);
  });
});

describe('moduleCardCount', () => {
  it('сумма карт по урокам', () => {
    expect(moduleCardCount(fx('c', 3, 2))).toBe(6);
  });
  it('модуль без карт → 0 (счётчик карт в шапке скрывается)', () => {
    expect(moduleCardCount(fx('c', 3))).toBe(0);
  });
});

describe('nodeXs — x-координаты змейки', () => {
  it('6 узлов — паттерн эталона', () => {
    expect(nodeXs(6)).toEqual([50, 24, 70, 38, 66, 42]);
  });
  it('меньше узлов — префикс паттерна', () => {
    expect(nodeXs(4)).toEqual([50, 24, 70, 38]);
  });
  it('больше узлов — цикл хвоста (модуль М4 = 8 уроков)', () => {
    expect(nodeXs(8)).toEqual([50, 24, 70, 38, 66, 42, 24, 70]);
  });
  it('все координаты в берегах макета [24, 70]', () => {
    for (const x of nodeXs(12)) {
      expect(x).toBeGreaterThanOrEqual(24);
      expect(x).toBeLessThanOrEqual(70);
    }
  });
});

describe('реальный course.json', () => {
  it('6 модулей, 32 урока (шапка экрана «6 МОДУЛЕЙ · 32 УРОКА»)', () => {
    expect(course).toHaveLength(6);
    expect(course.reduce((n, m) => n + m.lessons.length, 0)).toBe(32);
  });
  it('М2 разбирает 8 карт — как в шапке эталона «6 УРОКОВ · 8 КАРТ»', () => {
    expect(moduleCardCount(course[1])).toBe(8);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тесты падают**

Выполнить: `npx jest src/lib/__tests__/courseProgress.test.ts`
Ожидание: FAIL — `Cannot find module '../courseProgress'`.

- [ ] **Шаг 3: Реализовать модуль**

Создать `src/lib/courseProgress.ts` целиком:

```ts
/** Чистая логика экрана курса (спека 07): состояния узлов пути, прогресс модуля,
 *  x-координаты змейки. Ни одного импорта react/expo — модуль целиком под юнит-тестами. */
import type { CourseModule } from './content';

/** Прогресс одного урока — схема logic-spec §7. В 07 пишется только DEV-строками
 *  настроек, по-настоящему — задача 08 (движок урока). */
export interface LessonProgress {
  done: boolean;
  /** ошибки викторины последнего прохождения; до задачи 08 всегда 0 */
  errors: number;
  /** момент записи, Date.now() */
  ts: number;
}
export type LessonProgressMap = Record<string, LessonProgress>;

export type LessonState = 'done' | 'current' | 'locked';

/** Состояние каждого урока. Блокировка СКВОЗНАЯ (решение брейншторма 07): current —
 *  первый непройденный урок в порядке m1l1 → … → m6l4, ровно один на весь курс (или ни
 *  одного, когда пройдено всё). Пройденное не по порядку остаётся done, а current всё
 *  равно указывает на первый не-done — «дырки» правило не ломают. */
export function lessonStates(
  modules: CourseModule[],
  progress: LessonProgressMap,
): Record<string, LessonState> {
  const states: Record<string, LessonState> = {};
  let currentTaken = false;
  for (const m of modules) {
    for (const l of m.lessons) {
      if (progress[l.id]?.done) {
        states[l.id] = 'done';
      } else if (!currentTaken) {
        states[l.id] = 'current';
        currentTaken = true;
      } else {
        states[l.id] = 'locked';
      }
    }
  }
  return states;
}

/** id урока-current — для DEV-строки «пройти следующий урок». null — курс пройден целиком. */
export function nextLessonId(modules: CourseModule[], progress: LessonProgressMap): string | null {
  for (const m of modules) {
    const open = m.lessons.find((l) => !progress[l.id]?.done);
    if (open) return open.id;
  }
  return null;
}

/** Прогресс модуля для шапки: pct — целые проценты, обычное округление. */
export function moduleProgress(
  module: CourseModule,
  progress: LessonProgressMap,
): { done: number; total: number; pct: number } {
  const total = module.lessons.length;
  const done = module.lessons.filter((l) => progress[l.id]?.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Сколько карт разбирается в модуле («N УРОКОВ · M КАРТ»; при 0 счётчик карт скрывается). */
export function moduleCardCount(module: CourseModule): number {
  return module.lessons.reduce((n, l) => n + l.cards.length, 0);
}

// Змейка эталона: первый узел по центру, дальше берега чередуются с разной амплитудой.
// Числа — x-координаты узлов в процентах ширины тропы (P-массив design-reference.html).
const WAVE_FIRST = 50;
const WAVE_CYCLE = [24, 70, 38, 66, 42];

/** x-координаты узлов (% ширины тропы) для модуля из count уроков. Макет дал координаты
 *  только для 6 узлов, а модули в course.json — по 4/6/8, поэтому хвост паттерна циклится. */
export function nodeXs(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? WAVE_FIRST : WAVE_CYCLE[(i - 1) % WAVE_CYCLE.length],
  );
}
```

- [ ] **Шаг 4: Убедиться, что тесты зелёные**

Выполнить: `npx jest src/lib/__tests__/courseProgress.test.ts`
Ожидание: PASS, 17 тестов. Затем `npx tsc --noEmit` — чисто.

- [ ] **Шаг 5: Коммит**

```
git add src/lib/courseProgress.ts src/lib/__tests__/courseProgress.test.ts
git commit -m "feat: courseProgress — состояния узлов, прогресс модуля, змейка (spec 07)"
```

---

### Задача 3: Стор — lessonsProgress, persist v4

**Файлы:**
- Изменить: `src/store/useApp.ts`

**Интерфейсы:**
- Использует: `LessonProgressMap` из задачи 2.
- Отдаёт дальше: поле `lessonsProgress`, экшены `setLessonDone(lessonId, done)`,
  `resetCourse()` — их используют задачи 8 и 10.

- [ ] **Шаг 1: Внести правки**

1. К импортам добавить (рядом с импортом journal):

```ts
import type { LessonProgressMap } from '../lib/courseProgress';
```

2. К реэкспортам типов (после `export type { AppSettings };`):

```ts
// прогресс уроков курса — тип живёт в src/lib/courseProgress.ts рядом с логикой пути
export type { LessonProgressMap };
```

3. В `interface AppState` после `history: DailyDraw[];`:

```ts
  /** Прогресс уроков курса по id урока (logic-spec §7). В 07 читается для состояний
   *  узлов пути; пишут только DEV-строки настроек — настоящая запись в задаче 08. */
  lessonsProgress: LessonProgressMap;
```

и после `setOutcome: ...;`:

```ts
  setLessonDone: (lessonId: string, done: boolean) => void;
  resetCourse: () => void;
```

4. В дефолтах состояния после `history: [],`:

```ts
      lessonsProgress: {},
```

5. Экшены — после блока `setOutcome`:

```ts
      // Прогресс урока. До движка урока (08) сюда пишут только DEV-строки настроек;
      // errors всегда 0 — считать их научит викторина задачи 08.
      setLessonDone: (lessonId, done) =>
        set({
          lessonsProgress: {
            ...get().lessonsProgress,
            [lessonId]: { done, errors: 0, ts: Date.now() },
          },
        }),
      resetCourse: () => set({ lessonsProgress: {} }),
```

6. Версия персиста: `version: 3` → `version: 4`, к комментариям версий добавить строку:

```ts
      // v3 → v4: lessonsProgress (прогресс курса, спека 07). Ключ ВЕРХНЕГО уровня —
      // поверхностное слияние persist подставит дефолт {} само (ловушка 06а бьёт только
      // по вложенным объектам вроде settings), поэтому отдельная ветка миграции не нужна.
```

`migrate` не меняется (mergeSettings уже делает всё нужное). Следующая задача, меняющая
схему стора, поднимает version до 5.

- [ ] **Шаг 2: Проверить**

Выполнить: `npx tsc --noEmit` — чисто. `npm test` — зелёный (26 старых сьютов не затронуты).

- [ ] **Шаг 3: Коммит**

```
git add src/store/useApp.ts
git commit -m "feat: прогресс уроков в сторе, persist v4 (spec 07)"
```

---

### Задача 4: Токен золота узла + строки i18n

**Файлы:**
- Изменить: `src/theme/theme.ts` (объект `gold`)
- Изменить: `src/lib/i18n.ts` (ru и en)

**Интерфейсы:**
- Отдаёт дальше: `gold.nodeGradient` (задача 5); ключи `course.*`,
  `settings.devLessonDone/devCourseReset` (задачи 5–10).

- [ ] **Шаг 1: Токен**

В `theme.ts` в объект `gold` после `tabGradient` добавить:

```ts
  // узел «текущий» на пути курса: 2 стопа под 140° — ТРЕТИЙ вариант золота эталона,
  // не совпадает ни с CTA (3 стопа), ни с вкладками (второй стоп #e9d095) — спека 07
  nodeGradient: ['#caa45a', '#efd9a2'] as readonly [string, string],
```

- [ ] **Шаг 2: Строки**

В `i18n.ts`, ru-ресурсы — новый корневой блок после блока `card:` (счётчики хранятся сразу
в верхнем регистре — это overline-подписи):

```ts
      // экран курса — «путь» (спека 07); числительные плюрализацией, иначе «1 УРОКОВ»
      course: {
        title: "Курс",
        modules_one: "{{count}} МОДУЛЬ", modules_few: "{{count}} МОДУЛЯ", modules_many: "{{count}} МОДУЛЕЙ",
        lessons_one: "{{count}} УРОК", lessons_few: "{{count}} УРОКА", lessons_many: "{{count}} УРОКОВ",
        cardsCount_one: "{{count}} КАРТА", cardsCount_few: "{{count}} КАРТЫ", cardsCount_many: "{{count}} КАРТ",
        moduleOf: "МОДУЛЬ {{n}} ИЗ {{total}}",
        startLesson: "НАЧАТЬ УРОК",
        lessonOverline: "МОДУЛЬ {{m}} · УРОК {{l}}",
        lessonPreparing: "Урок готовится",
      },
```

В ru-блок `settings:` после `showPlan: "План пушей",`:

```ts
        devLessonDone: "Пройти следующий урок",
        devCourseReset: "Сбросить прогресс курса",
```

Симметрично в en-ресурсах — блок `course:` (после блока `card:`):

```ts
      course: {
        title: "Course",
        modules_one: "{{count}} MODULE", modules_other: "{{count}} MODULES",
        lessons_one: "{{count}} LESSON", lessons_other: "{{count}} LESSONS",
        cardsCount_one: "{{count}} CARD", cardsCount_other: "{{count}} CARDS",
        moduleOf: "MODULE {{n}} OF {{total}}",
        startLesson: "START LESSON",
        lessonOverline: "MODULE {{m}} · LESSON {{l}}",
        lessonPreparing: "Lesson coming soon",
      },
```

и в en-`settings:`:

```ts
        devLessonDone: "Complete next lesson",
        devCourseReset: "Reset course progress",
```

- [ ] **Шаг 3: Проверить и закоммитить**

`npx tsc --noEmit` — чисто.

```
git add src/theme/theme.ts src/lib/i18n.ts
git commit -m "feat: токен золота узла пути и строки курса (spec 07)"
```

---

### Задача 5: Компонент PathNode

**Файлы:**
- Создать: `src/components/PathNode.tsx`

**Интерфейсы:**
- Использует: `LessonState` (задача 2), `gold.nodeGradient` (задача 4), `PressableScale`,
  `Txt`, `hapticWarning` (существующие).
- Отдаёт дальше: `PathNode` (пропсы `state`, `title`, `chipLabel`, `onPress`) и константу
  `NODE_SIZE = 76` — задача 6 позиционирует узлы по ней.

- [ ] **Шаг 1: Написать компонент**

Создать `src/components/PathNode.tsx` целиком:

```tsx
/** Узел пути курса (спека 07, эталон .node из #v-course). Три состояния:
 *  done — контур success с галочкой; current — золотая заливка с пульс-кольцом и чипом
 *  «НАЧАТЬ УРОК»; locked — контур line с замком, тап качает замок (motion-spec №13)
 *  и отвечает предупреждающей вибрацией. Размеры — макет ×1.147 (рама макета ~340px
 *  против реальных 390), сведены в design-system.md, раздел «Узел пути».
 *
 *  Заливка current рисуется сиблингом ПОД кругом с бордером, а не фоном круга:
 *  дети в RN рисуются поверх бордера родителя и золото закрасило бы рамку frame. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import type { LessonState } from '../lib/courseProgress';
import { hapticWarning } from '../lib/haptics';
import { gold } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

/** Диаметр круга узла — по нему CoursePath переводит центры в left/top. */
export const NODE_SIZE = 76;
const ICON = 28;
const RING_INSET = -10; // пульс-кольцо на 10px шире узла с каждой стороны
const LABEL_W = 132; // подпись до двух строк (в макете nowrap — в RN он бы обрезался)
const SHAKE_STEP_MS = 58; // качание замка: ±8°, три раза, ~350мс (motion-spec №13)

/** Иконки состояний — пути из эталона (блок course path в design-reference.html). */
function NodeIcon({ state, color }: { state: LessonState; color: string }) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      {state === 'done' && <Path d="m4.5 12.5 5 5 10-11" {...common} />}
      {state === 'current' && (
        <Path
          d="M12 3.5 14.4 9l5.9.6-4.4 3.9 1.3 5.8L12 16.2l-5.2 3.1 1.3-5.8L3.7 9.6 9.6 9z"
          {...common}
        />
      )}
      {state === 'locked' && (
        <>
          <Rect x={5.5} y={10.5} width={13} height={9} rx={2} {...common} />
          <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...common} />
        </>
      )}
    </Svg>
  );
}

export function PathNode({
  state,
  title,
  chipLabel,
  onPress,
}: {
  state: LessonState;
  title: string;
  /** подпись чипа над текущим узлом — приходит снаружи, узел про i18n не знает */
  chipLabel: string;
  onPress?: () => void;
}) {
  const t = useTheme();

  const pulse = useSharedValue(0); // цикл пульс-кольца, 0..1
  const bob = useSharedValue(0); // вертикальный боб чипа, px
  const shake = useSharedValue(0); // качание замка, доли от ±8°

  React.useEffect(() => {
    if (state !== 'current') return;
    // keyframes pulse эталона: линейно бежим цикл 1.8s, форма кривой — в стиле ниже
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease), reduceMotion: ReduceMotion.System }),
      -1,
    );
    // keyframes bob2: ±5px за 2s
    bob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(bob);
    };
  }, [state, pulse, bob]);

  // до 70% цикла кольцо расширяется 0.82→1.14 и гаснет 0.9→0, остаток цикла невидимо —
  // так в keyframes эталона (70%{scale:1.14;opacity:0} 100%{opacity:0})
  const ringStyle = useAnimatedStyle(() => {
    const k = Math.min(pulse.value / 0.7, 1);
    return { opacity: 0.9 * (1 - k), transform: [{ scale: 0.82 + 0.32 * k }] };
  });
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 8}deg` }] }));

  const onNodePress = () => {
    if (state !== 'locked') {
      onPress?.();
      return;
    }
    hapticWarning();
    const step = (to: number) =>
      withTiming(to, { duration: SHAKE_STEP_MS, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System });
    shake.value = withSequence(step(1), step(-1), step(1), step(-1), step(1), step(0));
  };

  const iconColor = state === 'current' ? gold.text : state === 'done' ? t.success : t.muted;
  const borderColor = state === 'current' ? t.frame : state === 'done' ? t.success : t.line;

  return (
    <View style={st.node}>
      {state === 'current' && (
        <Animated.View pointerEvents="none" style={[st.ring, { borderColor: t.accent }, ringStyle]} />
      )}
      <PressableScale
        onPress={onNodePress}
        // прозрачность заблокированного — поверх контурного стиля (product-spec §2 + макет,
        // компромисс из раздела «Расхождения» спеки 07); подпись остаётся плотной, как в макете
        style={[st.hit, state === 'locked' && { opacity: 0.55 }]}
      >
        {state === 'current' && (
          <LinearGradient
            colors={gold.nodeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 1 }} // ≈140° макета
            style={[st.fill, { boxShadow: `0 10px 24px ${t.glow}` }]}
          />
        )}
        <View style={[st.circle, { borderColor }]}>
          <Animated.View style={state === 'locked' ? shakeStyle : undefined}>
            <NodeIcon state={state} color={iconColor} />
          </Animated.View>
        </View>
      </PressableScale>
      {state === 'current' && (
        <Animated.View
          pointerEvents="none"
          style={[st.chip, { backgroundColor: t.panel, borderColor: t.frame }, bobStyle]}
        >
          <Txt style={[st.chipText, { color: t.accent }]}>{chipLabel}</Txt>
          <View style={[st.chipTail, { backgroundColor: t.panel, borderColor: t.frame }]} />
        </Animated.View>
      )}
      <Txt
        numberOfLines={2}
        style={[st.label, { color: state === 'current' ? t.head : t.muted }]}
      >
        {title}
      </Txt>
    </View>
  );
}

const st = StyleSheet.create({
  node: { width: NODE_SIZE, height: NODE_SIZE },
  hit: { width: NODE_SIZE, height: NODE_SIZE },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: NODE_SIZE / 2 },
  circle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: RING_INSET,
    left: RING_INSET,
    right: RING_INSET,
    bottom: RING_INSET,
    borderRadius: (NODE_SIZE - RING_INSET * 2) / 2,
    borderWidth: 1.5,
  },
  chip: {
    position: 'absolute',
    top: -53,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 3,
  },
  chipText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.5 },
  chipTail: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 10,
    height: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  label: {
    position: 'absolute',
    top: 80,
    left: (NODE_SIZE - LABEL_W) / 2,
    width: LABEL_W,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
```

- [ ] **Шаг 2: Проверить**

`npx tsc --noEmit` — чисто.

- [ ] **Шаг 3: Коммит**

```
git add src/components/PathNode.tsx
git commit -m "feat: узел пути курса — три состояния, пульс, чип, качание замка (spec 07)"
```

---

### Задача 6: Компонент CoursePath

**Файлы:**
- Создать: `src/components/CoursePath.tsx`

**Интерфейсы:**
- Использует: `nodeXs`, `LessonState` (задача 2), `CourseModule`, `CourseLesson`, `Lang`
  (задача 1), `PathNode`, `NODE_SIZE` (задача 5).
- Отдаёт дальше: `CoursePath` (пропсы `module`, `states`, `lang`, `chipLabel`,
  `onLessonPress`) — использует задача 8.

- [ ] **Шаг 1: Написать компонент**

Создать `src/components/CoursePath.tsx` целиком:

```tsx
/** Тропа одного модуля (эталон .path из #v-course): пунктирная кривая через узлы-уроки.
 *  Кривая — кубические Безье через середины Y соседних центров (формула макета).
 *  Координаты считаются в px по замеренной ширине: у макета viewBox растягивается
 *  preserveAspectRatio="none", но в RN это деформировало бы круглый пунктир. */
import React from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { CourseLesson, CourseModule, Lang } from '../lib/content';
import { nodeXs, type LessonState } from '../lib/courseProgress';
import { useTheme } from '../theme/useTheme';
import { NODE_SIZE, PathNode } from './PathNode';

const TOP = 96; // запас над первым узлом: чип «НАЧАТЬ УРОК» не должен упираться в шапку модуля
const STEP = 106; // вертикальный шаг центров узлов (макет ~92 ×1.147)
const BOTTOM = 80; // под последним узлом — место подписи в две строки

export function CoursePath({
  module: mod,
  states,
  lang,
  chipLabel,
  onLessonPress,
}: {
  module: CourseModule;
  states: Record<string, LessonState>;
  lang: Lang;
  chipLabel: string;
  onLessonPress: (lesson: CourseLesson) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = React.useState(0);

  const n = mod.lessons.length;
  const height = TOP + STEP * (n - 1) + BOTTOM;
  const xs = nodeXs(n);
  const centers = mod.lessons.map((_, i) => ({
    x: (xs[i] / 100) * width,
    y: TOP + STEP * i,
  }));

  // M x0,y0 C x0,ym x1,ym x1,y1 … — ym = середина Y соседних центров (формула эталона)
  const d = centers
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const ym = (centers[i - 1].y + p.y) / 2;
      return `C ${centers[i - 1].x},${ym} ${p.x},${ym} ${p.x},${p.y}`;
    })
    .join(' ');

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
            <Path
              d={d}
              stroke={t.line}
              strokeWidth={3}
              strokeDasharray={[1, 10]}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          {mod.lessons.map((l, i) => (
            <View
              key={l.id}
              style={{
                position: 'absolute',
                left: centers[i].x - NODE_SIZE / 2,
                top: centers[i].y - NODE_SIZE / 2,
              }}
            >
              <PathNode
                state={states[l.id] ?? 'locked'}
                title={l.title[lang]}
                chipLabel={chipLabel}
                onPress={() => onLessonPress(l)}
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}
```

- [ ] **Шаг 2: Проверить**

`npx tsc --noEmit` — чисто.

- [ ] **Шаг 3: Коммит**

```
git add src/components/CoursePath.tsx
git commit -m "feat: тропа модуля — кривая Безье и узлы по змейке (spec 07)"
```

---

### Задача 7: Компонент ModuleHeader

**Файлы:**
- Создать: `src/components/ModuleHeader.tsx`

**Интерфейсы:**
- Использует: `moduleProgress`, `moduleCardCount`, `LessonProgressMap` (задача 2),
  `CourseModule`, `Lang` (задача 1), ключи `course.*` (задача 4).
- Отдаёт дальше: `ModuleHeader` (пропсы `module`, `index`, `total`, `progress`, `lang`) —
  использует задача 8.

- [ ] **Шаг 1: Написать компонент**

Создать `src/components/ModuleHeader.tsx` целиком:

```tsx
/** Шапка модуля на пути курса (эталон .mhead): overline «МОДУЛЬ N ИЗ 6» (+ замок на
 *  платных), название, счётчики уроков/карт, процент прохождения справа. Замок —
 *  визуальный маркер премиума: в v1 подписки нет, доступ гейтит только сквозной порядок. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { CourseModule, Lang } from '../lib/content';
import { moduleCardCount, moduleProgress, type LessonProgressMap } from '../lib/courseProgress';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function ModuleHeader({
  module: mod,
  index,
  total,
  progress,
  lang,
}: {
  module: CourseModule;
  /** номер модуля, с нуля */
  index: number;
  total: number;
  progress: LessonProgressMap;
  lang: Lang;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { pct } = moduleProgress(mod, progress);
  const cards = moduleCardCount(mod);
  // у модулей без разбора карт (М1, М6) счётчик карт не показывается — «4 УРОКА · 0 КАРТ» враньё
  const counters =
    tr('course.lessons', { count: mod.lessons.length }) +
    (cards > 0 ? ` · ${tr('course.cardsCount', { count: cards })}` : '');

  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={{ flex: 1 }}>
        <View style={st.overlineRow}>
          <Txt style={[st.overline, { color: t.muted }]}>
            {tr('course.moduleOf', { n: index + 1, total })}
          </Txt>
          {!mod.free && <Ionicons name="lock-closed" size={12} color={t.muted} />}
        </View>
        <Txt style={[st.title, { color: t.head }]}>{mod.title[lang]}</Txt>
        <Txt style={[st.counters, { color: t.muted }]}>{counters}</Txt>
      </View>
      <Txt style={[st.pct, { color: t.accent }]}>{pct}%</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderWidth: 1,
    borderRadius: radius.l,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
  },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: { fontSize: 9.5, letterSpacing: 2, fontWeight: '600' },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
  counters: { fontSize: 11, letterSpacing: 1, fontWeight: '600', marginTop: 3 },
  pct: { fontSize: 14, fontWeight: '700' },
});
```

- [ ] **Шаг 2: Проверить**

`npx tsc --noEmit` — чисто.

- [ ] **Шаг 3: Коммит**

```
git add src/components/ModuleHeader.tsx
git commit -m "feat: шапка модуля с прогрессом и счётчиками (spec 07)"
```

---

### Задача 8: Экран курса — лента модулей

**Файлы:**
- Переписать: `app/(tabs)/course.tsx` (целиком; `LessonRow` и его стили умирают —
  качание замка уже переехало в `PathNode`)

**Интерфейсы:**
- Использует: всё из задач 1–7; `useTabTopRef`, `ScreenBg`, `Rule`, `FadeUp`, `Txt`
  (существующие); `router` из expo-router.
- Отдаёт дальше: переходы `router.push('/lesson/<id>')` — экран для них создаёт задача 9
  (до неё тап по узлу будет падать в «Unmatched route» — это ожидаемо, проверка в задаче 9).

- [ ] **Шаг 1: Переписать экран**

Заменить содержимое `app/(tabs)/course.tsx` целиком на:

```tsx
/** Экран курса — «путь» как в Duolingo (спека 07): все 6 модулей одной лентой,
 *  шапка модуля + тропа-змейка. Движка урока нет — узлы ведут на заглушку /lesson/[id]. */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoursePath } from '../../src/components/CoursePath';
import { FadeUp } from '../../src/components/FadeUp';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { course, type CourseLesson } from '../../src/lib/content';
import { lessonStates } from '../../src/lib/courseProgress';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function CourseScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const scrollRef = useTabTopRef<ScrollView>();
  const lessonsProgress = useApp((s) => s.lessonsProgress);

  const states = React.useMemo(() => lessonStates(course, lessonsProgress), [lessonsProgress]);
  const lessonsTotal = course.reduce((n, m) => n + m.lessons.length, 0);
  const chipLabel = tr('course.startLesson');

  // Автоскролл к модулю с текущим уроком — один раз, при первом открытии таба.
  // Позиции секций приходят из onLayout в произвольном порядке, поэтому пробуем после
  // каждого замера: сработает, как только измерена именно нужная секция.
  const currentModule = course.findIndex((m) => m.lessons.some((l) => states[l.id] === 'current'));
  const sectionYs = React.useRef<(number | undefined)[]>([]);
  const scrolled = React.useRef(false);
  const onSectionLayout = (index: number, y: number) => {
    sectionYs.current[index] = y;
    if (scrolled.current || currentModule <= 0) return; // первый модуль и так наверху
    const target = sectionYs.current[currentModule];
    if (target === undefined) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, target - spacing.m), animated: false });
  };

  const openLesson = (l: CourseLesson) => router.push(`/lesson/${l.id}`);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.sub, { color: t.muted }]}>
            {`${tr('course.modules', { count: course.length })} · ${tr('course.lessons', { count: lessonsTotal })}`}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('course.title')}</Txt>
          <Rule />
        </FadeUp>

        {course.map((m, mi) => {
          const section = (
            <>
              <ModuleHeader module={m} index={mi} total={course.length} progress={lessonsProgress} lang={lang} />
              <CoursePath module={m} states={states} lang={lang} chipLabel={chipLabel} onLessonPress={openLesson} />
            </>
          );
          return (
            <View
              key={m.id}
              style={mi === 0 ? { marginTop: spacing.l } : undefined}
              onLayout={(e) => onSectionLayout(mi, e.nativeEvent.layout.y)}
            >
              {/* каскад — шапка экрана и только первая секция: глубже первого экрана
                  появление не анимируется (правило задачи 17) */}
              {mi === 0 ? <FadeUp index={1}>{section}</FadeUp> : section}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
});
```

- [ ] **Шаг 2: Проверить**

`npx tsc --noEmit` — чисто. Быстрый смоук в вебе (dev-сервер обычно уже крутится на
http://localhost:8081, иначе `npx expo start --web`): таб «Курс» показывает 6 шапок и 6 троп,
один золотой узел с чипом на m1l1, замки на М3–М6 в шапках. Тап по золотому узлу пока ведёт
на «Unmatched route» — это норма до задачи 9.

- [ ] **Шаг 3: Коммит**

```
git add "app/(tabs)/course.tsx"
git commit -m "feat: экран курса — путь одной лентой с автоскроллом (spec 07)"
```

---

### Задача 9: Заглушка урока /lesson/[id]

**Файлы:**
- Создать: `app/lesson/[id].tsx`
- Изменить: `app/_layout.tsx` (регистрация маршрута)

**Интерфейсы:**
- Использует: `course` (задача 1), ключи `course.lessonOverline/lessonPreparing` (задача 4),
  `EmptyState`, `ScreenBg`, `FadeUp`, `Txt`, `hapticTap` (существующие).
- Отдаёт дальше: маршрут `/lesson/[id]` — задача 08 наполнит экран движком урока.

- [ ] **Шаг 1: Зарегистрировать маршрут**

В `app/_layout.tsx` после `Stack.Screen name="note/[date]"` добавить:

```tsx
        {/* заглушка урока (спека 07): обычный push с прозрачной шапкой — движок урока (08)
            наполнит экран, маршрут и навигация уже настоящие */}
        <Stack.Screen
          name="lesson/[id]"
          options={{
            title: '',
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTintColor: t.accent,
          }}
        />
```

- [ ] **Шаг 2: Написать экран**

Создать `app/lesson/[id].tsx` целиком:

```tsx
/** Заглушка урока (спека 07): маршрут, шапка и композиция настоящие, содержимое привезёт
 *  задача 08 (теория → викторина → результат). Открывается с узла пути курса. */
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeUp } from '../../src/components/FadeUp';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { course } from '../../src/lib/content';
import { hapticTap } from '../../src/lib/haptics';
import { fonts, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Урок и его позиция («МОДУЛЬ N · УРОК M») по id из маршрута. */
function findLesson(id: string | undefined) {
  for (let mi = 0; mi < course.length; mi++) {
    const li = course[mi].lessons.findIndex((l) => l.id === id);
    if (li >= 0) return { lesson: course[mi].lessons[li], mi, li };
  }
  return null;
}

export default function LessonScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const { id } = useLocalSearchParams<{ id: string }>();

  // вибрация на уходе с экрана — паттерн card/[id]: кнопка «назад» нативная, onPress не
  // повесить, поэтому ловим beforeRemove (покрывает и кнопку, и свайп-жест)
  const navigation = useNavigation();
  React.useEffect(() => navigation.addListener('beforeRemove', () => { hapticTap(); }), [navigation]);

  const found = findLesson(id);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.course') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // как card/[id]: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        {found && (
          <FadeUp index={0}>
            <Txt style={[st.overline, { color: t.muted }]}>
              {tr('course.lessonOverline', { m: found.mi + 1, l: found.li + 1 })}
            </Txt>
            <Txt style={[st.title, { color: t.head }]}>{found.lesson.title[lang]}</Txt>
          </FadeUp>
        )}
        <FadeUp index={1} style={{ marginTop: spacing.xl }}>
          <EmptyState text={tr('course.lessonPreparing')} />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  overline: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 26, textAlign: 'center', marginTop: 4 },
});
```

- [ ] **Шаг 3: Проверить**

`npx tsc --noEmit` — чисто. В вебе: тап по золотому узлу открывает «МОДУЛЬ 1 · УРОК 1» +
название + «Урок готовится», кнопка «назад» подписана «Курс» и возвращает на путь.

- [ ] **Шаг 4: Коммит**

```
git add "app/lesson/[id].tsx" app/_layout.tsx
git commit -m "feat: заглушка урока /lesson/[id] (spec 07)"
```

---

### Задача 10: DEV-строки прогресса в настройках

**Файлы:**
- Изменить: `app/settings.tsx`

**Интерфейсы:**
- Использует: `nextLessonId` (задача 2), `course` (задача 1), экшены `setLessonDone`,
  `resetCourse` и поле `lessonsProgress` (задача 3).

- [ ] **Шаг 1: Внести правки**

1. К импортам добавить:

```ts
import { course } from '../src/lib/content';
import { nextLessonId } from '../src/lib/courseProgress';
```

2. К селекторам стора (рядом с `resetToday`):

```ts
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const setLessonDone = useApp((s) => s.setLessonDone);
  const resetCourse = useApp((s) => s.resetCourse);
```

3. В DEV-блок (`{__DEV__ && (...)}`) после строки «План пушей» (FadeUp index={9}) добавить:

```tsx
            <FadeUp index={10}>
              <SettingsRow
                icon="school-outline"
                label={tr('settings.devLessonDone')}
                value="DEV"
                // проверка состояний пути до движка урока (08): двигает current по курсу
                onPress={() => {
                  const next = nextLessonId(course, lessonsProgress);
                  if (next) setLessonDone(next, true);
                }}
              />
            </FadeUp>
            <FadeUp index={11}>
              <SettingsRow
                icon="arrow-undo-outline"
                label={tr('settings.devCourseReset')}
                value="DEV"
                onPress={resetCourse}
              />
            </FadeUp>
```

- [ ] **Шаг 2: Проверить**

`npx tsc --noEmit` — чисто. В вебе: настройки → «Пройти следующий урок» → на табе «Курс»
m1l1 становится ✓, чип и пульс переезжают на m1l2, в шапке М1 «25%»; «Сбросить прогресс
курса» возвращает всё в ноль.

- [ ] **Шаг 3: Коммит**

```
git add app/settings.tsx
git commit -m "feat: DEV-строки прогресса курса в настройках (spec 07)"
```

---

### Задача 11: Синхронизация доков

**Файлы:**
- Изменить: `docs/design-system.md` (§5 — новый подраздел, §7 — уточнение)
- Изменить: `docs/motion-spec.md` (анти-чеклист, №13)
- Изменить: `docs/backlog.md` (статус 07, новая задача дорисовки макета)

**Интерфейсы:** нет (только документация).

- [ ] **Шаг 1: design-system.md**

В §5 «Компоненты» добавить подраздел (значения — макет ×1.147, источники: спека 07 +
design-reference.html `#v-course`):

```markdown
### Узел пути (курс, спека 07)

Круг 76×76, бордер 1.5; иконка 28 (stroke 2, round; галочка/звезда/замок — SVG-пути эталона).
Состояния: done — контур и иконка `success`, без заливки и тени; current — заливка
`gold.nodeGradient` (2 стопа, ≈140°), бордер `frame`, иконка `gold.text`, тень
`boxShadow 0 10px 24px glow`; locked — контур `line`, иконка `muted`, узел (круг+иконка)
opacity 0.55, подпись плотная. Подпись: 11 / 600 / letterSpacing 0.5, `muted` (current —
`head`), top 80 от верха круга, до 2 строк, ширина 132. Пульс-кольцо current: inset −10,
бордер 1.5 `accent`, цикл 1.8s ease-out (scale 0.82→1.14, opacity 0.9→0 к 70%). Чип
«НАЧАТЬ УРОК»: `panel` + бордер 1 `frame`, radius 12, паддинги 8×16, текст 11.5 / 700 /
letterSpacing 1.5 `accent`, хвостик-ромб 10×10, top −53, боб ±5px 2s. Линия пути: `line`,
3px, пунктир [1,10], linecap round (бисер), кубические Безье через середины Y соседних
узлов. Вертикальный шаг узлов 106; x-паттерн змейки [50, 24, 70, 38, 66, 42]%, хвост
циклится с 2-го элемента. Шапка модуля: `panel` + бордер `line`, radius 16, паддинги 14×16,
название Display M, счётчики 11 / 600 / ls 1, процент 14 / 700 `accent`.
```

В §7 «Состояния» строку про заблокированное заменить на:

```markdown
Заблокировано: уроки на пути курса — контурный стиль (бордер line, иконка-замок muted)
+ opacity 0.55 на круге; прочие premium-элементы — opacity 0.55 + иконка lock-closed
цветом muted. Тап — покачивание замка (motion-spec №13).
```

- [ ] **Шаг 2: motion-spec.md**

1. В анти-чеклисте к исключениям про бесконечные анимации (карта дня, кольца, огонёк серии,
   парение картинки) добавить: «пульс-кольцо текущего узла пути и боб чипа "НАЧАТЬ УРОК"
   (экран курса — это его единственный живой элемент и главный призыв к действию)».
2. К пункту №13 приписать: «(в CSS-макете `wob .35s ease 2` — два цикла; реализовано три,
   по букве этого пункта — расхождение осознанное, спека 07)».

- [ ] **Шаг 3: backlog.md**

1. Статус 07: `[ ]` → `[~]` (готово в коде, ждёт веб/лайв-проверки — финальный статус `[x]`
   поставит только лайв-проверка Артёма).
2. В раздел задач добавить задачу дорисовки макета:

```markdown
- [ ] **Макет: курс одной лентой** — design-reference.html рисует один модуль на экран
  («Модуль 2 из 6» шапкой экрана); в приложении по спеке 07 все 6 модулей одной вертикальной
  прокруткой (решение брейншторма 12.08). Дорисовать вкладку «Курс»: секция модуля =
  шапка-панель (overline «МОДУЛЬ N ИЗ 6» внутри) + тропа, экранный заголовок — просто «Курс».
```

- [ ] **Шаг 4: Коммит**

```
git add docs/design-system.md docs/motion-spec.md docs/backlog.md
git commit -m "docs: узел пути в design-system, исключения motion-spec, статус 07"
```

---

### Задача 12: Веб-проверка 6а + 6б и отчёт

**Файлы:**
- Создать: скриншоты в `docs/screenshots/07/`
- Изменить: `docs/specs/07-course-path.md` (раздел «Отчёт о реализации»)

Проверка по процессу CLAUDE.md (6а-0, 6а, 6б) — выполняется самостоятельно, без Артёма.

- [ ] **Шаг 1: Подготовка**

`npm test` — все сьюты зелёные (ожидается 12 сьютов: 11 старых + courseProgress).
`npx tsc --noEmit` — чисто. Запустить `npx expo start --web` (приложение на
http://localhost:8081), открыть через браузерный MCP два окна: приложение и
`file:///.../docs/design-reference.html` (вкладка «Курс»).

- [ ] **Шаг 2: Сверка 6а (обе темы, 390×844)**

Скриншоты в `docs/screenshots/07/`: путь сверху (шапка + М1), середина (граница модулей,
замок на М3), текущий узел крупно (чип + кольцо), заглушка урока — в тёмной и светлой темах.
Чек-лист ui-verification + сверка с макетом: композиция узлов по змейке, пунктир-бисер,
золото узла, панель шапки, шрифты (название модуля — Cormorant), отступы 24. Помнить 6а-0:
макет ≠ истина — принятые расхождения перечислены в спеке 07, новые — фиксировать в отчёте.
Известные отличия веба (вибрация, слабые тени) багами не считать.

- [ ] **Шаг 3: Прокликивание 6б**

- Тап по current → заглушка урока, «назад» («Курс») возвращает на путь.
- Тап по done (после DEV-прохода) → та же заглушка.
- Тап по locked → замок качается; вибрации в вебе нет — не баг.
- Настройки: «Пройти следующий урок» ×5 → current переезжает по узлам и через границу
  модулей (М1 100% → чип на m2l1), проценты в шапках растут; «Сбросить прогресс курса» → ноль.
- Повторный тап по табу «Курс» → скролл к началу.
- Автоскролл: DEV-проходом довести current до М2+, перезагрузить страницу → таб открывается
  на секции текущего модуля.
- Переключить язык на en → «MODULE 2 OF 6», «START LESSON», счётчики en; вернуть ru.
- Консоль браузера: без новых ошибок и warning (артефакты Fast Refresh при правке файлов —
  перезагрузить страницу и проверить заново).

- [ ] **Шаг 4: Отчёт и пуш**

Дописать в `docs/specs/07-course-path.md` раздел «Отчёт о реализации (дата)»: что сделано,
что нашла веб-проверка и как починено, отметить чекбоксы «Готово, когда» (кроме 6в — лайв).
Коммит: `git add -A; git commit -m "docs: отчёт о реализации 07, скриншоты веб-сверки"`.
`git push -u origin feat/07-course-path`. Дальше — лайв-проверка Артёма на iPhone (6в):
хаптика замка, пульс без рывков, автоскролл; merge в main только после неё.

---

## Самопроверка плана

**Покрытие спеки 07:**

| Пункт спеки | Задача плана |
|---|---|
| §1 Типы курса | 1 |
| §2 courseProgress + тесты | 2 |
| §3 Стор, persist v4 | 3 |
| §4 Токен nodeGradient | 4 |
| §5 PathNode (состояния, пульс, чип, wobble) | 5 |
| §6 CoursePath (Безье, пунктир, змейка) | 6 |
| §7 ModuleHeader | 7 |
| §8 Экран-лента + автоскролл + FadeUp | 8 |
| §9 Заглушка /lesson/[id] + маршрут | 9 |
| §10 DEV-строки | 10 |
| §11 i18n | 4 |
| §13 Синхронизация доков | 11 |
| «Готово, когда» / проверки 6а–6б | 12 |

**Порядок и зависимости:** 1 → 2 (типы) → 3 (LessonProgressMap) → 4 (токен/строки) →
5 (LessonState, nodeGradient, строки) → 6 (PathNode, nodeXs) → 7 (moduleProgress, строки) →
8 (всё выше) → 9 (маршрут для тапов из 8) → 10 (nextLessonId + экшены) → 11 → 12.
Единственный «висящий» промежуток — между 8 и 9 тап по узлу ведёт на несуществующий маршрут;
помечено в задаче 8 как ожидаемое.

**Согласованные имена между задачами:** `CourseModule`/`CourseLesson` (1);
`LessonProgress`/`LessonProgressMap`/`LessonState`/`lessonStates`/`nextLessonId`/
`moduleProgress`/`moduleCardCount`/`nodeXs` (2); `lessonsProgress`/`setLessonDone`/
`resetCourse` (3); `gold.nodeGradient`, ключи `course.title/modules/lessons/cardsCount/
moduleOf/startLesson/lessonOverline/lessonPreparing`, `settings.devLessonDone/devCourseReset`
(4); `PathNode`/`NODE_SIZE` (5); `CoursePath` (6); `ModuleHeader` (7); маршрут `/lesson/[id]` (9).

**Известные ловушки, учтённые планом:**
- persist сливает только верхний уровень — `lessonsProgress` верхнеуровневый, миграция no-op,
  version всё равно 4 (дисциплина logic-spec §7);
- `boxShadow`-проп вместо `shadow*` (Android/веб); заливка узла — сиблинг под кругом, не фон
  (дети рисуются поверх бордера родителя); тень на заливке, не на контейнере с overflow;
- `Txt` переводит fontWeight в семейство Manrope — заголовки задают `fontFamily` сами;
- `FadeUp` — только шапка + первая секция (списки >8 и глубже первого экрана не оборачивать);
- бесконечные пульс/боб — `ReduceMotion.System` + `cancelAnimation` в cleanup эффекта;
- координаты кривой в px по onLayout, не растяжение viewBox (деформация пунктира);
- никакого `Math.random`/`Alert.alert`; строки — в оба языка, русские — `_one/_few/_many`;
- `git add` путей со скобками/квадратными скобками — в кавычках (`"app/(tabs)/course.tsx"`).
