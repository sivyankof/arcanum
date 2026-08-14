/** Версия приложения из app.json (поле `expo.version`) — одна на строку в настройках
 *  и на экран «О приложении» (спека 12): читаем в одном месте, чтобы значения не разошлись.
 *  Лежит отдельным модулем, а не в settings.ts: тот импортируется чистыми модулями
 *  (pushPlan.ts) и не должен тянуть за собой expo даже транзитивно. */
import Constants from 'expo-constants';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '—';
}
