/** Общий выбор подписи кнопки «назад» по параметру маршрута `from` (спека 72, финальное ревью,
 *  находки F1/F2/F5/T1). До этой правки один и тот же приём жил в ДВУХ параллельных видах:
 *  Record-карта «from → ключ i18n» (app/card/[id].tsx, app/paywall.tsx) и тернар прямо в JSX
 *  (app/fragment.tsx). Каждый экран знает СВОЙ набор источников и СВОИ ключи (у card/[id] это
 *  заголовки экранов вроде `card.backToday`, у остальных — подписи вкладок `tabs.*`), поэтому
 *  общее — не сама карта, а функция выбора: неизвестный/пустой `from` — на `fallback`. */
export function backTitleKey(map: Record<string, string>, from: string | undefined, fallback: string): string {
  return map[from ?? ''] ?? fallback;
}
