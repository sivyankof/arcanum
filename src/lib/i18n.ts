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
        resonated: "отзывалась {{n}}",
      },
      profile: { title: "Профиль", streak: "СЕРИЯ", cards: "КАРТ ДНЯ" },
      settings: {
        title: "Настройки", theme: "Тема", dark: "Тёмная", light: "Светлая",
        language: "Язык", languageValue: "Русский", resetToday: "Сбросить карту дня",
        reflection: "Вечерняя рефлексия", on: "Вкл", off: "Выкл",
        reflectNow: "Рефлексия: показать сейчас",
        pushes: "Напоминания",
        pushMorning: "Утреннее", pushEvening: "Вечернее", pushDenied: "Выключены в системе",
        // между тапом по тумблеру и ответом системного диалога тумблер ещё не включён —
        // строка обязана честно показывать это промежуточное состояние, а не заранее «Вкл»
        // (пункт 1 второй волны фиксов 06б)
        pushRequesting: "Спрашиваем…",
        pushHint: "Ещё напомним, если серия под угрозой, и один раз — если вы давно не заходили",
        pickMorning: "Когда напомнить утром", pickEvening: "Когда напомнить вечером",
        testPush: "Тестовый пуш (10 сек)",
        showPlan: "План пушей",
        planEmpty: "Ничего не запланировано",
        queuedCount: "В очереди системы: {{count}}",
        close: "Закрыть",
        ok: "Готово",
      },
      // заголовки баннеров: тело пуша берётся из content/phrases.json (правило вариативности),
      // а заголовок — короткая метка типа. Числительное — плюрализацией, иначе «Серия 3 дней»
      push: {
        titleMorning: "Карта дня ✦",
        titleEvening: "Как прошёл день?",
        titleStreak_one: "Серия {{count}} день",
        titleStreak_few: "Серия {{count}} дня",
        titleStreak_many: "Серия {{count}} дней",
        titleComeback: "Давно не виделись",
        // готовая форма «N дней» для подстановки {days} в push.streak_save (content/phrases.json):
        // сырая подстановка числа без плюрализации давала «Серия 3 дней» — заголовок пуша строкой
        // выше уже согласован числительным, а тело было рассинхронизировано (пункт C финального
        // ревью 06б)
        streakDays_one: "{{count}} день",
        streakDays_few: "{{count}} дня",
        streakDays_many: "{{count}} дней",
        // прелюдия разрешения на пуши — вопрос после первого переворота карты дня (спека 06б)
        preludeTitle: "Напомнить утром?",
        preludeText: "Пришлём одно тихое напоминание, когда придёт время новой карты. Выключить можно в любой момент в настройках.",
        preludeYes: "Напомнить",
        preludeNo: "Не сейчас",
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
        cardHistory: "Ваша история с картой",
        drawn_one: "Выпадала {{count}} раз", drawn_few: "Выпадала {{count}} раза", drawn_many: "Выпадала {{count}} раз",
        drawnOnce: "Выпадала {{date}}",
        lastDate: "последняя {{date}}",
        resonated_one: "Отозвалось {{n}} из {{count}} дня",
        resonated_few: "Отозвалось {{n}} из {{count}} дней",
        resonated_many: "Отозвалось {{n}} из {{count}} дней",
        filters: { all: "Все", note: "С заметкой" },
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
      // вечерняя рефлексия (product-spec §1). Слово «сбылось» запрещено content-guide:
      // мы про рефлексию, а не про предсказание, — везде «отозвалась»
      reflect: {
        title: "Как прошёл день",
        yes: "Отозвалась", partly: "Отчасти", no: "Не отозвалась",
        saved: "Записано в дневник · {{answer}}",
        edit: "изменить можно до полуночи",
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
        resonated: "resonated {{n}}",
      },
      profile: { title: "Profile", streak: "STREAK", cards: "DAILY CARDS" },
      settings: {
        title: "Settings", theme: "Theme", dark: "Dark", light: "Light",
        language: "Language", languageValue: "English", resetToday: "Reset daily card",
        reflection: "Evening reflection", on: "On", off: "Off",
        reflectNow: "Reflection: show now",
        pushes: "Reminders",
        pushMorning: "Morning", pushEvening: "Evening", pushDenied: "Off in system settings",
        pushRequesting: "Asking…",
        pushHint: "We'll also nudge you if your streak is at risk, and once if you've been away",
        pickMorning: "Morning reminder time", pickEvening: "Evening reminder time",
        testPush: "Test push (10 sec)",
        showPlan: "Scheduled pushes",
        planEmpty: "Nothing scheduled",
        queuedCount: "Queued with the system: {{count}}",
        close: "Close",
        ok: "Done",
      },
      push: {
        titleMorning: "Card of the day ✦",
        titleEvening: "How was your day?",
        titleStreak_one: "{{count}}-day streak",
        titleStreak_other: "{{count}}-day streak",
        titleComeback: "It's been a while",
        // не используется в англ. варианте фразы («{n}-day streak» уже корректно без плюрализации
        // слова «day»), но ключ должен существовать в обоих языках — правило проекта
        streakDays_one: "{{count}} day",
        streakDays_other: "{{count}} days",
        preludeTitle: "A morning nudge?",
        preludeText: "We'll send one quiet reminder when it's time for a new card. You can turn it off anytime in settings.",
        preludeYes: "Remind me",
        preludeNo: "Not now",
      },
      journal: {
        title: "Journal",
        monthCard: "Card of the month",
        times_one: "{{count}} time", times_other: "{{count}} times",
        entries_one: "{{count}} entry", entries_other: "{{count}} entries",
        withNote: "{{count}} with a note",
        noNote: "No note",
        cardHistory: "Your history with this card",
        drawn_one: "Drawn {{count}} time", drawn_other: "Drawn {{count}} times",
        drawnOnce: "Drawn on {{date}}",
        lastDate: "last on {{date}}",
        resonated_one: "Resonated on {{n}} of {{count}} day",
        resonated_other: "Resonated on {{n}} of {{count}} days",
        filters: { all: "All", note: "With a note" },
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
      reflect: {
        title: "How was your day",
        yes: "Resonated", partly: "Partly", no: "Not really",
        saved: "Saved to your journal · {{answer}}",
        edit: "you can change this until midnight",
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
