/** Язык приложения (спека 27) — единственное место, где объявлено, какие языки есть, как они
 *  называются, какой локалью форматируются даты и как из многоязычной записи достать текст.
 *  Чистый модуль: без expo и react — целиком под юнит-тестами (lang.test.ts).
 *
 *  Источник правды текущего языка — стор (`useApp().lang`, персист); i18n — его зеркало,
 *  экраны читают зеркало через `useLang()` из `src/lib/i18n.ts`. Здесь — только словари и функции.
 */

/** Языки v1 (решение 12.08): порядок = порядок в пикере настроек. */
export const LANGS = ['ru', 'en', 'es', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

/** Языки канона: на них контент написан руками, эти ключи у записи обязательны.
 *  es/pt появятся с переводами (задача 28) — до этого их у записи может не быть. */
export type CanonLang = 'ru' | 'en';

/** Куда падает контент, пока перевода на выбранный язык нет. Совпадает с fallbackLng i18n. */
export const CONTENT_FALLBACK: CanonLang = 'en';

/** Многоязычная запись контента: ru/en обязательны, остальные — по мере переводов.
 *  Индекс `rec[lang]` по общему `Lang` даёт `T | undefined` — поэтому читать через `inLang`. */
export type Localized<T = string> = Record<CanonLang, T> & Partial<Record<Lang, T>>;

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

/** Язык, на котором запись реально есть: сам `lang` либо CONTENT_FALLBACK.
 *  Нужен там, где важен не только текст, но и его язык — стемминг в поиске (cardSearch). */
export function presentLang<T>(rec: Localized<T>, lang: Lang): Lang {
  return rec[lang] !== undefined ? lang : CONTENT_FALLBACK;
}

/** Текст (или список) на нужном языке с фолбэком на канон.
 *  Пустая строка отсутствием НЕ считается: полноту переводов следят контракт-тесты, а не рантайм. */
export function inLang<T>(rec: Localized<T>, lang: Lang): T {
  const own = rec[lang];
  return own !== undefined ? own : rec[CONTENT_FALLBACK];
}

/** Эндонимы для пикера языка — не переводятся (пользователь ищет свой язык глазами). */
export const LANG_NAMES: Record<Lang, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

/** Локали (BCP-47) по языку приложения. es-MX, а не es-419: любой латиноамериканский тег даёт
 *  те же имена месяцев и дней, но «419» местами не распознаётся движками и молча падает
 *  в дефолт локали; pt-BR — бразильская норма (план локализации). */
export const LOCALES: Record<Lang, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-MX',
  pt: 'pt-BR',
};

/** Тег локали для системных компонентов и toLocaleDateString.
 *
 *  ⚠️ Нужен там, где строку форматирует НЕ наш код, а системный компонент. Язык приложения —
 *  наша собственная настройка в сторе, и он не обязан совпадать ни с языком устройства, ни с тем,
 *  что готова показать система: iOS локализует системные виджеты по списку языков приложения-хоста,
 *  а хост в разработке — Expo Go, чей список мы не контролируем. Поэтому локаль таким компонентам
 *  передаём явно, а не надеемся на окружение (найдено Артёмом 13.08: колесо даты говорило
 *  по-английски при русских и приложении, и телефоне). */
export function localeTag(lang: Lang): string {
  return LOCALES[lang];
}

/** Первичный субтег языка: 'es-MX' → 'es', 'PT_br' → 'pt', '' → ''. */
export function primarySubtag(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0];
}

/** Любой код языка → наш Lang; неизвестный падает в 'en' (как fallbackLng i18n).
 *  Этим нормализуется `i18n.language` в useLang(). */
export function toLang(code: string): Lang {
  const sub = primarySubtag(code);
  return isLang(sub) ? sub : 'en';
}

/** Язык для первой установки по списку предпочтений устройства (в порядке пользователя):
 *  первый, который у нас ДОСТУПЕН (`available` — AVAILABLE_LANGS из i18n.ts), иначе 'en'.
 *  [de-DE, es-ES] → es: смотрим весь список, а не только первый тег. */
export function detectLang(tags: readonly string[], available: readonly Lang[]): Lang {
  for (const tag of tags) {
    const sub = primarySubtag(tag);
    if (isLang(sub) && available.includes(sub)) return sub;
  }
  return 'en';
}
