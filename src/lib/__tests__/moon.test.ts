/** Тесты луны (logic-spec §6, спека 47): точные моменты против опубликованных эфемерид, окна фаз
 *  вокруг НАСТОЯЩИХ моментов, лунный день, перечень событий за период.
 *  Все моменты — UTC-инстанты, результат не зависит от часового пояса машины. */
import {
  HALF_WINDOW,
  lunarDay,
  lunationAround,
  moonAge,
  moonEvents,
  moonInfo,
  moonPhase,
  phaseInstant,
  type MoonEventKind,
} from '../moon';

const DAY_MS = 24 * 60 * 60 * 1000;
const shift = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const minutesBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 60000;

/** Курированные опорные моменты (спека 47, раздел А): у каждого подписано, ЧЕМ он примечателен.
 *  Подтверждены US Naval Observatory 20.08 — все 18 совпали минута в минуту; полный список
 *  того же источника за 2025–2027 проверяется отдельным тестом ниже. */
const EPHEMERIS: Array<[MoonEventKind, string, string]> = [
  ['new', '2025-08-23T06:06Z', 'logic-spec §6'],
  ['full', '2025-08-09T07:55Z', 'logic-spec §6'],
  ['full', '2025-01-13T22:27Z', 'первое полнолуние 2025'],
  ['new', '2025-03-29T10:58Z', 'частное солнечное затмение'],
  ['full', '2025-03-14T06:55Z', 'полное лунное затмение'],
  ['new', '2025-09-21T19:54Z', 'частное солнечное затмение'],
  ['full', '2025-09-07T18:09Z', 'полное лунное затмение'],
  ['full', '2026-01-03T10:03Z', 'первое полнолуние 2026'],
  ['new', '2026-01-18T19:52Z', 'первое новолуние 2026'],
  ['new', '2026-02-17T12:01Z', 'кольцеобразное солнечное затмение'],
  ['full', '2026-03-03T11:38Z', 'полное лунное затмение'],
  ['new', '2026-08-12T17:37Z', 'полное солнечное затмение; месяц макета'],
  ['full', '2026-08-28T04:18Z', 'частное лунное затмение; месяц макета'],
  ['new', '2026-12-09T00:52Z', 'последнее новолуние 2026'],
  ['full', '2026-12-24T01:28Z', 'последнее полнолуние 2026'],
  ['new', '2027-02-06T15:56Z', 'кольцеобразное солнечное затмение'],
  ['new', '2027-08-02T10:05Z', 'полное солнечное затмение'],
  ['new', '2027-12-27T20:12Z', 'последнее новолуние 2027'],
];
/** Допуск сверки с эфемеридами. НЕ «с запасом»: при 10 минутах сьют оставался ПОЛНОСТЬЮ зелёным
 *  на сломанном коде — перепутанный знак ΔT (`jde + DELTA_T_S` вместо `−`) сдвигает все моменты
 *  на 2×69 с ≈ 2.3 мин и в такой допуск умещался целиком (замерено 20.08: 32/32 passed на мутации).
 *  Реальные отклонения верной реализации — не больше 0.74 мин на всех 74 моментах USNO, поэтому
 *  2 минуты дают почти трёхкратный запас честной точности и при этом краснеют на инверсии знака. Правило проекта: тест, который
 *  не краснеет на сломанном коде, — не тест, а декорация (hf-02). */
const TOLERANCE_MIN = 2;

// опорные новолуние и полнолуние для тестов окон — из той же таблицы
const NEW_2025_08 = new Date('2025-08-23T06:06Z');
const FULL_2025_08 = new Date('2025-08-09T07:55Z');

describe('phaseInstant / moonEvents — точные моменты против эфемерид', () => {
  it.each(EPHEMERIS)('%s %s (%s) — в пределах допуска', (kind, iso) => {
    const at = new Date(iso);
    // событие ищем среди событий в окне ±2 суток: так проверяется и перечень, и сам момент
    const found = moonEvents(shift(at, -2), shift(at, 2)).filter((e) => e.kind === kind);
    expect(found).toHaveLength(1);
    expect(minutesBetween(found[0].at, at)).toBeLessThan(TOLERANCE_MIN);
  });

  // Полный список моментов за 2025–2027 из US Naval Observatory
  // (aa.usno.navy.mil/calculated/moon/phases, получен 20.08.2026) — 74 момента.
  // Курированная таблица EPHEMERIS выше объясняет, ЧЕМ примечателен каждый её момент;
  // этот тест берёт всё подряд и не даёт ошибке спрятаться между выбранными датами.
  const USNO = [
    'full 2025-01-13T22:27Z', 'new 2025-01-29T12:36Z',
    'full 2025-02-12T13:53Z', 'new 2025-02-28T00:45Z',
    'full 2025-03-14T06:55Z', 'new 2025-03-29T10:58Z',
    'full 2025-04-13T00:22Z', 'new 2025-04-27T19:31Z',
    'full 2025-05-12T16:56Z', 'new 2025-05-27T03:02Z',
    'full 2025-06-11T07:44Z', 'new 2025-06-25T10:31Z',
    'full 2025-07-10T20:37Z', 'new 2025-07-24T19:11Z',
    'full 2025-08-09T07:55Z', 'new 2025-08-23T06:06Z',
    'full 2025-09-07T18:09Z', 'new 2025-09-21T19:54Z',
    'full 2025-10-07T03:47Z', 'new 2025-10-21T12:25Z',
    'full 2025-11-05T13:19Z', 'new 2025-11-20T06:47Z',
    'full 2025-12-04T23:14Z', 'new 2025-12-20T01:43Z',
    'full 2026-01-03T10:03Z', 'new 2026-01-18T19:52Z',
    'full 2026-02-01T22:09Z', 'new 2026-02-17T12:01Z',
    'full 2026-03-03T11:38Z', 'new 2026-03-19T01:23Z',
    'full 2026-04-02T02:12Z', 'new 2026-04-17T11:52Z',
    'full 2026-05-01T17:23Z', 'new 2026-05-16T20:01Z',
    'full 2026-05-31T08:45Z', 'new 2026-06-15T02:54Z',
    'full 2026-06-29T23:56Z', 'new 2026-07-14T09:43Z',
    'full 2026-07-29T14:36Z', 'new 2026-08-12T17:37Z',
    'full 2026-08-28T04:18Z', 'new 2026-09-11T03:27Z',
    'full 2026-09-26T16:49Z', 'new 2026-10-10T15:50Z',
    'full 2026-10-26T04:12Z', 'new 2026-11-09T07:02Z',
    'full 2026-11-24T14:53Z', 'new 2026-12-09T00:52Z',
    'full 2026-12-24T01:28Z', 'new 2027-01-07T20:24Z',
    'full 2027-01-22T12:17Z', 'new 2027-02-06T15:56Z',
    'full 2027-02-20T23:23Z', 'new 2027-03-08T09:29Z',
    'full 2027-03-22T10:44Z', 'new 2027-04-06T23:51Z',
    'full 2027-04-20T22:27Z', 'new 2027-05-06T10:58Z',
    'full 2027-05-20T10:59Z', 'new 2027-06-04T19:40Z',
    'full 2027-06-19T00:44Z', 'new 2027-07-04T03:02Z',
    'full 2027-07-18T15:45Z', 'new 2027-08-02T10:05Z',
    'full 2027-08-17T07:29Z', 'new 2027-08-31T17:41Z',
    'full 2027-09-15T23:03Z', 'new 2027-09-30T02:36Z',
    'full 2027-10-15T13:47Z', 'new 2027-10-29T13:36Z',
    'full 2027-11-14T03:26Z', 'new 2027-11-28T03:24Z',
    'full 2027-12-13T16:09Z', 'new 2027-12-27T20:12Z'
  ];

  it('полный список USNO за 2025–2027: все 74 момента в допуске', () => {
    expect(USNO).toHaveLength(74);
    let worst = 0;
    for (const row of USNO) {
      const [kind, iso] = row.split(' ') as [MoonEventKind, string];
      const at = new Date(iso);
      const found = moonEvents(shift(at, -2), shift(at, 2)).filter((e) => e.kind === kind);
      expect(found).toHaveLength(1);
      worst = Math.max(worst, minutesBetween(found[0].at, at));
    }
    expect(worst).toBeLessThan(TOLERANCE_MIN);
  });

  it('k = 0 — новолуние 6 января 2000 18:14 UTC (эпоха средней формулы)', () => {
    expect(minutesBetween(phaseInstant(0, 'new'), new Date('2000-01-06T18:14Z'))).toBeLessThan(TOLERANCE_MIN);
  });

  it('пример 49.a из Меюса: k = −283 → 18 февраля 1977 03:37:42 TD, то есть 03:36:33 UT', () => {
    // Книга даёт ДИНАМИЧЕСКОЕ время (TD), а функция отдаёт UT — разница ровно на нашу константу
    // ΔT = 69 с по построению, а не из-за неточности. Поэтому сверяем с TD − 69 с: так тест
    // закрепляет НАПРАВЛЕНИЕ поправки (при перепутанном знаке вышло бы 03:38:51 — 2.3 мин мимо).
    expect(minutesBetween(phaseInstant(-283, 'new'), new Date('1977-02-18T03:36:33Z'))).toBeLessThan(TOLERANCE_MIN);
  });

  it('за 2026 год — 12 новолуний и 13 полнолуний, по времени, кинды чередуются', () => {
    const events = moonEvents(new Date('2026-01-01T00:00Z'), new Date('2027-01-01T00:00Z'));
    expect(events.filter((e) => e.kind === 'new')).toHaveLength(12);
    expect(events.filter((e) => e.kind === 'full')).toHaveLength(13);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].at.getTime()).toBeGreaterThan(events[i - 1].at.getTime());
      expect(events[i].kind).not.toBe(events[i - 1].kind);
    }
  });

  it('границы периода: from включительно, to — нет', () => {
    const at = moonEvents(new Date('2025-08-20T00:00Z'), new Date('2025-08-25T00:00Z'))[0].at;
    expect(moonEvents(at, shift(at, 1))).toHaveLength(1);
    expect(moonEvents(shift(at, -1), at)).toHaveLength(0);
  });
});

describe('lunationAround', () => {
  it('prevNew ≤ date < nextNew, full между ними', () => {
    for (const iso of ['2025-08-15T00:00Z', '2026-02-28T12:00Z', '1999-12-31T23:59Z', '2031-07-04T04:04Z']) {
      const d = new Date(iso);
      const { prevNew, full, nextNew } = lunationAround(d);
      expect(prevNew.getTime()).toBeLessThanOrEqual(d.getTime());
      expect(nextNew.getTime()).toBeGreaterThan(d.getTime());
      expect(full.getTime()).toBeGreaterThan(prevNew.getTime());
      expect(full.getTime()).toBeLessThan(nextNew.getTime());
      // лунация 29.27–29.83 суток
      const len = (nextNew.getTime() - prevNew.getTime()) / DAY_MS;
      expect(len).toBeGreaterThan(29.2);
      expect(len).toBeLessThan(29.9);
    }
  });

  it('в самый момент новолуния prevNew — это оно', () => {
    const at = moonEvents(new Date('2025-08-20T00:00Z'), new Date('2025-08-25T00:00Z'))[0].at;
    expect(lunationAround(at).prevNew.getTime()).toBe(at.getTime());
  });
});

describe('окна фаз — ±HALF_WINDOW вокруг НАСТОЯЩЕГО момента (hf-01)', () => {
  it('константа окна — 0.92 суток', () => expect(HALF_WINDOW).toBe(0.92));

  it('новолуние: ±0.91 сут — new; −0.93 — waning, +0.93 — waxing', () => {
    expect(moonPhase(NEW_2025_08)).toBe('new');
    expect(moonPhase(shift(NEW_2025_08, 0.91))).toBe('new');
    expect(moonPhase(shift(NEW_2025_08, -0.91))).toBe('new');
    expect(moonPhase(shift(NEW_2025_08, 0.93))).toBe('waxing');
    expect(moonPhase(shift(NEW_2025_08, -0.93))).toBe('waning');
  });

  it('полнолуние: ±0.91 сут — full; −0.93 — waxing, +0.93 — waning', () => {
    expect(moonPhase(FULL_2025_08)).toBe('full');
    expect(moonPhase(shift(FULL_2025_08, 0.91))).toBe('full');
    expect(moonPhase(shift(FULL_2025_08, -0.91))).toBe('full');
    expect(moonPhase(shift(FULL_2025_08, -0.93))).toBe('waxing');
    expect(moonPhase(shift(FULL_2025_08, 0.93))).toBe('waning');
  });

  it('реальные даты logic-spec §6: 28.08.2025 — растущая, 15.08.2025 — убывающая', () => {
    expect(moonPhase(new Date('2025-08-28T00:00Z'))).toBe('waxing');
    expect(moonPhase(new Date('2025-08-15T00:00Z'))).toBe('waning');
  });
});

describe('moonAge / lunarDay', () => {
  it('через час после новолуния — возраст < 0.05, день 1; через 1.5 суток — день 2', () => {
    expect(moonAge(shift(NEW_2025_08, 1 / 24))).toBeLessThan(0.05);
    expect(lunarDay(shift(NEW_2025_08, 1 / 24))).toBe(1);
    expect(lunarDay(shift(NEW_2025_08, 1.5))).toBe(2);
  });

  it('за сутки до новолуния — последний день предыдущей лунации (29 или 30), фаза waning', () => {
    const day = lunarDay(shift(NEW_2025_08, -1));
    expect(day === 29 || day === 30).toBe(true);
    expect(moonPhase(shift(NEW_2025_08, -1))).toBe('waning');
  });

  it('за три года с шагом 6 часов: возраст в [0, 29.9), день в 1…30, день не убывает внутри лунации', () => {
    let prevDay = 0;
    for (let t = new Date('2025-01-01T00:00Z').getTime(); t < new Date('2028-01-01T00:00Z').getTime(); t += 6 * 3600 * 1000) {
      const d = new Date(t);
      const age = moonAge(d);
      const day = lunarDay(d);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(29.9);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(30);
      // либо растёт/стоит, либо сброс в 1 на новолунии
      expect(day >= prevDay || day === 1).toBe(true);
      prevDay = day;
    }
  });
});

describe('moonInfo', () => {
  it('согласован с moonAge/moonPhase/lunarDay на одном моменте', () => {
    const d = shift(FULL_2025_08, 0.3);
    const info = moonInfo(d);
    expect(info.phase).toBe(moonPhase(d));
    expect(info.day).toBe(lunarDay(d));
    expect(info.age).toBeCloseTo(moonAge(d), 9);
    expect(info.phase).toBe('full');
  });
});
