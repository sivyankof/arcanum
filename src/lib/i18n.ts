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
      // major — подпись чипа-фильтра, поэтому короткая: длинная не влезала в одну строку (спека 04)
      cards: {
        title: "78 карт", major: "Старшие", wands: "Жезлы", cups: "Кубки", swords: "Мечи", pentacles: "Пентакли",
        all: "Все", searchPlaceholder: "Найти карту…", empty: "Такой карты нет — проверьте написание",
      },
      card: {
        general: "Общее значение", reversed: "Перевёрнутая", love: "Любовь", career: "Работа",
        finances: "Финансы", health: "Здоровье", day_card: "Как карта дня", symbolism: "Символика",
        keywords: "Ключевые слова", soon: "Текст готовится", backAll: "Карты", backToday: "Сегодня",
        backProfile: "Профиль", todayHighlight: "Ваша карта сегодня",
        tabGeneral: "Общее", sphereLove: "В любви", sphereCareer: "В работе", sphereFinances: "В финансах", sphereHealth: "Для здоровья",
      },
      profile: { title: "Профиль", streak: "СЕРИЯ", cards: "КАРТ ДНЯ" },
      settings: {
        title: "Настройки", theme: "Тема", dark: "Тёмная", light: "Светлая",
        language: "Язык", languageValue: "Русский", resetToday: "Сбросить карту дня",
      },
      // дневник в профиле и блок «Ваша история с картой» (product-spec §5, logic-spec §3).
      // Числительные — плюрализация i18next: _one/_few/_many для русского
      journal: {
        title: "Дневник",
        monthCard: "Карта месяца",
        times_one: "{{count}} раз", times_few: "{{count}} раза", times_many: "{{count}} раз",
        entries_one: "{{count}} запись", entries_few: "{{count}} записи", entries_many: "{{count}} записей",
        withNote: "{{count}} с заметкой",
        noNote: "Без заметки",
        empty: "Первая запись появится после карты дня",
        cardHistory: "Ваша история с картой",
        drawn_one: "Выпадала {{count}} раз", drawn_few: "Выпадала {{count}} раза", drawn_many: "Выпадала {{count}} раз",
        drawnOnce: "Выпадала {{date}}",
        lastDate: "последняя {{date}}",
      },
      note: {
        title: "Заметка",
        add: "+ Добавить заметку о дне…",
        placeholder: "О чём этот день?",
        save: "Сохранить",
        leaveTitle: "Уйти без сохранения?",
        leaveText: "Заметка не сохранится",
        leave: "Уйти", stay: "Остаться",
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
      cards: {
        title: "78 cards", major: "Major", wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles",
        all: "All", searchPlaceholder: "Find a card…", empty: "No such card — check the spelling",
      },
      card: {
        general: "General meaning", reversed: "Reversed", love: "Love", career: "Career",
        finances: "Finances", health: "Health", day_card: "As card of the day", symbolism: "Symbolism",
        keywords: "Keywords", soon: "Text in progress", backAll: "Cards", backToday: "Today",
        backProfile: "Profile", todayHighlight: "Your card today",
        tabGeneral: "General", sphereLove: "In love", sphereCareer: "At work", sphereFinances: "In finances", sphereHealth: "For health",
      },
      profile: { title: "Profile", streak: "STREAK", cards: "DAILY CARDS" },
      settings: {
        title: "Settings", theme: "Theme", dark: "Dark", light: "Light",
        language: "Language", languageValue: "English", resetToday: "Reset daily card",
      },
      journal: {
        title: "Journal",
        monthCard: "Card of the month",
        times_one: "{{count}} time", times_other: "{{count}} times",
        entries_one: "{{count}} entry", entries_other: "{{count}} entries",
        withNote: "{{count}} with a note",
        noNote: "No note",
        empty: "Your first entry appears after a card of the day",
        cardHistory: "Your history with this card",
        drawn_one: "Drawn {{count}} time", drawn_other: "Drawn {{count}} times",
        drawnOnce: "Drawn on {{date}}",
        lastDate: "last on {{date}}",
      },
      note: {
        title: "Note",
        add: "+ Add a note about the day…",
        placeholder: "What was this day about?",
        save: "Save",
        leaveTitle: "Leave without saving?",
        leaveText: "The note will not be saved",
        leave: "Leave", stay: "Stay",
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
