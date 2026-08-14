/** Математика полноэкранного просмотра (спека 14): зум, границы пана, двойной тап. */
import {
  clampZoom, panBounds, clampPan, doubleTapTarget, focalTranslate,
  swipeCloseAllowed, ZOOM_MAX, ZOOM_MIN, DOUBLE_TAP_ZOOM,
} from '../lightbox';

describe('clampZoom', () => {
  it('внутри диапазона не трогает', () => expect(clampZoom(2)).toBe(2));
  it('снизу упирается в 1', () => expect(clampZoom(0.4)).toBe(ZOOM_MIN));
  it('сверху упирается в 3', () => expect(clampZoom(5)).toBe(ZOOM_MAX));
});

describe('panBounds (карта 265×457, экран 390×844)', () => {
  it('при зуме 1 пан запрещён: карта меньше экрана по обеим осям', () =>
    expect(panBounds(1, 265, 457, 390, 844)).toEqual({ maxX: 0, maxY: 0 }));
  it('при зуме 2 разрешён только вылезающий излишек', () =>
    expect(panBounds(2, 265, 457, 390, 844)).toEqual({ maxX: 70, maxY: 35 }));
  it('ось, где карта всё ещё меньше экрана, остаётся запертой', () =>
    expect(panBounds(1.4, 265, 457, 390, 844)).toEqual({ maxX: 0, maxY: 0 }));
});

describe('clampPan', () => {
  const b = { maxX: 70, maxY: 35 };
  it('внутри границ не трогает', () => expect(clampPan(10, -20, b)).toEqual({ x: 10, y: -20 }));
  it('за границей прижимает к краю с обеих сторон', () =>
    expect(clampPan(100, -50, b)).toEqual({ x: 70, y: -35 }));
});

describe('doubleTapTarget', () => {
  it('из ×1 ведёт в ×2', () => expect(doubleTapTarget(1)).toBe(DOUBLE_TAP_ZOOM));
  it('из любого зума >1 сбрасывает в ×1', () => {
    expect(doubleTapTarget(2)).toBe(1);
    expect(doubleTapTarget(1.3)).toBe(1);
  });
});

describe('focalTranslate (зум ×2, границы 70/35)', () => {
  const b = { maxX: 70, maxY: 35 };
  it('тап в центр не двигает картинку', () => expect(focalTranslate(0, 0, 2, b)).toEqual({ x: 0, y: 0 }));
  it('тап правее центра тянет картинку влево (точка тапа к центру), с клампом', () =>
    expect(focalTranslate(100, 0, 2, b)).toEqual({ x: -70, y: 0 }));
  it('без границ формула -(p·(z−1))', () =>
    expect(focalTranslate(-40, 20, 2, { maxX: 200, maxY: 200 })).toEqual({ x: 40, y: -20 }));
});

describe('swipeCloseAllowed', () => {
  it('при ×1 свайп-закрытие разрешено', () => expect(swipeCloseAllowed(1)).toBe(true));
  it('при зуме >1 запрещено — жест отдан пану', () => expect(swipeCloseAllowed(1.01)).toBe(false));
});
