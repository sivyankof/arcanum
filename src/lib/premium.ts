/** Право Premium и правила «что заперто» (спека 53). Чистый модуль: ни react, ни expo, ни i18n.
 *  Источник правды «что платное» — флаги free в контенте (module.free, spread.free); экраны
 *  сравнивают их ТОЛЬКО через функции отсюда (контракт-тест premiumSources). Само право лежит
 *  в сторе (useApp.premium) и в бэкап не входит — решение 4 спеки. */
import type { CourseModule, Spread } from './content';
import { doneToday, SESSION_MAX, type ReviewDay } from './review';

export type PremiumSource = 'none' | 'dev' | 'store';
export interface PremiumState {
  active: boolean;
  /** откуда право: магазин (53б), DEV-тумблер настроек, нет права */
  source: PremiumSource;
  /** конец оплаченного периода, ISO (53б); у dev/none — null */
  until: string | null;
}
export const PREMIUM_NONE: PremiumState = { active: false, source: 'none', until: null };

/** Бесплатный тренажёр: не больше одной порции в день. Понятия «сессия» у повторения нет
 *  намеренно (спека 45), поэтому считаем карты, покинувшие очередь, — doneCount. */
export const FREE_REVIEW_PER_DAY = SESSION_MAX;

export function moduleLocked(mod: CourseModule, premium: PremiumState): boolean {
  return !mod.free && !premium.active;
}

/** Урок заперт по модулю, в котором лежит. Неизвестный id — не заперт: гейт маршрута
 *  до этого места не дойдёт (чужой id уводит назад раньше). */
export function lessonLocked(lessonId: string, modules: readonly CourseModule[], premium: PremiumState): boolean {
  const mod = modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  return mod !== undefined && moduleLocked(mod, premium);
}

export function spreadLocked(spread: Spread, premium: PremiumState): boolean {
  return !spread.free && !premium.active;
}

export function reviewLeftToday(day: ReviewDay, todayISO: string, premium: PremiumState): number {
  if (premium.active) return Infinity;
  return Math.max(0, FREE_REVIEW_PER_DAY - doneToday(day, todayISO));
}

export function reviewLimitReached(day: ReviewDay, todayISO: string, premium: PremiumState): boolean {
  return reviewLeftToday(day, todayISO, premium) === 0;
}
