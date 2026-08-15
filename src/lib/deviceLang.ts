/** Языки устройства — единственный файл, знающий про `expo-localization` (спека 27).
 *  Отдаёт теги в порядке предпочтений пользователя (`['es-MX', 'en-US']`); выбор из них делает
 *  чистый `detectLang` (lang.ts) — там и тесты. Веб/SSR-безопасно: реализация пакета сама
 *  проверяет наличие DOM и падает на Intl. Стор зовёт это один раз — при первой гидрации. */
import { getLocales } from 'expo-localization';

export function deviceLocaleTags(): string[] {
  return getLocales().map((l) => l.languageTag);
}
