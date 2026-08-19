# План 47 — лунный календарь

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ sub-skill — superpowers:subagent-driven-development
> (или executing-plans); задача за задачей, шаги с чекбоксами. Модель сабагентов — sonnet
> (финальное ревью ветки — opus).

**Цель:** экран `/moon` с сеткой текущего месяца и событиями новолуния/полнолуния (дата + местное
время), вход — нажимаемая строка луны на «Сегодня»; ядро `moon.ts` считает точные моменты
по алгоритму Меюса вместо средней луны.

**Архитектура:** чистая логика (`moon.ts` — точные моменты, фаза, лунный день; `moonCalendar.ts` —
сетка и события месяца; `dates.ts`/`lang.ts` — подписи дней недели, время, начало недели) →
выносы (`MoonRow`, `Rule.glyph`) → экран `app/moon.tsx` + маршрут под гардом + `onPress` на
«Сегодня» → макет и документы → веб-проверка. Ветка `feat/47-moon-calendar` от `main`.

**Стек:** Expo SDK 54 (НЕ обновлять), expo-router v6, react-native 0.81, reanimated, jest-expo.
Новых зависимостей нет, `npm install` не нужен.

**Спека:** `docs/specs/47-moon-calendar.md` — читать целиком перед началом; таблица «Решения»
и раздел А (формулы и опорные моменты) — источник правды для задач 1 и 5.

## Глобальные ограничения

- Комментарии и коммиты по-русски; без упоминаний ИИ; без трейлеров `Co-Authored-By`.
- `npx tsc --noEmit` чистый после каждой задачи; `npm test` зелёный перед каждым коммитом.
- Цвета только из `useTheme()`; `pointerEvents` только в style; persist/бэкап не трогать
  (version **10**); `pushPlan.ts`/`pushes.ts` не трогать (пуши — задача 47б).
- Новые UI-строки — ru И en (`src/lib/i18n.ts`); числительных и плюрализации задача не добавляет.
- Значения из спеки/макета: `.date` 9.5/ls3.5 muted; `.h2` Cormorant 28 head, отступ 3; `.moonrow`
  13 по центру, отступ 12; `.mooncal` 7 колонок, gap 4, отступ 12; `.wd` 8.5/ls1 muted, paddingV 4;
  `.dcell` квадрат, radius 10, бордер 1 прозрачный, число 11 text; `.today2` бордер accent + фон
  chipBg; `.dim` muted + opacity .45; `.mevent` panel/frame 1, radius 14, паддинг 12/14, отступ 9,
  ряд gap 12; `.mevent b` 9/ls2 accent; `.mevent span` Cormorant 14.5 head; кружки 6 (ячейка) /
  14 (строка), ○ — кольцо accent border 1 / 1.5; шеврон строки луны `chevron-forward-outline`
  12 muted, gap 4; `HALF_WINDOW = 0.92`; допуск тестов эфемерид ±2 мин (±10 не краснеет на перепутанном знаке ΔT); ΔT = 69 с.
- TDD: тест пишется ПЕРВЫМ и прогоняется красным; зелёный с первого раза — искать ошибку в тесте.

---

### Задача 1: ядро `moon.ts` — точные моменты новолуния/полнолуния (TDD)

**Файлы:** изменить `src/lib/moon.ts` (переписать целиком), `src/lib/__tests__/moon.test.ts`
(переписать целиком).

**Интерфейсы (производит):**
```ts
export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';
export type MoonEventKind = 'new' | 'full';
export interface MoonEvent { kind: MoonEventKind; at: Date }
export const HALF_WINDOW = 0.92;
export function phaseInstant(k: number, kind: MoonEventKind): Date;
export function moonEvents(from: Date, to: Date): MoonEvent[];
export function lunationAround(date: Date): { prevNew: Date; full: Date; nextNew: Date };
export function moonAge(date: Date): number;
export function moonPhase(date: Date): MoonPhase;
export function lunarDay(date: Date): number;
export function moonInfo(date: Date): { age: number; phase: MoonPhase; day: number };
```
Удаляются экспорты `MOON_EPOCH`, `SYNODIC_MONTH`, `PHASE_BOUNDS` (их импортировал только старый тест).
Единственный потребитель в коде — `app/(tabs)/index.tsx` (`moonInfo(now)`) — правок не требует.

- [ ] **Шаг 0: ветка.** `git checkout main && git pull && git checkout -b feat/47-moon-calendar`.

- [ ] **Шаг 1: падающие тесты.** Заменить содержимое `src/lib/__tests__/moon.test.ts` на:

```ts
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

/** Опорные моменты (спека 47, раздел А): опубликованные эфемериды, UTC. Формулы и таблица
 *  сверены друг о друга пробным скриптом 19.08 (все ≤ 0.5 мин). */
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

  it('k = 0 — новолуние 6 января 2000 18:14 UTC (эпоха средней формулы)', () => {
    expect(minutesBetween(phaseInstant(0, 'new'), new Date('2000-01-06T18:14Z'))).toBeLessThan(TOLERANCE_MIN);
  });

  it('пример 49.a из Меюса: k = −283 → новолуние 18 февраля 1977 03:37 TD', () => {
    // книга даёт TD; наша ΔT-константа для 1977 завышена на ~20 с — в допуске
    expect(minutesBetween(phaseInstant(-283, 'new'), new Date('1977-02-18T03:37:42Z'))).toBeLessThan(TOLERANCE_MIN);
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
```

- [ ] **Шаг 2: красный прогон.** `npx jest src/lib/__tests__/moon.test.ts` → падает на импорте
  (`phaseInstant`/`moonEvents`/`lunationAround` не экспортируются) — ожидаемо.

- [ ] **Шаг 3: реализация.** Заменить содержимое `src/lib/moon.ts` на:

```ts
/** Луна: точные моменты новолуния и полнолуния, фаза и лунный день (logic-spec §6, спека 47).
 *
 *  До задачи 47 здесь была «средняя луна» — возраст от эпохи 2000 по средней длине месяца. Для
 *  строки «Растущая луна» этого хватало, для календаря с ДАТАМИ — нет: настоящий момент гуляет
 *  относительно среднего до ±14 часов (13.08.2026 07:46 по средней формуле против реальных
 *  12.08.2026 17:37 UTC). Теперь моменты считаются по Meeus, Astronomical Algorithms, гл. 49
 *  («Phases of the Moon»): средняя фаза лунации k + периодические поправки + планетные члены,
 *  точность ~1–2 минуты. Офлайн, без зависимостей; все функции чистые.
 *
 *  Семантика фаз сохранена с hf-01: окно new/full — ±HALF_WINDOW суток вокруг ТОЧНОГО момента,
 *  между окнами waxing/waning. Лунный день = floor(возраст) + 1 (1…30); лунация длится
 *  29.27–29.83 суток, поэтому день 30 бывает не в каждом месяце — так в любом лунном календаре.
 */

export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';
export type MoonEventKind = 'new' | 'full';
/** Событие луны: вид и точный момент (UTC-инстант). */
export interface MoonEvent {
  kind: MoonEventKind;
  at: Date;
}

/** Полуширина окна главных фаз (новолуние/полнолуние) вокруг точного момента, в сутках (hf-01). */
export const HALF_WINDOW = 0.92;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Средняя длина синодического месяца, сутки — только для ОЦЕНКИ номера лунации k. */
const MEAN_SYNODIC = 29.530588861;
/** Юлианская дата средней эпохи k = 0 (новолуние 6 января 2000). */
const JD_EPOCH = 2451550.09766;
/** Юлианская дата начала Unix-эпохи. */
const JD_UNIX = 2440587.5;
/** ΔT = TD − UT, секунды: ряд Меюса даёт динамическое время. Для 2020–2030 ≈ 69 с,
 *  меняется в пределах ±3 с — ниже точности ряда, берём константой. */
const DELTA_T_S = 69;

const sin = (deg: number) => Math.sin((deg * Math.PI) / 180);

/** Первые семь коэффициентов ряда — единственное, чем новолуние отличается от полнолуния. */
const HEAD: Record<MoonEventKind, readonly number[]> = {
  new: [-0.4072, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208],
  full: [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209],
};

/** Точный момент фазы лунации k (Meeus 49): k целое — новолуние, для полнолуния берётся k + 0.5.
 *  Для дат до 2000 года k отрицательный — формула это допускает. */
export function phaseInstant(k: number, kind: MoonEventKind): Date {
  const kk = kind === 'full' ? k + 0.5 : k;
  const T = kk / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  // средняя фаза (49.1)
  let jde = JD_EPOCH + MEAN_SYNODIC * kk + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;

  // аргументы (47.6, 49.4–49.7), градусы
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * kk - 0.0000014 * T2 - 0.00000011 * T3; // средняя аномалия Солнца
  const Mp = 201.5643 + 385.81693528 * kk + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4; // Луны
  const F = 160.7108 + 390.67050284 * kk - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4; // аргумент широты
  const Om = 124.7746 - 1.56375588 * kk + 0.0020672 * T2 + 0.00000215 * T3; // долгота восходящего узла

  // периодические поправки, сутки
  const [c0, c1, c2, c3, c4, c5, c6] = HEAD[kind];
  jde +=
    c0 * sin(Mp) +
    c1 * E * sin(M) +
    c2 * sin(2 * Mp) +
    c3 * sin(2 * F) +
    c4 * E * sin(Mp - M) +
    c5 * E * sin(Mp + M) +
    c6 * E * E * sin(2 * M) -
    0.00111 * sin(Mp - 2 * F) -
    0.00057 * sin(Mp + 2 * F) +
    0.00056 * E * sin(2 * Mp + M) -
    0.00042 * sin(3 * Mp) +
    0.00042 * E * sin(M + 2 * F) +
    0.00038 * E * sin(M - 2 * F) -
    0.00024 * E * sin(2 * Mp - M) -
    0.00017 * sin(Om) -
    0.00007 * sin(Mp + 2 * M) +
    0.00004 * sin(2 * Mp - 2 * F) +
    0.00004 * sin(3 * M) +
    0.00003 * sin(Mp + M - 2 * F) +
    0.00003 * sin(2 * Mp + 2 * F) -
    0.00003 * sin(Mp + M + 2 * F) +
    0.00003 * sin(Mp - M + 2 * F) -
    0.00002 * sin(Mp - M - 2 * F) -
    0.00002 * sin(3 * Mp + M) +
    0.00002 * sin(4 * Mp);

  // планетные поправки («additional corrections»), сутки
  const A = [
    299.77 + 0.107408 * kk - 0.009173 * T2,
    251.88 + 0.016321 * kk,
    251.83 + 26.651886 * kk,
    349.42 + 36.412478 * kk,
    84.66 + 18.206239 * kk,
    141.74 + 53.303771 * kk,
    207.14 + 2.453732 * kk,
    154.84 + 7.30686 * kk,
    34.52 + 27.261239 * kk,
    207.19 + 0.121824 * kk,
    291.34 + 1.844379 * kk,
    161.72 + 24.198154 * kk,
    239.56 + 25.513099 * kk,
    331.55 + 3.592518 * kk,
  ];
  const AC = [
    0.000325, 0.000165, 0.000164, 0.000126, 0.00011, 0.000062, 0.00006, 0.000056, 0.000047, 0.000042,
    0.00004, 0.000037, 0.000035, 0.000023,
  ];
  for (let i = 0; i < A.length; i++) jde += AC[i] * sin(A[i]);

  const jdUt = jde - DELTA_T_S / 86400;
  return new Date((jdUt - JD_UNIX) * DAY_MS);
}

/** Оценка номера лунации для момента по средней формуле (целая часть). Точный момент
 *  новолуния k отстоит от среднего до ±0.6 суток, поэтому вызывающие перебирают соседние k. */
function lunationEstimate(date: Date): number {
  const jd = date.getTime() / DAY_MS + JD_UNIX;
  return Math.floor((jd - JD_EPOCH) / MEAN_SYNODIC);
}

/** Лунация вокруг момента: последнее новолуние ≤ date, полнолуние той же лунации, следующее новолуние. */
export function lunationAround(date: Date): { prevNew: Date; full: Date; nextNew: Date } {
  // стартуем с k0 + 2 (заведомо позже date: средний момент ≥ месяц впереди, точный — не раньше чем
  // на 0.6 сут) и спускаемся, пока новолуние не окажется ≤ date — не больше трёх шагов
  let k = lunationEstimate(date) + 2;
  while (phaseInstant(k, 'new').getTime() > date.getTime()) k -= 1;
  return { prevNew: phaseInstant(k, 'new'), full: phaseInstant(k, 'full'), nextNew: phaseInstant(k + 1, 'new') };
}

/** Все новолуния и полнолуния в [from, to), по времени. */
export function moonEvents(from: Date, to: Date): MoonEvent[] {
  const out: MoonEvent[] = [];
  // по лунации запаса с обеих сторон: точный момент гуляет вокруг среднего
  for (let k = lunationEstimate(from) - 1; k <= lunationEstimate(to) + 1; k++) {
    for (const kind of ['new', 'full'] as const) {
      const at = phaseInstant(k, kind);
      if (at.getTime() >= from.getTime() && at.getTime() < to.getTime()) out.push({ kind, at });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

type Lunation = ReturnType<typeof lunationAround>;

/** Всё о моменте внутри уже найденной лунации — чтобы moonInfo считал её один раз. */
function describeIn(date: Date, lun: Lunation): { age: number; phase: MoonPhase; day: number } {
  const t = date.getTime();
  const age = (t - lun.prevNew.getTime()) / DAY_MS;
  const near = (ev: Date) => Math.abs(t - ev.getTime()) / DAY_MS < HALF_WINDOW;
  let phase: MoonPhase;
  if (near(lun.prevNew) || near(lun.nextNew)) phase = 'new';
  else if (near(lun.full)) phase = 'full';
  else phase = t < lun.full.getTime() ? 'waxing' : 'waning';
  return { age, phase, day: Math.floor(age) + 1 };
}

/** Возраст луны в сутках от последнего новолуния: 0 — новолуние, ~14.8 — полнолуние. */
export function moonAge(date: Date): number {
  return describeIn(date, lunationAround(date)).age;
}

/** Фаза: окна new/full ±HALF_WINDOW вокруг точных моментов, между ними waxing/waning. */
export function moonPhase(date: Date): MoonPhase {
  return describeIn(date, lunationAround(date)).phase;
}

/** Лунный день (1–30): первые сутки после новолуния — день 1. */
export function lunarDay(date: Date): number {
  return describeIn(date, lunationAround(date)).day;
}

/** Всё сразу — чтобы экран считал лунацию один раз. */
export function moonInfo(date: Date): { age: number; phase: MoonPhase; day: number } {
  return describeIn(date, lunationAround(date));
}
```

- [ ] **Шаг 4: зелёный прогон.** `npx jest src/lib/__tests__/moon.test.ts` → все зелёные
  (18 эфемерид + остальные). Если какая-то эфемерида падает с расхождением в часы — ошибка
  в транскрипции коэффициента (сверить со спекой, раздел А), а не в таблице: формулы и таблица
  уже сверены друг о друга. `npx tsc --noEmit` чистый; `npm test` зелёный целиком.

- [ ] **Шаг 5: коммит.**
  `git add src/lib/moon.ts src/lib/__tests__/moon.test.ts && git commit -m "feat: ядро луны — точные моменты новолуния/полнолуния по Меюсу, фаза и лунный день от них (spec 47)"`

---

### Задача 2: начало недели, подписи дней недели, время — `lang.ts` / `dates.ts` (TDD)

**Файлы:** изменить `src/lib/lang.ts`, `src/lib/dates.ts`, `src/lib/__tests__/dates.test.ts`.

**Интерфейсы (производит):**
```ts
// lang.ts
export const WEEK_START: Record<Lang, 0 | 1>;          // 0 — воскресенье, 1 — понедельник (нумерация Date.getDay)
// dates.ts
export function weekdayLabels(lang: Lang): string[];   // 7 подписей от WEEK_START[lang], UPPERCASE, без хвостовой точки
export function formatTime(d: Date, lang: Lang): string; // «20:37» / «08:37 PM»
```

- [ ] **Шаг 1: падающие тесты.** В конец `src/lib/__tests__/dates.test.ts` добавить (и дописать
  `formatTime`, `weekdayLabels` в import из `'../dates'`, плюс `import { WEEK_START } from '../lang';`):

```ts
describe('weekdayLabels — шапка сетки лунного календаря (спека 47)', () => {
  test('ru: неделя с понедельника, «ПН … ВС»', () =>
    expect(weekdayLabels('ru')).toEqual(['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']));
  test('en: неделя с воскресенья, «SUN … SAT»', () =>
    expect(weekdayLabels('en')).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']));
  test('es/pt: с воскресенья; у pt-BR хвостовая точка («seg.») срезана', () => {
    expect(weekdayLabels('es')[0]).toBe('DOM');
    expect(weekdayLabels('pt')).toEqual(['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']);
    for (const lang of ['ru', 'en', 'es', 'pt'] as const) {
      expect(weekdayLabels(lang)).toHaveLength(7);
      for (const l of weekdayLabels(lang)) expect(l).not.toMatch(/\.$/);
    }
  });
  test('WEEK_START: ru — понедельник, остальные — воскресенье', () =>
    expect(WEEK_START).toEqual({ ru: 1, en: 0, es: 0, pt: 0 }));
});

describe('formatTime — местное время события луны (спека 47)', () => {
  // локальный конструктор: результат не зависит от часового пояса машины
  const d = new Date(2026, 7, 12, 20, 37);
  test('ru: 24 часа «20:37»', () => expect(formatTime(d, 'ru')).toBe('20:37'));
  // перед «PM» ICU разных версий ставит то обычный пробел, то узкий неразрывный (U+202F) —
  // нормализуем, проверяем содержание, а не байты
  test('en: 12 часов «08:37 PM»', () => expect(formatTime(d, 'en').replace(/\u202f/g, ' ')).toBe('08:37 PM'));
  test('pt: 24 часа «20:37»', () => expect(formatTime(d, 'pt')).toBe('20:37'));
});
```

- [ ] **Шаг 2: красный прогон.** `npx jest src/lib/__tests__/dates.test.ts` → падает на импорте.

- [ ] **Шаг 3: реализация.** В `src/lib/lang.ts` после блока `LOCALES` добавить:

```ts
/** Первый день недели по языку для сетки календаря (спека 47), нумерация `Date.getDay()`:
 *  0 — воскресенье, 1 — понедельник. Значения — CLDR выбранных локалей: ru-RU — понедельник,
 *  en-US / es-MX / pt-BR — воскресенье. */
export const WEEK_START: Record<Lang, 0 | 1> = {
  ru: 1,
  en: 0,
  es: 0,
  pt: 0,
};
```
В `src/lib/dates.ts`: импорт расширить до `import { LOCALES, WEEK_START, type Lang } from './lang';`
и в конец файла добавить:

```ts
/** Семь подписей дней недели для шапки сетки лунного календаря (спека 47), начиная
 *  с WEEK_START[lang]: ru «ПН … ВС», en «SUN … SAT». Тот же механизм, что formatEntryDate
 *  (`weekday: 'short'`); pt-BR отдаёт «seg.» — хвостовую точку срезаем.
 *  Опорная неделя: 9 августа 2026 — воскресенье (getDay 0). */
export function weekdayLabels(lang: Lang): string[] {
  const start = WEEK_START[lang];
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 7, 9 + ((start + i) % 7))
      .toLocaleDateString(LOCALES[lang], { weekday: 'short' })
      .replace(/\.$/, '')
      .toUpperCase(),
  );
}

/** «20:37» / «08:37 PM» — местное время события в строке лунного календаря (спека 47).
 *  12 или 24 часа решает локаль, не мы. */
export function formatTime(d: Date, lang: Lang): string {
  return d.toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' });
}
```

- [ ] **Шаг 4: зелёный прогон.** `npx jest src/lib/__tests__/dates.test.ts`; `npx tsc --noEmit`; `npm test`.

- [ ] **Шаг 5: коммит.**
  `git add src/lib/lang.ts src/lib/dates.ts src/lib/__tests__/dates.test.ts && git commit -m "feat: начало недели по языку, подписи дней недели и формат времени для лунного календаря (spec 47)"`

---

### Задача 3: сетка и события месяца — `moonCalendar.ts` (TDD)

**Файлы:** создать `src/lib/moonCalendar.ts`, `src/lib/__tests__/moonCalendar.test.ts`.

**Интерфейсы (потребляет):** `moonEvents`, `MoonEvent`, `MoonEventKind` из задачи 1.
**Производит:**
```ts
export interface MonthEvent { kind: MoonEventKind; at: Date; day: number }
export type EventSource = (from: Date, to: Date) => MoonEvent[];
export function monthEvents(year: number, month0: number, source?: EventSource): MonthEvent[];
export interface MonthGrid { leading: number; daysInMonth: number }
export function monthGrid(year: number, month0: number, weekStart: 0 | 1): MonthGrid;
```

- [ ] **Шаг 1: падающие тесты.** Создать `src/lib/__tests__/moonCalendar.test.ts`:

```ts
/** Сетка и события месяца лунного календаря (спека 47). Синтетические события собираются
 *  ЛОКАЛЬНЫМ конструктором Date — иначе тесты зависели бы от часового пояса машины. */
import type { MoonEvent, MoonEventKind } from '../moon';
import { monthEvents, monthGrid, type EventSource } from '../moonCalendar';

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
    const real = monthEvents(2026, 7);
    expect(real.map((e) => e.kind)).toEqual(['new', 'full']);
    expect(real[0].day).toBeGreaterThanOrEqual(11);
    expect(real[0].day).toBeLessThanOrEqual(13);
    expect(real[1].day).toBeGreaterThanOrEqual(27);
    expect(real[1].day).toBeLessThanOrEqual(29);
  });
});
```

- [ ] **Шаг 2: красный прогон.** `npx jest src/lib/__tests__/moonCalendar.test.ts` → модуль не найден.

- [ ] **Шаг 3: реализация.** Создать `src/lib/moonCalendar.ts`:

```ts
/** Сетка месяца и события луны для экрана календаря (спека 47).
 *  Числовой модуль: про язык и локаль не знает (подписи дней недели и время — dates.ts),
 *  про экран — тем более. */
import { moonEvents, type MoonEvent, type MoonEventKind } from './moon';

/** Событие месяца: вид, точный момент и число месяца по ЛОКАЛЬНОМУ календарю. */
export interface MonthEvent {
  kind: MoonEventKind;
  at: Date;
  day: number;
}

export type EventSource = (from: Date, to: Date) => MoonEvent[];

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
    daysInMonth: new Date(year, month0 + 1, 0).getDate(),
  };
}
```

- [ ] **Шаг 4: зелёный прогон.** `npx jest src/lib/__tests__/moonCalendar.test.ts`; `npx tsc --noEmit`; `npm test`.

- [ ] **Шаг 5: коммит.**
  `git add src/lib/moonCalendar.ts src/lib/__tests__/moonCalendar.test.ts && git commit -m "feat: сетка месяца и события луны по локальному календарю — moonCalendar.ts (spec 47)"`

---

### Задача 4: выносы — `Rule.glyph` и `MoonRow` (поведение «Сегодня» не меняется)

**Файлы:** изменить `src/components/Rule.tsx`, `app/(tabs)/index.tsx` (строки ~433–441 и стиль
`moon` в `st`); создать `src/components/MoonRow.tsx`.

**Интерфейсы (производит):**
```ts
// Rule.tsx
export function Rule({ glyph = '✦' }: { glyph?: string }): JSX.Element;
// MoonRow.tsx
export function MoonRow(props: { phase: MoonPhase; day: number; onPress?: () => void; style?: StyleProp<ViewStyle> }): JSX.Element;
```
Компоненты юнит-тестами не покрываются (testing-strategy п. 2) — проверка веб-прогоном (задача 7).

- [ ] **Шаг 1: `Rule.glyph`.** В `src/components/Rule.tsx` заменить сигнатуру и глиф:

```tsx
type Props = {
  /** символ между линиями: ✦ по умолчанию; лунный календарь передаёт ☾ (.rule span макета) */
  glyph?: string;
};

export function Rule({ glyph = '✦' }: Props) {
  const t = useTheme();
  // 'transparent' в градиенте на iOS даёт серый ореол, поэтому гасим через альфу самого цвета
  const clear = `${t.frame}00`;

  return (
    <View style={st.row}>
      <LinearGradient colors={[clear, t.frame]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.line} />
      <Text style={[st.star, { color: t.accent }]}>{glyph}</Text>
      <LinearGradient colors={[t.frame, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.line} />
    </View>
  );
}
```
(Шапочный комментарий файла дополнить: «…и в лунном календаре (☾, спека 47)». `st` не меняется.)

- [ ] **Шаг 2: `MoonRow`.** Создать `src/components/MoonRow.tsx`:

```tsx
/** Строка луны «☽ Растущая луна · 8-й лунный день» (.moonrow эталона) — на «Сегодня» и в шапке
 *  лунного календаря (спека 47; вынесена из app/(tabs)/index.tsx вторым потребителем).
 *  Символ ☽ рисуем системным шрифтом: в Manrope его нет, поэтому обёртка — обычный Text без
 *  fontFamily. С `onPress` строка нажимаема (PressableScale — единая замена самодельным нажатиям)
 *  и несёт справа шеврон — вход в календарь; без `onPress` — просто текст (сам календарь). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MoonPhase } from '../lib/moon';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type Props = {
  phase: MoonPhase;
  day: number;
  /** тап по строке (вход в лунный календарь); без него строка не нажимаема и без шеврона */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function MoonRow({ phase, day, onPress, style }: Props) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const text = (
    <Text style={[st.text, { color: t.muted }]}>
      <Text>☽ </Text>
      <Txt style={{ color: t.head, fontWeight: '600' }}>{tr(`moon.${phase}`)}</Txt>
      <Txt style={{ color: t.muted }}>{` · ${tr('moon.day', { n: day })}`}</Txt>
    </Text>
  );

  if (!onPress) return <View style={[st.row, style]}>{text}</View>;

  return (
    <PressableScale onPress={onPress} hitSlop={8} accessibilityRole="button" style={[st.row, style]}>
      {text}
      {/* шеврон 12 muted, зазор 4 (решение спеки 47 — в макете дорисован) */}
      <Ionicons name="chevron-forward-outline" size={12} color={t.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  // .moonrow: 13px по центру, отступ 12 сверху; строка — ряд, чтобы шеврон встал за текстом
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  text: { fontSize: 13, textAlign: 'center' },
});
```

- [ ] **Шаг 3: «Сегодня» на `MoonRow`.** В `app/(tabs)/index.tsx`:
  - добавить импорт `import { MoonRow } from '../../src/components/MoonRow';` (по алфавиту рядом
    с `MeaningPanel`);
  - блок строки луны (комментарий «строка луны (.moonrow эталона)…» + `FadeUp index={1}` с `Text`)
    заменить на:
```tsx
        {/* строка луны — общий MoonRow (спека 47); onPress появится вместе с маршрутом /moon */}
        <FadeUp index={1}>
          <MoonRow phase={moon.phase} day={moon.day} />
        </FadeUp>
```
  - из `st` удалить `moon: { fontSize: 13, textAlign: 'center', marginTop: 12 },`;
  - импорт `Text` из react-native оставить, если он ещё используется в файле (проверить грепом
    `<Text`; если осталось 0 — убрать из импорта).

- [ ] **Шаг 4: проверка.** `npx tsc --noEmit` чистый; `npm test` зелёный; в браузере
  (`npx expo start --web`, http://localhost:8081) строка луны на «Сегодня» выглядит как раньше
  (тот же текст, тот же отступ 12 от разделителя; шеврона НЕТ — `onPress` ещё не передан);
  `Rule` по-прежнему рисует ✦ у всех пяти реальных потребителей (грепом `import.*Rule`:
  `app/(tabs)/index.tsx`, `app/(tabs)/course.tsx`, `app/(tabs)/profile.tsx`, `app/review.tsx`,
  `src/components/SpreadScreen.tsx` — таба «Карты» среди них нет, он `Rule` не импортирует).

- [ ] **Шаг 5: коммит.**
  `git add src/components/Rule.tsx src/components/MoonRow.tsx "app/(tabs)/index.tsx" && git commit -m "refactor: строка луны вынесена в MoonRow, у Rule проп glyph — под лунный календарь (spec 47)"`

---

### Задача 5: строки i18n, экран `app/moon.tsx`, маршрут под гардом, вход с «Сегодня»

**Файлы:** изменить `src/lib/i18n.ts`, `app/_layout.tsx`, `app/(tabs)/index.tsx`; создать `app/moon.tsx`.

**Интерфейсы (потребляет):** `moonInfo`, `MoonEventKind` (задача 1); `WEEK_START` (2);
`weekdayLabels`, `formatTime`, `formatDayMonth`, `formatMonthTitle`, `localDateISO` (2 и прежние);
`monthEvents`, `monthGrid` (3); `MoonRow`, `Rule glyph` (4); `FadeUp`, `ScreenBg`, `Txt`,
`useAppActive`, `useLang`, `transparentHeader`.

- [ ] **Шаг 1: i18n.** В `src/lib/i18n.ts` блок `moon` в **ru** (строки ~30–33) заменить на:
```ts
      // фазы луны и лунный день — строка под разделителем на «Сегодня» (logic-spec §6);
      // title/newHint/fullHint — экран лунного календаря (спека 47)
      moon: {
        new: "Новолуние", waxing: "Растущая луна", full: "Полнолуние", waning: "Убывающая луна",
        day: "{{n}}-й лунный день",
        title: "Лунный календарь",
        newHint: "Время задумывать новое",
        fullHint: "Время подводить итоги",
      },
```
  и блок `moon` в **en** (строки ~312–315) на:
```ts
      moon: {
        new: "New moon", waxing: "Waxing moon", full: "Full moon", waning: "Waning moon",
        day: "lunar day {{n}}",
        title: "Moon calendar",
        newHint: "A time to begin",
        fullHint: "A time to take stock",
      },
```
  Проверить: `npx tsc --noEmit`; `npx jest src/lib/__tests__/i18nPlurals.test.ts` (ресурсы читаются).

- [ ] **Шаг 2: экран.** Создать `app/moon.tsx`:

```tsx
/** Лунный календарь (спека 47; product-spec §1а; logic-spec §6): текущий месяц одним экраном —
 *  шапка месяца, строка луны (та же, что на «Сегодня»), сетка 7 колонок с глифами событий,
 *  строки новолуния/полнолуния с местным временем. Всё выводится из времени — стора нет.
 *  «Сейчас» берётся при монтировании и на возврате из фона (useAppActive, правило 06а);
 *  переход через полночь при открытом экране таймером не ловим — обновится на следующем
 *  возврате из фона. Композиция — #v-moon эталона. */
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../src/components/FadeUp';
import { MoonRow } from '../src/components/MoonRow';
import { Rule } from '../src/components/Rule';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { formatDayMonth, formatMonthTitle, formatTime, localDateISO, weekdayLabels } from '../src/lib/dates';
import { useLang } from '../src/lib/i18n';
import { WEEK_START } from '../src/lib/lang';
import { moonInfo, type MoonEventKind } from '../src/lib/moon';
import { monthEvents, monthGrid } from '../src/lib/moonCalendar';
import { useAppActive } from '../src/lib/useAppActive';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

// .mooncal: 7 колонок, зазор 4
const COLS = 7;
const GAP = 4;

/** Глиф события: ● новолуние (заливка text), ○ полнолуние (кольцо accent). View-кружок, а не
 *  символ шрифта: символ зависел бы от системного шрифта платформы, кружок — нет.
 *  size 6 в ячейке (border 1), 14 в строке события (border 1.5). */
function EventGlyph({ kind, size }: { kind: MoonEventKind; size: number }) {
  const t = useTheme();
  const ring = kind === 'full';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ring ? 'transparent' : t.text,
        borderWidth: ring ? (size > 8 ? 1.5 : 1) : 0,
        borderColor: t.accent,
      }}
    />
  );
}

export default function MoonScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // «сейчас» — при монтировании и на возврате из фона
  const [now, setNow] = React.useState(() => new Date());
  useAppActive(() => setNow(new Date()));

  const year = now.getFullYear();
  const month0 = now.getMonth();
  const today = now.getDate();
  const moon = moonInfo(now);
  const grid = monthGrid(year, month0, WEEK_START[lang]);
  const events = monthEvents(year, month0);
  const labels = weekdayLabels(lang);
  // в один день два события не попадают: между соседними ≈14.8 суток
  const glyphByDay = new Map(events.map((e) => [e.day, e.kind]));
  const cells: Array<number | null> = [
    ...Array.from({ length: grid.leading }, () => null),
    ...Array.from({ length: grid.daysInMonth }, (_, i) => i + 1),
  ];
  // ширина ячейки из ширины контента: 7 ячеек + 6 зазоров; квадрат — явной высотой
  const cellSize = Math.floor((width - spacing.xl * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.today') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // как тренажёр и урок: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        <FadeUp index={0}>
          <Txt style={[st.overline, { color: t.muted }]}>
            {formatMonthTitle(localDateISO(now).slice(0, 7), lang).toUpperCase()}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('moon.title')}</Txt>
          <Rule glyph="☾" />
        </FadeUp>

        <FadeUp index={1}>
          <MoonRow phase={moon.phase} day={moon.day} />
          <View style={st.grid}>
            {labels.map((l) => (
              <Txt key={l} style={[st.weekday, { width: cellSize, color: t.muted }]}>
                {l}
              </Txt>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <View key={`empty-${i}`} style={{ width: cellSize, height: cellSize }} />;
              const past = d < today;
              const kind = glyphByDay.get(d);
              return (
                <View
                  key={d}
                  style={[
                    st.cell,
                    { width: cellSize, height: cellSize },
                    d === today && { borderColor: t.accent, backgroundColor: t.chipBg },
                    past && st.dim,
                  ]}
                >
                  <Txt style={[st.cellNum, { color: past ? t.muted : t.text }]}>{d}</Txt>
                  {kind && (
                    <View style={st.cellGlyph}>
                      <EventGlyph kind={kind} size={6} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </FadeUp>

        <FadeUp index={2}>
          {events.map((e) => (
            <View
              key={e.at.getTime()}
              style={[st.event, { backgroundColor: t.panel, borderColor: t.frame }, e.day < today && st.dim]}
            >
              <EventGlyph kind={e.kind} size={14} />
              <View style={st.eventTexts}>
                <Txt style={[st.eventTitle, { color: t.accent }]}>
                  {`${tr(`moon.${e.kind}`)} · ${formatDayMonth(localDateISO(e.at), lang)} · ${formatTime(e.at, lang)}`.toUpperCase()}
                </Txt>
                <Txt style={[st.eventHint, { color: t.head }]}>
                  {tr(e.kind === 'new' ? 'moon.newHint' : 'moon.fullHint')}
                </Txt>
              </View>
            </View>
          ))}
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  // значения — CSS #v-moon эталона: .date/.h2/.mooncal/.wd/.dcell/.today2/.dim/.mevent
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 12 }, // .mooncal
  weekday: { fontSize: 8.5, letterSpacing: 1, textAlign: 'center', paddingVertical: 4 }, // .wd
  cell: { borderWidth: 1, borderColor: 'transparent', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, // .dcell
  cellNum: { fontSize: 11 },
  cellGlyph: { marginTop: 1 },
  dim: { opacity: 0.45 }, // .dim — прошедшие дни и события
  // .mevent: панель panel/frame, radius 14, паддинг 12/14, отступ 9, ряд gap 12
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 9,
  },
  // сжимаемый текст — flex 1 (в RN flexShrink по умолчанию 0, урок задачи 16)
  eventTexts: { flex: 1 },
  eventTitle: { fontSize: 9, letterSpacing: 2 }, // .mevent b
  eventHint: { fontFamily: fonts.display, fontSize: 14.5 }, // .mevent span
});
```

- [ ] **Шаг 3: маршрут под гардом.** В `app/_layout.tsx` после строки
  `<Stack.Screen name="review" options={transparentHeader(t)} />` добавить:
```tsx
          {/* лунный календарь (спека 47): корневой стек поверх таба «Сегодня», прозрачная шапка
              с подписью «Сегодня» на кнопке назад (ставит сам экран); объявлен здесь, чтобы не
              пройти мимо гарда онбординга (урок 09 — незаявленный файловый маршрут роутер добавляет сам) */}
          <Stack.Screen name="moon" options={transparentHeader(t)} />
```

- [ ] **Шаг 4: вход с «Сегодня».** В `app/(tabs)/index.tsx` строку
  `<MoonRow phase={moon.phase} day={moon.day} />` заменить на
  `<MoonRow phase={moon.phase} day={moon.day} onPress={() => router.push('/moon')} />`
  и комментарий над ней — на `{/* строка луны — общий MoonRow (спека 47), тап ведёт в лунный календарь */}`.
  ⚠️ `typedRoutes`: `'/moon'` компилируется только после того, как Metro перегенерировал
  `.expo/types/router.d.ts` по новому файлу `app/moon.tsx` — если `tsc` падает на этой строке,
  запустить `npx expo start --web` (или дождаться, пока уже запущенный dev-сервер подхватит файл)
  и повторить `tsc` (урок задачи 07). Временных кастов не делать.

- [ ] **Шаг 5: проверка.** `npx tsc --noEmit` чистый; `npm test` зелёный. В браузере: на «Сегодня»
  справа от строки луны шеврон; тап → `/moon` — шапка месяца по-русски, заголовок, ☾, строка луны,
  сетка (ПН…ВС), сегодняшняя клетка обведена, прошедшие приглушены, кружки на днях событий,
  1–3 строки событий с датой и временем; «назад» ведёт на «Сегодня». Переключить язык на English
  в настройках → на `/moon` «SUN…SAT», «MOON CALENDAR», время с AM/PM.

- [ ] **Шаг 6: коммит.**
  `git add src/lib/i18n.ts app/moon.tsx app/_layout.tsx "app/(tabs)/index.tsx" && git commit -m "feat: экран лунного календаря /moon — сетка месяца, события новолуния/полнолуния с временем, вход со строки луны на «Сегодня» (spec 47)"`

---

### Задача 6: макет и документы

**Файлы:** изменить `docs/design-reference.html`, `docs/logic-spec.md`, `docs/product-spec.md`,
`docs/design-system.md`, `docs/master-plan.md`.

- [ ] **Шаг 1: макет `v-today`.** В `docs/design-reference.html` строку `.moonrow` вкладки «Сегодня»
  (`<div class="moonrow fadeup d2">☽ <b>Убывающая луна</b> · 26-й лунный день</div>`, ~615) заменить на:
```html
    <div class="moonrow fadeup d2" onclick="show('v-moon')" style="cursor:pointer">☽ <b>Убывающая луна</b> · 26-й лунный день <svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></div>
```
  и в CSS после `.moonrow b{…}` (~75) добавить:
```css
.moonrow .chev{width:12px;height:12px;margin-left:-10px;stroke:var(--muted);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
```
  (`.moonrow` — flex с gap 14; `margin-left:-10px` даёт зазор 4 между текстом и шевроном, как в спеке.)
  Строку `.moonrow` внутри `v-moon` (~982) НЕ трогать — там строка не нажимаема.

- [ ] **Шаг 2: макет `v-moon`.** Строки событий (~985–986) заменить на:
```html
      <div class="mevent"><span class="mi">●</span><div><b>НОВОЛУНИЕ · 12 АВГУСТА · 20:37</b><span>Время задумывать новое</span></div></div>
      <div class="mevent"><span class="mi" style="color:var(--accent)">○</span><div><b>ПОЛНОЛУНИЕ · 28 АВГУСТА · 07:18</b><span>Время подводить итоги</span></div></div>
```
  (московское время реальных моментов 12.08.2026 17:37 UTC и 28.08.2026 04:18 UTC). В JS сетки
  (~1460) `const isNew = d===12||d===13, isFull = d===27||d===28, today = d===9;` заменить на
  `const isNew = d===12, isFull = d===28, today = d===9;` и комментарий над блоком — на
  `/* этап 4: лунный календарь августа 2026 — событие одним днём (спека 47), дата/время — реальные моменты по МСК */`.
  Открыть макет в браузере, кнопка демобара «Луна» и клик по строке луны на «Сегодня» ведут на экран;
  глифы только на 12 и 28.

- [ ] **Шаг 3: logic-spec §6.** Заменить раздел «## 6. Фаза луны» целиком на:
```md
## 6. Луна: фазы, лунный день, события

Локальный расчёт без сети, точные моменты (задача 47, заменила «среднюю луну» от эпохи 2000):
моменты новолуния и полнолуния считаются по Meeus, *Astronomical Algorithms*, гл. 49 — средняя
фаза лунации k + периодические поправки + 14 планетных членов, ΔT = 69 с константой, точность
~1–2 минуты (формулы и 18 опорных эфемерид — спека 47, раздел А; тесты `moon.test.ts`,
допуск ±2 мин). Средняя луна давала до ±14 ч к реальному моменту — для строки фазы терпимо,
для календаря с датами нет.
**Фаза** — окна СИММЕТРИЧНЫЕ вокруг точных моментов (hf-01, 09.08): новолуние — |t − момент
новолуния| < 0.92 сут; полнолуние — |t − момент полнолуния| < 0.92 сут; между окнами растущая
(от новолуния к полнолунию) и убывающая. **Лунный день** = floor(возраст) + 1, возраст — сутки
от последнего новолуния; лунация 29.27–29.83 сут, поэтому день 30 бывает не в каждом месяце.
**Событие календаря** (экран `/moon`) — один ЛОКАЛЬНЫЙ календарный день точного момента, показывается
с местным временем («Новолуние · 12 августа · 20:37»); окно фазы (~2 суток «Новолуние» в строке
«Сегодня») — период, событие — момент, это разные вещи и не противоречат друг другу. Месяц
содержит 1–3 события (в феврале может не быть полнолуния, в длинном месяце — два новолуния).
Начало недели в сетке — по языку (`WEEK_START`: ru — ПН, en/es/pt — ВС, CLDR выбранных локалей).
Тест-кейсы (UTC): 23.08.2025 06:06 — новолуние · 09.08.2025 07:55 — полнолуние · 12.08.2026 17:37 —
новолуние (затмение) · 28.08.2026 04:18 — полнолуние · 28.08.2025 — растущая · 15.08.2025 — убывающая.
Использование v1: строка на «Сегодня» (нажимаема → `/moon`), экран лунного календаря; пуши
новолуния/полнолуния — задача 47б.
```

- [ ] **Шаг 4: product-spec.** В разделе «## 1. Сегодня» фразу
  `строка луны\n(«☽ Растущая луна · 15-й лунный день», расчёт локальный)` дополнить:
  `строка луны («☽ Растущая луна · 15-й лунный день ›», расчёт локальный, нажимаема → лунный календарь ✅(47))`
  (в две строки по ширине файла). После раздела 1 (перед `## 2. Курс`) добавить:
```md
## 1а. Лунный календарь ✅ (47)

Отдельный экран `/moon`, вход — ТОЛЬКО тап по строке луны на «Сегодня», «назад → Сегодня». Текущий
месяц (листания нет). Сверху вниз: overline «АВГУСТ 2026» → «Лунный календарь» → разделитель с ☾ →
та же строка луны → сетка 7 колонок (подписи дней недели по языку: ru с ПН, en/es/pt с ВС;
прошедшие дни приглушены, сегодня обведён золотом, на днях новолуния ● и полнолуния ○) → строки
событий месяца (1–3): «НОВОЛУНИЕ · 12 АВГУСТА · 20:37» / «ПОЛНОЛУНИЕ · …» + подпись «Время
задумывать новое» / «Время подводить итоги»; прошедшие события приглушены. Всё выводится из
времени (logic-spec §6), ничего не хранится; «сегодня» пересчитывается на возврате из фона.
Ячейки не нажимаются. Не делаем: тексты на лунные дни, листание месяцев, расклады лунного цикла;
пуши новолуния/полнолуния — 47б.
```

- [ ] **Шаг 5: design-system §5.** Перед `## 6. Иконография` (после абзаца про OptionPicker) добавить:
```md
**Лунный календарь (спека 47).** Экран `/moon` по `#v-moon`: шапка — `.date` 9.5/ls3.5 muted
(«АВГУСТ 2026»), `.h2` Cormorant 28 head, отступ 3, `Rule` с глифом ☾ (проп `glyph`, дефолт ✦);
строка луны — общий `MoonRow` (13 по центру, ☽ системным шрифтом, фаза head/600, остаток muted,
отступ 12). Сетка `.mooncal`: 7 колонок, зазор 4, отступ 12, ширина ячейки = (ширина контента −
6×4)/7, квадрат; подписи дней недели 8.5/ls1 muted, paddingV 4 (`weekdayLabels`, начало недели
`WEEK_START` по языку); ячейка radius 10, бордер 1 прозрачный, число 11 text; прошедший день —
muted + opacity .45; сегодня — бордер accent + фон chipBg; под числом глиф события (отступ 1).
Глифы — View-кружки, не символы: ● новолуние 6×6 заливка text, ○ полнолуние 6×6 кольцо accent
border 1; в строке события 14×14 (кольцо border 1.5). Строка события `.mevent`: panel + бордер 1
frame, radius 14, паддинг 12/14, отступ 9, ряд gap 12; overline 9/ls2 accent «НОВОЛУНИЕ ·
12 АВГУСТА · 20:37» (дата `formatDayMonth`, время `formatTime` — 12/24 ч решает локаль), подпись
Cormorant 14.5 head; прошедшее событие — opacity .45 на строку. Блюр макета у `.mevent` не
воспроизводим. Вход: `MoonRow` на «Сегодня» с `onPress` — `PressableScale`, шеврон
`chevron-forward-outline` 12 muted через зазор 4 (дорисован в макет).
```

- [ ] **Шаг 6: master-plan.** В §3.1-Р п. 11 дописать в конец: ` *(экран — задача 47, 19.08; пуши
  новолуния/полнолуния — 47б)*`.

- [ ] **Шаг 7: коммит.**
  `git add docs/design-reference.html docs/logic-spec.md docs/product-spec.md docs/design-system.md docs/master-plan.md && git commit -m "docs: лунный календарь в logic-spec §6, product-spec §1а, design-system; макет — шеврон строки луны и события одним днём (spec 47)"`

---

### Задача 7: веб-проверка 6а/6б и отчёт

- [ ] **Шаг 1: скрипт** `<scratchpad>/webcheck-47.js` (Playwright из кэша npx, в проект НЕ ставить;
  dev-сервер `npx expo start --web` на http://localhost:8081; вьюпорт 390×844, headless). Запуск:
  `NODE_PATH="C:/Users/Artem/AppData/Local/npm-cache/_npx/705bc6b22212b352/node_modules" node <scratchpad>/webcheck-47.js`.
  Сид — `localStorage['arcanum-app'] = JSON.stringify({ state: { profile: { onboarded: true }, themeMode, lang }, version: 10 })`
  через `goto → evaluate → reload` (НЕ `addInitScript`: он срабатывает на каждой навигации и затирает
  состояние). Каркас скрипта (проверки 1–2 написаны целиком, 3–8 — тем же приёмом по списку ниже):

```js
const { chromium } = require('playwright');
const path = require('path');
const OUT = 'C:/Users/Artem/Documents/my-projects/arcanum/docs/screenshots/47';
const MOCKUP = 'file:///C:/Users/Artem/Documents/my-projects/arcanum/docs/design-reference.html';
const APP = 'http://localhost:8081';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

async function seed(page, state) {
  await page.goto(APP);
  await page.evaluate((s) => localStorage.setItem('arcanum-app', JSON.stringify({ state: { profile: { onboarded: true }, ...s }, version: 10 })), state);
  await page.reload();
  await page.waitForTimeout(1500);
}
/** computed opacity самого узла и всех предков до body — минимум (как в проверке 46б) */
const chainOpacity = (el) => { let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) o = Math.min(o, parseFloat(getComputedStyle(n).opacity)); return o; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/pointerEvents is deprecated/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1. «Сегодня» (dark, ru): строка луны и вход
  await seed(page, { themeMode: 'dark', lang: 'ru' });
  const moonRow = page.getByText(/лунный день/).first();
  check('сегодня: строка луны видна', await moonRow.isVisible());
  await page.screenshot({ path: path.join(OUT, 'today-dark.png') });
  await moonRow.click({ force: true });
  await page.waitForTimeout(900);
  check('тап по строке → /moon', /\/moon$/.test(page.url()), page.url());
  check('заголовок «Лунный календарь»', await page.getByText('Лунный календарь').first().isVisible());

  // 2. /moon (dark, ru)
  const now = new Date();
  const monthTitle = `${now.toLocaleDateString('ru-RU', { month: 'long' })} ${now.getFullYear()}`.toUpperCase();
  check(`overline «${monthTitle}»`, await page.getByText(monthTitle, { exact: true }).first().isVisible());
  const labels = await page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.children.length === 0 && /^(ПН|ВТ|СР|ЧТ|ПТ|СБ|ВС)$/.test(d.textContent)).map((d) => d.textContent));
  check('подписи недели ПН…ВС', labels.join(',') === 'ПН,ВТ,СР,ЧТ,ПТ,СБ,ВС', labels.join(','));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cellInfo = await page.evaluate((dim) => {
    // ячейки — листовые div с числом 1…N внутри сетки; сетка — ближайший общий контейнер с «ПН»
    const lbl = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent === 'ПН');
    const grid = lbl.parentElement;
    const nums = [...grid.querySelectorAll('div')].filter((d) => d.children.length === 0 && /^\d{1,2}$/.test(d.textContent));
    const cellOf = (n) => n.parentElement; // Txt → ячейка
    const today = new Date().getDate();
    const todayCell = cellOf(nums.find((n) => Number(n.textContent) === today));
    const firstCell = cellOf(nums.find((n) => n.textContent === '1'));
    const chain = (el) => { let o = 1; for (let x = el; x && x !== document.body; x = x.parentElement) o = Math.min(o, parseFloat(getComputedStyle(x).opacity)); return o; };
    const dots = [...grid.querySelectorAll('div')].filter((d) => { const r = d.getBoundingClientRect(); return Math.abs(r.width - 6) < 0.6 && Math.abs(r.height - 6) < 0.6; });
    return {
      count: nums.length, max: Math.max(...nums.map((n) => Number(n.textContent))),
      todayBorder: getComputedStyle(todayCell).borderTopColor,
      firstOpacity: today > 1 ? chain(firstCell) : null,
      dotDays: dots.map((d) => { const cell = d.parentElement.parentElement; return cell.querySelector('div').textContent; }),
    };
  }, 0.45);
  check(`ячеек с числами ${daysInMonth}`, cellInfo.count === daysInMonth && cellInfo.max === daysInMonth, JSON.stringify(cellInfo));
  check('сегодня обведён (border не прозрачный)', !/rgba\(0, 0, 0, 0\)|transparent/.test(cellInfo.todayBorder), cellInfo.todayBorder);
  if (cellInfo.firstOpacity !== null) check('прошедший день opacity .45', Math.abs(cellInfo.firstOpacity - 0.45) < 0.02, String(cellInfo.firstOpacity));
  const events = await page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.children.length === 0 && /^(НОВОЛУНИЕ|ПОЛНОЛУНИЕ) · /.test(d.textContent)).map((d) => d.textContent));
  check('строк событий 1–3', events.length >= 1 && events.length <= 3, events.join(' | '));
  check('в каждом событии время ЧЧ:ММ', events.every((e) => /\d{2}:\d{2}/.test(e)));
  const eventDays = events.map((e) => e.match(/ · (\d{1,2}) /)?.[1]);
  check('кружки стоят на днях событий', eventDays.every((d) => cellInfo.dotDays.includes(d)), `events ${eventDays} dots ${cellInfo.dotDays}`);
  await page.screenshot({ path: path.join(OUT, 'moon-dark.png') });

  // 3…8 — см. список ниже; каждая проверка через check(...)

  console.log(`\nитог: PASS ${pass} / FAIL ${fail}; console errors: ${errors.length}`);
  errors.forEach((e) => console.log('  console:', e));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
```
  Проверки (каждая печатает PASS/FAIL, в конце — счёт):
  1. **Сегодня (dark, ru):** текст строки луны содержит «лунный день»; клик по строке →
     URL оканчивается на `/moon`, виден текст «Лунный календарь»; скриншот `today-dark.png`.
  2. **/moon (dark, ru):** overline = `(new Date().toLocaleDateString('ru-RU',{month:'long'}) + ' ' + год).toUpperCase()`;
     первая подпись недели «ПН», последняя «ВС»; число ячеек с числами = дней в месяце
     (посчитать элементы с текстом 1…N внутри контейнера сетки — искать по тексту «ПН» → родитель);
     сегодняшняя ячейка: computed `border-color` ≠ transparent; если сегодня > 1 — ячейка «1»
     имеет computed opacity 0.45 (поднимаясь от текста к ячейке); строк событий 1–3, каждая
     начинается с «НОВОЛУНИЕ» или «ПОЛНОЛУНИЕ» и содержит `/\d{2}:\d{2}/`; у каждого события
     в ячейке его дня есть потомок 6×6 (`getBoundingClientRect`); скриншот `moon-dark.png`.
  3. **/moon (light, ru):** сид `themeMode:'light'` → reload → те же проверки 2 (без скриншота
     макета), скриншот `moon-light.png`; «Сегодня» light — `today-light.png`.
  4. **/moon (dark, en):** сид `lang:'en'` → первая подпись «SUN», заголовок «Moon calendar»,
     время содержит `AM|PM`; скриншот `moon-en-dark.png`.
  5. **Гард:** сид `profile:{onboarded:false}` → `goto('/moon')` → URL содержит `onboarding`.
  6. **Назад:** на `/moon` (dark, ru) клик по кнопке шапки (`getByRole('button', { name: /Сегодня|back|назад/i })`,
     при отсутствии — `page.goBack()` и пометить в отчёте) → виден заголовок «Карта дня».
  7. **Консоль:** собрать `console.error`/`pageerror` за весь прогон — ноль (кроме известного
     `props.pointerEvents is deprecated` из react-navigation).
  8. **Макет:** открыть `MOCKUP` (константа каркаса — `file:///C:/Users/Artem/Documents/my-projects/arcanum/docs/design-reference.html`), `evaluate(() => show('v-moon'))`,
     скриншот `mockup-moon-dark.png`; переключить тему макета (кнопка демобара) → `mockup-moon-light.png`;
     `show('v-today')` → `mockup-today-dark.png` (виден шеврон у строки луны).
  **Красный прогон:** временно в `src/lib/moonCalendar.ts` заставить `monthEvents` возвращать `[]`
  → проверки «строк событий 1–3» и «кружок в ячейке» ОБЯЗАНЫ упасть; вернуть
  `git checkout -- src/lib/moonCalendar.ts`, прогнать зелёным. Скриншоты — в `docs/screenshots/47/`.
- [ ] **Шаг 2: сверка с макетом глазами** по `docs/ui-verification.md` (композиция, отступы, размеры
  шрифтов — не даты: макет хардкодит август 2026, «сегодня = 9-е»). Расхождения — исправить
  или перечислить с причиной. Предвидимые законные: в макете между ☽, фазой и «· день» стоят
  flex-зазоры 14, в приложении — пробелы (так с задачи 01); блюра у строк событий нет.
- [ ] **Шаг 3: отчёт** — раздел «## Отчёт веб-проверки 47 (дата)» в конец
  `docs/specs/47-moon-calendar.md`: таблица проверок, скриншоты, расхождения, консоль,
  красный/зелёный прогон, `npm test`/`tsc`, сценарий лайв-проверки для Артёма (см. раздел
  «Проверка» спеки, пункт 6в).
- [ ] **Шаг 4: коммит.**
  `git add docs/screenshots/47 docs/specs/47-moon-calendar.md && git commit -m "docs: отчёт веб-проверки 47 и скриншоты (spec 47)"`

---

### Задача 8: финал

- [ ] финальное ревью ветки (opus) по диапазону `main..HEAD`: пять срезов — ядро Меюса (сверка
  коэффициентов со спекой построчно), границы/часовые пояса (`monthEvents`, `formatTime`,
  `weekdayLabels`), экран (значения против design-system §5, `flex: 1` у сжимаемого текста,
  `pointerEvents` только в style), маршрут/гард, документы и макет; волна правок при необходимости;
  `npm test` и `tsc` после волны.
- [ ] `git push -u origin feat/47-moon-calendar`; сценарий лайв-проверки 47 (из отчёта спеки) — Артёму
  ⚠️ только когда ВСЕ правки лежат в рабочем дереве (урок 43/44).
- [ ] после ✓ Артёма — `git checkout main && git merge --no-ff feat/47-moon-calendar`, push; бэклог
  `[x]` у 47 (47б остаётся открытым хвостом); `CLAUDE.md` «Статус» — абзац о задаче 47 (что сделано,
  выносы `MoonRow`/`Rule.glyph`, уроки: средняя луна не годится для дат; тесты `monthEvents` только
  на синтетическом источнике из-за часового пояса; число тестов — по факту `npm test`);
  `AGENTS.md` — число тестов и строка про `moon.ts`/`moonCalendar.ts` в «Архитектуре».
