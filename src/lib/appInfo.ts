/** Версия приложения из app.json (поле `expo.version`) — одна на строку в настройках
 *  и на экран «О приложении» (спека 12): читаем в одном месте, чтобы значения не разошлись.
 *  Лежит отдельным модулем, а не в settings.ts: тот импортируется чистыми модулями
 *  (pushPlan.ts) и не должен тянуть за собой expo даже транзитивно. */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '—';
}

/** Единственный источник адресов публичных страниц (спека 54: GitHub Pages этого репозитория).
 *  Лежит здесь, а не в feedback.ts: appInfo — метаданные приложения (версия, адреса страниц),
 *  а feedback.ts — про письмо поддержки (адрес и сборка mailto). */
export const SITE_URL = 'https://sivyankof.github.io/arcanum';
export const PRIVACY_URL = `${SITE_URL}/privacy.html`;
export const TERMS_URL = `${SITE_URL}/terms.html`;
export const SUPPORT_URL = `${SITE_URL}/support.html`;

/** Идентификаторы приложения в магазинах — сверяются с app.json / eas.json контракт-тестом. */
export const ANDROID_PACKAGE = 'app.arcanum.tarot';
export const IOS_APP_ID = '6805994267';
/** Пока iOS-версия не вышла в App Store, ссылки на страницу отзывов нет — строку не показываем.
 *  После публикации сменить на true. */
export const IOS_PUBLISHED = false;
/** Запасной адрес, если market:// не открылся (нет Google Play на устройстве). */
export const RATE_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** Адрес оценки приложения для платформы; null — строки «Оценить» нет. */
export function rateUrlFor(os: string, iosPublished: boolean = IOS_PUBLISHED): string | null {
  if (os === 'android') return `market://details?id=${ANDROID_PACKAGE}`;
  if (os === 'ios' && iosPublished) {
    return `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${IOS_APP_ID}?action=write-review`;
  }
  return null;
}

export const RATE_URL: string | null = rateUrlFor(Platform.OS);
