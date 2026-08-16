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
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  // Правило одно для ЛЮБОЙ раскладки (однорядной и многорядной): вся мини-схема обязана влезать
  // в коробку .diag и стоять по центру — решение владельца от 16.08, важнее композиции макета
  // (там подкова и кельтский крест вылезают за рамку и налезают на название расклада, правило 6а-0).
  // Центрируется ФАКТИЧЕСКИЙ размах раскладки (maxX−minX / maxY−minY), а не размах «от нуля»:
  // у «Выбора из двух» minX = 0.2 (SPREAD_LAYOUTS.choice), и счёт от нуля завышал бы ширину на
  // 0.2·stepX ≈ 4px, сдвигая контент вправо и делая поля НЕсимметричными (найдено на живой
  // сверке 16.08 — поля стали 6/3 вместо прежних 4/5, хуже макета). Шаг колонки/ряда сжимается,
  // только если размах при штатном шаге не влезает («На месяц» 4 карты — 0..57 при коробке 52;
  // у подковы и кельта сжимается и шаг колонки, и шаг ряда). Смещение центрирует остаток размаха
  // по обеим осям — когда размах уже укладывается в коробку, min()/max(0, …) отдают 0 сами.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const stepX = spanX > 0 ? Math.min(MINI.stepX, Math.floor((MINI.boxW - MINI.cellW) / spanX)) : MINI.stepX;
  const stepY = spanY > 0 ? Math.min(MINI.stepY, Math.floor((MINI.boxH - MINI.cellH) / spanY)) : MINI.stepY;
  const offX = Math.max(0, Math.floor((MINI.boxW - (spanX * stepX + MINI.cellW)) / 2));
  const offY = Math.max(0, Math.floor((MINI.boxH - (spanY * stepY + MINI.cellH)) / 2));
  return pts.map((p) => ({
    left: offX + Math.round((p.x - minX) * stepX),
    top: offY + Math.round((p.y - minY) * stepY),
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
