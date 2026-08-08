/**
 * SRS — интервальное повторение флеш-карт, алгоритм SM-2 (как в Anki).
 * Открытый алгоритм: P.A. Wozniak, SuperMemo-2 (1987).
 *
 * grade: 0 — не вспомнил, 1 — с трудом, 2 — вспомнил, 3 — легко.
 */
export interface SrsState {
  cardId: string;
  reps: number;        // подряд успешных повторений
  intervalDays: number;
  ease: number;        // фактор лёгкости (>= 1.3)
  dueAt: number;       // timestamp следующего показа
}

export function initialSrs(cardId: string, now: number): SrsState {
  return { cardId, reps: 0, intervalDays: 0, ease: 2.5, dueAt: now };
}

export function review(s: SrsState, grade: 0 | 1 | 2 | 3, now: number): SrsState {
  const q = [1, 3, 4, 5][grade]; // маппинг в шкалу SM-2 (0..5)
  let { reps, intervalDays, ease } = s;

  if (q < 3) {
    reps = 0;
    intervalDays = 0; // показать снова в этой же сессии
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const dueAt = now + (intervalDays === 0 ? 10 * 60_000 : intervalDays * 86_400_000);
  return { ...s, reps, intervalDays, ease, dueAt };
}

/** Карты, которые пора повторить (для экрана флеш-карт). */
export function dueCards(states: SrsState[], now: number, limit = 20): SrsState[] {
  return states.filter((s) => s.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt).slice(0, limit);
}
