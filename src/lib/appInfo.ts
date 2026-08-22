/** Версия приложения из app.json (поле `expo.version`) — одна на строку в настройках
 *  и на экран «О приложении» (спека 12): читаем в одном месте, чтобы значения не разошлись.
 *  Лежит отдельным модулем, а не в settings.ts: тот импортируется чистыми модулями
 *  (pushPlan.ts) и не должен тянуть за собой expo даже транзитивно. */
import Constants from 'expo-constants';

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
