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
  // симметричные окна вокруг новолуния (0) и полнолуния (~14.7653), полуширина 0.92 (hf-01/H1)
  it('окно новолуния: до 0.92 суток — новолуние, дальше — растущая', () => {
    expect(moonPhase(at(0.91))).toBe('new');
    expect(moonPhase(at(0.93))).toBe('waxing');
  });

  it('окно полнолуния: нижняя граница ~13.8453 — растущая сменяется полнолунием', () => {
    expect(moonPhase(at(13.84))).toBe('waxing');
    expect(moonPhase(at(13.85))).toBe('full');
  });

  it('окно полнолуния: верхняя граница ~15.6853 — полнолуние сменяется убывающей', () => {
    expect(moonPhase(at(15.68))).toBe('full');
    expect(moonPhase(at(15.69))).toBe('waning');
  });

  it('окно новолуния следующего цикла: граница ~28.6106', () => {
    expect(moonPhase(at(28.6))).toBe('waning');
    expect(moonPhase(at(28.62))).toBe('new');
  });
});

describe('реальные даты (logic-spec §6)', () => {
  // возрасты посчитаны от MOON_EPOCH, сверены с логикой аудита
  it('23.08.2025 06:06 UTC — новолуние', () => {
    expect(moonPhase(new Date(Date.UTC(2025, 7, 23, 6, 6)))).toBe('new');
  });

  it('09.08.2025 08:00 UTC — полнолуние', () => {
    expect(moonPhase(new Date(Date.UTC(2025, 7, 9, 8, 0)))).toBe('full');
  });

  it('28.08.2025 00:00 UTC — растущая', () => {
    expect(moonPhase(new Date(Date.UTC(2025, 7, 28, 0, 0)))).toBe('waxing');
  });

  it('15.08.2025 00:00 UTC — убывающая', () => {
    expect(moonPhase(new Date(Date.UTC(2025, 7, 15, 0, 0)))).toBe('waning');
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
