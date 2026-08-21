/** Ступень мастерства карты по SRS-записи (спека 49). Кейс на КАЖДУЮ границу порогов. */
import { masteryLevel } from '../mastery';
import { reviewState, type SrsState } from '../srs';

const st = (intervalDays: number): SrsState => ({ reps: 1, intervalDays, ease: 2.5, due: '2026-08-22' });

describe('masteryLevel', () => {
  test('записи нет — НОВАЯ (1): изучена уроком, ещё не повторялась', () => {
    expect(masteryLevel(undefined)).toBe(1);
  });
  test('интервал 0 (после провала) — ЗНАКОМАЯ (2), не НОВАЯ: запись есть, карта в работе', () => {
    expect(masteryLevel(st(0))).toBe(2);
  });
  test('границы ЗНАКОМОЙ: 1 и 5', () => {
    expect(masteryLevel(st(1))).toBe(2);
    expect(masteryLevel(st(5))).toBe(2);
  });
  test('границы УВЕРЕННОЙ: 6 и 20', () => {
    expect(masteryLevel(st(6))).toBe(3);
    expect(masteryLevel(st(20))).toBe(3);
  });
  test('границы МАСТЕРА: 21 и потолок 365', () => {
    expect(masteryLevel(st(21))).toBe(4);
    expect(masteryLevel(st(365))).toBe(4);
  });
  test('МАСТЕР после «не помню» падает до ЗНАКОМОЙ — сквозь настоящий reviewState', () => {
    const master = st(30);
    expect(masteryLevel(master)).toBe(4);
    expect(masteryLevel(reviewState(master, 0, '2026-08-21'))).toBe(2);
  });
});
