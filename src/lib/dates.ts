/** Локальные границы дня (logic-spec §7, аудит H2).
 *
 *  Раньше дату дня получали из строки в формате UTC (стандартный метод Date для ISO-строки).
 *  В часовом поясе UTC+3 это значит, что до 03:00 по местному времени приложение всё ещё жило
 *  «вчера»: карта дня не менялась вовремя, а серия (streak) рвалась, хотя человек открывал
 *  карту каждый день. Здесь — только локальные компоненты даты устройства.
 */
import { LOCALES, type Lang } from './lang';

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

/** Дата через n суток от ISO-дня (локально); n может быть отрицательным. Пара к daysAgoISO
 *  для случаев, где отсчёт идёт не от «сейчас», а от сохранённой даты — срок следующего
 *  показа карты повторения (спека 45). */
export function plusDaysISO(iso: string, n: number): string {
  return daysAgoISO(-n, parseISODate(iso));
}

/** YYYY-MM-DD → Date по ЛОКАЛЬНОЙ полуночи. `new Date('2026-08-11')` разобрал бы строку
 *  как UTC и в отрицательных поясах показал бы 10 августа — та же ловушка, что в аудите H2. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** «пн · 11 августа» (weekday 'long' → «понедельник · 11 августа»).
 *  Регистр задаёт вызывающий: в дневнике строка идёт в UPPERCASE как Overline. */
export function formatEntryDate(iso: string, lang: Lang, weekday: 'short' | 'long' = 'short'): string {
  const d = parseISODate(iso);
  const locale = LOCALES[lang];
  return `${d.toLocaleDateString(locale, { weekday })} · ${d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
  })}`;
}

/** «11 августа» — дата внутри фразы (блок «Ваша история с картой»). */
export function formatDayMonth(iso: string, lang: Lang): string {
  return parseISODate(iso).toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long' });
}

/** YYYY-MM → «август 2026» для заголовка навигатора дневника. Год приписываем сами:
 *  с `year: 'numeric'` русская локаль возвращает «август 2026 г.» — хвост «г.» в Overline лишний. */
export function formatMonthTitle(month: string, lang: Lang): string {
  const d = parseISODate(`${month}-01`);
  return `${d.toLocaleDateString(LOCALES[lang], { month: 'long' })} ${d.getFullYear()}`;
}

/** «10 февраля 1994» — дата рождения в поле онбординга (спека 09).
 *  Языки разведены намеренно: у английской локали правильный формат с запятой
 *  («February 10, 1994»), а русская с `year: 'numeric'` добавляет хвост «г.» (ловушка
 *  formatMonthTitle) — поэтому в ru год приписываем сами к уже готовому «дню с месяцем». */
export function formatFullDate(iso: string, lang: Lang): string {
  if (lang === 'en') {
    return parseISODate(iso).toLocaleDateString(LOCALES.en, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return `${formatDayMonth(iso, lang)} ${parseISODate(iso).getFullYear()}`;
}
