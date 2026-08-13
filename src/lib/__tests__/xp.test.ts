import { lessonXp, levelFromXp, reflectXp, REPEAT_XP, XP_DRAW, XP_REFLECT } from '../xp';

describe('lessonXp — 10 − 2×ошибки, минимум 4 (logic-spec §4)', () => {
  it.each([
    [0, 10], [1, 8], [2, 6], [3, 4], [4, 4], [10, 4],
  ])('%i ошибок → %i XP', (errors, expected) => {
    expect(lessonXp(errors)).toBe(expected);
  });
});

describe('reflectXp — +3 только за первый ответ рефлексии дня (logic-spec §4)', () => {
  it('первый ответ (prevOutcome не задан) → XP_REFLECT', () => {
    expect(reflectXp(undefined)).toBe(XP_REFLECT);
  });

  it('смена уже данного ответа → 0', () => {
    expect(reflectXp('yes')).toBe(0);
    expect(reflectXp('partly')).toBe(0);
    expect(reflectXp('no')).toBe(0);
  });
});

describe('levelFromXp — пороги 0/50/150/300/500, дальше +250', () => {
  it.each([
    [0, 1], [49, 1], [50, 2], [149, 2], [150, 3], [299, 3], [300, 4], [499, 4],
    [500, 5], [749, 5], [750, 6], [999, 6], [1000, 7], [1250, 8],
  ])('%i XP → уровень %i', (xp, level) => {
    expect(levelFromXp(xp).level).toBe(level);
  });

  it('progress — доля пути до следующего уровня, 0..1', () => {
    expect(levelFromXp(0).progress).toBe(0);
    expect(levelFromXp(25).progress).toBeCloseTo(0.5); // 0..50
    expect(levelFromXp(100).progress).toBeCloseTo(0.5); // 50..150
    expect(levelFromXp(625).progress).toBeCloseTo(0.5); // 500..750
    expect(levelFromXp(500).progress).toBe(0);
  });

  it('константы источников XP на месте (logic-spec §4)', () => {
    expect(XP_DRAW).toBe(5);
    expect(XP_REFLECT).toBe(3);
    expect(REPEAT_XP).toBe(2);
  });
});
