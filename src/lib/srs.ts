/**
 * SRS — интервальное повторение флеш-карт, алгоритм SM-2 (P.A. Wozniak, SuperMemo-2, 1987;
 * открытый алгоритм). Спека 45, logic-spec §12. Чистый модуль без импортов react/expo.
 *
 * Оценки: 0 — не помню, 1 — с трудом (кнопки в UI v1 нет, оставлена под будущий режим-викторину),
 * 2 — помню, 3 — легко. Расписание ведётся по ЛОКАЛЬНЫМ ДНЯМ, а не по времени суток: оценка
 * в 23:00 даёт «завтра» = следующий календарный день — иначе утром очередь была бы пуста,
 * а вечером полна.
 */
import { plusDaysISO } from './dates';

export type SrsGrade = 0 | 1 | 2 | 3;

export interface SrsState {
  /** подряд успешных повторений; «не помню» сбрасывает в 0 */
  reps: number;
  intervalDays: number;
  /** фактор лёгкости SM-2, EASE_MIN..EASE_MAX */
  ease: number;
  /** день следующего показа, YYYY-MM-DD локально; due <= сегодня — карта к повторению */
  due: string;
}

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 5;
export const MAX_INTERVAL_DAYS = 365;

/** Оценка → шкала SM-2 (0..5): «не помню» — полный провал (1), дальше 3 / 4 / 5. */
const SM2_QUALITY: Record<SrsGrade, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };

export function isDue(s: SrsState, todayISO: string): boolean {
  return s.due <= todayISO;
}

/** Новое состояние карты после оценки. prev === undefined — карта повторяется впервые.
 *  Интервал: 1 → 6 → round(prev × ease) (ease ДО обновления), потолок MAX_INTERVAL_DAYS;
 *  «не помню» → reps 0, интервал 0, due = сегодня (карта вернётся в конец сессии).
 *  ease обновляется при любой оценке (оригинальный SM-2), в коридоре EASE_MIN..EASE_MAX. */
export function reviewState(prev: SrsState | undefined, grade: SrsGrade, todayISO: string): SrsState {
  const q = SM2_QUALITY[grade];
  const base: SrsState = prev ?? { reps: 0, intervalDays: 0, ease: EASE_START, due: todayISO };
  let reps = base.reps;
  let intervalDays = base.intervalDays;
  if (q < 3) {
    reps = 0;
    intervalDays = 0;
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * base.ease);
    intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
  }
  const raw = base.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const ease = Math.min(EASE_MAX, Math.max(EASE_MIN, raw));
  return { reps, intervalDays, ease, due: plusDaysISO(todayISO, intervalDays) };
}
