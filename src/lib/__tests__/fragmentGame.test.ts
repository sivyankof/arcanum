import {
  boxEdges, buildFragmentSession, fragmentLayout, sessionScore,
  CARD_RATIO, FRAGMENT_OPTIONS, type FragmentPool,
} from '../fragmentGame';
import { XP_REVIEW } from '../xp';

// детерминированный генератор (LCG) — тест не зависит от Math.random
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pool = (n: number): FragmentPool =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, [
    { cx: 0.3, cy: 0.3, size: 0.3 }, { cx: 0.6, cy: 0.6, size: 0.3 },
  ]]));

describe('buildFragmentSession', () => {
  it('10 вопросов, карта не повторяется, у каждого 4 разных варианта', () => {
    const qs = buildFragmentSession(pool(22), lcg(1));
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.cardId)).size).toBe(10);
    for (const q of qs) expect(new Set(q.options).size).toBe(FRAGMENT_OPTIONS);
  });
  it('correct указывает на карту вопроса при любом сиде (класс дефекта 29/31)', () => {
    for (let seed = 1; seed <= 50; seed++)
      for (const q of buildFragmentSession(pool(22), lcg(seed))) expect(q.options[q.correct]).toBe(q.cardId);
  });
  it('верный ответ не прилипает к одной позиции', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) buildFragmentSession(pool(22), lcg(seed)).forEach((q) => seen.add(q.correct));
    expect(seen.size).toBe(FRAGMENT_OPTIONS);
  });
  it('фрагмент вопроса принадлежит его карте', () => {
    const p = pool(22);
    for (const q of buildFragmentSession(p, lcg(7))) expect(p[q.cardId]).toContain(q.box);
  });
  it('детерминизм: один сид — одна сессия', () => {
    expect(buildFragmentSession(pool(22), lcg(3))).toEqual(buildFragmentSession(pool(22), lcg(3)));
  });
  it('пул меньше размера сессии — вопросов столько, сколько карт; меньше 4 карт — пусто', () => {
    expect(buildFragmentSession(pool(6), lcg(1))).toHaveLength(6);
    expect(buildFragmentSession(pool(3), lcg(1))).toEqual([]);
    expect(buildFragmentSession({}, lcg(1))).toEqual([]);
  });
  it('карта без фрагментов в сессию не попадает', () => {
    const p = { ...pool(5), empty: [] };
    for (let seed = 1; seed <= 20; seed++)
      expect(buildFragmentSession(p, lcg(seed)).some((q) => q.cardId === 'empty')).toBe(false);
  });

  it('фрагмент карты выбирается случайно, а не всегда один и тот же (спека 72, находка F10)', () => {
    // у каждой карты пула ровно 2 бокса — за 150 сидов по 10 вопросов оба обязаны прозвучать
    // хотя бы раз на каждую карту. Мутация «всегда boxes[0]» (или «всегда последний») даёт
    // размер множества индексов 1 и красит проверку — проверено вручную на копии в памяти.
    const p = pool(22);
    const seenIndex: Record<string, Set<number>> = {};
    for (let seed = 1; seed <= 150; seed++) {
      for (const q of buildFragmentSession(p, lcg(seed))) {
        (seenIndex[q.cardId] ??= new Set()).add(p[q.cardId].indexOf(q.box));
      }
    }
    expect(Object.keys(seenIndex).length).toBe(22); // периметр: у сессий побывали все карты пула
    for (const id of Object.keys(seenIndex)) expect(seenIndex[id].size).toBeGreaterThan(1);
  });
});

describe('boxEdges и fragmentLayout', () => {
  it('квадрат в пикселях: высота в долях = size / ratio', () => {
    const e = boxEdges({ cx: 0.5, cy: 0.5, size: 0.4 });
    expect(e.right - e.left).toBeCloseTo(0.4);
    expect(e.bottom - e.top).toBeCloseTo(0.4 / CARD_RATIO);
  });
  it('t = 0: фрагмент заполняет квадрат, центр фрагмента в центре квадрата', () => {
    const r = fragmentLayout({ cx: 0.5, cy: 0.5, size: 0.25 }, 300);
    expect(r.width).toBeCloseTo(1200);
    expect(r.height).toBeCloseTo(1200 * CARD_RATIO);
    expect(r.left + 0.5 * r.width).toBeCloseTo(150);
    expect(r.top + 0.5 * r.height).toBeCloseTo(150);
  });
  it('t = 0: у края скана картинка не оголяет квадрат', () => {
    const r = fragmentLayout({ cx: 0.05, cy: 0.05, size: 0.3 }, 300);
    expect(r.left).toBeLessThanOrEqual(0);
    expect(r.top).toBeLessThanOrEqual(0);
    expect(r.left + r.width).toBeGreaterThanOrEqual(300);
  });

  it('t = 0: у ПРАВОГО/НИЖНЕГО края скана картинка тоже не оголяет квадрат (зеркало предыдущего — иначе клампится только левый/верхний край)', () => {
    const r = fragmentLayout({ cx: 0.95, cy: 0.95, size: 0.3 }, 300);
    expect(r.left).toBeLessThanOrEqual(0);
    expect(r.top).toBeLessThanOrEqual(0);
    expect(r.left + r.width).toBeGreaterThanOrEqual(300);
    expect(r.top + r.height).toBeGreaterThanOrEqual(300);
  });
  it('t = 1: карта целиком вписана по высоте и стоит по центру', () => {
    const r = fragmentLayout({ cx: 0.2, cy: 0.8, size: 0.3 }, 300, CARD_RATIO, 1);
    expect(r.height).toBeCloseTo(300);
    expect(r.width).toBeCloseTo(300 / CARD_RATIO);
    expect(r.top).toBeCloseTo(0);
    expect(r.left).toBeCloseTo((300 - 300 / CARD_RATIO) / 2);
  });
});

describe('sessionScore', () => {
  it('считает верные и XP по XP_REVIEW', () => {
    expect(sessionScore([true, false, true])).toEqual({ right: 2, total: 3, xp: 2 * XP_REVIEW });
    expect(sessionScore([])).toEqual({ right: 0, total: 0, xp: 0 });
  });
});
