/** Дневник: группировка истории карт дня по месяцам, сводки месяца и личная история карты.
 *
 *  Чистые функции без React — на них живут дневник в профиле, блок «Ваша история с картой»
 *  и проверки заметки в сторе. Правила и тест-кейсы: docs/specs/05-journal-part1.md,
 *  docs/logic-spec.md §3 (сбор и использование), §9 (никакого Math.random в выборе текста/карты).
 */
import { localDateISO } from './dates';

/** Запись дня: карта дня, заметка и вечерняя рефлексия (outcome наполнится в задаче 06). */
export interface DailyDraw {
  date: string; // YYYY-MM-DD
  cardId: string;
  reversed: boolean;
  note?: string;
  outcome?: 'yes' | 'partly' | 'no'; // вечерняя рефлексия «сбылось?»
}

/** Предел длины заметки (logic-spec §3). */
export const NOTE_MAX = 500;

/** Сводка календарного месяца для карточки в шапке дневника. */
export interface MonthSummary {
  count: number;              // записей за месяц
  withNote: number;           // из них с заметкой
  topCardId?: string;         // «карта месяца» — самая частая
  topCount: number;           // сколько раз она выпадала
}

/** Личная история одной карты для блока на её странице. */
export interface CardHistory {
  times: number;
  lastDate?: string;
  lastNote?: string;
}

/** Правка заметки разрешена только за сегодня: в полночь запись фиксируется (logic-spec §3). */
export function canEditNote(date: string, today: string = localDateISO()): boolean {
  return date === today;
}

/** Заметка перед записью в стор: пробелы по краям срезаем, лишнее сверх лимита отбрасываем. */
export function normalizeNote(text: string): string {
  return text.trim().slice(0, NOTE_MAX);
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
    lastDate: entries[0]?.date,
    lastNote: entries.find((e) => e.note)?.note,
  };
}
