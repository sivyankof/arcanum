/** Тесты локальных границ дня (hf-01/H2). Все кейсы строятся из локальных компонентов
 *  (new Date(year, month, day, ...)), поэтому результат не зависит от часового пояса машины,
 *  на которой гоняются тесты, — как и сам контракт localDateISO/daysAgoISO. */
import {
  daysAgoISO,
  daysInMonth,
  formatFullDate,
  formatTime,
  localDateISO,
  parseISODate,
  plusDaysISO,
  weekdayLabels,
} from '../dates';
import { WEEK_START } from '../lang';

describe('localDateISO', () => {
  it('сразу после полуночи — сегодняшняя дата', () => {
    expect(localDateISO(new Date(2026, 7, 9, 0, 0, 1))).toBe('2026-08-09');
  });

  it('в 23:59:59 — всё ещё тот же день', () => {
    expect(localDateISO(new Date(2026, 7, 9, 23, 59, 59))).toBe('2026-08-09');
  });

  it('паддинг нулями для месяца и дня', () => {
    expect(localDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('daysAgoISO', () => {
  it('переход через границу месяца: 1 марта минус 1 сутки — 28 февраля', () => {
    expect(daysAgoISO(1, new Date(2026, 2, 1))).toBe('2026-02-28');
  });

  it('високосный год: 1 марта минус 1 сутки — 29 февраля', () => {
    expect(daysAgoISO(1, new Date(2024, 2, 1))).toBe('2024-02-29');
  });

  it('переход через границу года: 1 января минус 1 сутки — 31 декабря', () => {
    expect(daysAgoISO(1, new Date(2026, 0, 1))).toBe('2025-12-31');
  });

  it('обычный случай внутри месяца: минус 7 суток', () => {
    expect(daysAgoISO(7, new Date(2026, 7, 9))).toBe('2026-08-02');
  });
});

describe('parseISODate', () => {
  it('строка разбирается по локальной полуночи, а не по UTC', () => {
    const d = parseISODate('2026-08-11');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 11]);
  });

  it('обратное преобразование не теряет день', () => {
    expect(localDateISO(parseISODate('2026-01-05'))).toBe('2026-01-05');
  });
});

describe('formatFullDate — дата рождения в поле онбординга (спека 09)', () => {
  test('ru: «10 февраля 1994», год без хвоста «г.»', () =>
    expect(formatFullDate('1994-02-10', 'ru')).toBe('10 февраля 1994'));
  test('en: «February 10, 1994» — запятая от локали, ручной склейки тут нет', () =>
    expect(formatFullDate('1994-02-10', 'en')).toBe('February 10, 1994'));
});

describe('plusDaysISO — дата через n суток от ISO-дня (спека 45)', () => {
  it('переход через месяц и год', () => {
    expect(plusDaysISO('2026-08-31', 1)).toBe('2026-09-01');
    expect(plusDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('n = 0 — та же дата; отрицательное n — назад (в феврале невисокосного года)', () => {
    expect(plusDaysISO('2026-08-19', 0)).toBe('2026-08-19');
    expect(plusDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('365 дней — потолок интервала SM-2', () => {
    expect(plusDaysISO('2026-08-19', 365)).toBe('2027-08-19');
  });
});

describe('weekdayLabels — шапка сетки лунного календаря (спека 47)', () => {
  test('ru: неделя с понедельника, «ПН … ВС»', () =>
    expect(weekdayLabels('ru')).toEqual(['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']));
  test('en: неделя с воскресенья, «SUN … SAT»', () =>
    expect(weekdayLabels('en')).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']));
  test('es/pt: с воскресенья; у pt-BR хвостовая точка («seg.») срезана', () => {
    expect(weekdayLabels('es')[0]).toBe('DOM');
    expect(weekdayLabels('pt')).toEqual(['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']);
    for (const lang of ['ru', 'en', 'es', 'pt'] as const) {
      expect(weekdayLabels(lang)).toHaveLength(7);
      for (const l of weekdayLabels(lang)) expect(l).not.toMatch(/\.$/);
    }
  });
  test('WEEK_START: ru — понедельник, остальные — воскресенье', () =>
    expect(WEEK_START).toEqual({ ru: 1, en: 0, es: 0, pt: 0 }));
});

describe('formatTime — местное время события луны (спека 47)', () => {
  // локальный конструктор: результат не зависит от часового пояса машины
  const d = new Date(2026, 7, 12, 20, 37);
  test('ru: 24 часа «20:37»', () => expect(formatTime(d, 'ru')).toBe('20:37'));
  // перед «PM» ICU разных версий ставит то обычный пробел, то узкий неразрывный (U+202F) —
  // нормализуем, проверяем содержание, а не байты
  test('en: 12 часов «08:37 PM»', () => expect(formatTime(d, 'en').replace(/\u202f/g, ' ')).toBe('08:37 PM'));
  test('pt: 24 часа «20:37»', () => expect(formatTime(d, 'pt')).toBe('20:37'));
});

describe('daysInMonth — общий хелпер длины месяца (спека 47, вынесен из DatePicker.web)', () => {
  test('30/31-дневные месяцы', () => {
    expect(daysInMonth(2026, 7)).toBe(31);
    expect(daysInMonth(2026, 8)).toBe(30);
  });
  test('февраль: невисокосный 28, високосный 29', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
  });
  test('декабрь: год перекатывается сам, 31 день', () => expect(daysInMonth(2026, 11)).toBe(31));
});
