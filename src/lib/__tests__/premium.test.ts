/** Правила Premium (спека 53): заперто ⟺ контент не free И права нет. Фикстуры синтетические —
 *  тест не зависит от того, какие модули/расклады free в контенте сегодня. */
import type { CourseModule, Spread } from '../content';
import {
  FREE_REVIEW_PER_DAY,
  lessonLocked,
  moduleLocked,
  PREMIUM_NONE,
  reviewLeftToday,
  reviewLimitReached,
  spreadLocked,
  type PremiumState,
} from '../premium';
import { REVIEW_DAY_DEFAULT, SESSION_MAX } from '../review';

const ACTIVE: PremiumState = { active: true, source: 'dev', until: null };
const mod = (id: string, free: boolean, lessons: string[]): CourseModule =>
  ({ id, free, title: { ru: id, en: id }, lessons: lessons.map((l) => ({ id: l, title: { ru: l, en: l }, cards: [] })) }) as unknown as CourseModule;
const MODS = [mod('m1', true, ['m1l1', 'm1l2']), mod('m3', false, ['m3l1'])];
const spread = (free: boolean): Spread =>
  ({ id: 's', free, cards: 3, name: { ru: 's', en: 's' }, description: { ru: '', en: '' }, positions: [] }) as unknown as Spread;

describe('модули и уроки', () => {
  it('free-модуль открыт всегда, premium — только с правом', () => {
    expect(moduleLocked(MODS[0], PREMIUM_NONE)).toBe(false);
    expect(moduleLocked(MODS[1], PREMIUM_NONE)).toBe(true);
    expect(moduleLocked(MODS[1], ACTIVE)).toBe(false);
  });
  it('урок заперт по своему модулю; чужой id — не заперт (гейт его не знает, маршрут сам уйдёт назад)', () => {
    expect(lessonLocked('m1l2', MODS, PREMIUM_NONE)).toBe(false);
    expect(lessonLocked('m3l1', MODS, PREMIUM_NONE)).toBe(true);
    expect(lessonLocked('m3l1', MODS, ACTIVE)).toBe(false);
    expect(lessonLocked('zzz', MODS, PREMIUM_NONE)).toBe(false);
  });
});

describe('расклады', () => {
  it('заперт ⟺ не free и права нет', () => {
    expect(spreadLocked(spread(true), PREMIUM_NONE)).toBe(false);
    expect(spreadLocked(spread(false), PREMIUM_NONE)).toBe(true);
    expect(spreadLocked(spread(false), ACTIVE)).toBe(false);
  });
});

describe('лимит тренажёра', () => {
  const T = '2026-08-22';
  it('лимит равен размеру порции', () => {
    expect(FREE_REVIEW_PER_DAY).toBe(SESSION_MAX);
  });
  it('9 сделано → осталась 1; 10 → 0 и лимит достигнут', () => {
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 9 }, T, PREMIUM_NONE)).toBe(1);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 9 }, T, PREMIUM_NONE)).toBe(false);
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 10 }, T, PREMIUM_NONE)).toBe(0);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 10 }, T, PREMIUM_NONE)).toBe(true);
  });
  it('сделано больше лимита (право включили и выключили в тот же день) → 0, не отрицательное', () => {
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 12 }, T, PREMIUM_NONE)).toBe(0);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 12 }, T, PREMIUM_NONE)).toBe(true);
  });
  it('вчерашний счётчик не считается', () => {
    expect(reviewLeftToday({ date: '2026-08-21', newCount: 0, doneCount: 10 }, T, PREMIUM_NONE)).toBe(FREE_REVIEW_PER_DAY);
  });
  it('с правом лимита нет', () => {
    expect(reviewLeftToday({ date: T, newCount: 0, doneCount: 99 }, T, ACTIVE)).toBe(Infinity);
    expect(reviewLimitReached({ date: T, newCount: 0, doneCount: 99 }, T, ACTIVE)).toBe(false);
    expect(reviewLimitReached(REVIEW_DAY_DEFAULT, T, PREMIUM_NONE)).toBe(false);
  });
});
