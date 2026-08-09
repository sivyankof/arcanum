/** Фаза луны — локальный расчёт без сети (logic-spec §6).
 *
 *  Приложение офлайновое, поэтому фазу считаем по средней длине синодического месяца
 *  от эталонного новолуния. Это упрощение: настоящее новолуние гуляет ±0,5 суток
 *  относительно среднего, но для строки «Растущая луна · 8-й лунный день» точности хватает.
 *
 *  Все функции чистые: принимают момент времени, ничего не читают снаружи и не пишут.
 *  Считаем от точного момента (не от полуночи) — так записано в logic-spec.
 */

/** Эталонное новолуние: 2000-01-06 18:14 UTC. */
export const MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

/** Средняя длина синодического месяца в сутках. */
export const SYNODIC_MONTH = 29.53059;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Полуширина окна главных фаз (новолуние/полнолуние) вокруг точного момента, в сутках
 *  (аудит 09.08, logic-spec §6): старые границы лежали целиком ПОСЛЕ точных моментов, поэтому
 *  в реальное новолуние/полнолуние фаза уже показывала следующую. Симметричные окна это чинят. */
export const HALF_WINDOW = 0.92;

/** Точный момент полнолуния — середина синодического месяца. */
const FULL_MOMENT = SYNODIC_MONTH / 2;

/** Границы фаз в сутках от новолуния, построенные вокруг точек new (0) и full (FULL_MOMENT)
 *  с полушириной HALF_WINDOW в каждую сторону. */
export const PHASE_BOUNDS = {
  waxingStart: HALF_WINDOW,               // ≈0.92
  fullStart: FULL_MOMENT - HALF_WINDOW,   // ≈13.8453
  waningStart: FULL_MOMENT + HALF_WINDOW, // ≈15.6853
  newStart: SYNODIC_MONTH - HALF_WINDOW,  // ≈28.6106
} as const;

export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';

/** Возраст луны в сутках: 0 — новолуние, ~14.8 — полнолуние. Всегда [0, 29.53059). */
export function moonAge(date: Date): number {
  const days = (date.getTime() - MOON_EPOCH) / DAY_MS;
  // остаток по модулю приводим к неотрицательному: даты до 2000 года дали бы минус
  return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
}

/** Фаза по возрасту луны. Окна new/full симметричны вокруг точных моментов (±HALF_WINDOW). */
export function moonPhase(date: Date): MoonPhase {
  const age = moonAge(date);
  if (age < PHASE_BOUNDS.waxingStart || age >= PHASE_BOUNDS.newStart) return 'new';
  if (age < PHASE_BOUNDS.fullStart) return 'waxing';
  if (age < PHASE_BOUNDS.waningStart) return 'full';
  return 'waning';
}

/** Лунный день (1–30): первые сутки после новолуния — день 1. */
export function lunarDay(date: Date): number {
  return Math.floor(moonAge(date)) + 1;
}

/** Всё сразу — чтобы экран считал возраст один раз. */
export function moonInfo(date: Date): { age: number; phase: MoonPhase; day: number } {
  const age = moonAge(date);
  return { age, phase: moonPhase(date), day: Math.floor(age) + 1 };
}
