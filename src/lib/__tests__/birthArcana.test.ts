import { birthArcanaId, birthNumber, buildProfile, NAME_MAX, normalizeName } from '../birthArcana';
import { cardById } from '../content';

describe('birthNumber — сумма цифр даты со свёрткой (logic-spec §5)', () => {
  test('15.03.1994 → 32 → 5', () => expect(birthNumber('1994-03-15')).toBe(5));
  test('29.12.1987 → 39 → 12', () => expect(birthNumber('1987-12-29')).toBe(12));
  test('01.01.2000 → 4', () => expect(birthNumber('2000-01-01')).toBe(4));
  test('10.02.1994 → 26 → 8 (кейс макета — Сила)', () => expect(birthNumber('1994-02-10')).toBe(8));
  test('10.02.1990 → ровно 22: дальше НЕ сворачивается', () =>
    expect(birthNumber('1990-02-10')).toBe(22));
});

describe('birthArcanaId — номер → карта', () => {
  test('22 → Дурак (fool, number 0)', () => expect(birthArcanaId('1990-02-10')).toBe('fool'));
  test('8 → strength', () => expect(birthArcanaId('1994-02-10')).toBe('strength'));
  test('инвариант: любая дата 1900–2100 даёт 1–22 и старший аркан из колоды', () => {
    // шаг 37 суток — покрывает все комбинации сумм без перебора 73 000 дней
    for (let ts = Date.UTC(1900, 0, 1); ts <= Date.UTC(2100, 0, 1); ts += 37 * 24 * 3600 * 1000) {
      const iso = new Date(ts).toISOString().slice(0, 10);
      const n = birthNumber(iso);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(22);
      expect(cardById.get(birthArcanaId(iso))?.arcana).toBe('major');
    }
  });
});

// toStrictEqual, а НЕ toEqual: toEqual игнорирует ключи со значением undefined, поэтому
// кейсы «поля нет» на нём проходят и у реализации, которая пишет { name: undefined }.
// Именно отсутствие ключа здесь и проверяется — иначе в персист уедут пустые поля.
describe('buildProfile — сборка профиля онбордингом', () => {
  test('имя обрезается, дата даёт аркан', () =>
    expect(buildProfile('  Анна  ', '1994-02-10')).toStrictEqual({
      name: 'Анна',
      birthDate: '1994-02-10',
      birthArcanaId: 'strength',
      onboarded: true,
    }));
  test('пустое имя/пробелы → поля name нет', () =>
    expect(buildProfile('   ')).toStrictEqual({ onboarded: true }));
  test('без даты → ни birthDate, ни birthArcanaId', () =>
    expect(buildProfile('Анна')).toStrictEqual({ name: 'Анна', onboarded: true }));
});

// Спека 59: до неё онбординг длину имени не ограничивал вовсе — имя видно заголовком
// профиля в одну строку, и строка любой длины уезжала в персист как есть.
describe('normalizeName — общая нормализация имени (спека 59)', () => {
  test('снимает пробелы по краям', () => expect(normalizeName('  Анна ')).toBe('Анна'));
  test('пустая строка остаётся пустой', () => expect(normalizeName('   ')).toBe(''));
  test('длинное имя обрезается до NAME_MAX', () => {
    expect(normalizeName('я'.repeat(NAME_MAX + 5))).toHaveLength(NAME_MAX);
  });
  test('имя ровно в NAME_MAX не трогается', () => {
    const exact = 'я'.repeat(NAME_MAX);
    expect(normalizeName(exact)).toBe(exact);
  });
  test('обрезка идёт ПОСЛЕ trim, а не до него', () => {
    // если сначала обрезать, пробелы съедят часть знаков и имя окажется короче лимита
    expect(normalizeName('   ' + 'я'.repeat(NAME_MAX))).toHaveLength(NAME_MAX);
  });
});

describe('buildProfile — длина имени (спека 59)', () => {
  test('имя длиннее NAME_MAX обрезается и в онбординге', () => {
    const p = buildProfile('я'.repeat(NAME_MAX + 10));
    expect(p.name).toHaveLength(NAME_MAX);
  });
});
