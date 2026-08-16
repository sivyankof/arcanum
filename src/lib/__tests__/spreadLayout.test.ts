import { spreads } from '../content';
import { BOARD, boardLayout, isBoard, MINI, miniCells, Pt, SPREAD_LAYOUTS } from '../spreadLayout';

describe('SPREAD_LAYOUTS — контракт с spreads.json', () => {
  it('у каждого расклада каталога раскладка ровно на cards позиций', () => {
    for (const s of spreads) expect(SPREAD_LAYOUTS[s.id]).toHaveLength(s.cards);
  });
});

/** Эмпирический шаг вдоль оси, измеренный ПО КООРДИНАТАМ на выходе `miniCells` (не по внутренним
 *  переменным формулы — так проверка не верит реализации на слово). Берётся пара точек
 *  с максимальным |Δ| по этой оси — так относительная погрешность округления минимальна.
 *  null, если у раскладки нет пары точек с ненулевой разницей по этой оси (одномерная раскладка). */
function actualStep(pts: Pt[], cells: { left: number; top: number }[], axis: 'x' | 'y'): number | null {
  let best: { d: number; step: number } | null = null;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = axis === 'x' ? pts[j].x - pts[i].x : pts[j].y - pts[i].y;
      if (d === 0) continue;
      const pd = axis === 'x' ? cells[j].left - cells[i].left : cells[j].top - cells[i].top;
      const step = pd / d;
      if (best === null || Math.abs(d) > Math.abs(best.d)) best = { d, step };
    }
  }
  return best ? best.step : null;
}

describe('miniCells — мини-схема списка (макет .diag, ячейка 13×20)', () => {
  it('«Карта дня» — одна ячейка по центру коробки (макет SPS, pos [19,22]), масштаб не нужен', () => {
    const l = miniCells('card-of-day');
    expect(l.cells).toEqual([{ left: 19, top: 22 }]);
    expect(l.cellW).toBe(13);
    expect(l.cellH).toBe(20);
  });
  it('три карты — ряд по центру коробки, top 22 (макет SPS, pos [0,22][19,22][38,22]), масштаб не нужен', () => {
    const l = miniCells('three-card');
    expect(l.cells).toEqual([{ left: 0, top: 22 }, { left: 19, top: 22 }, { left: 38, top: 22 }]);
    expect(l.cellW).toBe(13);
    expect(l.cellH).toBe(20);
  });
  it('«На месяц» — размах 70 больше коробки 52, схема масштабируется целиком (scale≈0.743): ячейка 10×15, шаг ≈14, зазоры вместо «впритык»', () => {
    // Решение владельца 16.08: в макете 4 карты стоят впритык ячейкой 13 (и вылезают за коробку
    // на 18px) — здесь расхождение с макетом осознанное, аккуратная коробка важнее копии композиции.
    const l = miniCells('month-ahead');
    expect(l.cells).toEqual([{ left: 0, top: 24 }, { left: 14, top: 24 }, { left: 28, top: 24 }, { left: 42, top: 24 }]);
    expect(l.cellW).toBe(10);
    expect(l.cellH).toBe(15);
  });
  it('«На отношения» — крест макета: боковые между рядами (y 0.5 → 11), центр колонки 19, масштаб не нужен (размах уже влезает)', () => {
    const l = miniCells('relationship');
    expect(l.cells).toEqual([
      { left: 0, top: 11 }, { left: 38, top: 11 }, { left: 19, top: 0 }, { left: 19, top: 22 }, { left: 19, top: 44 },
    ]);
    expect(l.cellW).toBe(13);
    expect(l.cellH).toBe(20);
  });
  it('«Выбор из двух» — центрируется по ФАКТИЧЕСКОМУ размаху (minX=0.2), а не «от нуля», масштаб не нужен', () => {
    // До правки minX считался неявно нулём — размах завышался на 0.2·19≈4px, лента уезжала вправо:
    // поля выходили 6/3 вместо честных 4/5 (регрессия найдена на живой сверке 16.08, не в тестах).
    const l = miniCells('choice');
    expect(l.cells).toEqual([
      { left: 19, top: 44 }, { left: 4, top: 0 }, { left: 4, top: 22 }, { left: 34, top: 0 }, { left: 34, top: 22 },
    ]);
    expect(l.cellW).toBe(13);
    expect(l.cellH).toBe(20);
  });
  it('кельтский крест — размах 57 больше коробки 52, схема масштабируется целиком (scale≈0.912): ячейка 12×18, крест сохраняет пропорции', () => {
    const l = miniCells('celtic-cross');
    expect(l.cells).toEqual([
      { left: 13, top: 21 }, { left: 18, top: 21 }, { left: 13, top: 6 }, { left: 13, top: 37 },
      { left: 0, top: 21 }, { left: 26, top: 21 },
      { left: 40, top: 6 }, { left: 40, top: 17 }, { left: 40, top: 28 }, { left: 40, top: 39 },
    ]);
    expect(l.cellW).toBe(12);
    expect(l.cellH).toBe(18);
  });
  it('подкова — размах 69 больше коробки 52, схема масштабируется целиком (scale≈0.754): ячейка 10×15, веер сохраняет форму и нахлёст макета, но влезает в коробку', () => {
    // Первая версия правки сжимала только шаг (13 при неизменной ячейке 13×20) — соседние точки
    // дуги (интервал ~0.316 единицы) расходятся на ~4px, ячейки наезжали друг на друга на 9px,
    // и вместо веера получался комок. Нахлёст сам по себе не дефект — он есть и в макете
    // (pos 0,6,16,28,40,50,56 при ячейке 13), дефектом было утроение нахлёста. Масштаб ОДНИМ
    // коэффициентом на шаг И ячейку сохраняет форму веера точно, просто уменьшенную целиком.
    const l = miniCells('horseshoe');
    expect(l.cells).toEqual([
      { left: 0, top: 10 }, { left: 5, top: 25 }, { left: 12, top: 34 }, { left: 21, top: 37 },
      { left: 30, top: 34 }, { left: 38, top: 25 }, { left: 42, top: 10 },
    ]);
    expect(l.cellW).toBe(10);
    expect(l.cellH).toBe(15);
  });
  it('коробка макета 52×64', () => {
    expect(MINI.boxW).toBe(52);
    expect(MINI.boxH).toBe(64);
  });
  it('инвариант: ЛЮБАЯ мини-схема каталога влезает в коробку и центрирована (правило одно, без исключений)', () => {
    for (const id of Object.keys(SPREAD_LAYOUTS)) {
      const l = miniCells(id);
      const maxLeft = Math.max(...l.cells.map((c) => c.left));
      const maxTop = Math.max(...l.cells.map((c) => c.top));
      expect(maxLeft + l.cellW).toBeLessThanOrEqual(MINI.boxW);
      expect(maxTop + l.cellH).toBeLessThanOrEqual(MINI.boxH);
    }
  });
  it('инвариант: мини-схема отцентрирована — поля слева/справа и сверху/снизу не расходятся сильнее округления формулы', () => {
    // Порог 2px — не «на глаз», а верхняя граница самой формулы `miniCells`: offX/offY считаются
    // через `Math.floor(slack / 2)`, и когда размах·шаг — не целое число (кельтский крест:
    // 2.316·16 = 37.056 ДО перехода на общий масштаб), дробный остаток слака достаётся флором
    // целиком одной стороне. Строгий порог 1px потребовал бы `Math.round` вместо `Math.floor`
    // в offX/offY — владелец сознательно отклонил это 16.08: «Карта дня» (единственная точка,
    // размах 0) тогда получила бы offX = round((52−13)/2) = round(19.5) = 20 вместо нынешних 19,
    // и её мини-схема разошлась бы с попиксельным совпадением макета (SPS pos [19,22]) ради
    // невидимого выигрыша на кельтском кресте. Порог 2px ловит содержательный перекос вроде бага
    // «Выбора из двух» (там разница полей была 3), не гоняет формулу за пикселем, которого
    // она математически не обещает, и не трогает уже сверенную с макетом «Карту дня».
    const MAX_CENTER_DRIFT = 2;
    for (const id of Object.keys(SPREAD_LAYOUTS)) {
      const l = miniCells(id);
      const left = Math.min(...l.cells.map((c) => c.left));
      const right = MINI.boxW - (Math.max(...l.cells.map((c) => c.left)) + l.cellW);
      const top = Math.min(...l.cells.map((c) => c.top));
      const bottom = MINI.boxH - (Math.max(...l.cells.map((c) => c.top)) + l.cellH);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(MAX_CENTER_DRIFT);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(MAX_CENTER_DRIFT);
    }
  });
  it('инвариант: форма раскладки не искажается — масштаб общий для x и y (отношение фактических шагов равно базовому)', () => {
    // Ловит именно тот класс регрессии, который проглядела первая версия масштабирования: сжимать
    // шаг колонки и шаг ряда НЕЗАВИСИМО (каждый под свою границу коробки) — форма раскладки
    // искажается, потому что коэффициент по x и по y разный. Шаг измеряется ПО КООРДИНАТАМ
    // на выходе (`actualStep` выше), а не по внутренней переменной `scale` — проверка обязана
    // ловить искажение, даже если оно просочилось в реализацию иным путём. Раскладки в одну
    // линию по какой-то оси (карта дня, три карты, «Ситуация», «На месяц») пропускаются —
    // искажать там нечего, нет пары точек с ненулевой разницей сразу по обеим осям.
    for (const id of Object.keys(SPREAD_LAYOUTS)) {
      const pts = SPREAD_LAYOUTS[id];
      const { cells } = miniCells(id);
      const stepX = actualStep(pts, cells, 'x');
      const stepY = actualStep(pts, cells, 'y');
      if (stepX === null || stepY === null) continue;
      expect(stepX / stepY).toBeCloseTo(MINI.stepX / MINI.stepY, 1);
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
