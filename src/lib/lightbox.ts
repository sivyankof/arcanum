/** Чистая математика полноэкранного просмотра карты (спека 14).
 *  Без импортов из react/expo — правила тестируются как данные.
 *  ⚠️ Все функции ниже вызываются из жестовых worklet-колбэков CardLightbox (pinch/pan/
 *  doubleTap), которые на устройстве выполняются на UI-потоке, а не на JS. Обычная (не-worklet)
 *  функция там недоступна — вызов фатален для приложения. Директива 'worklet' обязательна
 *  первой строкой тела КАЖДОЙ экспортируемой функции; веб и jest этот класс краша не ловят
 *  (там worklets выполняются как обычные JS-функции в одном потоке) — контракт проверяет
 *  src/lib/__tests__/lightbox.test.ts чтением исходника, см. комментарий там. */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const DOUBLE_TAP_ZOOM = 2;
/** Порог свайпа вниз, после которого карта улетает на место (motion-spec §15). */
export const SWIPE_CLOSE_PX = 120;

export function clampZoom(z: number): number {
  'worklet';
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/** Пан разрешён только на излишек, вылезающий за экран: карта меньше экрана — стоит по центру. */
export function panBounds(zoom: number, cardW: number, cardH: number, viewW: number, viewH: number) {
  'worklet';
  return {
    maxX: Math.max(0, (cardW * zoom - viewW) / 2),
    maxY: Math.max(0, (cardH * zoom - viewH) / 2),
  };
}

export function clampPan(x: number, y: number, b: { maxX: number; maxY: number }) {
  'worklet';
  return {
    x: Math.min(b.maxX, Math.max(-b.maxX, x)),
    y: Math.min(b.maxY, Math.max(-b.maxY, y)),
  };
}

/** Двойной тап: из ×1 — в ×2, из любого зума — сброс к ×1. */
export function doubleTapTarget(zoom: number): number {
  'worklet';
  return zoom > ZOOM_MIN ? ZOOM_MIN : DOUBLE_TAP_ZOOM;
}

/** Куда сдвинуть картинку, чтобы точка тапа (px,py — смещение от центра карты при ×1)
 *  оказалась в центре экрана после зума; результат зажат границами пана.
 *  «+0» убирает отрицательный ноль (-0 * k = -0 в JS) — числа те же, а сравнения чище. */
export function focalTranslate(px: number, py: number, zoom: number, b: { maxX: number; maxY: number }) {
  'worklet';
  return clampPan(-px * (zoom - 1) + 0, -py * (zoom - 1) + 0, b);
}

/** Свайп-вниз закрывает только при ×1: при зуме жест вертикали принадлежит пану. */
export function swipeCloseAllowed(zoom: number): boolean {
  'worklet';
  return zoom <= ZOOM_MIN;
}
