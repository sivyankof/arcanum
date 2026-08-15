import { spreads } from '../content';
import { BOARD, boardLayout, isBoard, MINI, miniCells, SPREAD_LAYOUTS } from '../spreadLayout';

describe('SPREAD_LAYOUTS — контракт с spreads.json', () => {
  it('у каждого расклада каталога раскладка ровно на cards позиций', () => {
    for (const s of spreads) expect(SPREAD_LAYOUTS[s.id]).toHaveLength(s.cards);
  });
});

describe('miniCells — мини-схема списка (макет .diag, ячейка 13×20)', () => {
  it('три карты — ряд 0/19/38, как в макете', () => {
    expect(miniCells('three-card')).toEqual([{ left: 0, top: 0 }, { left: 19, top: 0 }, { left: 38, top: 0 }]);
  });
  it('«На отношения» — крест макета: боковые между рядами (y 0.5 → 11), центр колонки 19', () => {
    expect(miniCells('relationship')).toEqual([
      { left: 0, top: 11 }, { left: 38, top: 11 }, { left: 19, top: 0 }, { left: 19, top: 22 }, { left: 19, top: 44 },
    ]);
  });
  it('кельтский крест — координаты макета (пересекающая карта смещена на 6px)', () => {
    const cells = miniCells('celtic-cross');
    expect(cells[0]).toEqual({ left: 14, top: 16 });
    expect(cells[1]).toEqual({ left: 20, top: 16 });
    expect(cells[4]).toEqual({ left: 0, top: 16 });
    expect(cells[9]).toEqual({ left: 44, top: 36 });
  });
  it('подкова — дуга макета', () => {
    expect(miniCells('horseshoe')).toEqual([
      { left: 0, top: 0 }, { left: 6, top: 20 }, { left: 16, top: 32 }, { left: 28, top: 36 },
      { left: 40, top: 32 }, { left: 50, top: 20 }, { left: 56, top: 0 },
    ]);
  });
  it('коробка макета 52×64', () => {
    expect(MINI.boxW).toBe(52);
    expect(MINI.boxH).toBe(64);
  });
});

describe('boardLayout — доска ≤5 карт', () => {
  const AVAIL = 390 - 48; // экран 390 минус два отступа 24

  it('три карты в ряд: карта 88×150, ширина 284, высота карта + подпись', () => {
    const l = boardLayout('three-card', AVAIL);
    expect(l.cardW).toBe(88);
    expect(l.cardH).toBe(150);
    expect(l.width).toBe(284);
    expect(l.height).toBe(150 + BOARD.labelH);
    expect(l.cells.map((c) => c.left)).toEqual([0, 98, 196]);
  });

  it('четыре в ряд не влезают в 342 → карта уменьшается до 78×133 с сохранением пропорции', () => {
    const l = boardLayout('month-ahead', AVAIL);
    expect(l.cardW).toBe(78);
    expect(l.cardH).toBe(133);
    expect(l.width).toBeLessThanOrEqual(AVAIL);
  });

  it('крест «На отношения»: три колонки, три ряда, шаг ряда включает полосу подписи', () => {
    const l = boardLayout('relationship', AVAIL);
    expect(l.width).toBe(284);
    expect(l.height).toBe(2 * (150 + BOARD.labelH) + 150 + BOARD.labelH);
    expect(l.cells[3]).toEqual({ left: 98, top: 150 + BOARD.labelH }); // «Что мешает» — центр
  });

  it('«Выбор из двух»: колонки на 0.2 и 1.8, «Вы» снизу по центру', () => {
    const l = boardLayout('choice', AVAIL);
    expect(l.width).toBeCloseTo(1.8 * 98 + 88, 5);
    expect(l.cells[0]).toEqual({ left: 98, top: 2 * (150 + BOARD.labelH) });
  });

  it('isBoard: до 5 карт — доска, 7 и 10 — лента', () => {
    expect(isBoard(3)).toBe(true);
    expect(isBoard(5)).toBe(true);
    expect(isBoard(7)).toBe(false);
    expect(isBoard(10)).toBe(false);
  });
});
