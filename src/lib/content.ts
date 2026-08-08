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
  keywords: Record<Lang, string[]>;
  image: string;
  content: Record<string, CardContentBlock>;
}

export const cards = (cardsJson as any).cards as TarotCard[];
export const spreads = (spreadsJson as any).spreads as any[];
export const course = (courseJson as any).modules as any[];

export const cardById = new Map(cards.map((c) => [c.id, c]));

/** Детерминированная карта дня: одна и та же на весь день для пользователя. */
export function cardOfDay(dateISO: string, userSeed = 0): TarotCard {
  let h = userSeed;
  for (const ch of dateISO) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return cards[h % cards.length];
}

/** Изображения карт: expo требует статических require — карта генерируется скриптом. */
export { cardImages } from "./cardImages";
