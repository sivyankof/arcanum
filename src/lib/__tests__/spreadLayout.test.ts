import { spreads } from '../content';
import { BOARD, boardLayout, isBoard, MINI, miniCells, SPREAD_LAYOUTS } from '../spreadLayout';

describe('SPREAD_LAYOUTS — контракт с spreads.json', () => {
  it('у каждого расклада каталога раскладка ровно на cards позиций', () => {
    for (const s of spreads) expect(SPREAD_LAYOUTS[s.id]).toHaveLength(s.cards);
  });
});

describe('miniCells — мини-схема списка (макет .diag, ячейка 13×20)', () => {
  it('«Карта дня» — одна ячейка по центру коробки (макет SPS, pos [19,22])', () => {
    expect(miniCells('card-of-day')).toEqual([{ left: 19, top: 22 }]);
  });
  it('три карты — ряд по центру коробки, top 22 (макет SPS, pos [0,22][19,22][38,22])', () => {
    expect(miniCells('three-card')).toEqual([{ left: 0, top: 22 }, { left: 19, top: 22 }, { left: 38, top: 22 }]);
  });
  it('«На месяц» — четыре ячейки, шаг сжат до 13, чтобы влезть в коробку (макет SPS, pos [0,22]…[39,22])', () => {
    expect(miniCells('month-ahead')).toEqual([
      { left: 0, top: 22 }, { left: 13, top: 22 }, { left: 26, top: 22 }, { left: 39, top: 22 },
    ]);
  });
  it('«На отношения» — крест макета: боковые между рядами (y 0.5 → 11), центр колонки 19', () => {
    expect(miniCells('relationship')).toEqual([
      { left: 0, top: 11 }, { left: 38, top: 11 }, { left: 19, top: 0 }, { left: 19, top: 22 }, { left: 19, top: 44 },
    ]);
  });
  it('«Выбор из двух» — центрируется по ФАКТИЧЕСКОМУ размаху (minX=0.2), а не «от нуля»', () => {
    // До правки minX считался неявно нулём — размах завышался на 0.2·19≈4px, лента уезжала вправо:
    // поля выходили 6/3 вместо честных 4/5 (хуже композиции, чем до правки формулы центровки —
    // регрессия найдена на живой сверке 16.08, не в тестах).
    expect(miniCells('choice')).toEqual([
      { left: 19, top: 44 }, { left: 4, top: 0 }, { left: 4, top: 22 }, { left: 34, top: 0 }, { left: 34, top: 22 },
    ]);
  });
  it('кельтский крест — сжат и центрирован, влезает в коробку (решение владельца 16.08, было по макету 14/16)', () => {
    const cells = miniCells('celtic-cross');
    expect(cells[0]).toEqual({ left: 12, top: 20 });
    expect(cells[1]).toEqual({ left: 17, top: 20 });
    expect(cells[4]).toEqual({ left: 0, top: 20 });
    expect(cells[9]).toEqual({ left: 37, top: 40 });
  });
  it('подкова — сжата и центрирована, влезает в коробку (решение владельца 16.08, было по макету — вылезала вправо)', () => {
    expect(miniCells('horseshoe')).toEqual([
      { left: 0, top: 4 }, { left: 4, top: 24 }, { left: 11, top: 36 }, { left: 19, top: 40 },
      { left: 27, top: 36 }, { left: 34, top: 24 }, { left: 38, top: 4 },
    ]);
  });
  it('коробка макета 52×64', () => {
    expect(MINI.boxW).toBe(52);
    expect(MINI.boxH).toBe(64);
  });
  it('инвариант: ЛЮБАЯ мини-схема каталога влезает в коробку и центрирована (правило одно, без исключений)', () => {
    for (const id of Object.keys(SPREAD_LAYOUTS)) {
      const cells = miniCells(id);
      const maxLeft = Math.max(...cells.map((c) => c.left));
      const maxTop = Math.max(...cells.map((c) => c.top));
      expect(maxLeft + MINI.cellW).toBeLessThanOrEqual(MINI.boxW);
      expect(maxTop + MINI.cellH).toBeLessThanOrEqual(MINI.boxH);
    }
  });
  it('инвариант: мини-схема отцентрирована — поля слева/справа и сверху/снизу не расходятся сильнее округления формулы', () => {
    // Порог 2px — не «на глаз», а верхняя граница самой формулы `miniCells`: offX/offY считаются
    // через `Math.floor(slack / 2)`, и когда размах·шаг — не целое число (кельтский крест:
    // 2.316·16 = 37.056), дробный остаток слака достаётся флором целиком одной стороне — поля
    // получаются 0/2, это НЕ регрессия и владелец уже принял такую мини-схему на живой сверке
    // 16.08. Задача проверки — ловить содержательный перекос вроде бага «Выбора из двух»
    // (там разница полей была 3, а не 1–2 от округления), а не гонять формулу за пикселем,
    // которого она математически не обещает.
    const MAX_CENTER_DRIFT = 2;
    for (const id of Object.keys(SPREAD_LAYOUTS)) {
      const cells = miniCells(id);
      const left = Math.min(...cells.map((c) => c.left));
      const right = MINI.boxW - (Math.max(...cells.map((c) => c.left)) + MINI.cellW);
      const top = Math.min(...cells.map((c) => c.top));
      const bottom = MINI.boxH - (Math.max(...cells.map((c) => c.top)) + MINI.cellH);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(MAX_CENTER_DRIFT);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(MAX_CENTER_DRIFT);
    }
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
