# План 08 · Движок урока

> **Для исполняющей сессии:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (рекомендуется; имплементация по шагам — сабагенты sonnet) или superpowers:executing-plans.
> Шаги отмечаются чекбоксами `- [ ]`.

**Цель:** уроки М1–М2 полностью проходимы (теория → разбор карт → викторина → финал с XP
и конфетти), XP-система настоящая (стор, три источника, пилюля «Сегодня»), бейдж «Изучено ✓»
в справочнике.

**Архитектура:** контент викторин сливается скриптом в `course.json`; вся логика — чистые модули
`src/lib/lesson.ts` (шаги, перемешивание) и `src/lib/xp.ts` (формулы, уровни) под юнит-тестами;
стор получает `xp` и `completeLesson` (persist v5); экран урока — локальная машина состояний
(выход = сброс, по спеке); финал — компонент `LessonResult` с конфетти через расширенный `Sparks`.

**Стек:** Expo SDK 54 (НЕ обновлять), expo-router v6, zustand+persist, reanimated, jest-expo.

**Спека:** `docs/specs/08-lesson-engine.md` — план аргументирует от неё, читать вместе.

## Глобальные ограничения

- Ветка `feat/08-lesson-engine` от main; крупная задача — merge только после лайв-проверки.
- После КАЖДОГО шага с кодом: `npx tsc --noEmit` чистый. `npm test` зелёный перед каждым push.
- Новых npm-пакетов нет — `npm install` не понадобится.
- Комментарии в коде и сообщения коммитов — русские; никаких упоминаний ИИ и трейлеров Co-Authored-By.
- Цвета только из `useTheme()` / `theme.ts`. Прецедент-исключения: тени/скримы литералами
  (как `boxShadow: rgba(0,0,0,0.28)` в cards.tsx).
- `pointerEvents` — только внутри `style` (проп устарел, web ругается).
- Persist: эта задача поднимает `version` до **5**; ничего другого в схеме не менять.
- Тексты в UI — через i18n, оба языка сразу. Плюрализация для числительных (ловушка «из 1 дней»).

---

### Задача 1: ветка + материалы Cowork

**Файлы:** без правок кода; только git.

- [ ] **Шаг 1.1: создать ветку**

```bash
git checkout -b feat/08-lesson-engine
```

- [ ] **Шаг 1.2: закоммитить материалы Cowork, если они ещё не в истории**

Проверить `git status`: если `content/quiz-m1-m2.json` (новый), `docs/design-reference.html`
и `docs/motion-spec.md` (правки: шаг карты `.lcard`, финал `.lresult`, §16) не закоммичены —
закоммитить их одним коммитом. Если уже закоммичены другой сессией — пропустить шаг.

```bash
git add content/quiz-m1-m2.json docs/design-reference.html docs/motion-spec.md
git commit -m "docs: материалы задачи 08 — вопросы викторин М1–М2, макет урока, motion-spec §16"
```

---

### Задача 2: quiz в course.json — типы, контракт-тест, скрипт слияния

**Файлы:**
- Изменить: `src/lib/content.ts` (типы)
- Создать: `src/lib/__tests__/courseContent.test.ts`
- Создать: `scripts/merge_quiz.py`
- Изменить (скриптом): `content/course.json`

**Интерфейсы:**
- Производит: тип `QuizQuestion { type: 'single' | 'card'; q: Record<Lang, string>;
  options: Record<Lang, string>[]; correct: number; explain: Record<Lang, string>; cardId?: string }`;
  поля `quiz?: QuizQuestion[]`, `quizStatus?: BlockStatus` у `CourseLesson`. На них опираются
  задачи 4 (lesson.ts) и 10 (экран).

- [ ] **Шаг 2.1: типы в content.ts**

В `src/lib/content.ts` после интерфейса `TarotCard` добавить:

```ts
/** Вопрос викторины урока (спека 08). type card — с изображением карты над вопросом. */
export type QuizType = "single" | "card";
export interface QuizQuestion {
  type: QuizType;
  q: Record<Lang, string>;
  /** ровно 3 варианта; порядок в контенте фиксированный, перемешивает движок (lesson.ts) */
  options: Record<Lang, string>[];
  correct: number;
  /** пояснение, появляется после ответа */
  explain: Record<Lang, string>;
  /** только у type: "card" */
  cardId?: string;
}
```

В `CourseLesson` добавить поля:

```ts
  /** викторина 5 вопросов; есть пока только у М1–М2 (сливается scripts/merge_quiz.py) */
  quiz?: QuizQuestion[];
  /** workflow готовности викторины, как у блоков карт */
  quizStatus?: BlockStatus;
```

Проверка: `npx tsc --noEmit` — чистый.

- [ ] **Шаг 2.2: контракт-тест контента (упадёт — quiz в course.json ещё нет)**

Создать `src/lib/__tests__/courseContent.test.ts`:

```ts
/** Контракт контента викторин (спека 08): опечатка после вычитки редактора должна валить
 *  npm test, а не всплывать у пользователя. Проверяем собранный course.json, не черновик. */
import { cardById, course } from '../content';

const lessons = course
  .filter((m) => ['m1', 'm2'].includes(m.id))
  .flatMap((m) => m.lessons);

describe('контракт викторин М1–М2 (course.json)', () => {
  it('М1–М2 — это 10 уроков', () => {
    expect(lessons).toHaveLength(10);
  });

  it.each(lessons.map((l) => [l.id, l] as const))('%s: 5 вопросов по схеме', (_id, l) => {
    expect(l.quiz).toBeDefined();
    expect(l.quiz!).toHaveLength(5);
    for (const q of l.quiz!) {
      expect(['single', 'card']).toContain(q.type);
      expect(q.options).toHaveLength(3);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(3);
      expect(q.q.ru).toBeTruthy();
      expect(q.q.en).toBeTruthy();
      expect(q.explain.ru).toBeTruthy();
      expect(q.explain.en).toBeTruthy();
      for (const o of q.options) {
        expect(o.ru).toBeTruthy();
        expect(o.en).toBeTruthy();
      }
      // cardId обязан существовать в колоде, но НЕ обязан входить в lesson.cards:
      // у m2l6 карт нет, а card-вопрос есть (спека 08)
      if (q.type === 'card') expect(cardById.has(q.cardId!)).toBe(true);
    }
  });

  it('правильные ответы не сидят на одном индексе (защита от «correct: 0 везде»)', () => {
    for (const l of lessons) {
      expect(new Set(l.quiz!.map((q) => q.correct)).size).toBeGreaterThan(1);
    }
  });
});
```

Запустить: `npm test -- courseContent` → ОЖИДАЕМО ПАДАЕТ («quiz … toBeDefined»).

- [ ] **Шаг 2.3: скрипт слияния**

Создать `scripts/merge_quiz.py`:

```python
#!/usr/bin/env python3
"""
Сливает черновики викторин content/quiz-m1-m2.json в content/course.json (спека 08).

Правило то же, что у build_cards.py: слияние, не перезапись — у урока обновляются только
quiz и quizStatus, всё остальное (theory, title, cards) не трогается. Скрипт идемпотентен:
правки редактора вносим в quiz-файл и перезапускаем.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSE = ROOT / "content" / "course.json"
QUIZ = ROOT / "content" / "quiz-m1-m2.json"
CARDS = ROOT / "content" / "cards.json"


def fail(msg: str) -> None:
    print(f"ОШИБКА: {msg}")
    sys.exit(1)


def main() -> None:
    course = json.loads(COURSE.read_text(encoding="utf-8"))
    quiz = json.loads(QUIZ.read_text(encoding="utf-8"))
    card_ids = {c["id"] for c in json.loads(CARDS.read_text(encoding="utf-8"))["cards"]}

    lessons_by_id = {l["id"]: l for m in course["modules"] for l in m["lessons"]}
    status = quiz.get("status", "draft")

    for entry in quiz["lessons"]:
        lid = entry["lessonId"]
        lesson = lessons_by_id.get(lid)
        if lesson is None:
            fail(f"урок {lid} не найден в course.json")
        for i, q in enumerate(entry["questions"]):
            where = f"{lid}, вопрос {i + 1}"
            if q["type"] not in ("single", "card"):
                fail(f"{where}: неизвестный type {q['type']!r}")
            if len(q["options"]) != 3:
                fail(f"{where}: вариантов {len(q['options'])}, ожидалось 3")
            if not (0 <= q["correct"] < 3):
                fail(f"{where}: correct {q['correct']} вне диапазона 0..2")
            for field in ("q", "explain"):
                if not (q[field].get("ru") and q[field].get("en")):
                    fail(f"{where}: поле {field} не двуязычно")
            for o in q["options"]:
                if not (o.get("ru") and o.get("en")):
                    fail(f"{where}: вариант не двуязычен")
            if q["type"] == "card" and q.get("cardId") not in card_ids:
                fail(f"{where}: cardId {q.get('cardId')!r} нет в cards.json")
        lesson["quiz"] = entry["questions"]
        lesson["quizStatus"] = status

    COURSE.write_text(json.dumps(course, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(len(e["questions"]) for e in quiz["lessons"])
    print(f"OK: {total} вопросов слиты в {len(quiz['lessons'])} уроков, статус {status}")


if __name__ == "__main__":
    main()
```

- [ ] **Шаг 2.4: запустить слияние и проверить**

```bash
python scripts/merge_quiz.py
```

Ожидаемо: `OK: 50 вопросов слиты в 10 уроков, статус draft`.
Затем: `npm test -- courseContent` → ЗЕЛЁНЫЙ. `npx tsc --noEmit` — чистый.
Повторный запуск скрипта не меняет файл (идемпотентность): `git diff --stat content/course.json`
после второго запуска тот же.

- [ ] **Шаг 2.5: коммит**

```bash
git add src/lib/content.ts src/lib/__tests__/courseContent.test.ts scripts/merge_quiz.py content/course.json
git commit -m "feat: викторины М1-М2 в course.json — скрипт слияния, типы, контракт-тест (spec 08)"
```

---

### Задача 3: `src/lib/xp.ts` — формулы XP и уровни

**Файлы:**
- Создать: `src/lib/xp.ts`
- Создать: `src/lib/__tests__/xp.test.ts`

**Интерфейсы:**
- Производит: `lessonXp(errors: number): number`, `levelFromXp(xp: number): { level: number;
  progress: number }`, константы `XP_DRAW = 5`, `XP_REFLECT = 3`, `REPEAT_XP = 2`.
  Их используют задачи 5 (courseProgress), 6 (стор) и 11 (XpPill).

- [ ] **Шаг 3.1: тест (упадёт — модуля нет)**

Создать `src/lib/__tests__/xp.test.ts`:

```ts
import { lessonXp, levelFromXp, REPEAT_XP, XP_DRAW, XP_REFLECT } from '../xp';

describe('lessonXp — 10 − 2×ошибки, минимум 4 (logic-spec §4)', () => {
  it.each([
    [0, 10], [1, 8], [2, 6], [3, 4], [4, 4], [10, 4],
  ])('%i ошибок → %i XP', (errors, expected) => {
    expect(lessonXp(errors)).toBe(expected);
  });
});

describe('levelFromXp — пороги 0/50/150/300/500, дальше +250', () => {
  it.each([
    [0, 1], [49, 1], [50, 2], [149, 2], [150, 3], [299, 3], [300, 4], [499, 4],
    [500, 5], [749, 5], [750, 6], [999, 6], [1000, 7], [1250, 8],
  ])('%i XP → уровень %i', (xp, level) => {
    expect(levelFromXp(xp).level).toBe(level);
  });

  it('progress — доля пути до следующего уровня, 0..1', () => {
    expect(levelFromXp(0).progress).toBe(0);
    expect(levelFromXp(25).progress).toBeCloseTo(0.5); // 0..50
    expect(levelFromXp(100).progress).toBeCloseTo(0.5); // 50..150
    expect(levelFromXp(625).progress).toBeCloseTo(0.5); // 500..750
    expect(levelFromXp(500).progress).toBe(0);
  });

  it('константы источников XP на месте (logic-spec §4)', () => {
    expect(XP_DRAW).toBe(5);
    expect(XP_REFLECT).toBe(3);
    expect(REPEAT_XP).toBe(2);
  });
});
```

Запустить: `npm test -- xp` → ОЖИДАЕМО ПАДАЕТ (модуль не найден).

- [ ] **Шаг 3.2: реализация**

Создать `src/lib/xp.ts`:

```ts
/** XP и уровни (logic-spec §4). Чистые функции без импортов react/expo — под юнит-тестами.
 *  Источники v1: урок 10 − 2×ошибки (мин 4) · повтор урока +2 (раз в день на урок) ·
 *  карта дня +5 · первый ответ рефлексии дня +3. Расклад +5 появится на своём этапе. */

export const XP_DRAW = 5;
export const XP_REFLECT = 3;
export const REPEAT_XP = 2;

/** XP за первое прохождение урока: 10 − 2×ошибки, но не меньше 4. */
export function lessonXp(errors: number): number {
  return Math.max(10 - 2 * errors, 4);
}

// Накопительные пороги: L1 = 0, L2 = 50, L3 = 150, L4 = 300, L5 = 500, дальше каждый +250.
// Даунгрейда нет, XP не сгорает.
const THRESHOLDS = [0, 50, 150, 300, 500];
const STEP_AFTER = 250;

/** Сумма XP, с которой начинается уровень level (нумерация с 1). */
function levelStart(level: number): number {
  if (level <= THRESHOLDS.length) return THRESHOLDS[level - 1];
  return THRESHOLDS[THRESHOLDS.length - 1] + STEP_AFTER * (level - THRESHOLDS.length);
}

/** Уровень по сумме XP + доля пути до следующего уровня (0..1) — для полосы XpPill. */
export function levelFromXp(xp: number): { level: number; progress: number } {
  let level = 1;
  while (xp >= levelStart(level + 1)) level++;
  const start = levelStart(level);
  return { level, progress: (xp - start) / (levelStart(level + 1) - start) };
}
```

- [ ] **Шаг 3.3: проверка и коммит**

`npm test -- xp` → зелёный; `npx tsc --noEmit` — чистый.

```bash
git add src/lib/xp.ts src/lib/__tests__/xp.test.ts
git commit -m "feat: формулы XP и уровней — чистый модуль с тестами (spec 08)"
```

---

### Задача 4: `src/lib/lesson.ts` — шаги урока и перемешивание

**Файлы:**
- Создать: `src/lib/lesson.ts`
- Создать: `src/lib/__tests__/lesson.test.ts`

**Интерфейсы:**
- Потребляет: `CourseLesson`, `QuizQuestion`, `Lang` из `./content` (задача 2).
- Производит: `type LessonStep = { kind: 'theory'; text: string } | { kind: 'card'; cardId: string }
  | { kind: 'quiz'; question: QuizQuestion }`; `type Rng = () => number`;
  `theoryPages(theory: string): string[]`; `shuffleOptions(q: QuizQuestion, rng: Rng): QuizQuestion`;
  `lessonPlayable(lesson: CourseLesson): boolean`;
  `lessonSteps(lesson: CourseLesson, lang: Lang, rng: Rng): LessonStep[]`.
  Их использует задача 10 (экран).

- [ ] **Шаг 4.1: тест (упадёт)**

Создать `src/lib/__tests__/lesson.test.ts`:

```ts
import type { CourseLesson, QuizQuestion } from '../content';
import { lessonPlayable, lessonSteps, shuffleOptions, theoryPages } from '../lesson';

const q = (correct: number): QuizQuestion => ({
  type: 'single',
  q: { ru: 'вопрос', en: 'q' },
  options: [{ ru: 'а', en: 'a' }, { ru: 'б', en: 'b' }, { ru: 'в', en: 'c' }],
  correct,
  explain: { ru: 'пояснение', en: 'explain' },
});

const lesson = (over: Partial<CourseLesson> = {}): CourseLesson => ({
  id: 'x1',
  title: { ru: 'Урок', en: 'Lesson' },
  cards: [],
  theory: { ru: 'абзац', en: 'para', status: 'draft' },
  quiz: [q(0)],
  quizStatus: 'draft',
  ...over,
});

const rngZero = () => 0;

describe('theoryPages — жадная группировка абзацев под бюджет ~700', () => {
  it('пустая строка → ни одной страницы', () => {
    expect(theoryPages('')).toEqual([]);
  });

  it('короткие абзацы склеиваются в одну страницу', () => {
    expect(theoryPages('раз\n\nдва')).toEqual(['раз\n\nдва']);
  });

  it('абзац сверх бюджета открывает новую страницу', () => {
    const a = 'а'.repeat(400);
    const b = 'б'.repeat(400);
    const c = 'в'.repeat(100);
    expect(theoryPages(`${a}\n\n${b}\n\n${c}`)).toEqual([a, `${b}\n\n${c}`]);
  });

  it('тройной перенос и хвостовые пробелы не создают пустых страниц', () => {
    expect(theoryPages('раз\n\n\n\nдва  ')).toEqual(['раз\n\nдва']);
  });
});

describe('shuffleOptions — перемешивание с переиндексацией correct', () => {
  it('rng=0: детерминированный порядок, correct следует за вариантом', () => {
    // Фишер–Йетс с j=0: [0,1,2] → swap(2,0) → [2,1,0] → swap(1,0) → [1,2,0]
    const s = shuffleOptions(q(0), rngZero);
    expect(s.options.map((o) => o.ru)).toEqual(['б', 'в', 'а']);
    expect(s.correct).toBe(2);
    expect(s.options[s.correct].ru).toBe('а');
  });

  it('исходный вопрос не мутируется', () => {
    const src = q(1);
    shuffleOptions(src, rngZero);
    expect(src.options.map((o) => o.ru)).toEqual(['а', 'б', 'в']);
    expect(src.correct).toBe(1);
  });

  it('при любом rng правильный ответ остаётся правильным по содержимому', () => {
    for (const seed of [0.1, 0.35, 0.6, 0.99]) {
      const s = shuffleOptions(q(2), () => seed);
      expect(s.options[s.correct].ru).toBe('в');
    }
  });
});

describe('lessonSteps — теория → карты → вопросы', () => {
  it('порядок видов шагов', () => {
    const l = lesson({ cards: ['fool', 'magician'], quiz: [q(0), q(1)] });
    expect(lessonSteps(l, 'ru', rngZero).map((s) => s.kind)).toEqual([
      'theory', 'card', 'card', 'quiz', 'quiz',
    ]);
  });

  it('карты идут в порядке lesson.cards', () => {
    const l = lesson({ cards: ['fool', 'magician'] });
    expect(lessonSteps(l, 'ru', rngZero).filter((s) => s.kind === 'card')).toEqual([
      { kind: 'card', cardId: 'fool' },
      { kind: 'card', cardId: 'magician' },
    ]);
  });

  it('текст теории берётся из переданного языка', () => {
    expect(lessonSteps(lesson(), 'en', rngZero)[0]).toEqual({ kind: 'theory', text: 'para' });
  });

  it('урок без теории и квиза: шагов нет, lessonPlayable = false', () => {
    const empty = lesson({ theory: undefined, quiz: undefined });
    expect(lessonSteps(empty, 'ru', rngZero)).toEqual([]);
    expect(lessonPlayable(empty)).toBe(false);
    expect(lessonPlayable(lesson())).toBe(true);
  });
});
```

Запустить: `npm test -- lesson.test` → ОЖИДАЕМО ПАДАЕТ.

- [ ] **Шаг 4.2: реализация**

Создать `src/lib/lesson.ts`:

```ts
/** Движок урока (спека 08): нарезка шагов и перемешивание вариантов. Чистые функции без
 *  импортов react/expo — целиком под юнит-тестами. Состояние прохождения (текущий шаг, ошибки)
 *  живёт в экране: product-spec §2 — выход из урока прогресс шага не сохраняет. */
import type { CourseLesson, Lang, QuizQuestion } from './content';

export type LessonStep =
  | { kind: 'theory'; text: string }
  | { kind: 'card'; cardId: string }
  | { kind: 'quiz'; question: QuizQuestion };

/** Бюджет страницы теории в символах: абзацы группируются жадно, пока влезают.
 *  Тексты М1–М2 ~1700–1900 символов — получается 2–3 страницы на урок. */
const PAGE_BUDGET = 700;

/** Нарезка теории на страницы: режем по пустой строке, жадно набираем абзацы в страницу. */
export function theoryPages(theory: string): string[] {
  const paras = theory.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const pages: string[] = [];
  let current = '';
  for (const p of paras) {
    if (current && current.length + 2 + p.length > PAGE_BUDGET) {
      pages.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) pages.push(current);
  return pages;
}

/** Источник случайности инжектируется: тесты детерминированы, приложение даёт Math.random. */
export type Rng = () => number;

/** Перемешивание вариантов (Фишер–Йетс) с переиндексацией correct. Возвращает НОВЫЙ объект —
 *  контент не мутируется (quiz в course.json один на всё приложение). */
export function shuffleOptions(q: QuizQuestion, rng: Rng): QuizQuestion {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correct: order.indexOf(q.correct),
  };
}

/** Проходим ли урок: есть непустая теория И викторина. Иначе экран показывает
 *  «Урок готовится» — весь М3+ до этапа 3. */
export function lessonPlayable(lesson: CourseLesson): boolean {
  return Boolean(lesson.theory?.ru) && (lesson.quiz?.length ?? 0) > 0;
}

/** Шаги урока: страницы теории → по странице на карту → вопросы с перемешанными вариантами.
 *  Порядок вопросов не мешаем (он педагогический), мешаем только варианты внутри вопроса. */
export function lessonSteps(lesson: CourseLesson, lang: Lang, rng: Rng): LessonStep[] {
  const steps: LessonStep[] = [];
  for (const text of theoryPages(lesson.theory?.[lang] ?? '')) steps.push({ kind: 'theory', text });
  for (const cardId of lesson.cards) steps.push({ kind: 'card', cardId });
  for (const q of lesson.quiz ?? []) steps.push({ kind: 'quiz', question: shuffleOptions(q, rng) });
  return steps;
}
```

- [ ] **Шаг 4.3: проверка и коммит**

`npm test -- lesson.test` → зелёный; `npx tsc --noEmit` — чистый.

```bash
git add src/lib/lesson.ts src/lib/__tests__/lesson.test.ts
git commit -m "feat: движок шагов урока — нарезка теории, перемешивание вариантов (spec 08)"
```

---

### Задача 5: courseProgress — `learnedCardIds` и `completeLessonProgress`

**Файлы:**
- Изменить: `src/lib/courseProgress.ts`
- Изменить: `src/lib/__tests__/courseProgress.test.ts` (дописать сьюты)

**Интерфейсы:**
- Потребляет: `lessonXp`, `REPEAT_XP` из `./xp` (задача 3).
- Производит: поле `repeatDate?: string` в `LessonProgress`;
  `learnedCardIds(modules: CourseModule[], progress: LessonProgressMap): Set<string>`;
  `completeLessonProgress(progress: LessonProgressMap, lessonId: string, errors: number,
  todayISO: string, now: number): { progress: LessonProgressMap; gained: number }`.
  Их используют задачи 6 (стор) и 11 (бейдж).

- [ ] **Шаг 5.1: тесты (упадут)**

В `src/lib/__tests__/courseProgress.test.ts` дописать импорты (`learnedCardIds`,
`completeLessonProgress` из `../courseProgress`) и два сьюта. Фабрики `fx` и `done` в файле
уже есть — переиспользовать:

```ts
describe('learnedCardIds — карты пройденных уроков (бейдж «Изучено ✓», спека 08)', () => {
  const MODS = [fx('a', 2, 2)]; // у a1 карты a1-card-0/1, у a2 — a2-card-0/1

  it('пустой прогресс — пустое множество', () => {
    expect(learnedCardIds(MODS, {}).size).toBe(0);
  });

  it('только карты пройденных уроков', () => {
    expect([...learnedCardIds(MODS, done('a1'))].sort()).toEqual(['a1-card-0', 'a1-card-1']);
  });

  it('повторяющиеся карты не задваиваются (урок-повторение перечисляет их заново)', () => {
    const m = fx('a', 2, 0);
    m.lessons[0].cards = ['fool'];
    m.lessons[1].cards = ['fool', 'magician'];
    expect(learnedCardIds([m], done('a1', 'a2')).size).toBe(2);
  });
});

describe('completeLessonProgress — запись прохождения и XP (спека 08)', () => {
  const DAY = '2026-08-13';

  it('первое прохождение: done + errors + XP по формуле', () => {
    const r = completeLessonProgress({}, 'a1', 1, DAY, 42);
    expect(r.progress.a1).toEqual({ done: true, errors: 1, ts: 42 });
    expect(r.gained).toBe(8);
  });

  it('минимум 4 XP при любом числе ошибок', () => {
    expect(completeLessonProgress({}, 'a1', 5, DAY, 1).gained).toBe(4);
  });

  it('повтор: +2, errors обновляются, done остаётся, дата повтора записана', () => {
    const first = completeLessonProgress({}, 'a1', 0, DAY, 1).progress;
    const r = completeLessonProgress(first, 'a1', 2, DAY, 2);
    expect(r.gained).toBe(2);
    expect(r.progress.a1).toEqual({ done: true, errors: 2, ts: 2, repeatDate: DAY });
  });

  it('второй повтор в тот же день — без XP, но ошибки последнего прохождения пишутся', () => {
    const p1 = completeLessonProgress({}, 'a1', 0, DAY, 1).progress;
    const p2 = completeLessonProgress(p1, 'a1', 0, DAY, 2).progress;
    const r = completeLessonProgress(p2, 'a1', 1, DAY, 3);
    expect(r.gained).toBe(0);
    expect(r.progress.a1.errors).toBe(1);
    expect(r.progress.a1.repeatDate).toBe(DAY);
  });

  it('повтор на следующий день снова даёт +2', () => {
    const p1 = completeLessonProgress({}, 'a1', 0, '2026-08-13', 1).progress;
    const p2 = completeLessonProgress(p1, 'a1', 0, '2026-08-13', 2).progress;
    const r = completeLessonProgress(p2, 'a1', 0, '2026-08-14', 3);
    expect(r.gained).toBe(2);
    expect(r.progress.a1.repeatDate).toBe('2026-08-14');
  });

  it('исходная карта прогресса не мутируется', () => {
    const src: LessonProgressMap = {};
    completeLessonProgress(src, 'a1', 0, DAY, 1);
    expect(src).toEqual({});
  });
});
```

Запустить: `npm test -- courseProgress` → ОЖИДАЕМО ПАДАЕТ.

- [ ] **Шаг 5.2: реализация**

В `src/lib/courseProgress.ts`: в `LessonProgress` добавить поле, вверху — импорт из `./xp`:

```ts
import { lessonXp, REPEAT_XP } from './xp';
```

```ts
  /** дата последнего НАГРАЖДЁННОГО повтора (локальный ISO-день): +2 не чаще раза в день */
  repeatDate?: string;
```

В конец файла добавить:

```ts
/** Карты пройденных уроков — бейдж «Изучено ✓» в справочнике (спека 08). Set уникальных id:
 *  уроки-повторения перечисляют карты модуля заново (та же ловушка, что у moduleCardCount). */
export function learnedCardIds(
  modules: CourseModule[],
  progress: LessonProgressMap,
): Set<string> {
  const ids = new Set<string>();
  for (const m of modules)
    for (const l of m.lessons) if (progress[l.id]?.done) l.cards.forEach((c) => ids.add(c));
  return ids;
}

/** Завершение урока (спека 08). Первое прохождение: done + errors + XP по формуле.
 *  Повтор: обновляются errors/ts (ошибки последнего прохождения — схема logic-spec §7),
 *  +2 XP не чаще раза в день (repeatDate). Чистая функция: стор только применяет результат. */
export function completeLessonProgress(
  progress: LessonProgressMap,
  lessonId: string,
  errors: number,
  todayISO: string,
  now: number,
): { progress: LessonProgressMap; gained: number } {
  const prev = progress[lessonId];
  if (!prev?.done) {
    return {
      progress: { ...progress, [lessonId]: { done: true, errors, ts: now } },
      gained: lessonXp(errors),
    };
  }
  const rewarded = prev.repeatDate === todayISO;
  return {
    progress: {
      ...progress,
      [lessonId]: { ...prev, errors, ts: now, ...(rewarded ? {} : { repeatDate: todayISO }) },
    },
    gained: rewarded ? 0 : REPEAT_XP,
  };
}
```

- [ ] **Шаг 5.3: проверка и коммит**

`npm test -- courseProgress` → зелёный; `npx tsc --noEmit` — чистый.

```bash
git add src/lib/courseProgress.ts src/lib/__tests__/courseProgress.test.ts
git commit -m "feat: карты пройденных уроков и правило завершения с XP за повтор (spec 08)"
```

---

### Задача 6: стор — `xp`, `completeLesson`, +5/+3, persist v5

**Файлы:**
- Изменить: `src/store/useApp.ts`
- Изменить: `src/lib/haptics.ts` (+ `hapticError` — понадобится экрану, кладём рядом с роднёй)

**Интерфейсы:**
- Потребляет: `completeLessonProgress` (задача 5), `XP_DRAW`, `XP_REFLECT` (задача 3).
- Производит: поле `xp: number` в сторе; экшен `completeLesson(lessonId: string,
  errors: number) => number` (возвращает начисленный XP — его показывает финал);
  `hapticError(): void`. Используют задачи 9–11.

- [ ] **Шаг 6.1: правки стора**

В `src/store/useApp.ts`:

1. Импорты: добавить `completeLessonProgress` в импорт из `../lib/courseProgress`,
   и новый импорт `import { XP_DRAW, XP_REFLECT } from '../lib/xp';`.

2. В `interface AppState` после `lessonsProgress` добавить:

```ts
  /** Сумма XP (logic-spec §4). Источники: урок, повтор урока, карта дня, первый ответ
   *  рефлексии дня. Задним числом за прошлые дни не начисляется — счёт с нуля у всех. */
  xp: number;
```

и в блок экшенов (после `setLessonDone`):

```ts
  /** Завершение урока движком (спека 08). Возвращает начисленный XP для экрана результата. */
  completeLesson: (lessonId: string, errors: number) => number;
```

3. В дефолты состояния после `lessonsProgress: {}` добавить `xp: 0,`.

4. `drawToday` — достать `xp` из `get()` и дописать начисление в `set`:

```ts
      drawToday: (cardId, reversed) => {
        const t = localDateISO();
        const { lastDrawDate, streak, history, xp } = get();
        if (lastDrawDate === t) return; // уже тянули сегодня
        const yesterday = daysAgoISO(1);
        const newStreak = lastDrawDate === yesterday ? streak + 1 : 1;
        set({
          lastDrawDate: t,
          streak: newStreak,
          history: [{ date: t, cardId, reversed }, ...history].slice(0, 365),
          // ритуал дня: +5 XP (logic-spec §4); повторное начисление отсекает проверка выше
          xp: xp + XP_DRAW,
        });
      },
```

5. `setOutcome` — заменить целиком:

```ts
      // Ответ вечерней рефлексии. Правило то же, что у заметки: правится только сегодняшняя
      // запись (logic-spec §3). Смена ответа до полуночи разрешена, снятия ответа нет.
      // +3 XP — только за ПЕРВЫЙ ответ дня: смена ответа повторно не начисляет (logic-spec §4).
      setOutcome: (date, outcome) => {
        if (!canEditEntry(date)) return;
        const entry = get().history.find((h) => h.date === date);
        if (!entry || entry.outcome === outcome) return;
        set({
          history: get().history.map((h) => (h.date === date ? { ...h, outcome } : h)),
          xp: get().xp + (entry.outcome === undefined ? XP_REFLECT : 0),
        });
      },
```

6. Новый экшен после `setLessonDone`:

```ts
      // Завершение урока: вся арифметика — в чистой completeLessonProgress (courseProgress.ts),
      // экшен применяет результат и возвращает начисленный XP экрану результата.
      completeLesson: (lessonId, errors) => {
        const { lessonsProgress, xp } = get();
        const r = completeLessonProgress(lessonsProgress, lessonId, errors, localDateISO(), Date.now());
        set({ lessonsProgress: r.progress, xp: xp + r.gained });
        return r.gained;
      },
```

7. Персист: `version: 4` → `version: 5`, к комментариям версий дописать строку:

```ts
      // v4 → v5: xp (спека 08) — снова ключ ВЕРХНЕГО уровня, дефолт 0 доливается поверхностным
      // слиянием сам; repeatDate живёт ВНУТРИ записей lessonsProgress и опционален — миграция
      // не нужна. Следующая задача, меняющая схему, поднимает до 6.
```

- [ ] **Шаг 6.2: hapticError**

В `src/lib/haptics.ts` после `hapticWarning` добавить:

```ts
/** Ошибка: неверный ответ викторины (спека 08). */
export const hapticError = () =>
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
```

- [ ] **Шаг 6.3: проверка и коммит**

`npx tsc --noEmit` — чистый; `npm test` — все сьюты зелёные.

```bash
git add src/store/useApp.ts src/lib/haptics.ts
git commit -m "feat: XP в сторе — completeLesson, +5 за карту дня, +3 за рефлексию, persist v5 (spec 08)"
```

---

### Задача 7: `Sparks` — режим конфетти (сектор, подъём, цвета)

**Файлы:**
- Изменить: `src/components/Sparks.tsx`

**Интерфейсы:**
- Производит: новые опциональные пропсы `Sparks` — `angleRange?: [number, number]`
  (сектор разлёта в радианах; без него — полный круг, как раньше), `lift?: number`
  (постоянный вертикальный сдвиг траектории, минус — вверх), `colors?: string[]`
  (цвета глифов по кругу; без него — accent темы). Существующие вызовы (салют на «Сегодня»)
  не меняются — все дефолты сохраняют старое поведение. Использует задача 9.

- [ ] **Шаг 7.1: правка компонента**

В `Spark` добавить пропсы `angleRange`, `lift`, `colors` (типы — как у `Sparks` ниже) и заменить
вычисление `angle`/`dy` и цвет:

```ts
  // сектор задан — раскладываем угол равномерно по нему; нет — полный круг, как раньше
  const angle = angleRange
    ? angleRange[0] + ((angleRange[1] - angleRange[0]) * index) / count + noise(index, 0) * angleJitter
    : (Math.PI * 2 * index) / count - Math.PI / 2 + noise(index, 0) * angleJitter;
```

```ts
  const dy = Math.sin(angle) * len + lift;
```

в стиле `Animated.Text`:

```ts
          color: colors ? colors[index % colors.length] : t.accent,
```

В `Sparks` добавить в сигнатуру и прокинуть в `Spark`:

```ts
  /** Сектор разлёта [от, до] в радианах; ось x вправо, y вниз (верхняя полуокружность —
   *  [Math.PI, Math.PI * 2]). Не задан — полный круг. */
  angleRange?: [number, number];
  /** Постоянный вертикальный сдвиг конца траектории (минус — вверх): «подброс» конфетти. */
  lift?: number;
  /** Цвета глифов по кругу (index % length). Не задан — accent темы. */
  colors?: string[];
```

с дефолтом `lift = 0` (angleRange и colors — undefined).

- [ ] **Шаг 7.2: проверка и коммит**

`npx tsc --noEmit` — чистый. Быстрая ручная проверка не нужна: поведение «Сегодня» не меняется
(дефолты), визуал конфетти проверится в задаче 13.

```bash
git add src/components/Sparks.tsx
git commit -m "feat: Sparks — сектор разлёта, вертикальный подброс и цвета для конфетти (spec 08)"
```

---

### Задача 8: i18n — строки урока (ru + en)

**Файлы:**
- Изменить: `src/lib/i18n.ts`

**Интерфейсы:**
- Производит ключи: `lesson.theoryTitle`, `lesson.cardStep`, `lesson.next`, `lesson.xpGain`,
  `lesson.passedOf` (плюрализация по `count` = всего уроков в модуле; `done` — параметр),
  `lesson.repeatDone`, `lesson.nextOnPath`, `cards.learned`. Используют задачи 9–11.

- [ ] **Шаг 8.1: добавить ключи**

В ru-ресурсы (рядом с блоком `course`) добавить:

```ts
      // экран урока (спека 08). passedOf: «уроков» склоняется по ЧИСЛУ M (count) —
      // «из 1 урока», «из 6 уроков»; та же ловушка, что «из 1 дней» в 06а
      lesson: {
        theoryTitle: "Теория",
        cardStep: "КАРТА УРОКА",
        next: "ДАЛЕЕ",
        xpGain: "+{{n}} XP",
        passedOf_one: "ПРОЙДЕНО {{done}} ИЗ {{count}} УРОКА МОДУЛЯ",
        passedOf_few: "ПРОЙДЕНО {{done}} ИЗ {{count}} УРОКОВ МОДУЛЯ",
        passedOf_many: "ПРОЙДЕНО {{done}} ИЗ {{count}} УРОКОВ МОДУЛЯ",
        repeatDone: "Повторение пройдено",
        nextOnPath: "ДАЛЬШЕ ПО ПУТИ →",
      },
```

в `cards` (ru): `learned: "ИЗУЧЕНО ✓",`

В en-ресурсы:

```ts
      lesson: {
        theoryTitle: "Theory",
        cardStep: "LESSON CARD",
        next: "NEXT",
        xpGain: "+{{n}} XP",
        passedOf_one: "{{done}} OF {{count}} MODULE LESSON DONE",
        passedOf_other: "{{done}} OF {{count}} MODULE LESSONS DONE",
        repeatDone: "Review complete",
        nextOnPath: "CONTINUE THE PATH →",
      },
```

в `cards` (en): `learned: "LEARNED ✓",`

- [ ] **Шаг 8.2: проверка и коммит**

`npx tsc --noEmit` — чистый; `npm test` — зелёный (сьют phrases не затронут).

```bash
git add src/lib/i18n.ts
git commit -m "feat: строки экрана урока и бейджа изучено, ru/en (spec 08)"
```

---

### Задача 9: компонент `LessonResult` — финал с XP, полосой и конфетти

**Файлы:**
- Создать: `src/components/LessonResult.tsx`

**Интерфейсы:**
- Потребляет: `Sparks` c `angleRange`/`lift`/`colors` (задача 7), `hapticSuccess` (есть),
  ключи `lesson.xpGain` / `lesson.passedOf` / `lesson.repeatDone` / `lesson.nextOnPath` (задача 8).
- Производит: `LessonResult({ gained, done, total, prevDone, onNext })` — `gained` — начисленный
  XP (0 = повтор без награды), `done`/`total` — прогресс модуля ПОСЛЕ записи, `prevDone` — ДО
  (старт полосы), `onNext` — CTA. Использует задача 10.

- [ ] **Шаг 9.1: компонент**

Создать `src/components/LessonResult.tsx`:

```tsx
/** Финал урока (motion-spec §16, `.lresult` эталона): панель въезжает fade+up 500мс →
 *  хаптика Success → счётчик «+N XP» катится (55мс/шаг) → полоса прогресса модуля заполняется
 *  пружинной кривой (та же, что у XpPill) → конфетти вверх веером. Конфетти живёт ТОЛЬКО здесь
 *  (и позже в коллекции, этап 3+) — редкость сохраняет праздник.
 *  gained = 0 (повтор, +2 сегодня уже получены): счётчика нет — заголовок «Повторение пройдено».
 *  Reduce motion: счётчик мгновенный, конфетти не запускается (motion-spec §16). */
import { LinearGradient } from 'expo-linear-gradient';
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
import { Sparks } from './Sparks';
import { Txt } from './Txt';

const ENTER_MS = 500; // въезд панели
const TICK_MS = 55; // шаг XP-счётчика
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

  const [shown, setShown] = React.useState(reduced ? gained : 0);
  const [burst, setBurst] = React.useState(0);

  const enter = useSharedValue(0);
  const bar = useSharedValue(total ? prevDone / total : 0);

  React.useEffect(() => {
    enter.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });

    // последовательность §16: панель встала → Success → счётчик → полоса + конфетти
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
    timers.push(
      setTimeout(() => {
        bar.value = withTiming(total ? done / total : 0, {
          duration: BAR_MS,
          easing: Easing.bezier(0.25, 1.2, 0.4, 1), // перелёт за цель, как полоса XpPill
          reduceMotion: ReduceMotion.System,
        });
        if (!reduced) setBurst((b) => b + 1);
      }, ENTER_MS + countMs),
    );

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
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` as `${number}%` }));

  return (
    <Animated.View style={enterStyle}>
      <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.frame }]}>
        {gained > 0 ? (
          <Txt style={[st.xp, { color: t.accent }]}>{tr('lesson.xpGain', { n: shown })}</Txt>
        ) : (
          <Txt style={[st.repeat, { color: t.head }]}>{tr('lesson.repeatDone')}</Txt>
        )}
        <Txt style={[st.line, { color: t.muted }]}>
          {tr('lesson.passedOf', { done, count: total })}
        </Txt>
        <View style={[st.bar, { backgroundColor: t.line }]}>
          <Animated.View style={[st.fill, barStyle]}>
            <LinearGradient
              colors={[t.accent, t.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <CtaButton label={tr('lesson.nextOnPath')} onPress={onNext} style={st.cta} />
        {/* конфетти из-за панели: верхняя полуокружность + подброс, цвета через один */}
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
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // .lresult эталона: radius 18 — осознанный литерал, как radius 13 у строки дневника
  panel: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginTop: spacing.l },
  xp: { fontFamily: fonts.displaySemi, fontSize: 36 },
  repeat: { fontFamily: fonts.display, fontSize: 24 },
  line: { fontSize: 11, letterSpacing: 1, marginTop: 4 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', alignSelf: 'stretch', marginTop: 12, marginHorizontal: 30 },
  fill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  cta: { marginTop: spacing.l, alignSelf: 'stretch' },
});
```

⚠️ Если `useReducedMotion` не экспортируется из установленной версии reanimated — заменить на
`AccessibilityInfo.isReduceMotionEnabled` с состоянием (но в SDK 54 / reanimated 3 хук есть).

- [ ] **Шаг 9.2: проверка и коммит**

`npx tsc --noEmit` — чистый.

```bash
git add src/components/LessonResult.tsx
git commit -m "feat: финальная панель урока — счётчик XP, полоса модуля, конфетти (spec 08)"
```

---

### Задача 10: экран урока `app/lesson/[id].tsx`

**Файлы:**
- Переписать: `app/lesson/[id].tsx` (заглушку 07 — целиком)

**Интерфейсы:**
- Потребляет: `lessonSteps`/`lessonPlayable`/`LessonStep` (задача 4), `completeLesson` из стора
  (задача 6), `moduleProgress` (есть), `LessonResult` (задача 9), `hapticTap`/`hapticError`
  (задача 6), `cardById`/`cardImages` (есть), i18n (задача 8).

- [ ] **Шаг 10.1: переписать экран**

Заменить содержимое `app/lesson/[id].tsx` целиком:

```tsx
/** Экран урока (спека 08): теория → разбор карт → викторина → финал с XP и конфетти.
 *  Состояние прохождения живёт здесь и умирает с экраном: выход посреди урока прогресс шага
 *  не сохраняет (product-spec §2). В стор пишет только completeLesson на финале.
 *  Язык шагов фиксируется при входе: пересборка посреди прохождения сбила бы индекс шага. */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Block } from '../../src/components/Block';
import { CtaButton } from '../../src/components/CtaButton';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeUp } from '../../src/components/FadeUp';
import { LessonResult } from '../../src/components/LessonResult';
import { PressableScale } from '../../src/components/PressableScale';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { cardById, cardImages, course, type CourseLesson, type CourseModule } from '../../src/lib/content';
import { moduleProgress } from '../../src/lib/courseProgress';
import { hapticError, hapticTap } from '../../src/lib/haptics';
import { lessonPlayable, lessonSteps, type LessonStep } from '../../src/lib/lesson';
import { useBackHaptic } from '../../src/lib/useBackHaptic';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';
import { useApp } from '../../src/store/useApp';

// смена контента шага — как вкладки сфер на странице карты: гашение 130мс → проявление 350мс
const FADE_OUT_MS = 130;
const FADE_IN_MS = 350;
// подсветка правильного варианта после ошибки — задержка из эталона (answer(): setTimeout 400)
const REVEAL_MS = 400;
// прогресс-бар шагов
const PROG_MS = 300;

/** Урок, его модуль и позиция («МОДУЛЬ N · УРОК M») по id из маршрута. */
function findLesson(
  id: string | undefined,
): { lesson: CourseLesson; module: CourseModule; mi: number; li: number } | null {
  for (let mi = 0; mi < course.length; mi++) {
    const li = course[mi].lessons.findIndex((l) => l.id === id);
    if (li >= 0) return { lesson: course[mi].lessons[li], module: course[mi], mi, li };
  }
  return null;
}

type OptState = 'idle' | 'ok' | 'no';

export default function LessonScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const { id } = useLocalSearchParams<{ id: string }>();

  // вибрация на уходе с экрана — общий хук (как card/[id])
  useBackHaptic();

  const found = React.useMemo(() => findLesson(id), [id]);

  // шаги строятся один раз на урок; язык внутри зафиксирован сознательно (см. шапку файла)
  const steps = React.useMemo<LessonStep[]>(() => {
    if (!found || !lessonPlayable(found.lesson)) return [];
    return lessonSteps(found.lesson, lang, Math.random);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);

  const completeLesson = useApp((s) => s.completeLesson);
  const lessonsProgress = useApp((s) => s.lessonsProgress);

  const [stepIdx, setStepIdx] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [showCorrect, setShowCorrect] = React.useState(false);
  const [result, setResult] = React.useState<{ gained: number; prevDone: number } | null>(null);
  const revealTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  // плавная смена контента шага
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const applyStep = (next: number) => {
    setPicked(null);
    setShowCorrect(false);
    setStepIdx(next);
    fade.value = withTiming(1, { duration: FADE_IN_MS, reduceMotion: ReduceMotion.System });
  };

  // прогресс-бар: доля пройденных шагов; на финале — 1
  const prog = useSharedValue(0);
  React.useEffect(() => {
    const target = steps.length === 0 ? 0 : result ? 1 : stepIdx / steps.length;
    prog.value = withTiming(target, {
      duration: PROG_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [stepIdx, result, steps.length, prog]);
  const progStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` as `${number}%` }));

  const step: LessonStep | undefined = steps[stepIdx];
  const answered = picked !== null;

  const onPick = (i: number) => {
    if (!step || step.kind !== 'quiz' || answered) return;
    setPicked(i);
    if (i === step.question.correct) {
      hapticTap(); // верный — Light (product-spec §2)
    } else {
      setErrors((e) => e + 1);
      hapticError();
      revealTimer.current = setTimeout(() => setShowCorrect(true), REVEAL_MS);
    }
  };

  const finish = () => {
    if (!found) return;
    const prevDone = moduleProgress(found.module, useApp.getState().lessonsProgress).done;
    const gained = completeLesson(found.lesson.id, errors);
    setResult({ gained, prevDone });
  };

  const onNext = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (stepIdx + 1 < steps.length) {
      fade.value = withTiming(
        0,
        { duration: FADE_OUT_MS, reduceMotion: ReduceMotion.System },
        (finished) => {
          if (finished) runOnJS(applyStep)(stepIdx + 1);
        },
      );
    } else {
      finish();
    }
  };

  const optState = (i: number): OptState => {
    if (!step || step.kind !== 'quiz' || picked === null) return 'idle';
    if (i === step.question.correct && (picked === step.question.correct || showCorrect)) return 'ok';
    if (i === picked && picked !== step.question.correct) return 'no';
    return 'idle';
  };

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
            {steps.length > 0 && (
              <View style={st.progRow}>
                <View style={[st.progTrack, { backgroundColor: t.line }]}>
                  <Animated.View style={[st.progFill, progStyle]}>
                    <LinearGradient
                      colors={[t.accent, t.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </View>
                <Txt style={[st.progLabel, { color: t.accent }]}>
                  {`${result ? steps.length : Math.min(stepIdx + 1, steps.length)}/${steps.length}`}
                </Txt>
              </View>
            )}
          </FadeUp>
        )}

        {/* урок без контента (М3+): как заглушка 07 — «Урок готовится» */}
        {(!found || steps.length === 0) && (
          <FadeUp index={1} style={{ marginTop: spacing.xl }}>
            <EmptyState text={tr('course.lessonPreparing')} />
          </FadeUp>
        )}

        {found && steps.length > 0 && result && (
          <LessonResult
            gained={result.gained}
            done={moduleProgress(found.module, lessonsProgress).done}
            total={found.module.lessons.length}
            prevDone={result.prevDone}
            onNext={() => router.back()}
          />
        )}

        {found && step && !result && (
          <FadeUp index={1}>
            <Animated.View style={fadeStyle}>
              {step.kind === 'theory' && <Block title={tr('lesson.theoryTitle')} text={step.text} />}

              {step.kind === 'card' && <CardStep cardId={step.cardId} lang={lang} />}

              {step.kind === 'quiz' && (
                <View style={{ marginTop: spacing.l }}>
                  {step.question.type === 'card' && step.question.cardId && (
                    <View style={[st.qImWrap, { borderColor: t.frame }]}>
                      <Image
                        source={cardImages[step.question.cardId]}
                        style={st.qIm}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    </View>
                  )}
                  <Txt style={[st.q, { color: t.head }]}>{step.question.q[lang]}</Txt>
                  {step.question.options.map((o, i) => {
                    const state = optState(i);
                    return (
                      <PressableScale
                        key={i}
                        onPress={() => onPick(i)}
                        style={[
                          st.opt,
                          { backgroundColor: t.panel, borderColor: t.line },
                          // фон верного — success с альфой 0.12 (1F), как rgba(90,160,126,.12) эталона
                          state === 'ok' && { borderColor: t.success, backgroundColor: `${t.success}1F` },
                          state === 'no' && { borderColor: t.danger, opacity: 0.6 },
                        ]}
                      >
                        <Txt style={[st.optTxt, { color: t.text }]}>{o[lang]}</Txt>
                      </PressableScale>
                    );
                  })}
                  {answered && (
                    <Txt style={[st.explain, { color: t.text }]}>{step.question.explain[lang]}</Txt>
                  )}
                </View>
              )}

              {(step.kind !== 'quiz' || answered) && (
                <CtaButton label={tr('lesson.next')} onPress={onNext} style={{ marginTop: spacing.xl }} />
              )}
            </Animated.View>
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}

/** Шаг «разбор карты» — `.lcard` эталона: изображение + имя + 4 ключевых слова из cards.json. */
function CardStep({ cardId, lang }: { cardId: string; lang: 'ru' | 'en' }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const card = cardById.get(cardId);
  if (!card) return null;
  return (
    <View style={[st.lcard, { backgroundColor: t.panel, borderColor: t.frame }]}>
      <View style={[st.lcardImWrap, { borderColor: t.frame, boxShadow: `0px 8px 22px ${t.glow}` }]}>
        <Image source={cardImages[cardId]} style={st.lcardIm} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <View style={st.lcardCol}>
        <Txt style={[st.lcardOverline, { color: t.accent }]}>{tr('lesson.cardStep')}</Txt>
        <Txt style={[st.lcardName, { color: t.head }]}>{card.name[lang]}</Txt>
        <Txt style={[st.lcardKw, { color: t.muted }]}>{`✦ ${card.keywords[lang].join(' · ')}`}</Txt>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  overline: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 26, textAlign: 'center', marginTop: 4 },
  // .prog эталона: полоса 7/4 + подпись X/N
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.m },
  progTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  progLabel: { fontSize: 11, fontWeight: '700' },
  // вопрос (.quiz .q, масштаб рамы: 17 → 19)
  q: { fontFamily: fonts.display, fontSize: 19, textAlign: 'center' },
  qImWrap: {
    width: 110,
    aspectRatio: 0.58,
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: spacing.l,
  },
  qIm: { width: '100%', height: '100%' },
  // вариант ответа (.opt): бордер 1.5, radius 14, паддинг 13×16, Body 14
  opt: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, marginTop: 9 },
  optTxt: { fontSize: 14, lineHeight: 20 },
  explain: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: spacing.l },
  // шаг карты (.lcard)
  lcard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: radius.l, padding: 14, marginTop: spacing.m },
  lcardImWrap: { width: 74, aspectRatio: 0.58, borderRadius: radius.s, borderWidth: 1, overflow: 'hidden' },
  lcardIm: { width: '100%', height: '100%' },
  lcardCol: { flex: 1 },
  lcardOverline: { fontSize: 9, letterSpacing: 2, fontWeight: '600' },
  lcardName: { fontFamily: fonts.display, fontSize: 20, marginTop: 2 },
  lcardKw: { fontSize: 12, marginTop: 5, lineHeight: 17 },
});
```

- [ ] **Шаг 10.2: проверка типов и ручная smoke-проверка**

`npx tsc --noEmit` — чистый. Запустить `npx expo start --web`, открыть
http://localhost:8081, таб «Курс» → «НАЧАТЬ УРОК» (m1l1): пролистать теорию (2–3 страницы,
прогресс-бар растёт), ответить на 5 вопросов (верный — зелёная рамка; неверный — красная +
подсветка правильного через 400мс + пояснение), финал — счётчик, полоса, конфетти, CTA
возвращает на курс, узел m1l1 стал ✓, m1l2 — золотой.

- [ ] **Шаг 10.3: коммит**

```bash
git add "app/lesson/[id].tsx"
git commit -m "feat: экран урока — теория, разбор карт, викторина, финал (spec 08)"
```

---

### Задача 11: бейдж «Изучено ✓» в справочнике + реальная XpPill на «Сегодня»

**Файлы:**
- Изменить: `app/(tabs)/cards.tsx`
- Изменить: `app/(tabs)/index.tsx`

**Интерфейсы:**
- Потребляет: `learnedCardIds` (задача 5), `levelFromXp` (задача 3), поле `xp` стора (задача 6),
  ключ `cards.learned` (задача 8).

- [ ] **Шаг 11.1: бейдж в сетке**

В `app/(tabs)/cards.tsx`:

1. Импорты: `learnedCardIds` из `../../src/lib/courseProgress`, `course` добавить в импорт
   из `../../src/lib/content`, `useApp` из `../../src/store/useApp`.

2. `Cell` — добавить проп `learned` и бейдж внутрь `imWrap` (после `Skeleton`):

```tsx
function Cell({ item, lang, learned }: { item: TarotCard; lang: 'ru' | 'en'; learned: boolean }) {
```

```tsx
        {learned && (
          <View style={st.learned}>
            <Txt style={[st.learnedTxt, { color: t.accent2 }]}>{tr('cards.learned')}</Txt>
          </View>
        )}
```

`Cell` теперь использует `tr`: добавить `const { t: tr } = useTranslation();` внутри `Cell`.

3. В `CardsScreen` после `const rows = ...`:

```tsx
  // карты пройденных уроков — бейдж «Изучено ✓» (спека 08)
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const learned = useMemo(() => learnedCardIds(course, lessonsProgress), [lessonsProgress]);
```

и в рендере ячейки: `<Cell key={c.id} item={c} lang={lang} learned={learned.has(c.id)} />`.

4. Стили (в `st`):

```ts
  // .st2 эталона: скрим-подложка литералом — как тень imWrap (не тема: затемнение поверх фото)
  learned: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.s,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  learnedTxt: { fontSize: 8, letterSpacing: 0.5, fontWeight: '700' },
```

- [ ] **Шаг 11.2: XpPill — реальные уровень и прогресс**

В `app/(tabs)/index.tsx`:

1. Удалить блок мока (комментарий + `MOCK_LEVEL` + `MOCK_PROGRESS`).
2. Импорт: `levelFromXp` из `../../src/lib/xp`.
3. В компоненте, рядом с чтением `streak` из стора: `const xp = useApp((s) => s.xp);`
   (точная форма — как соседние селекторы в файле) и `const lvl = levelFromXp(xp);`.
4. Рендер: `<XpPill level={lvl.level} progress={lvl.progress} style={st.pillXp} />`.

- [ ] **Шаг 11.3: проверка и коммит**

`npx tsc --noEmit` — чистый; `npm test` — зелёный. В вебе: DEV-строкой настроек «Пройти следующий
урок» пройти m1l1–m1l4 и m2l1 — в справочнике у Дурака и Мага появился бейдж «ИЗУЧЕНО ✓»
(у остальных нет); на «Сегодня» пилюля показывает «Уровень 1» с ненулевой полосой (XP от DEV-строк
не начисляется — но открытая карта дня даёт +5; для проверки полосы открыть карту).

```bash
git add "app/(tabs)/cards.tsx" "app/(tabs)/index.tsx"
git commit -m "feat: бейдж изучено в справочнике и настоящая пилюля уровня (spec 08)"
```

---

### Задача 12: синхронизация доков

**Файлы:**
- Изменить: `docs/product-spec.md`, `docs/logic-spec.md`, `docs/design-system.md`,
  `docs/backlog.md`, `CLAUDE.md`

- [ ] **Шаг 12.1: product-spec §2**

Три правки (номера строк — на 13.08, искать по тексту):

1. Строка «по пройденному → урок в режиме повторения (без XP)» → «по пройденному → урок
   в режиме повторения (+2 XP, не чаще раза в день — logic-spec §4)».
2. Блок «**Экран урока 🔨(08):** …» заменить на:

```markdown
**Экран урока ✅(08):** прогресс-бар (шаг X/N, все шаги) → карточки теории (course.json →
lessons[].theory, Cormorant, листание «Далее»; 2–3 страницы, абзацы группируются под бюджет
~700 символов) → разбор карт: по странице на карту урока — изображение + название + 4 ключевых
слова из cards.json (у уроков без карт шага нет) → викторина 5 вопросов (перемешиваются только
варианты, порядок вопросов фиксированный; тип card — с изображением карты; верный → зелёная
рамка + хаптика Light; неверный → красная + правильный подсвечивается через 400мс + хаптика
Error, счёт ошибок не блокирует; после ответа — пояснение explain и «Далее») → финал:
«+N XP» (счётчик катится), конфетти, прогресс модуля («ПРОЙДЕНО N ИЗ M УРОКОВ МОДУЛЯ»
с полосой), CTA «Дальше по пути». XP: 10 за урок, минус 2 за каждую ошибку, минимум 4;
повтор +2 не чаще раза в день. Выход посреди урока → прогресс шага не сохраняется (урок
короткий). Уроки без контента (М3+) — «Урок готовится», завершить нельзя.
```

3. В §3: пометку 🔨(08) у бейджа «Изучено ✓» сменить на ✅(08).

- [ ] **Шаг 12.2: logic-spec**

1. §4: «ответ рефлексии +3» → «первый ответ рефлексии за день +3 (смена ответа до полуночи
   повторно не начисляет)»; к «повторное прохождение урока +2 (раз в день на урок)» дописать
   «— дата награждённого повтора в `lessonsProgress[id].repeatDate`».
2. §7, схема состояния: `lessonsProgress: {lessonId: {done, errors, ts}}` →
   `lessonsProgress: {lessonId: {done, errors, ts, repeatDate?}}`.
3. §7, история версий персиста, после записи о v4 добавить:

```markdown
**08 подняла `version` до 5** ради поля `xp` — ключ верхнего уровня, дефолт 0 доливается
поверхностным слиянием сам; `repeatDate` живёт внутри записей `lessonsProgress` и опционален —
миграция не нужна. Следующая задача, меняющая схему, поднимает до 6.
```

4. §7, схема course.json (если описана): у урока дописать `quiz` (5 вопросов: type single|card,
   q/options×3/correct/explain, card — с cardId) и `quizStatus` (draft → reviewed → final).

- [ ] **Шаг 12.3: design-system**

В раздел компонентов (§5) добавить блок:

```markdown
**Экран урока (08).** Прогресс-бар: высота 7, radius 4, фон line, заполнение — градиент
accent→accent2, подпись «X/N» 11/700 accent, ряд gap 10. Теория — Block (текст Cormorant 16/24).
Карта урока: панель panel/frame 1px, radius 16, паддинг 14, ряд gap 14; изображение 74px
(radius 8, бордер frame, boxShadow 0 8px 22px glow); overline «КАРТА УРОКА» 9/2 accent;
имя Cormorant 20; слова 12 muted «✦ а · б · в · г». Вопрос: Cormorant 19 head по центру;
card-вопрос — изображение 110px (radius 12, бордер frame) над текстом. Вариант ответа: панель
panel, бордер 1.5 line, radius 14, паддинг 13×16, Body 14, отступ 9; верный — бордер success +
фон success 12% (hex-альфа 1F); неверный — бордер danger + opacity 0.6, правильный
подсвечивается через 400мс. Пояснение: Cormorant 15/22 по центру. Финал: панель panel/frame,
radius 18, паддинг 20; счётчик Cormorant SemiBold 36 accent; подпись 11/ls1 muted; полоса 6/3,
отступ 12/30/0; конфетти — Sparks сектором [π, 2π], 22 шт, 8–18px, разлёт 90–220, подброс −60,
1.1с, цвета accent/accent2 через один. Бейдж «ИЗУЧЕНО ✓» в сетке справочника (.st2): угол 6/6,
шрифт 8/700, ls 0.5, accent2 на rgba(0,0,0,.4), radius 8, паддинг 2×6.
Хаптика: верный ответ Light, неверный Notification.Error, финал Success (дополнение к
motion-spec п.8).
```

- [ ] **Шаг 12.4: backlog + CLAUDE.md**

1. `docs/backlog.md`: задачу 08 пометить `[~]` с датой и одной строкой итога (в `[x]` её
   переведёт только лайв-проверка Артёма); в задачу 15 дописать пункт:

```markdown
      Дописано 13.08 при реализации 08 — три дорисовки в уроке: (л) после ответа на вопрос
      в приложении появляются пояснение explain и кнопка «ДАЛЕЕ», в макете их нет; (м) у
      card-вопроса в приложении изображение карты над текстом вопроса — в макете вопрос
      только текстовый; (н) панель теории в приложении несёт Overline-заголовок «ТЕОРИЯ»
      (фирменный стиль Block), в макете `.theory` без заголовка.
```

2. `CLAUDE.md`, раздел «Статус»: абзац о задаче 08 — что сделано (движок урока, XP-система,
   бейдж, persist v5, число тестов после `npm test`), с пометкой «веб-проверка ✓, ждёт
   лайв-проверки». Раздел «Ближайшие задачи»: убрать пункт 08, отметить что следующая — 09
   (онбординг), правило «следующая задача, меняющая схему стора, поднимает persist до 6».

- [ ] **Шаг 12.5: коммит**

```bash
git add docs/product-spec.md docs/logic-spec.md docs/design-system.md docs/backlog.md CLAUDE.md
git commit -m "docs: синхронизация доков по задаче 08 — экран урока, XP, persist v5"
```

---

### Задача 13: проверка 6а/6б — веб-сверка с эталоном и прокликивание

Правила процесса — CLAUDE.md п.6 (6а-0, 6а, 6б) и `docs/ui-verification.md`. Не Артём — сама
исполняющая сессия, браузерным MCP.

- [ ] **Шаг 13.1: полный прогон тестов и типов**

`npx tsc --noEmit` чистый, `npm test` зелёный. Зафиксировать фактическое число тестов и сьютов
из вывода — оно пойдёт в CLAUDE.md и backlog (в доках сейчас расходятся 166 и 171 «до» —
записать честное «стало N в M сьютах» по выводу jest, добавилось ~30).

- [ ] **Шаг 13.2: скриншоты и сверка с эталоном (6а)**

`npx expo start --web` → приложение на http://localhost:8081; рядом открыть
`file:///.../docs/design-reference.html` (вкладка «Урок»; ответить на вопрос в макете, чтобы
увидеть эталон финала). Размер 390×844, ОБЕ темы, скриншоты в `docs/screenshots/08/`:
теория, шаг карты (в макете он есть у урока), вопрос до ответа, верный ответ, неверный ответ
(с подсветкой правильного и explain), финал (счётчик+полоса+конфетти), справочник с бейджем,
«Сегодня» с настоящей пилюлей уровня. Каждое расхождение с эталоном — исправить или явно
перечислить в отчёте спеки с причиной (известные осознанные: explain и «ДАЛЕЕ» после ответа,
изображение card-вопроса, Overline «ТЕОРИЯ» — задокументированы в задаче 15 бэклога).

- [ ] **Шаг 13.3: прокликивание (6б)**

- m1l1 целиком: листание теории, все 5 вопросов (и верные, и неверные), финал, CTA → курс,
  узел ✓, m1l2 золотой, автоскролл.
- Повторный вход в пройденный m1l1: финал «+2 XP»; второй повтор в тот же день — «Повторение
  пройдено» без счётчика.
- Выход посреди урока (назад из шапки) → повторный вход: урок с начала, прогресс не записан.
- Смена языка в настройках → вход в урок: теория/вопросы на en; смена языка ПОСРЕДИ урока
  не ломает шаг (тексты вопросов переключаются, индекс шага цел).
- m2l1 (после DEV-прохода М1): шаги карт Дурака и Мага между теорией и викториной; card-вопрос
  с изображением.
- Урок М3 (после DEV-прохода М1–М2): «Урок готовится», завершить нельзя.
- «Сегодня»: открыть карту дня → +5 XP на пилюле; ответ рефлексии (DEV-строка «показать сейчас»)
  → ещё +3; смена ответа → без изменений.
- Консоль браузера: без новых ошибок и warning (артефакты Fast Refresh «X is not defined» —
  перезагрузить страницу и проверить заново).
- Известные веб-отличия (НЕ баги): хаптики нет, системные тени слабее.

- [ ] **Шаг 13.4: отчёт и пуш**

Дописать в `docs/specs/08-lesson-engine.md` раздел «Отчёт о реализации» (что сделано, отклонения,
результаты 6а/6б со ссылками на скриншоты). Коммит + `git push -u origin feat/08-lesson-engine`.

```bash
git add docs/specs/08-lesson-engine.md docs/screenshots/08
git commit -m "docs: отчёт о реализации и веб-проверке (spec 08)"
git push -u origin feat/08-lesson-engine
```

Дальше — лайв-проверка Артёма на iPhone (хаптика трёх видов, конфетти, счётчик, пилюля).
Merge в main — только после неё (правило крупных задач).

---

## Порядок и зависимости

```
1 (ветка) → 2 (контент) → 3 (xp) → 4 (lesson) → 5 (courseProgress) → 6 (стор) → 7 (Sparks)
→ 8 (i18n) → 9 (LessonResult) → 10 (экран) → 11 (бейдж+пилюля) → 12 (доки) → 13 (проверка)
```

Задачи 3–4 независимы между собой; 7–8 независимы от 5–6. Всё остальное — строго по порядку.

## Чего в плане сознательно нет

- Правок `setLessonDone`/`resetCourse` (DEV-строки настроек работают как раньше; XP не трогают).
- Отметки «Изучено» на странице карты, викторин М3+, сохранения шага, карточки уровня в профиле
  (задача 16), ачивок — см. «Что НЕ делаем» спеки.
- Новых npm-пакетов и правок `package.json` / `app.json`.
