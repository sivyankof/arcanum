/** Окружение адаптера покупок (спека 53б): ключ SDK по платформе и признак Expo Go. Отдельный
 *  файл, чтобы purchasesMap.ts оставался чистым, а purchases.ts в тестах мокал только этот модуль.
 *  ⚠️ EXPO_PUBLIC_* подставляет Metro при сборке бандла ТОЛЬКО в буквальном виде
 *  `process.env.ИМЯ` — динамический `process.env[name]` останется undefined в сборке. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const platform: string = Platform.OS;

export function apiKey(): string | undefined {
  const key = Platform.OS === 'android' ? process.env.EXPO_PUBLIC_RC_ANDROID_KEY : process.env.EXPO_PUBLIC_RC_IOS_KEY;
  return key ? key : undefined;
}

/** Expo Go: SDK переходит в Preview API Mode, а `configure` с боевым ключом бросает — там магазина нет. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
