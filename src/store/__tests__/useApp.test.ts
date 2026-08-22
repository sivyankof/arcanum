/** Гидрация стора при обновлении версии схемы (спека 53). До этой задачи у migrate не было
 *  ни одного теста — дыра класса «пара проверить/применить» (правило задачи 27): parseBackup
 *  доливает reviewDay.doneCount руками (см. backup.test.ts), а параллельный путь — реальная
 *  гидрация persist на телефоне пользователя, обновившего приложение, — не проверялся вовсе.
 *  AsyncStorage мокается официальным jest-моком библиотеки (без него импорт стора падает на
 *  «NativeModule: AsyncStorage is null» — модуль нативный, в jest его нет). Проверяется ПОЛНЫЙ
 *  пайплайн rehydrate (не голый migrate напрямую): premium — новый ключ ВЕРХНЕГО уровня, его
 *  дефолт доливает не migrate, а последующее поверхностное слияние persist с currentState —
 *  так же, как раньше доливались srs/reviewDay/spreadsHistory (см. комментарий истории версий
 *  в useApp.ts). Голый вызов migrate() эту доливку не показал бы вовсе. */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PREMIUM_NONE } from '../../lib/premium';
import { useApp } from '../useApp';

describe('useApp — гидрация persist версии 11 (спека 53)', () => {
  it('файл версии 10 с reviewDay без doneCount получает doneCount: 0, premium — дефолт PREMIUM_NONE', async () => {
    await AsyncStorage.setItem(
      'arcanum-app',
      JSON.stringify({ state: { reviewDay: { date: '2026-08-22', newCount: 4 } }, version: 10 }),
    );
    await useApp.persist.rehydrate();
    const s = useApp.getState();
    expect(s.reviewDay).toEqual({ date: '2026-08-22', newCount: 4, doneCount: 0 });
    expect(s.premium).toEqual(PREMIUM_NONE);
  });
});
