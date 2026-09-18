/** Окружение адаптера покупок (спека 53б): ключ SDK по платформе и признак Expo Go. Отдельный
 *  файл, чтобы purchasesMap.ts оставался чистым, а purchases.ts в тестах мокал только этот модуль.
 *  ⚠️ EXPO_PUBLIC_* подставляет Metro при сборке бандла ТОЛЬКО в буквальном виде
 *  `process.env.ИМЯ` — динамический `process.env[name]` останется undefined в сборке. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const platform: string = Platform.OS;

export function apiKey(): string | undefined {
  let key: string | undefined;
  if (Platform.OS === 'android') key = process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
  else if (Platform.OS === 'ios') key = process.env.EXPO_PUBLIC_RC_IOS_KEY;
  return key ? key : undefined;
}

/** Expo Go: SDK переходит в Preview API Mode, а `configure` с боевым ключом бросает — там магазина нет. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Имя магазина в текстах пейвола (спека 72; Apple 2.3.10 — в iOS-сборке не называть чужой магазин).
 *  Не переводится. На вебе магазина нет — называем оба. */
export const STORE_NAME: string =
  Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'App Store / Google Play';
