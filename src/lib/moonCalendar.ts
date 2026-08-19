/** Сетка месяца и события луны для экрана календаря (спека 47).
 *  Числовой модуль: про язык и локаль не знает (подписи дней недели и время — dates.ts),
 *  про экран — тем более. */
import { daysInMonth } from './dates';
import { moonEvents, type EventSource, type MoonEventKind } from './moon';

/** Событие месяца: вид, точный момент и число месяца по ЛОКАЛЬНОМУ календарю. */
export interface MonthEvent {
  kind: MoonEventKind;
  at: Date;
  day: number;
}


/** События месяца по локальному календарю: момент 17:37 UTC — это 12-е число в Москве и 13-е
 *  в Окленде, поэтому границы — локальные полуночи (`new Date(y, m, 1)`, а не ISO-строки — ловушка
 *  H2), а `day` — `getDate()` момента. `source` подменяется в тестах синтетическими событиями:
 *  иначе они зависели бы от часового пояса машины. */
export function monthEvents(year: number, month0: number, source: EventSource = moonEvents): MonthEvent[] {
  const from = new Date(year, month0, 1);
  const to = new Date(year, month0 + 1, 1);
  return source(from, to).map((e) => ({ ...e, day: e.at.getDate() }));
}

export interface MonthGrid {
  /** пустых клеток перед 1-м числом при старте недели с weekStart */
  leading: number;
  daysInMonth: number;
}

/** weekStart — нумерация `Date.getDay()`: 0 воскресенье, 1 понедельник (WEEK_START в lang.ts).
 *  Хвост сетки не считаем: ряд просто заканчивается. */
export function monthGrid(year: number, month0: number, weekStart: 0 | 1): MonthGrid {
  const first = new Date(year, month0, 1).getDay();
  return {
    leading: (first - weekStart + 7) % 7,
    daysInMonth: daysInMonth(year, month0),
  };
}
