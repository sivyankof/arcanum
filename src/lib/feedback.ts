/** Обратная связь (спека 13): адрес поддержки и сборка mailto-ссылки.
 *  Модуль чистый — ни expo, ни react: тексты темы и тела собирает экран настроек из i18n,
 *  здесь только машинная часть, проверяемая юнитами. */

/** Адрес поддержки (27.08.2026 — псевдоним iCloud Mail Артёма с пересылкой на личную почту;
 *  регистрацию отдельного ящика в Google и Outlook блокировала антибот-проверка).
 *  Тот же адрес стоит на всех страницах `site/` (равенство держит `site.test.ts`) и в контактах
 *  Play Console / App Store Connect — менять только все места разом. */
export const SUPPORT_EMAIL = 'arcanum.tarot@icloud.com';

/** mailto-URL с темой и телом. Значения кодируются целиком: кириллица, переносы строк
 *  и символы & ? = внутри текста не должны читаться как разделители query. */
export function buildMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
