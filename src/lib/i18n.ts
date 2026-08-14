// Полифилл `Intl.PluralRules` для Hermes (hf-02). Стоит ПЕРВОЙ строкой файла намеренно:
// импорты выполняются по порядку объявления, поэтому правила встают до `i18n.init()` и до первого
// `t()`. В Hermes встроенного механизма выбора формы числительного нет, i18next 26 молча берёт
// заглушку «1 → one, всё остальное → other», ключа `*_other` у русских семейств нет ни одного,
// и строка уходит на `fallbackLng: "en"` — в русском интерфейсе появляется «6 MODULES · 32 LESSONS».
// Пакет ставит себя ТОЛЬКО когда движок не тянет правила сам, поэтому в браузере и в тестах
// продолжает работать родной ICU и веб с устройством считают формы одинаково.
// Разбор: docs/specs/hf-02-plurals-research.md, решение: docs/specs/hf-02-hermes-plurals.md
import "intl-pluralrules";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// экспортируется ради тестов плюрализации: структурный тест и оракул обходят языки
// по `Object.keys(resources)`, а не по литералам "ru"/"en" — иначе третий язык проехал бы мимо
export const resources = {
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
        learned: "ИЗУЧЕНО ✓",
      },
      card: {
        general: "Общее значение", reversed: "Перевёрнутая", love: "Любовь", career: "Работа",
        finances: "Финансы", health: "Здоровье", day_card: "Как карта дня", symbolism: "Символика",
        keywords: "Ключевые слова", soon: "Текст готовится", backAll: "Карты", backToday: "Сегодня",
        backProfile: "Профиль", todayHighlight: "Ваша карта сегодня",
        tabGeneral: "Общее", sphereLove: "В любви", sphereCareer: "В работе", sphereFinances: "В финансах", sphereHealth: "Для здоровья",
        resonated: "отзывалась {{n}}",
      },
      // экран курса — «путь» (спека 07); числительные плюрализацией, иначе «1 УРОКОВ»
      course: {
        title: "Курс",
        modules_one: "{{count}} МОДУЛЬ", modules_few: "{{count}} МОДУЛЯ", modules_many: "{{count}} МОДУЛЕЙ",
        lessons_one: "{{count}} УРОК", lessons_few: "{{count}} УРОКА", lessons_many: "{{count}} УРОКОВ",
        cardsCount_one: "{{count}} КАРТА", cardsCount_few: "{{count}} КАРТЫ", cardsCount_many: "{{count}} КАРТ",
        moduleOf: "МОДУЛЬ {{n}} ИЗ {{total}}",
        startLesson: "НАЧАТЬ УРОК",
        lessonOverline: "МОДУЛЬ {{m}} · УРОК {{l}}",
        lessonPreparing: "Урок готовится",
      },
      // экран урока (спека 08). passedOf: «уроков» склоняется по ЧИСЛУ M (count) —
      // «из 1 урока», «из 6 уроков»; та же ловушка, что «из 1 дней» в 06а
      lesson: {
        theoryTitle: "Теория",
        cardStep: "КАРТА УРОКА",
        next: "ДАЛЕЕ",
        xpGain: "+{{n}} XP",
        passedOf_one: "ПРОЙДЕНО {{done}} ИЗ {{count}} УРОКА МОДУЛЯ",
        passedOf_few: "ПРОЙДЕНО {{done}} ИЗ {{count}} УРОКОВ МОДУЛЯ",
        passedOf_many: "ПРОЙДЕНО {{done}} ИЗ {{count}} УРОКОВ МОДУЛЯ",
        repeatDone: "Повторение пройдено",
        nextOnPath: "ДАЛЬШЕ ПО ПУТИ →",
      },
      // экран раскладов. cards — НЕ дубль course.cardsCount: там строка живёт в overline шапки
      // модуля и набрана капсом («8 КАРТ»), здесь — в описании обычным регистром («3 карты»).
      // Один ключ на оба места дал бы капс посреди предложения
      spreads: {
        overline: "ПРАКТИКА",
        title: "Расклады",
        premium: "ПРЕМИУМ",
        cards_one: "{{count}} карта", cards_few: "{{count}} карты", cards_many: "{{count}} карт",
      },
      // онбординг (спека 09); birthOverline общий с чипом на странице карты
      ob: {
        sub: "Научитесь читать таро — по 5 минут в день. Без магии из кино, с уважением к традиции.",
        start: "НАЧАТЬ ПУТЬ",
        aboutTitle: "Немного о вас",
        aboutLead: "Дата рождения откроет ваш личный аркан — карту-спутницу вашей жизни.",
        nameLabel: "ИМЯ",
        namePlaceholder: "Как к вам обращаться",
        birthLabel: "ДАТА РОЖДЕНИЯ",
        birthPlaceholder: "Выберите дату",
        pickTitle: "Дата рождения",
        openArcana: "ОТКРЫТЬ МОЙ АРКАН",
        continue: "ПРОДОЛЖИТЬ",
        birthOverline: "ВАШ АРКАН РОЖДЕНИЯ",
        learnMore: "УЗНАТЬ БОЛЬШЕ ОБО МНЕ",
      },
      profile: {
        // огонёк у серии рисуется ИКОНКОЙ рядом с подписью (StatBox), а не эмодзи в строке:
        // на «Сегодня» та же серия уже иконочная, два разных огня выглядели бы небрежностью
        title: "Профиль", overline: "ВАШ ПУТЬ", streak: "СЕРИЯ", cards: "КАРТ ДНЯ",
        freeze: "ЗАМОРОЗКА",
        arcana: "АРКАН РОЖДЕНИЯ", arcanaCta: "Указать дату рождения",
        // «XP» инвариант к числу — плюрализация не нужна (правило logic-spec §10 — про формы слов)
        xpOf: "{{xp}} / {{next}} XP",
      },
      settings: {
        title: "Настройки", theme: "Тема", dark: "Тёмная", light: "Светлая",
        language: "Язык", languageValue: "Русский", resetToday: "Сбросить карту дня",
        reflection: "Вечерняя рефлексия", on: "Вкл", off: "Выкл",
        reflectNow: "Рефлексия: показать сейчас",
        devSkipYesterday: "Пропустить вчера",
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
        devLessonDone: "Пройти следующий урок",
        devCourseReset: "Сбросить прогресс курса",
        devOnboarding: "Пройти онбординг заново",
        // бэкап (спека 11); тон — design-system §8: без «Ошибка!» и приказов
        exportData: "Экспорт данных",
        importData: "Импорт из файла",
        importConfirmTitle: "Восстановить данные?",
        // «Записей: N» вместо числительного — форма без склонений, плюрализация не нужна (урок hf-02)
        importConfirmText: "Бэкап от {{date}}. Записей дневника: {{entries}}, серия: {{streak}}. Текущие данные будут заменены.",
        importConfirm: "Восстановить",
        importCancel: "Отмена",
        importDoneTitle: "Данные восстановлены",
        importDoneText: "Дневник, прогресс и настройки — снова с вами.",
        errTitle: "Не получилось",
        exportErr: "Не удалось подготовить файл. Попробуйте ещё раз.",
        importErrNotBackup: "Файл не похож на бэкап Arcanum.",
        importErrNewer: "Файл создан в более новой версии приложения. Обновите приложение и попробуйте снова.",
        importErrCorrupt: "Файл повреждён — восстановить из него не получится.",
        planEmpty: "Ничего не запланировано",
        queuedCount: "В очереди системы: {{count}}",
        close: "Закрыть",
        ok: "Готово",
        about: "О приложении",
      },
      // экран «О приложении» (спека 12): версия, дисклеймер, атрибуция колоды и источников.
      // Заголовки блоков заданы обычным регистром — капсом их рисует сам `Block` (title.toUpperCase())
      about: {
        title: "О приложении",
        version: "Версия {{v}}",
        appTitle: "О приложении",
        appText: "Arcanum — спутник в изучении таро: карта дня, курс, справочник всех 78 карт и дневник наблюдений.",
        disclaimer: "Приложение создано для развлекательных и образовательных целей. Оно не предсказывает будущее и не заменяет профессиональную консультацию — медицинскую, юридическую, финансовую или психологическую.",
        deckTitle: "О колоде",
        deckText: "В приложении используется классическая колода Райдер–Уэйт. Рисунки карт выполнила художница Памела Колман Смит в 1909 году; сегодня они находятся в общественном достоянии.",
        dataTitle: "Данные и конфиденциальность",
        dataText: "Все ваши данные — дневник, серия, прогресс курса и настройки — хранятся только на этом устройстве. У приложения нет аккаунтов и серверов: ничего не отправляется в интернет и не передаётся третьим лицам.\n\nРезервную копию вы создаёте сами — кнопкой «Экспорт данных» в настройках — и храните где удобно. Удаление приложения удаляет все его данные с устройства.",
        sourcesTitle: "Источники",
        sourcesText: "Названия и изображения карт подготовлены на основе открытого проекта tarot-api (лицензия MIT).",
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
        titleFreeze: "Заморозка наготове ❄",
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
        learned: "LEARNED ✓",
      },
      card: {
        general: "General meaning", reversed: "Reversed", love: "Love", career: "Career",
        finances: "Finances", health: "Health", day_card: "As card of the day", symbolism: "Symbolism",
        keywords: "Keywords", soon: "Text in progress", backAll: "Cards", backToday: "Today",
        backProfile: "Profile", todayHighlight: "Your card today",
        tabGeneral: "General", sphereLove: "In love", sphereCareer: "At work", sphereFinances: "In finances", sphereHealth: "For health",
        resonated: "resonated {{n}}",
      },
      course: {
        title: "Course",
        modules_one: "{{count}} MODULE", modules_other: "{{count}} MODULES",
        lessons_one: "{{count}} LESSON", lessons_other: "{{count}} LESSONS",
        cardsCount_one: "{{count}} CARD", cardsCount_other: "{{count}} CARDS",
        moduleOf: "MODULE {{n}} OF {{total}}",
        startLesson: "START LESSON",
        lessonOverline: "MODULE {{m}} · LESSON {{l}}",
        lessonPreparing: "Lesson coming soon",
      },
      lesson: {
        theoryTitle: "Theory",
        cardStep: "LESSON CARD",
        next: "NEXT",
        xpGain: "+{{n}} XP",
        passedOf_one: "{{done}} OF {{count}} MODULE LESSON DONE",
        passedOf_other: "{{done}} OF {{count}} MODULE LESSONS DONE",
        repeatDone: "Review complete",
        nextOnPath: "CONTINUE THE PATH →",
      },
      spreads: {
        overline: "PRACTICE",
        title: "Spreads",
        premium: "PREMIUM",
        cards_one: "{{count}} card", cards_other: "{{count}} cards",
      },
      ob: {
        sub: "Learn to read tarot — five minutes a day. No movie magic, with respect for the tradition.",
        start: "BEGIN THE PATH",
        aboutTitle: "About you",
        aboutLead: "Your birth date reveals your personal arcana — the card that walks beside you.",
        nameLabel: "NAME",
        namePlaceholder: "What should we call you",
        birthLabel: "BIRTH DATE",
        birthPlaceholder: "Pick a date",
        pickTitle: "Birth date",
        openArcana: "REVEAL MY ARCANA",
        continue: "CONTINUE",
        birthOverline: "YOUR BIRTH ARCANA",
        learnMore: "TELL ME MORE",
      },
      profile: {
        title: "Profile", overline: "YOUR PATH", streak: "STREAK", cards: "DAILY CARDS",
        freeze: "FREEZE",
        arcana: "BIRTH ARCANA", arcanaCta: "Add your birth date",
        xpOf: "{{xp}} / {{next}} XP",
      },
      settings: {
        title: "Settings", theme: "Theme", dark: "Dark", light: "Light",
        language: "Language", languageValue: "English", resetToday: "Reset daily card",
        reflection: "Evening reflection", on: "On", off: "Off",
        reflectNow: "Reflection: show now",
        devSkipYesterday: "Skip yesterday",
        pushes: "Reminders",
        pushMorning: "Morning", pushEvening: "Evening", pushDenied: "Off in system settings",
        pushRequesting: "Asking…",
        pushHint: "We'll also nudge you if your streak is at risk, and once if you've been away",
        pickMorning: "Morning reminder time", pickEvening: "Evening reminder time",
        testPush: "Test push (10 sec)",
        showPlan: "Scheduled pushes",
        devLessonDone: "Complete next lesson",
        devCourseReset: "Reset course progress",
        devOnboarding: "Replay onboarding",
        // бэкап (спека 11)
        exportData: "Export data",
        importData: "Import from file",
        importConfirmTitle: "Restore data?",
        importConfirmText: "Backup from {{date}}. Journal entries: {{entries}}, streak: {{streak}}. Current data will be replaced.",
        importConfirm: "Restore",
        importCancel: "Cancel",
        importDoneTitle: "Data restored",
        importDoneText: "Your journal, progress and settings are back.",
        errTitle: "Something went wrong",
        exportErr: "Couldn't prepare the file. Please try again.",
        importErrNotBackup: "This file doesn't look like an Arcanum backup.",
        importErrNewer: "This file was created in a newer app version. Update the app and try again.",
        importErrCorrupt: "The file is damaged and can't be restored.",
        planEmpty: "Nothing scheduled",
        queuedCount: "Queued with the system: {{count}}",
        close: "Close",
        ok: "Done",
        about: "About",
      },
      about: {
        title: "About",
        version: "Version {{v}}",
        appTitle: "About the app",
        appText: "Arcanum is a companion for learning tarot: a card of the day, a course, a reference of all 78 cards, and a journal.",
        disclaimer: "The app is made for entertainment and educational purposes. It does not predict the future and is not a substitute for professional advice — medical, legal, financial, or psychological.",
        deckTitle: "About the deck",
        deckText: "The app uses the classic Rider–Waite deck. The card illustrations were created by artist Pamela Colman Smith in 1909 and are now in the public domain.",
        dataTitle: "Data and privacy",
        dataText: "All your data — journal, streak, course progress, and settings — is stored only on this device. The app has no accounts and no servers: nothing is sent to the internet or shared with anyone.\n\nYou create backups yourself — with “Export data” in Settings — and keep them wherever you like. Deleting the app deletes all its data from the device.",
        sourcesTitle: "Sources",
        sourcesText: "Card names and images are based on the open-source tarot-api project (MIT license).",
      },
      push: {
        titleMorning: "Card of the day ✦",
        titleEvening: "How was your day?",
        titleStreak_one: "{{count}}-day streak",
        titleStreak_other: "{{count}}-day streak",
        titleComeback: "It's been a while",
        titleFreeze: "Your freeze has you covered ❄",
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

// Единственный оставшийся риск hf-02 — «а вдруг Intl на Hermes не расширяем»: симптом тогда
// будет ровно тот же самый, что до починки, и «не встало» станет неотличимо от «диагноз был
// не тот». Проверяем не наличие конструктора, а результат — так один и тот же код закрывает оба
// возможных варианта поломки движка.
if (__DEV__) {
  let form: string;
  try {
    form = new Intl.PluralRules("ru").select(4);
  } catch {
    form = "конструктор недоступен";
  }
  if (form !== "few") {
    console.warn(
      `[i18n] Правила плюрализации не встали: ru, 4 → «${form}», ожидалось «few». ` +
        "Русские числительные покажутся по-английски — см. docs/specs/hf-02-hermes-plurals.md",
    );
  }
}

export default i18n;
export const lang = () => (i18n.language.startsWith("ru") ? "ru" : "en") as "ru" | "en";
