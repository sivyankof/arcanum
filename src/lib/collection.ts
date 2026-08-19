/** Коллекция-альбом (спека 46, logic-spec §13): чистые функции над колодой и множеством изученных
 *  карт. Ничего не хранится — альбом целиком выводится из `learnedCardIds` (то же множество, что
 *  бейдж «ИЗУЧЕНО ✓» справочника и колода тренажёра): «открыто» = «изучено», правило одно на три места. */
import type { TarotCard } from './content';

/** Секции альбома в порядке экрана: старшие арканы, затем масти в порядке чипов справочника и курса М4. */
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

/** Режим секции на экране (решение спеки 46, вопрос 7): хотя бы одна открытая карта — сетка
 *  с заголовком «НАЗВАНИЕ · N ИЗ M», ни одной — компактная строка «Название · 0 ИЗ M». */
export type SectionMode = 'grid' | 'row';
export function sectionMode(s: CollectionSection): SectionMode {
  return s.open > 0 ? 'grid' : 'row';
}
