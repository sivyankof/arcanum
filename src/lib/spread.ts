/** Расклады: запись, тасование, лимиты и текст позиции (спека 36, logic-spec §1а/§7).
 *  Чистый модуль без react/expo — целиком под юнит-тестами (spread.test.ts). */
import { cardById, cards } from './content';
import { inLang, type Lang } from './lang';
import { normalizeText } from './journal';

/** Карта в позиции расклада. Порядок в массиве = порядок позиций spreads.json. */
export interface DrawnCard {
  cardId: string;
  reversed: boolean;
}

/** Сохранённый расклад (logic-spec §1а). `ts` — момент тасования в мс и одновременно идентификатор
 *  записи: раскладов в один день может быть несколько, дата ключом не годится. */
export interface SpreadDraw {
  ts: number;
  date: string; // YYYY-MM-DD, локальный день тасования
  spreadId: string;
  cards: DrawnCard[];
  question?: string;
  note?: string;
}

/** Предел истории раскладов (logic-spec §7): старые отрезаются. */
export const SPREADS_MAX = 100;
/** Предел длины вопроса к раскладу; заметка — NOTE_MAX из journal.ts. */
export const QUESTION_MAX = 200;
/** Вероятность перевёрнутой карты в раскладе (logic-spec §1а). */
export const REVERSED_P = 0.3;

export function normalizeQuestion(text: string): string {
  return normalizeText(text, QUESTION_MAX);
}

/** Тасуем все 78 (Фишер–Йетс), берём первые count — карта не может выпасть дважды в одном раскладе;
 *  каждой независимо reversed с вероятностью REVERSED_P. rng — параметр ради детерминированных
 *  тестов; в приложении — Math.random (криптостойкость не нужна). */
export function dealSpread(count: number, rng: () => number = Math.random): DrawnCard[] {
  const ids = cards.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count).map((cardId) => ({ cardId, reversed: rng() < REVERSED_P }));
}

/** Текст значения позиции: general у прямой, reversed у перевёрнутой (product-spec §4).
 *  Блок со статусом todo (или неизвестная карта) → todo: true, экран показывает «Текст готовится». */
export function cardMeaning(cardId: string, reversed: boolean, lang: Lang): { text: string; todo: boolean } {
  const block = cardById.get(cardId)?.content[reversed ? 'reversed' : 'general'];
  if (!block || block.status === 'todo') return { text: '', todo: true };
  return { text: inLang(block, lang), todo: false };
}

/** Часть react-i18next `t`, нужная этому модулю: один параметр `name` у ключа
 *  `spread.reversedName`, без параметров у `card.soon`. Берём как аргумент функции, а не
 *  импортируем react-i18next — модуль обязан остаться чистым от react (см. шапку файла). */
type Translate = (key: string, options?: { name?: string }) => string;

/** Готовая ПОДПИСЬ выпавшей карты (не просто имя): имя на языке пользователя — или сам `cardId`,
 *  если карты почему-то нет в каталоге (та же защита, что у cardMeaning) — и, для перевёрнутой
 *  карты, обёртка в `spread.reversedName`. Вынесена сюда, потому что одну и ту же карту в одном
 *  кадре считали трижды: подпись под картой на доске (SpreadBoard), в строке ленты (SpreadRow)
 *  и заголовок панели значения под доской (SpreadScreen) — три копии одной и той же логики. */
export function drawnCardLabel(cardId: string, reversed: boolean, lang: Lang, tr: Translate): string {
  const card = cardById.get(cardId);
  const name = card ? inLang(card.name, lang) : cardId;
  return reversed ? tr('spread.reversedName', { name }) : name;
}

/** Готовый текст значения ВМЕСТЕ с признаком todo: блок ещё не написан → текст `card.soon`
 *  («Текст готовится»), иначе — сам текст cardMeaning. Признак todo отдаём и дальше — вызывающие
 *  красят текст в muted и курсив (design-system §5). Ветка «todo → card.soon, иначе текст» была
 *  продублирована в SpreadScreen и SpreadRow — второй слой того же дубля, что и drawnCardLabel. */
export function spreadMeaningText(cardId: string, reversed: boolean, lang: Lang, tr: Translate): { text: string; todo: boolean } {
  const m = cardMeaning(cardId, reversed, lang);
  return { text: m.todo ? tr('card.soon') : m.text, todo: m.todo };
}
