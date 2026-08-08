/** Позиция ячейки, из которой открыли карту, — для «перелёта» изображения на страницу карты
 *  (пункт 6 motion-spec, фолбэк: в Reanimated 4 нет sharedTransitionTag).
 *  Живёт вне React: значение нужно ровно один раз, между нажатием и монтированием экрана. */

export type Rect = { x: number; y: number; w: number; h: number };

const MAX_AGE_MS = 1000;

let origin: { id: string; rect: Rect; at: number } | null = null;

/** Запомнить, откуда стартует переход (вызывается на нажатии в сетке карт). */
export function setCardOrigin(id: string, rect: Rect) {
  origin = { id, rect, at: Date.now() };
}

/** Забрать позицию и сразу очистить: перелёт бывает только сразу после нажатия
 *  и только для той же карты (иначе — обычное появление). */
export function takeCardOrigin(id: string): Rect | null {
  if (!origin || origin.id !== id || Date.now() - origin.at > MAX_AGE_MS) return null;
  const { rect } = origin;
  origin = null;
  return rect;
}
