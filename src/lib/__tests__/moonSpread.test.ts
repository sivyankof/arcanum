/** Окно доступности лунного расклада (спека 51). Синтетические события собираются ЛОКАЛЬНЫМ
 *  конструктором Date, иначе тест зависел бы от часового пояса машины; ожидания — литералы,
 *  а не вызов проверяемой функции (урок 47б: иначе тест становится тавтологией). */
import type { EventSource, MoonEvent, MoonEventKind } from '../moon';
import { isMoonWindowOpen, moonSpreadState } from '../moonSpread';

/** Источник, уважающий границы периода, — как настоящий moonEvents (полуинтервал [from, to)). */
const sourceOf =
  (events: Array<[MoonEventKind, Date]>): EventSource =>
  (from, to) =>
    events
      .filter(([, at]) => at.getTime() >= from.getTime() && at.getTime() < to.getTime())
      .map(([kind, at]): MoonEvent => ({ kind, at }));

// новолуние 12 августа 2026, 21:36 местного времени
const NEW_AUG = new Date(2026, 7, 12, 21, 36);
const src = sourceOf([['new', NEW_AUG], ['new', new Date(2026, 8, 11, 10, 0)], ['full', new Date(2026, 7, 28, 8, 18)]]);

describe('moonSpreadState — окно события', () => {
  it('в день события окно открыто', () => {
    const s = moonSpreadState('new', new Date(2026, 7, 12, 9, 0), src);
    expect(s).toEqual({ kind: 'new', at: NEW_AUG, open: true });
  });

  it('за сутки до события окно уже открыто', () => {
    expect(moonSpreadState('new', new Date(2026, 7, 11, 0, 1), src)?.open).toBe(true);
  });

  it('через сутки после события окно ещё открыто', () => {
    expect(moonSpreadState('new', new Date(2026, 7, 13, 23, 59), src)?.open).toBe(true);
  });

  it('за двое суток до события окно закрыто, at указывает на это событие', () => {
    const s = moonSpreadState('new', new Date(2026, 7, 10, 12, 0), src);
    expect(s).toEqual({ kind: 'new', at: NEW_AUG, open: false });
  });

  it('через двое суток после события окно закрыто, at указывает на СЛЕДУЮЩЕЕ событие', () => {
    const s = moonSpreadState('new', new Date(2026, 7, 14, 12, 0), src);
    expect(s?.open).toBe(false);
    expect(s?.at).toEqual(new Date(2026, 8, 11, 10, 0));
  });

  it('вид события не путается: полнолуние своё окно, новолуние своё', () => {
    const at28 = new Date(2026, 7, 28, 12, 0);
    expect(moonSpreadState('full', at28, src)?.open).toBe(true);
    expect(moonSpreadState('new', at28, src)?.open).toBe(false);
  });

  it('пустой источник — null, а не выдуманная дата', () => {
    expect(moonSpreadState('new', new Date(2026, 7, 12), sourceOf([]))).toBeNull();
  });
});

describe('isMoonWindowOpen — окно КОНКРЕТНОГО события', () => {
  it('день события и сутки по обе стороны — открыто', () => {
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 11, 0, 1))).toBe(true);
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 12, 12, 0))).toBe(true);
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 13, 23, 59))).toBe(true);
  });
  it('двое суток в любую сторону — закрыто', () => {
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 10, 23, 59))).toBe(false);
    expect(isMoonWindowOpen(NEW_AUG, new Date(2026, 7, 14, 0, 1))).toBe(false);
  });
});

describe('moonSpreadState — источник по умолчанию (без инъекции)', () => {
  // Все девять тестов выше подсовывают синтетический источник — дефолт `source = moonEvents`
  // (настоящая астрономия) остаётся ничем не проверенным: подмени его на пустой источник, и оба
  // лунных расклада навсегда закрылись бы в приложении, а сьют остался бы зелёным. Опорный момент —
  // из src/lib/__tests__/moon.test.ts (сверен с USNO 20.08, допуск тот же), не выдуман.
  const NEW_AUG_2026_UTC = new Date('2026-08-12T17:37Z');
  const TOLERANCE_MIN = 2;

  it('реальное новолуние 12 августа 2026: окно открыто, at рядом с эфемеридой', () => {
    // «сейчас» = сам момент события (абсолютный instant) — сравнение TZ-независимо, в отличие
    // от подбора «локального полудня»: тест не должен зависеть от часового пояса машины.
    const now = new Date(NEW_AUG_2026_UTC.getTime());
    const s = moonSpreadState('new', now);
    expect(s?.open).toBe(true);
    const diffMin = s ? Math.abs(s.at.getTime() - NEW_AUG_2026_UTC.getTime()) / 60000 : Infinity;
    expect(diffMin).toBeLessThan(TOLERANCE_MIN);
  });
});
