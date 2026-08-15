/** Дневник: группировка истории карт дня по месяцам, сводки месяца и личная история карты.
 *
 *  Чистые функции без React — на них живут дневник в профиле, блок «Ваша история с картой»
 *  и проверки заметки в сторе. Правила и тест-кейсы: docs/specs/05-journal-part1.md,
 *  docs/logic-spec.md §3 (сбор и использование), §9 (никакого Math.random в выборе текста/карты).
 */
import { localDateISO } from './dates';

/** Ответ вечерней рефлексии (logic-spec §3). */
export type Outcome = 'yes' | 'partly' | 'no';

/** Знак ответа в интерфейсе: строка дневника, чипы-фильтры, свёрнутая строка рефлексии. */
export const OUTCOME_MARK: Record<Outcome, string> = { yes: '✓', partly: '≈', no: '✗' };

/** «Отозвалась» = утвердительный ответ или частичный (logic-spec §3): так считается
 *  и сводка месяца, и счётчик на странице карты. */
export const isResonated = (o?: Outcome): boolean => o === 'yes' || o === 'partly';

/** Токен темы для каждого ответа. Красного нет намеренно: «не отозвалась» — не ошибка
 *  (design-system §4). Имена токенов, а не цвета: модуль чистый и про тему не знает. */
export const OUTCOME_COLOR: Record<Outcome, 'success' | 'accent' | 'muted'> = {
  yes: 'success',
  partly: 'accent',
  no: 'muted',
};

/** Запись дня: карта дня, заметка и вечерняя рефлексия. */
export interface DailyDraw {
  date: string; // YYYY-MM-DD
  cardId: string;
  reversed: boolean;
  note?: string;
  outcome?: Outcome;
}

/** Фильтры ленты дневника (product-spec §5). */
export type JournalFilter = 'all' | Outcome | 'note';
export const JOURNAL_FILTERS: JournalFilter[] = ['all', 'yes', 'partly', 'no', 'note'];

/** Предел длины заметки (logic-spec §3). */
export const NOTE_MAX = 500;

/** Предел истории карт дня (logic-spec §7): старые записи отрезаются. */
export const HISTORY_MAX = 365;

/** Сводка календарного месяца для карточки в шапке дневника. */
export interface MonthSummary {
  count: number;              // записей за месяц
  withNote: number;           // из них с заметкой
  topCardId?: string;         // «карта месяца» — самая частая
  topCount: number;           // сколько раз она выпадала
}

/** Сводка рефлексий месяца: для строки «Отозвалось X из Y» и полоски распределения. */
export interface OutcomeStats {
  answered: number;   // дни С ОТВЕТОМ — знаменатель
  resonated: number;  // yes + partly
  yes: number;
  partly: number;
  no: number;
}

/** Личная история одной карты для блока на её странице. */
export interface CardHistory {
  times: number;
  resonated: number;
  lastDate?: string;
  lastNote?: string;
}

/** Правка разрешена только за сегодня: в полночь запись фиксируется (logic-spec §3).
 *  Одно правило и для заметки, и для ответа рефлексии. */
export function canEditEntry(date: string, today: string = localDateISO()): boolean {
  return date === today;
}

/** Текст перед записью в стор: пробелы по краям срезаем, лишнее сверх лимита отбрасываем.
 *  Общий для заметки дня, заметки и вопроса расклада (спека 36). */
export function normalizeText(text: string, max: number): string {
  return text.trim().slice(0, max);
}

/** Заметка карты дня — normalizeText с лимитом NOTE_MAX. */
export function normalizeNote(text: string): string {
  return normalizeText(text, NOTE_MAX);
}

/** Месяц записи в формате YYYY-MM. */
function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Сортировка «новые сверху». Порядок записей в сторе не гарантирован: их переставляют
 *  сброс карты дня и будущий импорт дневника (задача 11), поэтому сортируем сами. */
function byDateDesc(a: DailyDraw, b: DailyDraw): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

/** Месяцы, в которых есть записи, новые первыми: `['2026-08', '2026-07']`.
 *  Навигатор дневника листает только их — пустых месяцев в ленте не бывает. */
export function monthsWithEntries(history: DailyDraw[]): string[] {
  const months = new Set(history.map((h) => monthOf(h.date)));
  return [...months].sort().reverse();
}

/** Записи календарного месяца, новые сверху. */
export function entriesOfMonth(history: DailyDraw[], month: string): DailyDraw[] {
  return history.filter((h) => monthOf(h.date) === month).sort(byDateDesc);
}

/** Сводка месяца. «Карта месяца» — мода по cardId; при равенстве частот выигрывает та,
 *  у которой свежее запись (записи отсортированы, поэтому лидер встречается первым). */
export function monthSummary(history: DailyDraw[], month: string): MonthSummary {
  const entries = entriesOfMonth(history, month);
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.cardId, (counts.get(e.cardId) ?? 0) + 1);

  let topCardId: string | undefined;
  let topCount = 0;
  for (const e of entries) {
    const n = counts.get(e.cardId)!;
    if (n > topCount) {
      topCount = n;
      topCardId = e.cardId;
    }
  }

  return {
    count: entries.length,
    withNote: entries.filter((e) => e.note).length,
    topCardId,
    topCount,
  };
}

/** История одной карты: сколько раз выпадала, когда в последний раз и последняя заметка.
 *  Заметку берём из свежайшей записи, У КОТОРОЙ ОНА ЕСТЬ: иначе вчерашнее выпадение
 *  без заметки прятало бы позавчерашнюю запись с текстом. */
export function cardHistory(history: DailyDraw[], cardId: string): CardHistory {
  const entries = history.filter((h) => h.cardId === cardId).sort(byDateDesc);
  return {
    times: entries.length,
    resonated: entries.filter((e) => isResonated(e.outcome)).length,
    lastDate: entries[0]?.date,
    lastNote: entries.find((e) => e.note)?.note,
  };
}

/** Сводка ответов за месяц. Знаменатель — дни С ОТВЕТОМ, а не все записи месяца:
 *  «Отозвалось 12 из 18» читается как «из 18 дней, когда вы отвечали» (logic-spec §3). */
export function outcomeStats(history: DailyDraw[], month: string): OutcomeStats {
  const entries = entriesOfMonth(history, month);
  const yes = entries.filter((e) => e.outcome === 'yes').length;
  const partly = entries.filter((e) => e.outcome === 'partly').length;
  const no = entries.filter((e) => e.outcome === 'no').length;
  return { answered: yes + partly + no, resonated: yes + partly, yes, partly, no };
}

/** Записи, попавшие под фильтр ленты. */
export function filterEntries(entries: DailyDraw[], filter: JournalFilter): DailyDraw[] {
  if (filter === 'all') return entries;
  if (filter === 'note') return entries.filter((e) => !!e.note);
  return entries.filter((e) => e.outcome === filter);
}

/** Числа для чипов-фильтров. Чип с нулём не показывается, поэтому счёт нужен заранее. */
export function filterCounts(entries: DailyDraw[]): Record<JournalFilter, number> {
  return {
    all: entries.length,
    yes: filterEntries(entries, 'yes').length,
    partly: filterEntries(entries, 'partly').length,
    no: filterEntries(entries, 'no').length,
    note: filterEntries(entries, 'note').length,
  };
}
