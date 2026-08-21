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
  // лунные расклады (спека 51): четыре карты в ряд, как «На месяц» — в макете `v-moonspread`
  // ячейки стоят на одной высоте с шагом 13px
  'new-moon': row(4),
  'full-moon': row(4),
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

/** Мини-схема списка: ячейка и шаги из макета `.sp .diag` / `.ccmap`. Это БАЗОВЫЕ (масштаб 1)
 *  значения — у раскладок с размахом больше коробки `miniCells` возвращает уменьшенные `cellW`/`cellH`,
 *  сама константа не меняется. */
export const MINI = { cellW: 13, cellH: 20, stepX: 19, stepY: 22, boxW: 52, boxH: 64 } as const;

export interface MiniLayout {
  cells: { left: number; top: number }[];
  /** Размер ячейки ПОСЛЕ масштабирования (может быть меньше MINI.cellW/cellH — см. `scale` ниже). */
  cellW: number;
  cellH: number;
}

export function miniCells(spreadId: string): MiniLayout {
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
  // у «Выбора из двух» minX = 0.2 (SPREAD_LAYOUTS.choice), счёт от нуля завышал бы ширину и уводил
  // контент вправо (регрессия найдена на живой сверке 16.08, поля были 6/3 вместо честных 4/5).
  //
  // Не влезает — масштабируется ЦЕЛИКОМ ОДНИМ коэффициентом: и шаги, и ячейка, а не только шаг
  // (первая версия этого правила сжимала только шаг, ячейка оставалась 13×20 — у подковы шаг ужался
  // до 13 при интервале между соседними точками дуги ~4px, ячейки наехали друг на друга на 9px
  // и вместо веера получился комок; найдено на живой сверке 16.08). Один `scale` на ОБЕ оси —
  // иначе схема исказится по пропорциям (то же ревью). `scale` берётся от БАЗОВОГО контента
  // (раскладка шагом/ячейкой 19×22/13×20), не превышает 1 — раскладкам, которые и так влезают,
  // сжатие не нужно вовсе.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const contentW = spanX * MINI.stepX + MINI.cellW;
  const contentH = spanY * MINI.stepY + MINI.cellH;
  const scale = Math.min(1, MINI.boxW / contentW, MINI.boxH / contentH);
  const stepX = MINI.stepX * scale;
  const stepY = MINI.stepY * scale;
  const cellW = MINI.cellW * scale;
  const cellH = MINI.cellH * scale;
  const offX = Math.max(0, Math.floor((MINI.boxW - (spanX * stepX + cellW)) / 2));
  const offY = Math.max(0, Math.floor((MINI.boxH - (spanY * stepY + cellH)) / 2));
  return {
    cells: pts.map((p) => ({
      left: offX + Math.round((p.x - minX) * stepX),
      top: offY + Math.round((p.y - minY) * stepY),
    })),
    cellW: Math.round(cellW),
    cellH: Math.round(cellH),
  };
}

/** Доска на экране: карта `.s3card` 88×150, зазор `.s3row` 10, полоса подписи под картой
 *  (позиция до 3 строк 8.5px + имя карты, 1 строка) — 60. Шаг ряда включает полосу, иначе подписи
 *  наезжали бы на ряд ниже у креста «На отношения».
 *
 *  До 16.08 подпись была ограничена 2 строками (labelH 48) — на «На отношения» три подписи из
 *  пяти (17, 20, 23, 25 знаков при вместимости ~24 на две строки) обрезались многоточием. Решение
 *  владельца: третья строка вместо бегущей строки (та расшатала бы спокойную пластику приложения —
 *  сразу три подписи поехали бы одновременно). labelH посчитан не «с потолка»: замер реального
 *  рендера Manrope 8.5px/ls1.5 (Playwright, `document.fonts.ready`, разбивка на строки через <br>)
 *  дал ровно 12px на строку текста при этом кегле и трекинге — устойчиво и без дробных пикселей
 *  на 1–4 строках. Старое значение 48 добавляло к сумме отступов и строк (7 + 2×12 + 1 + 12 = 44)
 *  4px технологического запаса — этот запас сохранён, прибавлена стоимость ровно одной строки:
 *  48 + 12 = 60. */
export const BOARD = { cardW: 88, cardH: 150, gap: 10, labelH: 60 } as const;

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
