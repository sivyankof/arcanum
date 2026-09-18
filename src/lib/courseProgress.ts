/** Чистая логика экрана курса (спека 07): состояния узлов пути, прогресс модуля,
 *  x-координаты змейки. Ни одного импорта react/expo — модуль целиком под юнит-тестами. */
import type { CourseLesson, CourseModule } from './content';
import { lessonXp, REPEAT_XP } from './xp';

/** Прогресс одного урока — схема logic-spec §7. В 07 пишется только DEV-строками
 *  настроек, по-настоящему — задача 08 (движок урока). */
export interface LessonProgress {
  done: boolean;
  /** ошибки викторины последнего прохождения; до задачи 08 всегда 0 */
  errors: number;
  /** момент записи, Date.now() */
  ts: number;
  /** дата последнего НАГРАЖДЁННОГО повтора (локальный ISO-день): +2 не чаще раза в день */
  repeatDate?: string;
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

/** id урока-current — для DEV-строки «пройти следующий урок». Производная от lessonStates,
 *  а не вторая копия её правила «первый непройденный»: current у lessonStates ровно один
 *  или ни одного, ровно это утверждение и нужно здесь. null — курс пройден целиком. */
export function nextLessonId(modules: CourseModule[], progress: LessonProgressMap): string | null {
  const states = lessonStates(modules, progress);
  return Object.keys(states).find((id) => states[id] === 'current') ?? null;
}

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

/** Прогресс модуля для шапки: pct — целые проценты, обычное округление. */
export function moduleProgress(
  module: CourseModule,
  progress: LessonProgressMap,
): { done: number; total: number; pct: number } {
  const total = module.lessons.length;
  const done = module.lessons.filter((l) => progress[l.id]?.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Сколько РАЗНЫХ карт разбирается в модуле («N УРОКОВ · M КАРТ»; при 0 счётчик скрывается).
 *  Считаем уникальные id, а не сумму длин: в М2 урок «Повторение» перечисляет все восемь карт
 *  модуля заново, и сумма дала бы «16 КАРТ» там, где эталон показывает «8 КАРТ». */
export function moduleCardCount(module: CourseModule): number {
  return new Set(module.lessons.flatMap((l) => l.cards)).size;
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

/** Впервые изученные карты — вход очереди «момента переворота» в справочнике (спека 46в).
 *  Разница learnedCardIds ДО и ПОСЛЕ записи прогресса: урок-повторение (все карты уже изучены)
 *  и уроки М6 без карт дают пустой результат сами по себе, без отдельной ветки. */
export function newlyLearnedIds(
  modules: CourseModule[],
  before: LessonProgressMap,
  after: LessonProgressMap,
): string[] {
  const prev = learnedCardIds(modules, before);
  return [...learnedCardIds(modules, after)].filter((id) => !prev.has(id));
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
