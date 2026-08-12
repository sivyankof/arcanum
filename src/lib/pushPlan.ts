/** Расписание локальных пушей (logic-spec §8) — чистые правила без единого импорта из expo.
 *
 *  Почему не повторяющийся DAILY-триггер: он безусловен, а три правила из четырёх условные —
 *  утренний не нужен, если карта уже открыта, вечерний не нужен без открытой карты и после
 *  ответа, спасение серии зависит от её длины. Поэтому план считается заново на каждое
 *  изменение состояния и ставится конкретными датами (спека 06б, решение 2).
 *
 *  Отсчёт горизонта идёт от СЕГОДНЯ, а не от последнего открытия карты: планировщик работает
 *  только когда приложение открыли, значит сегодняшняя активность гарантирована. Правило
 *  «3+ дня тишины → один возвратный» получается из этого само.
 */
import { localDateISO } from './dates';
import type { DailyDraw, Outcome } from './journal';
import { parseHHMM, type AppSettings } from './settings';

export type PushKind = 'morning' | 'evening' | 'streak' | 'comeback';

export interface PlannedPush {
  kind: PushKind;
  /** Локальная дата 'YYYY-MM-DD'. */
  date: string;
  hour: number;
  minute: number;
  /** Ключ в content/phrases.json, а НЕ готовый текст: модуль не знает про язык и контент. */
  phraseKey: string;
  /** Подстановка {card} у вечернего. */
  cardId?: string;
  /** Подстановка {n} у спасения серии. */
  n?: number;
}

export interface PlanInput {
  pushesOn: boolean;
  reflectionOn: boolean;
  /** 'HH:MM' */
  morning: string;
  /** 'HH:MM' */
  evening: string;
  streak: number;
  /** Карта дня открыта сегодня. */
  todayCardId?: string;
  /** Ответ вечерней рефлексии уже дан. */
  todayOutcome?: Outcome;
}

/** На сколько дней вперёд ставим утренние, прежде чем замолчать. */
export const MORNING_AHEAD_DAYS = 3;
/** На какой день тишины приходит единственный возвратный пуш. */
export const COMEBACK_AFTER_DAYS = 4;
export const STREAK_SAVE_HOUR = 20;
/** Короче трёх дней серию спасать не зовём — терять почти нечего. */
export const STREAK_MIN = 3;
/** Жёсткий инвариант logic-spec §8. */
export const MAX_PER_DAY = 2;

/** Кого оставляем, когда на день претендует больше двух. */
const PRIORITY: PushKind[] = ['streak', 'evening', 'morning', 'comeback'];

const PHRASE_KEY: Record<PushKind, string> = {
  morning: 'push.morning_card',
  evening: 'push.evening_reflect',
  streak: 'push.streak_save',
  comeback: 'push.winback',
};

/** Локальная дата через N суток. Конструктор Date сам нормализует переход через месяц и год. */
function daysAheadISO(n: number, from: Date): string {
  return localDateISO(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n));
}

/** Момент уже прошёл? Сравнение в локальном времени — как и всё в проекте после аудита H2. */
function isPast(p: PlannedPush, now: Date): boolean {
  const [y, m, d] = p.date.split('-').map(Number);
  return new Date(y, m - 1, d, p.hour, p.minute).getTime() <= now.getTime();
}

/** Собирает вход планировщика из среза стора (settings/streak/history): та же сборка, что
 *  делает живой планировщик (usePushScheduler), вынесена сюда, чтобы DEV-показ плана в
 *  настройках считал ровно теми же данными, а не держал собственную копию этого маппинга. */
export function planInputFromStore(
  settings: AppSettings,
  streak: number,
  history: DailyDraw[],
  now: Date = new Date(),
): PlanInput {
  const today = history.find((h) => h.date === localDateISO(now));
  return {
    pushesOn: settings.pushesOn,
    reflectionOn: settings.reflectionOn,
    morning: settings.pushMorning,
    evening: settings.pushEvening,
    streak,
    todayCardId: today?.cardId,
    todayOutcome: today?.outcome,
  };
}

export function planPushes(input: PlanInput, now: Date): PlannedPush[] {
  if (!input.pushesOn) return [];

  const morning = parseHHMM(input.morning, 9);
  const evening = parseHHMM(input.evening, 21);
  const today = localDateISO(now);
  const drawn = !!input.todayCardId;
  const out: PlannedPush[] = [];

  // сегодняшний утренний — только пока карта не открыта
  if (!drawn) {
    out.push({ kind: 'morning', date: today, ...morning, phraseKey: PHRASE_KEY.morning });
  }

  // вечерний — только на сегодня: он называет карту по имени, а откроют ли завтрашнюю, неизвестно
  if (input.reflectionOn && drawn && !input.todayOutcome) {
    out.push({
      kind: 'evening',
      date: today,
      ...evening,
      phraseKey: PHRASE_KEY.evening,
      cardId: input.todayCardId,
    });
  }

  // спасение серии — только на сегодня: не открыл сегодня, завтра серия уже сброшена
  if (!drawn && input.streak >= STREAK_MIN) {
    out.push({
      kind: 'streak',
      date: today,
      hour: STREAK_SAVE_HOUR,
      minute: 0,
      phraseKey: PHRASE_KEY.streak,
      n: input.streak,
    });
  }

  // утренние вперёд, затем один возвратный — и тишина до возвращения
  for (let d = 1; d <= MORNING_AHEAD_DAYS; d++) {
    out.push({ kind: 'morning', date: daysAheadISO(d, now), ...morning, phraseKey: PHRASE_KEY.morning });
  }
  out.push({
    kind: 'comeback',
    date: daysAheadISO(COMEBACK_AFTER_DAYS, now),
    ...morning,
    phraseKey: PHRASE_KEY.comeback,
  });

  return capPerDay(out.filter((p) => !isPast(p, now)));
}

/** По построению внутри `planPushes` претендентов на один день никогда не больше двух (спасение
 *  серии живёт при закрытой карте, вечерний — при открытой), поэтому на реалистичном входе ветка
 *  обрезки ни разу не срабатывает — её можно было бы стереть, и существовавший тест этого
 *  не заметил бы. Инвариант logic-spec §8 всё равно должен быть выражен в коде, а не держаться
 *  на рассуждении о том, что претендентов не бывает больше двух: экспортируется отдельно, чтобы
 *  тест мог собрать искусственный день с тремя-четырьмя претендентами напрямую, в обход
 *  `planPushes` (см. `capPerDay` в `__tests__/pushPlan.test.ts` — проверяет и количество,
 *  и то, какие именно два выживают, то есть сам порядок `PRIORITY`). */
export function capPerDay(pushes: PlannedPush[]): PlannedPush[] {
  const byDate = new Map<string, PlannedPush[]>();
  for (const p of pushes) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const kept: PlannedPush[] = [];
  for (const list of byDate.values()) {
    list.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
    kept.push(...list.slice(0, MAX_PER_DAY));
  }
  return kept.sort((a, b) =>
    a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1,
  );
}
