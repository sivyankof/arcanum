/** Окно доступности лунного расклада (спека 51, master-plan п. 11).
 *  Чистый модуль: ни react, ни expo, ни i18n — как moon.ts и pushPlan.ts.
 *
 *  Окно считается КАЛЕНДАРНЫМИ сутками: локальный день события плюс день до и день после.
 *  Не ±24 часа от точного момента — всё приложение живёт локальными днями (граница карты дня
 *  hf-01, SRS 45, лунный пуш 47б), и окно, закрывающееся в 21:36 посреди вечера, было бы
 *  единственным исключением; вдобавок утренний пуш «Полнолуние ✦» и доступность расклада
 *  обязаны совпадать по дню. Решение спеки 51, подтверждено Артёмом 21.08. */
import { localDateISO, localMidnight, plusDaysISO } from './dates';
import { moonEvents, type EventSource, type MoonEventKind } from './moon';

/** Сколько суток по обе стороны от дня события держится окно. */
export const MOON_WINDOW_DAYS = 1;

/** Горизонт поиска ближайшего события своего вида. Синодический месяц ≈ 29.53 суток,
 *  поэтому 40 суток гарантированно содержат и новолуние, и полнолуние. */
const SEARCH_AHEAD_DAYS = 40;

export interface MoonSpreadState {
  kind: MoonEventKind;
  /** Момент события: текущего, если окно идёт, иначе ближайшего будущего. */
  at: Date;
  open: boolean;
}

function inWindow(eventISO: string, todayISO: string): boolean {
  return (
    todayISO === eventISO ||
    todayISO === plusDaysISO(eventISO, -MOON_WINDOW_DAYS) ||
    todayISO === plusDaysISO(eventISO, MOON_WINDOW_DAYS)
  );
}

/** Открыто ли окно ИМЕННО ЭТОГО события. Нужна там, где событие уже известно — панель под
 *  строкой события на экране луны. Без неё панель пришлось бы спрашивать «какое событие сейчас
 *  актуально», и под вторым полнолунием месяца (голубая луна) она показала бы состояние первого. */
export function isMoonWindowOpen(at: Date, now: Date = new Date()): boolean {
  return inWindow(localDateISO(at), localDateISO(now));
}

/** Источник событий инъектируется — тем же приёмом, что monthEvents (47) и moonDaysIn (47б):
 *  без него проверка «момент → ЛОКАЛЬНЫЙ день» стала бы тавтологией.
 *  null — событий этого вида в горизонте нет: в приложении недостижимо, защита от пустого
 *  источника; экран в этом случае просто не рисует панель. */
export function moonSpreadState(
  kind: MoonEventKind,
  now: Date = new Date(),
  source: EventSource = moonEvents,
): MoonSpreadState | null {
  const todayISO = localDateISO(now);
  // от вчерашней полуночи: событие вчера ещё держит окно на сегодня, позавчерашнее — уже нет
  const events = source(localMidnight(now, -MOON_WINDOW_DAYS), localMidnight(now, SEARCH_AHEAD_DAYS))
    .filter((e) => e.kind === kind)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const open = events.find((e) => inWindow(localDateISO(e.at), todayISO));
  if (open) return { kind, at: open.at, open: true };

  const next = events.find((e) => localDateISO(e.at) > todayISO);
  return next ? { kind, at: next.at, open: false } : null;
}
