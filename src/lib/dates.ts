/** Локальные границы дня (logic-spec §7, аудит H2).
 *
 *  Раньше дату дня получали из строки в формате UTC (стандартный метод Date для ISO-строки).
 *  В часовом поясе UTC+3 это значит, что до 03:00 по местному времени приложение всё ещё жило
 *  «вчера»: карта дня не менялась вовремя, а серия (streak) рвалась, хотя человек открывал
 *  карту каждый день. Здесь — только локальные компоненты даты устройства.
 */

/** Дата в формате YYYY-MM-DD из ЛОКАЛЬНЫХ компонентов даты (getFullYear/getMonth/getDate). */
export function localDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Дата N суток назад (локально). Конструктор Date сам нормализует переход через месяц/год,
 *  поэтому безопасно и вблизи перевода часов. */
export function daysAgoISO(n: number, from: Date = new Date()): string {
  return localDateISO(new Date(from.getFullYear(), from.getMonth(), from.getDate() - n));
}
