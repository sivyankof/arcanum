import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ru: {
    translation: {
      tabs: { today: "Сегодня", course: "Курс", cards: "Карты", spreads: "Расклады", profile: "Профиль" },
      today: { title: "Карта дня", draw: "Вытянуть карту", drawn: "Ваша карта на сегодня" },
      // фазы луны и лунный день — строка под разделителем на «Сегодня» (logic-spec §6)
      moon: {
        new: "Новолуние", waxing: "Растущая луна", full: "Полнолуние", waning: "Убывающая луна",
        day: "{{n}}-й лунный день",
      },
      // титулы уровней — logic-spec §4; шестой титул общий для 6-го и всех следующих
      level: {
        line: "Уровень {{n}} · {{title}}",
        t1: "Любопытная", t2: "Ученица", t3: "Читающая",
        t4: "Толковательница", t5: "Хранительница", t6: "Мастерица",
      },
      cards: { title: "Все карты", major: "Старшие арканы", wands: "Жезлы", cups: "Кубки", swords: "Мечи", pentacles: "Пентакли" },
      card: {
        general: "Общее значение", reversed: "Перевёрнутая", love: "Любовь", career: "Работа",
        finances: "Финансы", health: "Здоровье", day_card: "Как карта дня", symbolism: "Символика",
        keywords: "Ключевые слова", soon: "Текст готовится", backAll: "Карты", backToday: "Сегодня", todayHighlight: "Ваша карта сегодня",
        tabGeneral: "Общее", sphereLove: "В любви", sphereCareer: "В работе", sphereFinances: "В финансах", sphereHealth: "Для здоровья",
      },
    },
  },
  en: {
    translation: {
      tabs: { today: "Today", course: "Course", cards: "Cards", spreads: "Spreads", profile: "Profile" },
      today: { title: "Card of the Day", draw: "Draw a card", drawn: "Your card for today" },
      moon: {
        new: "New moon", waxing: "Waxing moon", full: "Full moon", waning: "Waning moon",
        day: "lunar day {{n}}",
      },
      level: {
        line: "Level {{n}} · {{title}}",
        t1: "Curious", t2: "Student", t3: "Reader",
        t4: "Interpreter", t5: "Keeper", t6: "Adept",
      },
      cards: { title: "All cards", major: "Major Arcana", wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" },
      card: {
        general: "General meaning", reversed: "Reversed", love: "Love", career: "Career",
        finances: "Finances", health: "Health", day_card: "As card of the day", symbolism: "Symbolism",
        keywords: "Keywords", soon: "Text in progress", backAll: "Cards", backToday: "Today", todayHighlight: "Your card today",
        tabGeneral: "General", sphereLove: "In love", sphereCareer: "At work", sphereFinances: "In finances", sphereHealth: "For health",
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
