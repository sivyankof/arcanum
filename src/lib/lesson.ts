/** Движок урока (спека 08): нарезка шагов и перемешивание вариантов. Чистые функции без
 *  импортов react/expo — целиком под юнит-тестами. Состояние прохождения (текущий шаг, ошибки)
 *  живёт в экране: product-spec §2 — выход из урока прогресс шага не сохраняет. */
import type { CourseLesson, Lang, QuizQuestion } from './content';
import type { CanonLang } from './lang';

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
  // theory — CardContentBlock, хранит только ru/en (es/pt появятся с переводами, задача 28)
  for (const text of theoryPages(lesson.theory?.[lang as CanonLang] ?? '')) steps.push({ kind: 'theory', text });
  for (const cardId of lesson.cards) steps.push({ kind: 'card', cardId });
  for (const q of lesson.quiz ?? []) steps.push({ kind: 'quiz', question: shuffleOptions(q, rng) });
  return steps;
}
