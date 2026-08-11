import { BAR_DEAD, BAR_DEPTH, nextBarShown } from '../scrollAware';

/** Базовое состояние: пользователь на глубине, панель спрятана, поле не в фокусе. */
const at = (y: number, lastY: number, over: Partial<{ shown: boolean; focused: boolean }> = {}) =>
  nextBarShown({ y, lastY, shown: false, focused: false, ...over });

describe('nextBarShown', () => {
  it('у верха списка панель спрятана, даже если жест был вверх', () => {
    expect(at(40, 200)).toBe(false);
    expect(at(0, 100, { shown: true })).toBe(false);
  });

  it('отрицательное смещение (bounce на iOS) не показывает панель', () => {
    expect(at(-60, 10, { shown: true })).toBe(false);
  });

  it('ровно на пороге глубина уже считается глубиной', () => {
    // y = BAR_DEPTH − 1 — это ещё «верх», y = BAR_DEPTH — уже глубина
    expect(at(BAR_DEPTH - 1, BAR_DEPTH + 100)).toBe(false);
    expect(at(BAR_DEPTH, BAR_DEPTH + 100)).toBe(true);
  });

  it('жест вверх на глубине показывает панель', () => {
    expect(at(300, 400)).toBe(true);
  });

  it('жест вниз на глубине прячет панель', () => {
    expect(at(400, 300, { shown: true })).toBe(false);
  });

  it('сдвиг в пределах мёртвой зоны сохраняет прежнее состояние', () => {
    expect(at(300, 300 + BAR_DEAD, { shown: true })).toBe(true);
    expect(at(300, 300 + BAR_DEAD, { shown: false })).toBe(false);
    expect(at(300, 300 - BAR_DEAD, { shown: true })).toBe(true);
    expect(at(300, 300 - BAR_DEAD, { shown: false })).toBe(false);
  });

  it('фокус в поле панели перевешивает любые правила скролла', () => {
    expect(at(0, 0, { focused: true })).toBe(true);
    expect(at(400, 300, { focused: true })).toBe(true);
  });
});
