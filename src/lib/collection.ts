/** Прогресс изучения в справочнике (спека 46б, logic-spec §13): чистые функции над колодой
 *  и множеством изученных карт. Ничего не хранится — секции целиком выводятся из `learnedCardIds`
 *  (то же множество, что бейдж «ИЗУЧЕНО ✓» справочника и колода тренажёра): «открыто» = «изучено»,
 *  правило одно на три места. */
import type { TarotCard } from './content';
import type { CardFilter } from './cardSearch';

/** Секции справочника в порядке экрана: старшие арканы, затем масти в порядке чипов справочника и курса М4. */
export type CollectionGroup = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
export const COLLECTION_GROUPS: readonly CollectionGroup[] = ['major', 'wands', 'cups', 'swords', 'pentacles'];

export interface CollectionSection {
  group: CollectionGroup;
  /** карты секции по возрастанию `number` (старшие 0–21, младшие 1–14: Туз … Король) */
  cards: TarotCard[];
  /** сколько из них изучено */
  open: number;
  total: number;
}

/** Секция карты: старший аркан → 'major', младший → его масть. У младшего масть есть всегда
 *  (контракт-тест колоды); `?? 'major'` — только чтобы не ронять экран на битых данных. */
export function groupOf(card: TarotCard): CollectionGroup {
  return card.arcana === 'major' ? 'major' : (card.suit ?? 'major');
}

export function collectionSections(
  deck: readonly TarotCard[],
  learned: ReadonlySet<string>,
): CollectionSection[] {
  return COLLECTION_GROUPS.map((group) => {
    const cards = deck.filter((c) => groupOf(c) === group).sort((a, b) => a.number - b.number);
    const open = cards.filter((c) => learned.has(c.id)).length;
    return { group, cards, open, total: cards.length };
  });
}

/** «Открыто N из 78» — сумма по секциям (а не размер множества: чужих id в нём не считаем). */
export function collectionProgress(sections: readonly CollectionSection[]): { open: number; total: number } {
  return sections.reduce(
    (acc, s) => ({ open: acc.open + s.open, total: acc.total + s.total }),
    { open: 0, total: 0 },
  );
}

/** Число под активным чипом справочника (спека 46б): «Все»/«Изучено» — вся колода, группа — её секция. */
export function filterProgress(
  sections: readonly CollectionSection[],
  filter: CardFilter,
): { open: number; total: number } {
  if (filter === 'all' || filter === 'learned') return collectionProgress(sections);
  const s = sections.find((x) => x.group === filter);
  return s ? { open: s.open, total: s.total } : { open: 0, total: 0 };
}
