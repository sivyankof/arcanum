import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ru: {
    translation: {
      tabs: { today: "Сегодня", course: "Курс", cards: "Карты", spreads: "Расклады", profile: "Профиль" },
      today: { title: "Карта дня", draw: "Вытянуть карту", drawn: "Ваша карта на сегодня" },
      cards: { title: "Все карты", major: "Старшие арканы", wands: "Жезлы", cups: "Кубки", swords: "Мечи", pentacles: "Пентакли" },
      card: {
        general: "Общее значение", reversed: "Перевёрнутая", love: "Любовь", career: "Работа",
        finances: "Финансы", health: "Здоровье", day_card: "Как карта дня", symbolism: "Символика",
        keywords: "Ключевые слова", soon: "Текст готовится",
      },
    },
  },
  en: {
    translation: {
      tabs: { today: "Today", course: "Course", cards: "Cards", spreads: "Spreads", profile: "Profile" },
      today: { title: "Card of the Day", draw: "Draw a card", drawn: "Your card for today" },
      cards: { title: "All cards", major: "Major Arcana", wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" },
      card: {
        general: "General meaning", reversed: "Reversed", love: "Love", career: "Career",
        finances: "Finances", health: "Health", day_card: "As card of the day", symbolism: "Symbolism",
        keywords: "Keywords", soon: "Text in progress",
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ru",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
export const lang = () => (i18n.language.startsWith("ru") ? "ru" : "en") as "ru" | "en";
