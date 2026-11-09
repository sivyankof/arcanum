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
import { SCHEMA_VERSION } from '../../lib/backup';
import { birthArcanaId, NAME_MAX } from '../../lib/birthArcana';
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

describe('useApp — гидрация persist версии 12 (спека 53б)', () => {
  it('файл версии 11 с premium без plan/willRenew получает plan: null, willRenew: false, остальное сохраняет', async () => {
    await AsyncStorage.setItem(
      'arcanum-app',
      JSON.stringify({ state: { premium: { active: true, source: 'dev', until: null } }, version: 11 }),
    );
    await useApp.persist.rehydrate();
    // toEqual НЕ прощает null против отсутствующего ключа — без mergePremium тест красный
    expect(useApp.getState().premium).toEqual({ active: true, source: 'dev', until: null, plan: null, willRenew: false });
  });

});

describe('useApp — гидрация persist версии 13 (спека 74)', () => {
  it('версия схемы поднята до 13', () => {
    expect(SCHEMA_VERSION).toBe(13);
  });

  it('файл версии 12 с settings без musicOn получает musicOn: true, тему сохраняет', async () => {
    await AsyncStorage.setItem(
      'arcanum-app',
      JSON.stringify({
        state: {
          themeMode: 'light',
          settings: { reflectionOn: false, pushesOn: true, pushMorning: '08:00', pushEvening: '20:00', pushAsked: true },
        },
        version: 12,
      }),
    );
    await useApp.persist.rehydrate();
    const s = useApp.getState();
    expect(s.settings.musicOn).toBe(true);
    expect(s.settings.reflectionOn).toBe(false);
    expect(s.themeMode).toBe('light');
  });

  it('setMusicOn(false) меняет только musicOn', () => {
    const before = useApp.getState().settings;
    useApp.getState().setMusicOn(false);
    const after = useApp.getState().settings;
    expect(after.musicOn).toBe(false);
    expect({ ...after, musicOn: before.musicOn }).toEqual(before);
  });
});

// Спека 59. Главное здесь — ОТСУТСТВИЕ ключа `name` после пустого имени, а не пустая
// строка: заголовок профиля читает `name ?? tr('profile.title')`, и `''` показал бы пустоту
// вместо «Профиль». Поэтому свойство проверяется через `in`, а не сравнением с undefined:
// реализация со спредом (`{ ...profile, name: undefined }`) второе прошла бы, а в персист уехало
// бы поле со значением undefined.
describe('setName — имя из строки настроек (спека 59)', () => {
  beforeEach(() => {
    useApp.setState({ profile: { onboarded: true } });
  });

  it('записывает имя, сняв пробелы по краям', () => {
    useApp.getState().setName('  Анна  ');
    expect(useApp.getState().profile.name).toBe('Анна');
  });

  it('меняет уже заданное имя', () => {
    useApp.getState().setName('Анна');
    useApp.getState().setName('Анна К.');
    expect(useApp.getState().profile.name).toBe('Анна К.');
  });

  it('обрезает имя длиннее NAME_MAX', () => {
    useApp.getState().setName('я'.repeat(NAME_MAX + 7));
    expect(useApp.getState().profile.name).toHaveLength(NAME_MAX);
  });

  it('пустое имя УДАЛЯЕТ ключ, а не пишет пустую строку', () => {
    useApp.getState().setName('Анна');
    useApp.getState().setName('   ');
    expect('name' in useApp.getState().profile).toBe(false);
  });

  it('имя не трогает дату рождения и аркан', () => {
    useApp.getState().setBirthDate('1994-02-10');
    const arcana = useApp.getState().profile.birthArcanaId;
    useApp.getState().setName('Анна');
    expect(useApp.getState().profile).toStrictEqual({
      onboarded: true,
      birthDate: '1994-02-10',
      birthArcanaId: arcana,
      name: 'Анна',
    });
  });

  it('setBirthDate меняет УЖЕ ЗАДАННУЮ дату и пересчитывает аркан', () => {
    useApp.getState().setBirthDate('1994-02-10');
    const first = useApp.getState().profile.birthArcanaId;
    useApp.getState().setBirthDate('1994-03-15');
    const second = useApp.getState().profile;
    expect(second.birthDate).toBe('1994-03-15');
    expect(second.birthArcanaId).not.toBe(first);
    expect(second.birthArcanaId).toBe(birthArcanaId('1994-03-15'));
  });
});
