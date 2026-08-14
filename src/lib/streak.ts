/** Серия и заморозки — чистая арифметика (logic-spec §2, спека 10). Без импортов из expo/react:
 *  стор только применяет результат, как с `completeLessonProgress`.
 *
 *  Модель заморозки: событие серии — ТОЛЬКО открытие карты дня, поэтому и трата ленивая —
 *  в момент следующего открытия, а не «в полночь пропущенного дня» (фоновых задач у офлайн-
 *  приложения нет). Пропущенный день в счёт серии не входит: 5 → пропуск → 6.
 */
import { daysAgoISO, parseISODate } from './dates';

/** Потолок накопления заморозок (logic-spec §2). */
export const FREEZE_MAX = 2;

export interface StreakAdvance {
  streak: number;
  freezes: number;
  /** Заморозка потрачена этим открытием — стору сигнал записать `freezeSpentDate`. */
  freezeSpent: boolean;
}

/** Следующее значение серии при открытии карты. Повтор в тот же день сюда не доходит —
 *  его отсекает guard в `drawToday` (`lastDrawDate === today`). */
export function advanceStreak(
  s: { streak: number; lastDrawDate: string | null; freezes: number },
  todayISO: string,
): StreakAdvance {
  const from = parseISODate(todayISO);
  if (s.lastDrawDate === daysAgoISO(1, from)) {
    return { streak: s.streak + 1, freezes: s.freezes, freezeSpent: false };
  }
  // пропуск РОВНО одного дня и есть запас — заморозка укрывает дыру, серия продолжается
  if (s.lastDrawDate === daysAgoISO(2, from) && s.freezes > 0) {
    return { streak: s.streak + 1, freezes: s.freezes - 1, freezeSpent: true };
  }
  // пропуск 2+ дней спасать нечем — сброс, заморозки целы (logic-spec §2)
  return { streak: 1, freezes: s.freezes, freezeSpent: false };
}

/** Ленивое начисление: «+1 первого числа месяца» наступает при первом открытии приложения
 *  в новом месяце. Пропущенные месяцы доначисляются по одному, потолок общий. */
export function grantFreezes(
  s: { freezes: number; freezeMonth: string | null },
  todayISO: string,
): { freezes: number; freezeMonth: string } {
  const month = todayISO.slice(0, 7);
  // первый запуск с этой механикой: записываем месяц БЕЗ начисления — стартовый запас 1
  // (дефолт стора) и есть «заморозка за текущий месяц» (спека 10, решение 2)
  if (s.freezeMonth === null) return { freezes: s.freezes, freezeMonth: month };
  const passed = monthsBetween(s.freezeMonth, month);
  // 0 — тот же месяц; отрицательное — часы перевели назад: месяц не трогаем,
  // иначе возврат к настоящему времени начислил бы за него второй раз
  if (passed <= 0) return { freezes: s.freezes, freezeMonth: s.freezeMonth };
  return { freezes: Math.min(FREEZE_MAX, s.freezes + passed), freezeMonth: month };
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
