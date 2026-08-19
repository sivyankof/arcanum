/** Сетка и события месяца лунного календаря (спека 47). Синтетические события собираются
 *  ЛОКАЛЬНЫМ конструктором Date — иначе тесты зависели бы от часового пояса машины. */
import type { MoonEvent, MoonEventKind } from '../moon';
import { monthEvents, monthGrid } from '../moonCalendar';
import type { EventSource } from '../moon';

/** Источник, который уважает границы периода — как настоящий moonEvents. */
const sourceOf =
  (events: Array<[MoonEventKind, Date]>): EventSource =>
  (from, to) =>
    events
      .filter(([, at]) => at.getTime() >= from.getTime() && at.getTime() < to.getTime())
      .map(([kind, at]): MoonEvent => ({ kind, at }));

describe('monthGrid', () => {
  it('август 2026 (1-е — суббота): 5 пустых при старте с ПН, 6 — с ВС; 31 день', () => {
    expect(monthGrid(2026, 7, 1)).toEqual({ leading: 5, daysInMonth: 31 });
    expect(monthGrid(2026, 7, 0)).toEqual({ leading: 6, daysInMonth: 31 });
  });
  it('февраль 2026 (1-е — воскресенье): 6 пустых с ПН, 0 — с ВС; 28 дней', () => {
    expect(monthGrid(2026, 1, 1)).toEqual({ leading: 6, daysInMonth: 28 });
    expect(monthGrid(2026, 1, 0)).toEqual({ leading: 0, daysInMonth: 28 });
  });
  it('високосный февраль 2028 — 29 дней', () => expect(monthGrid(2028, 1, 1).daysInMonth).toBe(29));
  it('через границу года: декабрь 2026 (1-е — вторник) и январь 2027 (1-е — пятница) — по 31 дню', () => {
    // единственное место, где JS Date обязан сам перекатить год: new Date(2026, 12, 0)
    expect(monthGrid(2026, 11, 1)).toEqual({ leading: 1, daysInMonth: 31 });
    expect(monthGrid(2026, 11, 0)).toEqual({ leading: 2, daysInMonth: 31 });
    expect(monthGrid(2027, 0, 1)).toEqual({ leading: 4, daysInMonth: 31 });
    expect(monthGrid(2027, 0, 0)).toEqual({ leading: 5, daysInMonth: 31 });
  });
});

describe('monthEvents — локальные границы месяца', () => {
  it('событие в 00:30 1-го числа попадает, в 00:30 1-го числа СЛЕДУЮЩЕГО месяца — нет, 31-е 23:59 — да', () => {
    const src = sourceOf([
      ['full', new Date(2026, 6, 31, 23, 59)], // 31 июля — не август
      ['new', new Date(2026, 7, 1, 0, 30)],
      ['full', new Date(2026, 7, 31, 23, 59)],
      ['new', new Date(2026, 8, 1, 0, 30)], // 1 сентября — не август
    ]);
    expect(monthEvents(2026, 7, src).map((e) => [e.kind, e.day])).toEqual([
      ['new', 1],
      ['full', 31],
    ]);
  });
  it('месяц с одним событием и месяц с тремя', () => {
    expect(monthEvents(2026, 1, sourceOf([['new', new Date(2026, 1, 17, 15, 1)]]))).toHaveLength(1);
    const three = monthEvents(
      2026,
      0,
      sourceOf([
        ['full', new Date(2026, 0, 3, 13, 3)],
        ['new', new Date(2026, 0, 18, 22, 52)],
        ['full', new Date(2026, 0, 31, 23, 0)],
      ]),
    );
    expect(three.map((e) => e.day)).toEqual([3, 18, 31]);
  });
  it('настоящий источник: август 2026 — новолуние около 12-го и полнолуние около 28-го (в любом поясе ±1 день)', () => {
    // ⚠️ Допуск ±1 день — не «на всякий случай», а ровно ширина реального разброса часовых поясов
    // (UTC−12…+14): моменты 12.08 17:37 UTC и 28.08 04:18 UTC дают 13-е в Кирибати и 27-е
    // в Etc/GMT+12 — то есть границы диапазона достигаются, а не лежат с запасом. Расширять
    // допуск нельзя: тогда тест перестанет ловить сдвиг события на сутки.
    const real = monthEvents(2026, 7);
    expect(real.map((e) => e.kind)).toEqual(['new', 'full']);
    expect(real[0].day).toBeGreaterThanOrEqual(11);
    expect(real[0].day).toBeLessThanOrEqual(13);
    expect(real[1].day).toBeGreaterThanOrEqual(27);
    expect(real[1].day).toBeLessThanOrEqual(29);
  });
});
