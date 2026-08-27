/** Тесты `apiKey()` (спека 53б, дополнение к задаче 4): ключ SDK по явной ветке платформы —
 *  android → EXPO_PUBLIC_RC_ANDROID_KEY, ios → EXPO_PUBLIC_RC_IOS_KEY, любая другая (в т.ч. веб) →
 *  undefined. Пустая строка и отсутствие переменной равнозначны — ключа нет.
 *  `isExpoGo()` не тестируется — одна строка чтения `expo-constants` (см. бриф задачи 4). */
import { Platform } from 'react-native';
import { apiKey } from '../purchasesEnv';

const ANDROID_VAR = 'EXPO_PUBLIC_RC_ANDROID_KEY';
const IOS_VAR = 'EXPO_PUBLIC_RC_IOS_KEY';

/** Ставит платформу и обе переменные окружения на время одного кейса, откатывает после —
 *  соседние тесты не должны видеть чужой Platform.OS или чужой ключ. */
function withEnv(os: (typeof Platform)['OS'], env: { android?: string; ios?: string }, run: () => void): void {
  const platform = jest.replaceProperty(Platform, 'OS', os);
  const prevAndroid = process.env[ANDROID_VAR];
  const prevIos = process.env[IOS_VAR];
  if (env.android === undefined) delete process.env[ANDROID_VAR];
  else process.env[ANDROID_VAR] = env.android;
  if (env.ios === undefined) delete process.env[IOS_VAR];
  else process.env[IOS_VAR] = env.ios;
  try {
    run();
  } finally {
    platform.restore();
    if (prevAndroid === undefined) delete process.env[ANDROID_VAR];
    else process.env[ANDROID_VAR] = prevAndroid;
    if (prevIos === undefined) delete process.env[IOS_VAR];
    else process.env[IOS_VAR] = prevIos;
  }
}

describe('apiKey (спека 53б)', () => {
  it('android: ключ из EXPO_PUBLIC_RC_ANDROID_KEY', () => {
    withEnv('android', { android: 'goog_test' }, () => {
      expect(apiKey()).toBe('goog_test');
    });
  });

  it('ios: ключ из EXPO_PUBLIC_RC_IOS_KEY', () => {
    withEnv('ios', { ios: 'appl_test' }, () => {
      expect(apiKey()).toBe('appl_test');
    });
  });

  it('веб: ключа нет, даже если обе переменные заданы', () => {
    withEnv('web', { android: 'goog_test', ios: 'appl_test' }, () => {
      expect(apiKey()).toBeUndefined();
    });
  });

  it('пустая строка — как отсутствие ключа', () => {
    withEnv('android', { android: '' }, () => {
      expect(apiKey()).toBeUndefined();
    });
  });

  it('переменной нет — undefined', () => {
    withEnv('ios', {}, () => {
      expect(apiKey()).toBeUndefined();
    });
  });
});
