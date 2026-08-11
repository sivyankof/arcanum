/** Доступ к контенту (78 карт, расклады, курс) — офлайн, из бандла. */
import cardsJson from "../../content/cards.json";
import spreadsJson from "../../content/spreads.json";
import courseJson from "../../content/course.json";

export type Lang = "ru" | "en";
export type BlockStatus = "todo" | "draft" | "reviewed" | "final";

export interface CardContentBlock { ru: string; en: string; status: BlockStatus }
export interface TarotCard {
  id: string;
  arcana: "major" | "minor";
  suit: "wands" | "cups" | "swords" | "pentacles" | null;
  number: number;
  name: Record<Lang, string>;
  /** Витрина: 4 канонических слова, показываются чипами под названием карты. */
  keywords: Record<Lang, string[]>;
  /** Только для поиска: житейские формулировки и смыслы перевёрнутой карты (спека 04г).
   *  В интерфейсе не показывается никогда — иначе «расставание» и «долги» лезут в чипы. */
  search: Record<Lang, string[]>;
  image: string;
  content: Record<string, CardContentBlock>;
}

export const cards = (cardsJson as any).cards as TarotCard[];
export const spreads = (spreadsJson as any).spreads as any[];
export const course = (courseJson as any).modules as any[];

export const cardById = new Map(cards.map((c) => [c.id, c]));

/** FNV-1a, 32-bit — быстрый некриптографический хеш строки в целое число [0, 2^32). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Детерминированная карта дня: (дата, личный сид) всегда дают одну и ту же карту (logic-spec §1).
 *  Анти-повтор: если естественно выпавшая карта уже была в последние 7 дней (recentCardIds),
 *  индекс пересчитывается другой солью — до 10 попыток подряд, после чего отдаём как есть
 *  (лучше редкий повтор, чем зависание на 78 картах в recentCardIds). */
export function cardOfDay(dateISO: string, seed: number, recentCardIds: string[] = []): TarotCard {
  let index = fnv1a32(`${dateISO}:${seed}`) % cards.length;
  for (let n = 1; n <= 10 && recentCardIds.includes(cards[index].id); n++) {
    index = fnv1a32(`${index}:retry:${n}`) % cards.length;
  }
  return cards[index];
}

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

/** Номер карты для подписи под названием, как в эталоне («XVII · СТАРШИЙ АРКАН»):
 *  старшие арканы — римскими цифрами, младшие — арабскими. */
export function cardNumeral(card: TarotCard): string {
  return card.arcana === "major" ? ROMAN[card.number] : String(card.number);
}

/** Изображения карт: expo требует статических require — карта генерируется скриптом. */
export { cardImages } from "./cardImages";
