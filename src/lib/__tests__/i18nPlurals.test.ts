/** Плюрализация русских числительных без `Intl.PluralRules` — симуляция телефона (hf-02).
 *
 *  Зачем нужен отдельный вид теста. Обычный юнит-тест этот баг НЕ ловит: jest гоняется на Node,
 *  у которого полный ICU, поэтому `select(4) === 'few'` и русские ключи находятся. На устройстве
 *  движок Hermes, в нём `Intl.PluralRules` нет вовсе — i18next молча берёт встроенную заглушку
 *  «1 → one, всё остальное → other», ключа `*_other` у русских семейств нет ни одного, и строка
 *  уезжает на `fallbackLng: 'en'`. Симптом: «6 MODULES · 32 LESSONS» в русском интерфейсе.
 *  Разбор: `docs/specs/hf-02-plurals-research.md`.
 *
 *  Поэтому телефон здесь воспроизводится руками: `Intl.PluralRules` сносится ДО загрузки
 *  `src/lib/i18n.ts` и возвращается на место только после того, как отработали все `t()`.
 *  Так можно потому, что заглушку i18next не кеширует (`i18next.js:1069/1071` — `return dummyRule`
 *  стоит до записи в кеш на строке 1075), то есть подмена правил опоздать не может.
 *
 *  ⚠️ Тест писался ДО починки и на сломанном коде был КРАСНЫМ («2 LESSONS» вместо «2 УРОКА»).
 *  Если правка `i18n.ts` когда-нибудь откатится, он обязан покраснеть снова — в этом весь смысл.
 *  Тест, зелёный и до фикса, и после, — декорация (урок из 06б, потолок «2 пуша в день»).
 */
import type { TFunction } from 'i18next';
import { resources } from '../i18n';

/** Прогон блока кода в среде без `Intl.PluralRules` — как на устройстве.
 *  Модуль переводов загружается свежим внутри блока: правила выбираются в момент `t()`,
 *  поэтому возвращать механизм на место можно только после последнего вызова. */
function asOnDevice<T>(fn: (t: TFunction) => T): T {
  const original = Intl.PluralRules;
  delete (Intl as { PluralRules?: unknown }).PluralRules;
  try {
    let result!: T;
    jest.isolateModules(() => {
      const i18n = require('../i18n').default;
      result = fn(i18n.getFixedT('ru'));
    });
    return result;
  } finally {
    (Intl as { PluralRules?: unknown }).PluralRules = original;
  }
}

/** Те же строки в нормальной среде (полный ICU) — это браузер, Node и веб-проверка 6а. */
function asInBrowser<T>(fn: (t: TFunction) => T): T {
  let result!: T;
  jest.isolateModules(() => {
    const i18n = require('../i18n').default;
    result = fn(i18n.getFixedT('ru'));
  });
  return result;
}

/** Все боевые вызовы с числительными — по таблице радиуса из исследования.
 *  Ключ, параметры, ожидаемая русская строка. */
const CASES: Array<[string, Record<string, number>, string]> = [
  // экран курса, подпись над заголовком — видно сразу при входе на таб
  ['course.modules', { count: 6 }, '6 МОДУЛЕЙ'],
  ['course.lessons', { count: 32 }, '32 УРОКА'],
  // шапки модулей: 4/6/6/8/4/4 урока, 8/14/40/16 карт
  ['course.lessons', { count: 4 }, '4 УРОКА'],
  ['course.lessons', { count: 6 }, '6 УРОКОВ'],
  ['course.cardsCount', { count: 8 }, '8 КАРТ'],
  ['course.cardsCount', { count: 40 }, '40 КАРТ'],
  // финал урока — то самое место, где баг заметил Артём
  ['lesson.passedOf', { done: 2, count: 4 }, 'ПРОЙДЕНО 2 ИЗ 4 УРОКОВ МОДУЛЯ'],
  // дневник в профиле
  ['journal.entries', { count: 5 }, '5 записей'],
  ['journal.times', { count: 3 }, '3 раза'],
  ['journal.resonated', { n: 2, count: 5 }, 'Отозвалось 2 из 5 дней'],
  // страница карты, «Ваша история с картой»
  ['journal.drawn', { count: 2 }, 'Выпадала 2 раза'],
  // пуш «спасение серии»: заголовок и тело — оба обязаны быть в одной форме
  ['push.titleStreak', { count: 3 }, 'Серия 3 дня'],
  ['push.streakDays', { count: 3 }, '3 дня'],
  // экран раскладов: раньше строка собиралась тернаром мимо i18n и давала «3 карт»
  ['spreads.cards', { count: 3 }, '3 карты'],
  ['spreads.cards', { count: 10 }, '10 карт'],
  ['spreads.cards', { count: 1 }, '1 карта'],
];

describe('русские числительные без Intl.PluralRules (как на iPhone)', () => {
  it.each(CASES)('%s %j → «%s»', (key, params, expected) => {
    const actual = asOnDevice((t) => t(key, params));
    expect(`${key} → ${actual}`).toBe(`${key} → ${expected}`);
  });

  /** Форма для единицы работала и на сломанном коде: заглушка i18next отдаёт для 1 категорию
   *  `one`, а ключ `_one` у русского есть. Отсюда живучесть бага — «1 УРОК» выглядел нормально.
   *  Если эта строка сломается ПОСЛЕ починки — виноваты новые правила, а не движок. */
  it('единица остаётся русской (была русской и до починки)', () => {
    expect(asOnDevice((t) => t('course.lessons', { count: 1 }))).toBe('1 УРОК');
  });
});

describe('паритет: браузер считает формы так же, как устройство', () => {
  it.each(CASES)('%s %j одинаково в обеих средах', (key, params, expected) => {
    expect(asInBrowser((t) => t(key, params))).toBe(expected);
    expect(asOnDevice((t) => t(key, params))).toBe(expected);
  });
});

/** Прогон с ЗАВЕДОМО полифилльными правилами: родной механизм снимается, пакет встаёт на его
 *  место, наружу отдаётся его конструктор. Так сравниваются два механизма, а не две среды. */
function withPolyfilledRules<T>(fn: (Ctor: typeof Intl.PluralRules) => T): T {
  const native = Intl.PluralRules;
  delete (Intl as { PluralRules?: unknown }).PluralRules;
  try {
    let result!: T;
    jest.isolateModules(() => {
      require('intl-pluralrules');
      result = fn(Intl.PluralRules);
    });
    return result;
  } finally {
    (Intl as { PluralRules?: unknown }).PluralRules = native;
  }
}

const NUMBERS = Array.from({ length: 2001 }, (_, n) => n);
const FRACTIONS = [0.5, 1.1, 1.5, 2.5, 10.7, 21.3];

/** Языки берутся из самих ресурсов, а НЕ из литералов 'ru'/'en': иначе обещание «добавил язык —
 *  тест сам проверит» ложное, а третьим языком в master-plan стоит PT-BR, у которого правила
 *  расходятся с английскими уже на нуле. */
const LANGS = Object.keys(resources);

describe('оракул: полифилл считает категории так же, как настоящий ICU', () => {
  /** Оракул имеет смысл, только если сравниваются ДВА РАЗНЫХ механизма. Пакет подменяет собой
   *  и рабочий родной `Intl.PluralRules`, если у того нет метода `selectRange` (условие в
   *  polyfill.js), — на таком движке оракул начал бы сравнивать полифилл сам с собой, остался бы
   *  зелёным и тихо перестал быть гарантией. Проверяем это явно, чтобы деградация падала. */
  it('среда честная: родной механизм не подменён полифиллом', () => {
    expect((Intl.PluralRules as { polyfill?: boolean }).polyfill).toBeFalsy();
    expect(typeof Intl.PluralRules.prototype.selectRange).toBe('function');
  });

  it.each(LANGS)('%s — 0…2000 и дробные', (lng) => {
    const all = [...NUMBERS, ...FRACTIONS];
    const native = new Intl.PluralRules(lng);
    const expected = all.map((n) => native.select(n));
    const actual = withPolyfilledRules((Ctor) => {
      const rules = new Ctor(lng);
      return all.map((n) => rules.select(n));
    });
    expect(actual).toEqual(expected);
  });
});

/** Плоский список ключей: { 'course.lessons_one': '{{count}} УРОК', … } */
function flatten(node: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') Object.assign(out, flatten(value, path));
  }
  return out;
}

const SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Какие формы язык реально требует для ЦЕЛЫХ чисел — считается по настоящему ICU, а не
 *  прописывается таблицей. Для ru это one/few/many (категория other у него только у дробных,
 *  а дробных счётчиков в приложении нет), для en — one/other. Новый язык принесёт свой набор
 *  сам, без правки теста. */
function integerCategories(lng: string): string[] {
  const rules = new Intl.PluralRules(lng);
  const found = new Set<string>();
  for (let n = 0; n <= 200; n++) found.add(rules.select(n));
  return [...found].sort();
}

/** Намеренные исключения: {{count}} есть, а слова рядом с ним не склоняются. */
const COUNT_WITHOUT_FORMS = new Set(['settings.queuedCount', 'journal.withNote']);

describe('структура ключей: числительные не забыты', () => {
  it.each(LANGS)('%s — у каждого семейства есть все формы своего языка', (lng) => {
    const flat = flatten((resources as Record<string, { translation: unknown }>)[lng].translation);
    const families = new Map<string, Set<string>>();
    for (const key of Object.keys(flat)) {
      const match = key.match(SUFFIX);
      if (!match) continue;
      const base = key.replace(SUFFIX, '');
      if (!families.has(base)) families.set(base, new Set());
      families.get(base)!.add(match[1]);
    }
    const required = integerCategories(lng);
    const broken = [...families.entries()]
      .filter(([, forms]) => required.some((form) => !forms.has(form)))
      .map(([base, forms]) => `${base}: есть ${[...forms].sort().join('/')}, нужно ${required.join('/')}`);
    expect(broken).toEqual([]);
  });

  /** Ловит более вероятную человеческую ошибку — «плюрализацию забыли совсем», а не «часть форм
   *  забыли». Ключ с {{count}} и без форм на устройстве покажется по-английски. */
  it.each(LANGS)('%s — ключи с {{count}} без форм только из белого списка', (lng) => {
    const flat = flatten((resources as Record<string, { translation: unknown }>)[lng].translation);
    const suspicious = Object.entries(flat)
      .filter(([key, value]) => !SUFFIX.test(key) && value.includes('{{count}}'))
      .map(([key]) => key)
      .filter((key) => !COUNT_WITHOUT_FORMS.has(key));
    expect(suspicious).toEqual([]);
  });

  /** UI-строка обязана существовать в обоих языках (правило проекта): ключ, забытый в одном
   *  из них, на устройстве молча уедет в фолбэк — тот же симптом, что чинит hf-02. */
  it('набор ключей совпадает во всех языках', () => {
    const bases = LANGS.map((lng) => {
      const flat = flatten((resources as Record<string, { translation: unknown }>)[lng].translation);
      return new Set(Object.keys(flat).map((key) => key.replace(SUFFIX, '')));
    });
    const [first, ...rest] = bases;
    for (let i = 0; i < rest.length; i++) {
      const missing = [...first].filter((key) => !rest[i].has(key));
      const extra = [...rest[i]].filter((key) => !first.has(key));
      expect({ lang: LANGS[i + 1], missing, extra }).toEqual({ lang: LANGS[i + 1], missing: [], extra: [] });
    }
  });
});
