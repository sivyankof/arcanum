/** Правило показа scroll-aware панели (design-system §5, спека 04е).
 *
 *  Вынесено отдельной чистой функцией по двум причинам: её зовёт скролл-обработчик на UI-потоке
 *  (там нельзя ни setState, ни обращения к пропам), и её удобно покрыть юнит-тестами, не поднимая
 *  ни React, ни Reanimated. */

/** Глубина скролла, ниже которой панель не показываем: там ещё видна шапка в потоке. */
export const BAR_DEPTH = 140;

/** Мёртвая зона: сдвиг меньше неё считаем дрожанием пальца и состояние не трогаем. */
export const BAR_DEAD = 6;

export type BarState = {
  /** текущее смещение скролла */
  y: number;
  /** смещение на предыдущем событии */
  lastY: number;
  /** показана ли панель сейчас */
  shown: boolean;
  /** стоит ли курсор в поле поиска САМОЙ панели (не того, что в потоке) */
  focused: boolean;
};

export function nextBarShown({ y, lastY, shown, focused }: BarState): boolean {
  'worklet';
  // пока пользователь печатает, панель не уезжает: при коротком списке результатов смещение
  // схлопывается в 0, и без этого исключения поле ушло бы вверх прямо из-под пальца
  if (focused) return true;
  if (y < BAR_DEPTH) return false;
  if (y < lastY - BAR_DEAD) return true;
  if (y > lastY + BAR_DEAD) return false;
  return shown;
}
