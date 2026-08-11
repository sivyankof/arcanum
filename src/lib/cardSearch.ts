/** Поиск и фильтрация справочника карт (спека 04).
 *  Чистые функции без React — чтобы покрыть тестами и переиспользовать (дневник, коллекция). */
import type { Lang, TarotCard } from './content';

/** Фильтр по аркану/масти: 'all' — вся колода. */
export type CardFilter = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';

export const CARD_FILTERS: CardFilter[] = ['all', 'major', 'wands', 'cups', 'swords', 'pentacles'];

/** Приводит строку к виду для сравнения: нижний регистр, «ё» → «е», без крайних пробелов.
 *  «Ё» отдельной буквой набирают редко, а ищут одинаково — без этой замены «жрец» не найдёт
 *  «Иерофанта», если редактор написал его через «ё». */
export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Совпадает ли карта с запросом: подстрока в названии, в ключевом слове ИЛИ в поисковом
 *  синониме (текущий язык). Пустой запрос совпадает со всем.
 *  `search` — скрытый слой (спека 04г): новичок ищет «расставание», а не «Тройку Мечей».
 *  `?? []` — защита границы данных: JSON приходит из бандла и типом не проверяется. */
export function matchesQuery(card: TarotCard, query: string, lang: Lang): boolean {
  const q = normalize(query);
  if (!q) return true;
  if (normalize(card.name[lang]).includes(q)) return true;
  const words = [...(card.keywords[lang] ?? []), ...(card.search?.[lang] ?? [])];
  return words.some((k) => normalize(k).includes(q));
}

/** Отбор карт: сначала аркан/масть, затем текстовый запрос.
 *  Сброс фильтра при вводе запроса делает экран (спека 04, §2), здесь оба условия просто складываются. */
export function filterCards(
  list: TarotCard[],
  { query, filter, lang }: { query: string; filter: CardFilter; lang: Lang },
): TarotCard[] {
  const byArcana =
    filter === 'all'
      ? list
      : filter === 'major'
        ? list.filter((c) => c.arcana === 'major')
        : list.filter((c) => c.suit === filter);
  const q = normalize(query);
  return q ? byArcana.filter((c) => matchesQuery(c, q, lang)) : byArcana;
}

/** Нарезка на ряды по `size` элементов: SectionList не умеет numColumns, сетку собираем рядами.
 *  Последний ряд может быть неполным — экран дополняет его пустыми местами. */
export function toRows<T>(items: T[], size: number): T[][] {
  if (size < 1) return items.length ? [items] : [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
