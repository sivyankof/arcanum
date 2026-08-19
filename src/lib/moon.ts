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
