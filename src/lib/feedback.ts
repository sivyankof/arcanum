/** Обратная связь (спека 13): адрес поддержки и сборка mailto-ссылки.
 *  Модуль чистый — ни expo, ни react: тексты темы и тела собирает экран настроек из i18n,
 *  здесь только машинная часть, проверяемая юнитами. */

/** ⚠️ ВРЕМЕННО личный адрес (решение Артёма 14.08) — заменить на адрес поддержки
 *  с лендинга ДО релиза, пункт в release-checklist. */
export const SUPPORT_EMAIL = 'morfiy0393@gmail.com';

/** mailto-URL с темой и телом. Значения кодируются целиком: кириллица, переносы строк
 *  и символы & ? = внутри текста не должны читаться как разделители query. */
export function buildMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
