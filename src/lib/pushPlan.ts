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
import { daysAgoISO, localDateISO, localMidnight } from './dates';
import type { DailyDraw, Outcome } from './journal';
import { moonEvents, type EventSource, type MoonEventKind } from './moon';
import { parseHHMM, type AppSettings } from './settings';

export type PushKind = 'morning' | 'evening' | 'streak' | 'comeback' | 'freeze' | 'moon';

/** День лунного события по ЛОКАЛЬНОМУ календарю — как на экране /moon (logic-spec §6). */
export interface MoonDay {
  date: string;
  kind: MoonEventKind;
}

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
  /** Подстановка {n} у спасения серии; freeze-пуш несёт то же поле для {days} (push.freeze_saved). */
  n?: number;
  /** Явный ключ заголовка: у лунного пуша их два (новолуние/полнолуние), по виду не выбрать. */
  titleKey?: string;
}

export interface PlanInput {
  pushesOn: boolean;
  reflectionOn: boolean;
  /** 'HH:MM' */
  morning: string;
  /** 'HH:MM' */
  evening: string;
  streak: number;
  /** Запас заморозок (logic-spec §2) — от него зависит freeze-пуш. */
  freezes: number;
  /** Дата последнего открытия карты — по ней считается день freeze-пуша. */
  lastDrawDate: string | null;
  /** Карта дня открыта сегодня. */
  todayCardId?: string;
  /** Ответ вечерней рефлексии уже дан. */
  todayOutcome?: Outcome;
  /** Дни новолуний/полнолуний в горизонте плана (собирает planInputFromStore). */
  moonDays: MoonDay[];
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

/** Кого оставляем, когда на день претендует больше двух. С morning лунный в один день
 *  не сосуществует по построению (он и есть утренний этого дня), но порядок обязан быть
 *  полным: «не нашёл в списке» = indexOf −1 = внезапно высший приоритет. */
const PRIORITY: PushKind[] = ['streak', 'evening', 'freeze', 'moon', 'morning', 'comeback'];

const PHRASE_KEY: Record<Exclude<PushKind, 'moon'>, string> = {
  morning: 'push.morning_card',
  evening: 'push.evening_reflect',
  streak: 'push.streak_save',
  comeback: 'push.winback',
  freeze: 'push.freeze_saved',
};

/** Лунному пушу ключи фразы и заголовка выбираются по виду СОБЫТИЯ (спека 47б).
 *  Экспортируются ради контракт-теста: у заголовка нет других проверок — тело пуша ловит
 *  `pickPhrase` (пустая строка на неизвестном ключе), а `i18n.t` на отсутствующем ключе молча
 *  возвращает САМ КЛЮЧ, и опечатка уехала бы в баннер как есть (мутационная проверка 47б). */
export const MOON_PHRASE: Record<MoonEventKind, string> = {
  new: 'push.moon_new',
  full: 'push.moon_full',
};
export const MOON_TITLE: Record<MoonEventKind, string> = {
  new: 'push.titleMoonNew',
  full: 'push.titleMoonFull',
};

/** Локальная дата через N суток. */
function daysAheadISO(n: number, from: Date): string {
  return localDateISO(localMidnight(from, n));
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
  freezes: number,
  lastDrawDate: string | null,
  now: Date = new Date(),
): PlanInput {
  const today = history.find((h) => h.date === localDateISO(now));
  return {
    pushesOn: settings.pushesOn,
    reflectionOn: settings.reflectionOn,
    morning: settings.pushMorning,
    evening: settings.pushEvening,
    streak,
    freezes,
    lastDrawDate,
    todayCardId: today?.cardId,
    todayOutcome: today?.outcome,
    moonDays: moonDaysIn(now),
  };
}

/** Дни лунных событий в горизонте плана: от НАЧАЛА локального сегодня (событие в 04:18 обязано
 *  попасть в план и при пересчёте в 09:00) до конца последнего дня утренних. `moonEvents` отдаёт
 *  полуинтервал [from, to), поэтому правая граница — полночь дня +MORNING_AHEAD_DAYS+1, и сам этот
 *  день в окно не входит.
 *
 *  Источник событий инъектируется — тот же приём, что у `monthEvents` (спека 47): без него
 *  проверка маппинга «момент → ЛОКАЛЬНЫЙ день» была бы тавтологией (тест строил бы ожидание тем же
 *  `localDateISO`, что и реализация) и молчала бы на подмене реализации UTC-срезом ISO-строки. */
export function moonDaysIn(now: Date, source: EventSource = moonEvents): MoonDay[] {
  return source(localMidnight(now), localMidnight(now, MORNING_AHEAD_DAYS + 1)).map((e) => ({
    date: localDateISO(e.at),
    kind: e.kind,
  }));
}

/** Утренний слот дня: в локальный день новолуния/полнолуния — лунный текст вместо дежурного
 *  («вместо, а не поверх», master-plan). Freeze-день сюда не попадает: его ветка в planPushes
 *  стоит раньше — спасение серии функционально и праздником не перекрывается (спека 47б). */
function morningSlot(
  date: string,
  at: { hour: number; minute: number },
  moonDays: MoonDay[],
): PlannedPush {
  const moon = moonDays.find((m) => m.date === date);
  return moon
    ? { kind: 'moon', date, ...at, phraseKey: MOON_PHRASE[moon.kind], titleKey: MOON_TITLE[moon.kind] }
    : { kind: 'morning', date, ...at, phraseKey: PHRASE_KEY.morning };
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
    out.push(morningSlot(today, morning, input.moonDays));
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

  // «серию спасла заморозка» — утро дня после ПЕРВОГО полностью пропущенного дня (спека 10):
  // замена обычного утреннего, не добавка. План строится под допущение «пользователь больше
  // не откроет приложение»: карта сегодня открыта → первый пропуск завтра, пуш послезавтра;
  // не открыта при вчерашнем открытии → пропуск сегодня, пуш завтра; открытие старше — к утру
  // серию уже не спасти (пропуск 2+ дней заморозка не покрывает, logic-spec §2).
  const freezeDay =
    input.freezes > 0 && input.streak >= 1
      ? drawn
        ? 2
        : input.lastDrawDate === daysAgoISO(1, now)
          ? 1
          : null
      : null;

  // утренние вперёд, затем один возвратный — и тишина до возвращения
  for (let d = 1; d <= MORNING_AHEAD_DAYS; d++) {
    if (d === freezeDay) {
      out.push({
        kind: 'freeze',
        date: daysAheadISO(d, now),
        ...morning,
        phraseKey: PHRASE_KEY.freeze,
        n: input.streak,
      });
    } else {
      out.push(morningSlot(daysAheadISO(d, now), morning, input.moonDays));
    }
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
