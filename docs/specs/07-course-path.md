# Спека 07 · Экран курса = «путь»

Статус: на согласовании · Эталон: docs/design-reference.html (вкладка «Курс», `#v-course`) ·
Значения: docs/design-system.md · Поведение: docs/product-spec.md §2 · Данные: docs/logic-spec.md §7 ·
Ветка: `feat/07-course-path` (первая задача по правилу «07+ — крупные, в ветке»)

## Цель

Таб «Курс» перестаёт быть плоским списком (v0) и становится «путём» как в Duolingo: извилистая
пунктирная тропа с узлами-уроками, у каждого модуля — шапка с прогрессом. Движка урока ещё нет
(задача 08) — узлы ведут на экран-заглушку, но вся геометрия, состояния и чтение прогресса
делаются по-настоящему, чтобы 08 только наполнял.

## Решения брейншторма (12.08)

1. **Блокировка сквозная.** Один «текущий» урок на весь курс — первый непройденный в сквозном
   порядке `m1l1 → … → m6l4`. М2 открывается только после всех уроков М1. Ровно один золотой
   пульсирующий узел на экране (или ни одного, если пройдено всё).
2. **Компоновка — одна лента.** Все 6 модулей одной вертикальной прокруткой: шапка модуля →
   тропа → шапка следующего → … При первом открытии таба экран сам прокручивается к текущему
   модулю. Макет рисует один модуль на экран («Модуль 2 из 6») — расхождение осознанное,
   см. «Расхождения с макетом».
3. **Заглушка урока.** Новый стековый экран `app/lesson/[id].tsx`: название урока +
   «Урок готовится». Маршрут, шапка и навигация делаются сейчас — 08 наполнит экран содержимым.
4. **Прогресс в сторе уже сейчас.** `lessonsProgress` появляется в 07 (читается для состояний
   узлов), запись — только DEV-строками в настройках. Настоящая запись — задача 08.

## Что делаем

### 1. Типы курса — `src/lib/content.ts`

`course` сейчас `any[]`. Заводим типы и типизируем экспорт:

```ts
export interface CourseLesson {
  id: string;                        // "m1l1"
  title: Record<Lang, string>;
  cards: string[];                   // id карт урока (может быть пустым)
  theory?: Record<Lang, string> & { status: BlockStatus };  // как блоки карт
}
export interface CourseModule {
  id: string;                        // "m1"
  free: boolean;
  title: Record<Lang, string>;
  lessons: CourseLesson[];
}
export const course: CourseModule[];
```

### 2. Чистая логика — `src/lib/courseProgress.ts` (новый) + юнит-тесты

Без единого импорта react/expo (правило testing-strategy). Типы и функции:

```ts
export interface LessonProgress { done: boolean; errors: number; ts: number } // схема logic-spec §7
export type LessonProgressMap = Record<string, LessonProgress>;
export type LessonState = 'done' | 'current' | 'locked';

export function lessonStates(modules: CourseModule[], progress: LessonProgressMap):
  Record<string, LessonState>;
// done = progress[id]?.done; current = ПЕРВЫЙ не-done в сквозном порядке; остальные locked.
// Все пройдены → current нет. Прогресс с «дыркой» (done не по порядку) не ломает правило:
// current — всегда первый не-done, ранние done остаются done.

export function nextLessonId(modules, progress): string | null;  // урок-current (для DEV-кнопки)

export function moduleProgress(module: CourseModule, progress: LessonProgressMap):
  { done: number; total: number; pct: number };   // pct = Math.round(done / total * 100)

export function moduleCardCount(module: CourseModule): number;   // Σ lessons[].cards.length

export function nodeXs(count: number): number[];
// x-координаты змейки в % ширины тропы. Паттерн макета: [50, 24, 70, 38, 66, 42];
// при count > 6 продолжаем циклом [24, 70, 38, 66, 42] с индекса 1 (в course.json модули
// по 4/6/8 уроков — макет дал координаты только для 6, генератор обязателен).
```

Тест-кейсы (`src/lib/__tests__/courseProgress.test.ts`):
- пустой прогресс → `m1l1` current, всё прочее locked;
- `m1l1` done → `m1l2` current;
- весь М1 done → `m2l1` current (граница модулей — сквозная);
- ВСЁ done → ни одного current;
- «дырка» (`m1l3` done, `m1l1` нет) → current `m1l1`, `m1l3` остаётся done;
- `moduleProgress`: 0/4 → 0; 2/6 → 33; 6/6 → 100; 1/3 → 33, 2/3 → 67 (округление);
- `moduleCardCount`: m2 → 8, m1 → 0;
- `nodeXs`: count 4 → `[50,24,70,38]`; count 6 → паттерн макета; count 8 → цикл; все ∈ [24, 70].

### 3. Стор — `src/store/useApp.ts`

- Поле `lessonsProgress: LessonProgressMap` (дефолт `{}`), тип реэкспортируется из
  courseProgress.ts (как `DailyDraw` из journal.ts).
- Экшены: `setLessonDone(lessonId: string, done: boolean)` — ставит/снимает
  `{done, errors: 0, ts: Date.now()}`; `resetCourse()` — очищает `lessonsProgress`.
  В 07 их зовут только DEV-строки; 08 расширит запись (errors по-настоящему).
- Persist `version` 3 → 4. Новый ключ — верхнего уровня, поверхностное слияние zustand/persist
  подхватит его из дефолта само (ловушка 06а касается вложенных объектов вроде `settings`),
  но version поднимаем по дисциплине logic-spec §7; migrate-ветка `<4` — no-op с комментарием.
  Следующая задача, меняющая схему, поднимает version до 5.

### 4. Токен — `src/theme/theme.ts`

Узел current в эталоне залит `linear-gradient(140deg, #caa45a, #efd9a2)` — это ТРЕТИЙ вариант
золота (не CTA `gradient`, не `tabGradient` — у того второй стоп `#e9d095`). Добавляем в `gold`:

```ts
nodeGradient: ['#caa45a', '#efd9a2'] as readonly [string, string], // узел пути, угол 140°
```

### 5. Компонент `PathNode` — `src/components/PathNode.tsx` (новый)

Один узел тропы. Пропсы: `state: LessonState`, `title: string`, `isFirstCurrent?` (чип),
`onPress`. Геометрия — макет ×1.147 (рама макета ~340px против реальных 390), значения
вносятся в design-system.md разделом «Узел пути»; финальная подгонка — на веб-сверке 6а:

- Круг **76×76**, бордер 1.5, иконка **28** (react-native-svg, пути из макета: галочка /
  звезда-искра / замок; stroke 2, round).
- Состояния:
  - **done** — без заливки, бордер и иконка `success`;
  - **current** — заливка `gold.nodeGradient` (140°), бордер `frame`, иконка `gold.text`,
    тень `boxShadow: 0 10px 24px glow` + внутренний блик макета опускаем (inset-тень в RN
    не рисуется — расхождение принятое);
  - **locked** — без заливки, бордер `line`, иконка `muted`, узел целиком **opacity 0.55**
    (см. «Расхождения», п.3).
- Подпись под узлом: top 80 от верха круга, 11px `sansSemi`, letterSpacing 0.5, `muted`
  (у current — `head`), по центру, до 2 строк.
- **Пульс-кольцо** (только current): inset −10 (диаметр 96), бордер 1.5 `accent`;
  Reanimated-цикл 1.8s ease-out infinite: scale 0.82 → 1.14, opacity 0.9 → 0 (гаснет к 70%).
- **Чип «НАЧАТЬ УРОК»** (только current): панель `panel` + бордер 1 `frame`, radius 12,
  паддинги 8×16, текст 11.5 `sansBold` letterSpacing 1.5 `accent`, uppercase; хвостик-ромб
  10×10 (бордер справа+снизу `frame`); позиция top −53 от круга; боб ±5px, 2s ease-in-out
  infinite (Reanimated).
- Тап: `PressableScale` (0.96 — motion-spec №5, не 0.9 из макета). Locked: **wobble замка**
  ±8°, 3 раза, ~350мс + `hapticWarning` — логика уже написана в `LessonRow` текущего
  course.tsx, переносится сюда (сам `LessonRow` умирает вместе с v0-экраном).
- Reduce motion: пульс и боб не запускаются (`ReduceMotion.System`).

### 6. Компонент `CoursePath` — `src/components/CoursePath.tsx` (новый)

Тропа одного модуля: контейнер высотой `96 + 106×(n−1) + 80` (паддинг сверху — чтобы чип
первого узла не обрезался; снизу — подпись последнего узла в две строки), узлы абсолютом
по центрам `(nodeXs(n)[i]% ширины, 96 + 106×i)`.
Под узлами — SVG-линия: кубические Безье через середины Y соседних центров
(`C xᵢ₋₁,(yᵢ₋₁+yᵢ)/2  xᵢ,(yᵢ₋₁+yᵢ)/2  xᵢ,yᵢ` — формула макета), координаты в **px** по
onLayout-ширине (не растяжение viewBox — деформирует пунктир), stroke `line`, width 3,
`strokeDasharray [1,10]`, `strokeLinecap round` (бисер как в эталоне).

### 7. Шапка модуля — `src/components/ModuleHeader.tsx` (новый)

Панель (`panel`, radius 16, бордер `line`, паддинги 14×16): слева overline «МОДУЛЬ N ИЗ 6»
(+ Ionicons `lock-closed` 12 `muted` у М3+ — чисто визуальный маркер Premium, НЕ блокирует:
в v1 всё бесплатно, пейволла нет) → название модуля Display M (Cormorant 600, 20) → small
«N УРОКОВ · M КАРТ» (11 `sansSemi`, letterSpacing 1, `muted`; при 0 карт — только «N УРОКОВ»).
Справа — `pct%` (14 `sansBold`, `accent` — макетные 12 ×1.147). Значения — из courseProgress.

### 8. Экран — `app/(tabs)/course.tsx` (переписывается)

- Шапка экрана как v0: overline «6 МОДУЛЕЙ · 32 УРОКА» (из данных, плюрализация), заголовок
  «Курс», разделитель `Rule`.
- Дальше лента: `ModuleHeader` + `CoursePath` на каждый модуль по порядку.
- Тапы узлов: current/done → `router.push('/lesson/' + id)` (done — та же заглушка; режим
  повторения — забота 08); locked — обрабатывает сам узел (wobble, без навигации).
- **Автоскролл к текущему модулю** при первом монтировании: по onLayout секций запоминаем y
  модуля с current-узлом, один раз `scrollTo({y: y − 12, animated: false})`. При возврате на
  таб позиция сохраняется как у всех табов; повторный тап по табу — scroll to top
  (`useTabTopRef` уже подключён в v0, сохраняем).
- FadeUp-каскад: 0 — шапка экрана, 1 — первая секция; глубже первого экрана не анимировать
  (правило задачи 17). ScrollView остаётся обычным (scroll-aware панелей тут нет).

### 9. Заглушка урока — `app/lesson/[id].tsx` (новый) + `app/_layout.tsx`

- Маршрут в `_layout.tsx` по паттерну `card/[id]`: `title: ''`, `headerTransparent: true`,
  `headerShadowVisible: false`, `headerTintColor: accent`, подпись назад «Курс»
  (`headerBackTitle`), анимация — дефолтный push (перелёта героя тут нет, fade не нужен).
- Тело: `ScreenBg`, overline «МОДУЛЬ N · УРОК M» (позиция урока в модуле), заголовок = название
  урока (Display XL), `EmptyState` с фразой «Урок готовится». Урок по id не найден →
  тот же `EmptyState` без заголовка.
- Хаптика на возврат — как у card/[id] (если там она в шапке — переиспользуем паттерн).

### 10. DEV-строки — `app/settings.tsx`

Под `__DEV__`, по образцу существующих (`SettingsRow`, `value="DEV"`):
- «Пройти следующий урок» — `setLessonDone(nextLessonId(...), true)`; все пройдены — строка
  ничего не делает;
- «Сбросить прогресс курса» — `resetCourse()`.
Без них состояния done/current не проверить ни в вебе, ни на телефоне до задачи 08.

### 11. i18n — `src/lib/i18n.ts` (ru + en, все ключи в оба языка)

`course.startLesson` «НАЧАТЬ УРОК», `course.moduleOf` «МОДУЛЬ {{n}} ИЗ {{total}}»,
`course.lessonOverline` «МОДУЛЬ {{m}} · УРОК {{l}}», `course.lessonPreparing` «Урок готовится»,
плюрализации `course.modules`/`course.lessons`/`course.cardsCount` (`_one/_few/_many` в ru —
ловушка «из 1 дней» из 06а), `settings.devLessonDone`, `settings.devCourseReset`.

## Что НЕ делаем (граница с 08 и дальше)

Экран урока с содержимым (теория, викторина, результат, конфетти), настоящая запись
`lessonsProgress` и errors, XP и полоса XP (motion-spec №9 продолжает ждать), бейдж
«Изучено ✓» в справочнике, пейволл/подписка, режим повторения пройденного урока,
изменения `content/course.json`.

## Расхождения с макетом (правило 6а-0)

1. **Лента против одного модуля.** Макет рисует единственный модуль («Модуль 2 из 6» шапкой
   экрана); по product-spec §2 модули листаются скроллом — реализуем ленту (решение
   брейншторма 2). В backlog добавляется задача дорисовки макета: «курс одной лентой».
2. **Wobble замка: 2 против 3.** CSS макета — `wob .35s ease 2`, motion-spec №13 — «3 раза».
   Реализуем по motion-spec (3), как уже сделано в v0-`LessonRow`.
3. **Вид locked-узла.** product-spec §2 и design-system §7 говорят «opacity 0.55 + иконка
   muted»; макет рисует контурный стиль (бордер `line`, своя иконка `--lock`) без прозрачности.
   Совмещаем: контурный стиль макета + opacity 0.55 на узле целиком (буква спек соблюдена,
   рисунок макета сохранён). Если на сверке 6а прозрачность убьёт читаемость — снимаем её
   и правим design-system §7 (⚠️ решение показать Артёму при согласовании).
4. **Внутренний блик узла** (`inset 0 2px 2px rgba(255,255,255,.55)`) — в RN inset-теней нет,
   опускаем.
5. **Цвет done-узла.** Макетный `--done` (#3d7a5c тёмная) ≠ токен `success` (#5aa07e; светлые
   совпадают). Цвета только из theme.ts → красим токеном `success`, макет не догоняем.
6. **Бесконечные пульс кольца и боб чипа** формально запрещены анти-чеклистом motion-spec —
   вносим их туда в исключения (как кольца карты дня): это единственный «живой» элемент экрана
   и он же — главный призыв к действию.

## План по файлам (порядок реализации)

1. `src/lib/content.ts` — типы `CourseModule`/`CourseLesson` → tsc.
2. `src/lib/courseProgress.ts` (новый) → tsc.
3. `src/lib/__tests__/courseProgress.test.ts` (новый) → npm test зелёный.
4. `src/store/useApp.ts` — `lessonsProgress`, экшены, version 4 → tsc.
5. `src/theme/theme.ts` — `gold.nodeGradient`.
6. `src/lib/i18n.ts` — ключи ru/en → tsc.
7. `src/components/PathNode.tsx` (новый) → tsc.
8. `src/components/CoursePath.tsx` (новый) → tsc.
9. `src/components/ModuleHeader.tsx` (новый) → tsc.
10. `app/(tabs)/course.tsx` — переписать на ленту → tsc.
11. `app/lesson/[id].tsx` (новый) + `app/_layout.tsx` — маршрут → tsc.
12. `app/settings.tsx` — DEV-строки → tsc.
13. Синхронизация доков: design-system.md (§5 «Узел пути» с числами, §7 уточнение locked),
    motion-spec.md (исключения анти-чеклиста, №13 «3 раза» подтверждён), backlog.md
    (статус 07 + задача дорисовки макета), CLAUDE.md (статус).

`npm install` не нужен: react-native-svg 15.12.1 уже в зависимостях.

## Готово, когда

- [ ] Таб «Курс»: 6 модулей одной лентой — шапка (overline «МОДУЛЬ N ИЗ 6», название, счётчики,
      pct%, замок на М3+) + тропа-змейка с пунктирной линией через узлы.
- [ ] Ровно один золотой узел с пульсом и чипом «НАЧАТЬ УРОК» — первый непройденный сквозной;
      после DEV-«пройти урок» он переезжает на следующий узел, пройденный становится ✓.
- [ ] Тап: current/done → `/lesson/[id]` («Урок готовится», название урока, шапка с «Курс»);
      locked → wobble + Warning-хаптика, без перехода.
- [ ] pct% шапки модуля: 0 / 33 (2 из 6) / 100 — считается из `lessonsProgress`;
      «· M КАРТ» скрыт у модулей без карт (М1, М6).
- [ ] Автоскролл к текущему модулю при первом открытии таба; повторный тап по табу — к началу.
- [ ] Обе темы читаемы; FadeUp-каскад на входе; reduce motion гасит пульс и боб.
- [ ] `npx tsc --noEmit` чистый; `npm test` зелёный (новый сьют courseProgress).
- [ ] Веб-сверка 6а: скриншоты 390×844 обеих тем в `docs/screenshots/07/`, сравнение с макетом
      по чек-листу ui-verification; прокликивание 6б: каждый узел, DEV-строки, консоль чистая.
- [ ] Лайв-проверка Артёма на iPhone (6в): хаптика замка, пульс, автоскролл — и push ветки.
