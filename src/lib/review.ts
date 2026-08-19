/** Повторение изученных карт (спека 45, logic-spec §12): сборка сессии, сводка для карточки
 *  курса и DEV-диалога, правило начисления XP. Чистый модуль без импортов react/expo.
 *  Единственная функция, меняющая srs/reviewDay/XP, — applyReview; стор только применяет её
 *  результат (как completeLessonProgress у уроков). */
import type { CourseModule } from './content';
import { learnedCardIds, type LessonProgressMap } from './courseProgress';
import { plusDaysISO } from './dates';
import { shuffle } from './shuffle';
import { isDue, reviewState, type SrsGrade, type SrsState } from './srs';
import { XP_REVIEW } from './xp';

/** Порция карт за один заход и потолок НОВЫХ карт в день (Anki-дефолты). Премиум-гейта в v1
 *  нет — если появится, ограничивать здесь. */
export const SESSION_MAX = 10;
export const NEW_PER_DAY = 10;
/** Коридор длины подсказки-предложения. */
export const PROMPT_MIN = 20;
export const PROMPT_MAX = 160;

export type SrsMap = Record<string, SrsState>;
export type Direction = 'toMeaning' | 'toCard';
export interface SessionItem {
  cardId: string;
  direction: Direction;
  isNew: boolean;
}
/** Сколько НОВЫХ карт введено за день: счётчик действителен, только если date === сегодня. */
export interface ReviewDay {
  date: string;
  newCount: number;
}
export const REVIEW_DAY_DEFAULT: ReviewDay = { date: '', newCount: 0 };
export interface ReviewLogEntry {
  cardId: string;
  grade: SrsGrade;
}
export interface ReviewSummary {
  deckSize: number;
  due: number;
  newAvailable: number;
  dueTomorrow: number;
}

/** Колода = карты пройденных уроков в порядке курса (Set хранит порядок вставки). Вычисляется,
 *  не хранится: DEV-сброс курса сжимает колоду сам, лишние состояния srs безвредны. */
export function deckOrder(modules: CourseModule[], progress: LessonProgressMap): string[] {
  return [...learnedCardIds(modules, progress)];
}

function newToday(day: ReviewDay, todayISO: string): number {
  return day.date === todayISO ? day.newCount : 0;
}

export function reviewSummary(deck: readonly string[], srs: SrsMap, todayISO: string, day: ReviewDay): ReviewSummary {
  const tomorrow = plusDaysISO(todayISO, 1);
  let due = 0;
  let fresh = 0;
  let dueTomorrow = 0;
  for (const id of deck) {
    const s = srs[id];
    if (!s) {
      fresh++;
      continue;
    }
    if (isDue(s, todayISO)) due++;
    // «завтра: M» показывается только когда просроченных нет, поэтому <= завтра = ровно завтра
    if (s.due <= tomorrow) dueTomorrow++;
  }
  const newAvailable = Math.max(0, Math.min(fresh, NEW_PER_DAY - newToday(day, todayISO)));
  return { deckSize: deck.length, due, newAvailable, dueTomorrow };
}

/** Порция ≤ SESSION_MAX: просроченные по due ↑ (при равенстве — порядок колоды), остаток слотов —
 *  новые в порядке колоды не больше newAvailable; итог тасуется. Направление: новая карта всегда
 *  toMeaning (сначала показать образ), повторяемая — 50/50. rng — параметр ради тестов. */
export function buildSession(
  deck: readonly string[],
  srs: SrsMap,
  todayISO: string,
  day: ReviewDay,
  rng: () => number,
): SessionItem[] {
  const pos = new Map(deck.map((id, i) => [id, i] as const));
  const dueIds = deck
    .filter((id) => srs[id] !== undefined && isDue(srs[id], todayISO))
    .sort((a, b) => {
      const da = srs[a].due;
      const db = srs[b].due;
      if (da !== db) return da < db ? -1 : 1;
      return (pos.get(a) ?? 0) - (pos.get(b) ?? 0);
    })
    .slice(0, SESSION_MAX);
  const items: SessionItem[] = dueIds.map((cardId) => ({
    cardId,
    direction: rng() < 0.5 ? 'toMeaning' : 'toCard',
    isNew: false,
  }));
  const { newAvailable } = reviewSummary(deck, srs, todayISO, day);
  const slots = Math.min(SESSION_MAX - items.length, newAvailable);
  const fresh = deck.filter((id) => srs[id] === undefined).slice(0, slots);
  items.push(...fresh.map((cardId): SessionItem => ({ cardId, direction: 'toMeaning', isNew: true })));
  return shuffle(items, rng);
}

/** Очередь сессии после оценки: голова снимается; «не помню» ставит её же в хвост — карта
 *  повторяется, пока не будет вспомнена. */
export function applyGrade(queue: readonly SessionItem[], grade: SrsGrade): { queue: SessionItem[]; passed: boolean } {
  const [head, ...rest] = queue;
  if (!head) return { queue: [], passed: false };
  return grade === 0 ? { queue: [...rest, head], passed: false } : { queue: rest, passed: true };
}

/** Применить оценку: новое состояние карты, счётчик новых за день, XP. Правило XP без понятия
 *  «сессия»: +XP_REVIEW за оценку ≥1 карты, которая ДО этой оценки была к повторению (новая или
 *  due <= сегодня). Провал и затем «помню» дают +1; повторное «помню» карты, уже ушедшей
 *  на завтра, — 0; накрутка невозможна. */
export function applyReview(
  srs: SrsMap,
  day: ReviewDay,
  cardId: string,
  grade: SrsGrade,
  todayISO: string,
): { srs: SrsMap; day: ReviewDay; gained: number } {
  const prev = srs[cardId];
  const wasDue = prev === undefined || isDue(prev, todayISO);
  const next: SrsMap = { ...srs, [cardId]: reviewState(prev, grade, todayISO) };
  const nextDay: ReviewDay = prev === undefined ? { date: todayISO, newCount: newToday(day, todayISO) + 1 } : day;
  return { srs: next, day: nextDay, gained: grade >= 1 && wasDue ? XP_REVIEW : 0 };
}

/** Итог сессии для панели результата: уникальных карт, «с первого раза» (первая оценка ≥1),
 *  XP — по карте с хотя бы одной оценкой ≥1. В сессии из buildSession это совпадает с суммой
 *  gained по applyReview (инвариант под тестом): карта в сессии по построению к повторению,
 *  а вспомненная в очередь не возвращается. */
export function sessionStats(log: readonly ReviewLogEntry[]): { cards: number; firstTry: number; xp: number } {
  const first = new Map<string, SrsGrade>();
  const passed = new Set<string>();
  for (const e of log) {
    if (!first.has(e.cardId)) first.set(e.cardId, e.grade);
    if (e.grade >= 1) passed.add(e.cardId);
  }
  let firstTry = 0;
  for (const g of first.values()) if (g >= 1) firstTry++;
  return { cards: first.size, firstTry, xp: passed.size * XP_REVIEW };
}

/** Первое предложение general для оборота/подсказки: срез по первому `.`/`!`/`?`/`…`, за которым
 *  пробел или конец строки; короче PROMPT_MIN («Дурак.») — берём до второго; длиннее PROMPT_MAX —
 *  режем с «…». Точка внутри слова («1.5») концом не считается. */
export function promptSentence(text: string): string {
  const src = text.trim();
  const ends: number[] = [];
  const re = /[.!?…]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while (ends.length < 2 && (m = re.exec(src)) !== null) ends.push(m.index + m[0].length);
  let cut = ends[0] ?? src.length;
  if (cut < PROMPT_MIN && ends[1] !== undefined) cut = ends[1];
  const out = src.slice(0, cut).trim();
  return out.length > PROMPT_MAX ? `${out.slice(0, PROMPT_MAX - 1).trimEnd()}…` : out;
}
