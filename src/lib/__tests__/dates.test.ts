/** Тесты локальных границ дня (hf-01/H2). Все кейсы строятся из локальных компонентов
 *  (new Date(year, month, day, ...)), поэтому результат не зависит от часового пояса машины,
 *  на которой гоняются тесты, — как и сам контракт localDateISO/daysAgoISO. */
import { daysAgoISO, localDateISO, parseISODate } from '../dates';

describe('localDateISO', () => {
  it('сразу после полуночи — сегодняшняя дата', () => {
    expect(localDateISO(new Date(2026, 7, 9, 0, 0, 1))).toBe('2026-08-09');
  });

  it('в 23:59:59 — всё ещё тот же день', () => {
    expect(localDateISO(new Date(2026, 7, 9, 23, 59, 59))).toBe('2026-08-09');
  });

  it('паддинг нулями для месяца и дня', () => {
    expect(localDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('daysAgoISO', () => {
  it('переход через границу месяца: 1 марта минус 1 сутки — 28 февраля', () => {
    expect(daysAgoISO(1, new Date(2026, 2, 1))).toBe('2026-02-28');
  });

  it('високосный год: 1 марта минус 1 сутки — 29 февраля', () => {
    expect(daysAgoISO(1, new Date(2024, 2, 1))).toBe('2024-02-29');
  });

  it('переход через границу года: 1 января минус 1 сутки — 31 декабря', () => {
    expect(daysAgoISO(1, new Date(2026, 0, 1))).toBe('2025-12-31');
  });

  it('обычный случай внутри месяца: минус 7 суток', () => {
    expect(daysAgoISO(7, new Date(2026, 7, 9))).toBe('2026-08-02');
  });
});

describe('parseISODate', () => {
  it('строка разбирается по локальной полуночи, а не по UTC', () => {
    const d = parseISODate('2026-08-11');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 11]);
  });

  it('обратное преобразование не теряет день', () => {
    expect(localDateISO(parseISODate('2026-01-05'))).toBe('2026-01-05');
  });
});
