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

/** Разбивает строку на слова: «баланс работы и дома» → четыре токена (спека 04з).
 *  Фразы в ключевых словах — норма, а искать человек будет по одному слову из фразы. */
export function tokenize(s: string): string[] {
  return normalize(s).split(/[\s-]+/).filter(Boolean);
}

/** Окончания для отсечения, сначала длинные — иначе «деньгами» потеряет только «и». */
const ENDINGS: Record<Lang, string[]> = {
  ru: ['ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ах', 'ях', 'ов', 'ев', 'ей',
    'ой', 'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ом', 'ем', 'ам', 'ям', 'ы', 'и', 'а', 'я',
    'е', 'у', 'ю', 'ь', 'о'],
  en: ['ing', 'es', 'ed', 's'],
};

/** Минимальная длина основы: без неё «дом» превратился бы в «д» и совпал с половиной колоды. */
const MIN_STEM = 4;

/** Отсекает окончание — грубо, таблицей (спека 04з): «работе» и «работа» → «работ».
 *  Не морфологический анализатор: чередования ему не по силам («денег» ≠ «деньг»). */
export function stem(token: string, lang: Lang): string {
  let out = token;
  // два прохода: «feelings» → «feeling» → «feel», иначе форма с двумя окончаниями
  // не сходится со словарной. MIN_STEM не даёт проходам съесть слово целиком.
  for (let pass = 0; pass < 2; pass++) {
    const end = ENDINGS[lang].find(
      (e) => out.endsWith(e) && out.length - e.length >= MIN_STEM,
    );
    if (!end) break;
    out = out.slice(0, -end.length);
  }
  return out;
}

/** Совпадение двух слов: слово начинается с запроса (набор по буквам) или общая основа. */
function tokenMatches(word: string, queryToken: string, lang: Lang): boolean {
  if (word.startsWith(queryToken)) return true;
  return stem(word, lang) === stem(queryToken, lang);
}

/** Совпадает ли карта с запросом: сравниваются слова названия, ключевых слов и поисковых
 *  синонимов (текущий язык) — с учётом словоформ, спека 04з. Пустой запрос совпадает со всем.
 *  Каждый токен запроса обязан найти пару: «мир в семье» требует все три слова.
 *  `search` — скрытый слой (спека 04г): новичок ищет «расставание», а не «Тройку Мечей».
 *  `?? []` — защита границы данных: JSON приходит из бандла и типом не проверяется. */
export function matchesQuery(card: TarotCard, query: string, lang: Lang): boolean {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return true;
  const source = [card.name[lang], ...(card.keywords[lang] ?? []), ...(card.search?.[lang] ?? [])];
  const words = source.flatMap(tokenize);
  return queryTokens.every((q) => words.some((w) => tokenMatches(w, q, lang)));
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
