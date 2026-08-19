import { EASE_MAX, EASE_MIN, EASE_START, isDue, MAX_INTERVAL_DAYS, reviewState, type SrsState } from '../srs';

const T = '2026-08-19';

describe('reviewState — SM-2 по локальным дням (спека 45, logic-spec §12)', () => {
  it('новая карта, «помню» (2): reps 1, интервал 1, due завтра, ease не меняется', () => {
    const s = reviewState(undefined, 2, T);
    expect(s).toEqual({ reps: 1, intervalDays: 1, ease: EASE_START, due: '2026-08-20' });
  });
  it('лестница 1 → 6 → round(6 × ease) при трёх «помню» подряд', () => {
    const s1 = reviewState(undefined, 2, T);
    const s2 = reviewState(s1, 2, s1.due);
    const s3 = reviewState(s2, 2, s2.due);
    expect(s2.intervalDays).toBe(6);
    expect(s2.due).toBe('2026-08-26');
    expect(s3.reps).toBe(3);
    expect(s3.intervalDays).toBe(15);
    expect(s3.due).toBe('2026-09-10');
  });
  it('ease по четырём оценкам от 2.5: 3 → +0.10, 2 → 0, 1 → −0.14, 0 → −0.54', () => {
    expect(reviewState(undefined, 3, T).ease).toBeCloseTo(2.6, 6);
    expect(reviewState(undefined, 2, T).ease).toBeCloseTo(2.5, 6);
    expect(reviewState(undefined, 1, T).ease).toBeCloseTo(2.36, 6);
    expect(reviewState(undefined, 0, T).ease).toBeCloseTo(1.96, 6);
  });
  it('«легко» у новой карты — тот же 1 день (без easy-bonus), отличие только в ease', () => {
    const s = reviewState(undefined, 3, T);
    expect(s.intervalDays).toBe(1);
    expect(s.due).toBe('2026-08-20');
  });
  it('«с трудом» (1) — засчитано: reps растёт, интервал по лестнице', () => {
    expect(reviewState(undefined, 1, T)).toMatchObject({ reps: 1, intervalDays: 1, due: '2026-08-20' });
  });
  it('«не помню» после длинного интервала: reps 0, интервал 0, due = сегодня, ease упал', () => {
    const prev: SrsState = { reps: 5, intervalDays: 60, ease: 2.8, due: T };
    const s = reviewState(prev, 0, T);
    expect(s).toEqual({ reps: 0, intervalDays: 0, ease: expect.closeTo(2.26, 6), due: T });
  });
  it('интервал считается по ease ДО обновления', () => {
    const prev: SrsState = { reps: 2, intervalDays: 6, ease: 2.0, due: T };
    // «легко»: интервал round(6 × 2.0) = 12, а не round(6 × 2.1)
    expect(reviewState(prev, 3, T).intervalDays).toBe(12);
  });
  it('пол ease 1.3 и потолки: ease 5, интервал 365', () => {
    const low: SrsState = { reps: 0, intervalDays: 0, ease: EASE_MIN, due: T };
    expect(reviewState(low, 0, T).ease).toBe(EASE_MIN);
    const high: SrsState = { reps: 3, intervalDays: 10, ease: EASE_MAX, due: T };
    expect(reviewState(high, 3, T).ease).toBe(EASE_MAX);
    const long: SrsState = { reps: 9, intervalDays: 300, ease: 2.5, due: T };
    const s = reviewState(long, 2, T);
    expect(s.intervalDays).toBe(MAX_INTERVAL_DAYS);
    expect(s.due).toBe('2027-08-19');
  });
  it('due переходит через месяц и год', () => {
    const s = reviewState({ reps: 1, intervalDays: 1, ease: 2.5, due: '2026-12-30' }, 2, '2026-12-30');
    expect(s.due).toBe('2027-01-05');
  });
});

describe('isDue', () => {
  const s = (due: string): SrsState => ({ reps: 1, intervalDays: 1, ease: 2.5, due });
  it('вчера и сегодня — к повторению, завтра — нет', () => {
    expect(isDue(s('2026-08-18'), T)).toBe(true);
    expect(isDue(s(T), T)).toBe(true);
    expect(isDue(s('2026-08-20'), T)).toBe(false);
  });
});
