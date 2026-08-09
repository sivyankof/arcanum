/** Тесты фазы луны — кейсы из logic-spec §6 и спеки 01 (остаток 2).
 *  Все моменты отсчитываем от эталонного новолуния, поэтому результат не зависит
 *  ни от текущей даты, ни от часового пояса машины. */
import { MOON_EPOCH, moonAge, moonInfo, moonPhase, lunarDay, SYNODIC_MONTH } from '../moon';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Момент «эпоха + N суток». */
const at = (days: number) => new Date(MOON_EPOCH + days * DAY_MS);

describe('moonPhase', () => {
  it('в момент эпохи — новолуние, первый лунный день', () => {
    expect(moonPhase(at(0))).toBe('new');
    expect(lunarDay(at(0))).toBe(1);
    expect(moonAge(at(0))).toBeCloseTo(0, 6);
  });

  it('через 2 суток — растущая', () => {
    expect(moonPhase(at(2))).toBe('waxing');
    expect(lunarDay(at(2))).toBe(3);
  });

  it('через 15 суток — полнолуние', () => {
    expect(moonPhase(at(15))).toBe('full');
    expect(lunarDay(at(15))).toBe(16);
  });

  it('через 17 суток — убывающая', () => {
    expect(moonPhase(at(17))).toBe('waning');
    expect(lunarDay(at(17))).toBe(18);
  });

  it('через 29.6 суток — новолуние нового цикла, снова первый день', () => {
    expect(moonPhase(at(29.6))).toBe('new');
    expect(lunarDay(at(29.6))).toBe(1);
  });
});

describe('границы фаз', () => {
  it('порог 1.85: до него новолуние, после — растущая', () => {
    expect(moonPhase(at(1.84))).toBe('new');
    expect(moonPhase(at(1.86))).toBe('waxing');
  });

  it('порог 14.77: до него растущая, после — полнолуние', () => {
    expect(moonPhase(at(14.76))).toBe('waxing');
    expect(moonPhase(at(14.78))).toBe('full');
  });

  it('порог 16.61: до него полнолуние, после — убывающая', () => {
    expect(moonPhase(at(16.6))).toBe('full');
    expect(moonPhase(at(16.62))).toBe('waning');
  });
});

describe('moonAge', () => {
  it('всегда лежит в пределах одного синодического месяца', () => {
    for (const days of [0, 5, 29.5, 40, 400, 10000]) {
      const age = moonAge(at(days));
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(SYNODIC_MONTH);
    }
  });

  it('для дат до эпохи остаток положительный (без отрицательного модуля)', () => {
    // за сутки до эталонного новолуния луна «стареет» на 28.53 суток предыдущего цикла
    expect(moonAge(at(-1))).toBeCloseTo(SYNODIC_MONTH - 1, 6);
    expect(moonPhase(at(-1))).toBe('waning');
    expect(lunarDay(at(-1))).toBe(29);
  });

  it('цикл повторяется: +1 месяц даёт тот же возраст', () => {
    expect(moonAge(at(7))).toBeCloseTo(moonAge(at(7 + SYNODIC_MONTH)), 5);
  });
});

describe('moonInfo', () => {
  it('возвращает согласованные возраст, фазу и день', () => {
    const info = moonInfo(at(15));
    expect(info.phase).toBe('full');
    expect(info.day).toBe(16);
    expect(info.age).toBeCloseTo(15, 6);
  });
});
