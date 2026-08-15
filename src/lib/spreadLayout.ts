/** Геометрия раскладов (спека 36 А): ОДИН источник для мини-схемы в списке (макет `.diag`,
 *  ячейка 13×20) и для доски ≤5 карт на экране (карта 88×150). Координаты — в дробных единицах
 *  «карта + зазор»: x вправо, y вниз, по точке на позицию в порядке spreads.json. Значения
 *  переведены из макета `SPS[].pos` (шаг колонки 19 = 13 + 6, шаг ряда 22 = 20 + 2).
 *  У раскладов 7–10 карт раскладка нужна только мини-схеме: на экране у них лента. */

export interface Pt {
  x: number;
  y: number;
}

const row = (n: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));

export const SPREAD_LAYOUTS: Record<string, Pt[]> = {
  'card-of-day': [{ x: 0, y: 0 }],
  'three-card': row(3),
  'situation-action-outcome': row(3),
  'month-ahead': row(4),
  // Вы · Партнёр · Соединяет · Мешает · Куда — крест, боковые карты между верхним и средним рядом
  relationship: [{ x: 0, y: 0.5 }, { x: 2, y: 0.5 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
  // Вы (снизу по центру) · A даст · A цена · B даст · B цена — две колонки над развилкой
  choice: [{ x: 1, y: 2 }, { x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 1.8, y: 0 }, { x: 1.8, y: 1 }],
  horseshoe: [
    { x: 0, y: 0 }, { x: 0.316, y: 0.909 }, { x: 0.842, y: 1.455 }, { x: 1.474, y: 1.636 },
    { x: 2.105, y: 1.455 }, { x: 2.632, y: 0.909 }, { x: 2.947, y: 0 },
  ],
  'celtic-cross': [
    { x: 0.737, y: 0.727 }, { x: 1.053, y: 0.727 }, { x: 0.737, y: 0 }, { x: 0.737, y: 1.545 },
    { x: 0, y: 0.727 }, { x: 1.474, y: 0.727 },
    { x: 2.316, y: 0 }, { x: 2.316, y: 0.545 }, { x: 2.316, y: 1.091 }, { x: 2.316, y: 1.636 },
  ],
};

/** Мини-схема списка: ячейка и шаги из макета `.sp .diag` / `.ccmap`. */
export const MINI = { cellW: 13, cellH: 20, stepX: 19, stepY: 22, boxW: 52, boxH: 64 } as const;

export function miniCells(spreadId: string): { left: number; top: number }[] {
  const pts = SPREAD_LAYOUTS[spreadId] ?? [];
  const maxX = Math.max(0, ...pts.map((p) => p.x));
  const maxY = Math.max(0, ...pts.map((p) => p.y));
  // Многорядные схемы (дуга подковы, крест «На отношения», кельтский крест) в макете нарочно
  // выходят за рамку коробки .diag — координаты те же, что и раньше, центрировать нечего.
  if (maxY !== 0) {
    return pts.map((p) => ({
      left: Math.round(p.x * MINI.stepX),
      top: Math.round(p.y * MINI.stepY),
    }));
  }
  // Однорядная схема в макете всегда целиком внутри коробки и стоит по центру: у «На месяц»
  // (4 карты) штатный шаг 19 не влезает (0..57 при ширине коробки 52) — шаг колонки сжимается
  // ровно настолько, чтобы последняя ячейка легла вплотную к правому краю, а вся лента ещё
  // и сдвигается по x, чтобы поля слева и справа совпали (при 2–3 картах сжимать не нужно —
  // min() отдаёт штатный шаг 19, как и раньше).
  const stepX = maxX > 0 ? Math.min(MINI.stepX, Math.floor((MINI.boxW - MINI.cellW) / maxX)) : MINI.stepX;
  const rowWidth = maxX * stepX + MINI.cellW;
  const offX = Math.max(0, Math.floor((MINI.boxW - rowWidth) / 2));
  const offY = Math.max(0, Math.floor((MINI.boxH - MINI.cellH) / 2));
  return pts.map((p) => ({
    left: offX + Math.round(p.x * stepX),
    top: offY,
  }));
}

/** Доска на экране: карта `.s3card` 88×150, зазор `.s3row` 10, полоса подписи под картой
 *  (позиция до 2 строк 8.5px + имя карты) — 48. Шаг ряда включает полосу, иначе подписи
 *  наезжали бы на ряд ниже у креста «На отношения». */
export const BOARD = { cardW: 88, cardH: 150, gap: 10, labelH: 48 } as const;

export interface BoardLayout {
  cardW: number;
  cardH: number;
  width: number;
  height: number;
  cells: { left: number; top: number }[];
}

/** Не влезает в availWidth — уменьшаем карту с сохранением пропорции 88:150 (четыре в ряд
 *  на экране 390 → 78×133); зазор и полоса подписи не меняются. */
export function boardLayout(spreadId: string, availWidth: number): BoardLayout {
  const pts = SPREAD_LAYOUTS[spreadId] ?? [];
  const maxX = Math.max(0, ...pts.map((p) => p.x));
  const maxY = Math.max(0, ...pts.map((p) => p.y));
  const full = maxX * (BOARD.cardW + BOARD.gap) + BOARD.cardW;
  const cardW = full <= availWidth ? BOARD.cardW : Math.floor((availWidth - maxX * BOARD.gap) / (maxX + 1));
  const cardH = Math.round((cardW * BOARD.cardH) / BOARD.cardW);
  const stepX = cardW + BOARD.gap;
  const stepY = cardH + BOARD.labelH;
  return {
    cardW,
    cardH,
    width: maxX * stepX + cardW,
    height: maxY * stepY + cardH + BOARD.labelH,
    cells: pts.map((p) => ({ left: p.x * stepX, top: p.y * stepY })),
  };
}

/** ≤5 карт — геометрическая доска; 7–10 — лента позиций (product-spec §4 п.3). */
export const isBoard = (cards: number): boolean => cards <= 5;
