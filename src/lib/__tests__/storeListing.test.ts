/** Контракт «тексты для сторов помещаются в лимиты» (спека 57): `docs/store-listing.md` —
 *  единственный источник текстов, которые копируются в App Store Connect, Play Console и RuStore.
 *  Формы магазинов режут длинное поле молча (и правку приходится сочинять под таймером), поэтому
 *  лимиты держит тест, а не память. Родня `site.test.ts`: там контракт «страница = приложение»,
 *  здесь — «документ = правила магазина».
 *
 *  Что проверяется:
 *  1) длина каждого поля ≤ лимита В СИМВОЛАХ UNICODE (`[...s].length`, не `s.length`);
 *  2) ключевые слова iOS: без пробела после запятой, без повторов слов и без слов из названия
 *     и подзаголовка того же языка — Apple индексирует название и подзаголовок и так, дубль
 *     впустую тратит лимит в 100 символов;
 *  3) запрещённые слова (гарантии, предсказания, лечение) — в поле не должно быть предложения
 *     с таким корнем БЕЗ отрицания: дисклеймер «не предсказывает будущее» законен, обещание
 *     «предсказываем будущее» — нет;
 *  4) слово «бесплатно» — только в теле описания; в названии и подзаголовке его запрещает Apple;
 *  5) периметр: языки файла = языки приложения (`LANGS`), набор полей и лимиты одинаковы
 *     у всех языков — иначе новый язык приезжает без поля, а контракт этого не замечает
 *     (урок «контракт, ограниченный литералами, волна переводов проходит молча»);
 *  6) числа в полном описании берутся из кода: 78 карт, 6 модулей, 32 урока, 160 вопросов.
 *
 *  ⚠️ Заголовки полей в документе — часть контракта: разбор ведётся по `### <язык> · <поле>
 *  (<лимит>)`, а проверки 2 и 4 ищут поля по именам `название` / `подзаголовок iOS` /
 *  `ключевые слова iOS`. Переименование заголовка обязано ронять прогон (проверка 5а),
 *  а не молча выключать проверку — маркер, который можно потерять, сторожит только себя.
 */
import fs from 'fs';
import path from 'path';
import { cards, course, spreads } from '../content';
import { LANGS } from '../lang';

const FILE = path.resolve(__dirname, '../../../docs/store-listing.md');

/** Имена полей, от которых зависят проверки ключевых слов и «бесплатно». */
const F_NAME = 'название';
const F_SUBTITLE = 'подзаголовок iOS';
const F_KEYWORDS = 'ключевые слова iOS';
const F_FULL = 'полное описание';

interface ListingField {
  lang: string;
  field: string;
  limit: number;
  text: string;
}

/** Заголовок поля: `### ru · короткое описание Google (80)`. */
const HEAD = /^###\s+(\S+)\s+·\s+(.+?)\s+\((\d+)\)\s*$/;

/** Разбор документа. Тело поля кончается на любом заголовке `#` или горизонтальной линии `---`:
 *  так текст соседнего языка и служебные разделы файла не приклеиваются к последнему полю. */
function parseListing(md: string): ListingField[] {
  const out: ListingField[] = [];
  let head: { lang: string; field: string; limit: number } | null = null;
  let body: string[] = [];

  const flush = (): void => {
    if (head) out.push({ ...head, text: body.join('\n').trim() });
    head = null;
    body = [];
  };

  for (const line of md.split(/\r?\n/)) {
    const m = HEAD.exec(line);
    if (m) {
      flush();
      head = { lang: m[1], field: m[2], limit: Number(m[3]) };
      continue;
    }
    if (head && (line.startsWith('#') || line.trim() === '---')) {
      flush();
      continue;
    }
    if (head) body.push(line);
  }
  flush();
  return out;
}

/** Длина в символах Unicode. `'\u{1F319}'.length` равна 2, а магазин считает такой символ одним —
 *  считать по строке значит занижать доступный лимит и резать текст без нужды. */
function size(s: string): number {
  return [...s].length;
}

/** Слова строки в нижнем регистре: разделитель — всё, что не буква и не цифра. */
function wordsOf(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Корни, которых в текстах магазина быть не должно. Совпадение ищется с НАЧАЛА слова
 *  (`(?<!\p{L})`), иначе `cura` ловит испанское «segura», а `cure` — английское «secure».
 *  `prev[êe]` закрыт справа, чтобы не ловить английское «prevent». */
const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ['гарант', /(?<!\p{L})гарант/iu],
  ['предсказ', /(?<!\p{L})предсказ/iu],
  ['вылеч', /(?<!\p{L})вылеч/iu],
  ['guarantee', /(?<!\p{L})guarantee/iu],
  ['predict', /(?<!\p{L})predict/iu],
  ['cure', /(?<!\p{L})cure/iu],
  ['garantiz', /(?<!\p{L})garantiz/iu],
  ['predic', /(?<!\p{L})predic/iu],
  ['cura', /(?<!\p{L})cura/iu],
  ['prevê', /(?<!\p{L})prev[êe](?!\p{L})/iu],
];

/** Отрицания четырёх языков. Дисклеймер «не предсказывает будущее» обязателен по правилам
 *  Apple 1.4.1 и стоит во всех четырёх описаниях — запрет на корень без учёта отрицания
 *  требовал бы удалить сам дисклеймер. */
const NEGATION = /(?<!\p{L})(не|нет|ни|без|not|no|never|without|ni|sin|não|nao|nem|sem)(?!\p{L})/iu;

/** Предложения текста: точка, восклицательный, вопросительный, многоточие и перенос строки.
 *  Отрицание ищется в том же предложении, что и корень, — «Гарантий нет. Предсказываем будущее.»
 *  обязано остаться находкой. */
function sentences(text: string): string[] {
  return text
    .split(/[.!?…\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Найденные запрещённые корни: корень в предложении БЕЗ отрицания. */
function forbiddenHits(text: string): string[] {
  const hits = new Set<string>();
  for (const sentence of sentences(text)) {
    if (NEGATION.test(sentence)) continue;
    for (const [root, re] of FORBIDDEN) if (re.test(sentence)) hits.add(root);
  }
  return [...hits];
}

/** Слово «бесплатно» по языкам — запрещено Apple в названии и подзаголовке.
 *  Язык без правила = ошибка периметра: пятый язык обязан прийти вместе со своим словом. */
const FREE_WORD: Record<string, RegExp> = {
  ru: /(?<!\p{L})бесплатн/iu,
  en: /(?<!\p{L})free(?!\p{L})/iu,
  es: /(?<!\p{L})grat(is|uit)/iu,
  pt: /(?<!\p{L})gr[áa]t(is|uit)/iu,
};

/** Претензии к строке ключевых слов iOS. Сравнение точное, без снятия диакритики и без
 *  приведения словоформ: «taro» рядом с «Tarô» в названии и «карта» рядом с «карт» в
 *  подзаголовке — намеренные разные написания (пользователь набирает без диакритики),
 *  а стемминг романских и русских форм в тесте даст ложные находки там, где Apple
 *  индексирует токены отдельно. */
function keywordProblems(keywords: string, occupied: string[]): string[] {
  const problems: string[] = [];
  if (/,\s/u.test(keywords)) problems.push('пробел после запятой (съедает лимит)');
  if (/\s,/u.test(keywords)) problems.push('пробел перед запятой');
  if (keywords.split(',').some((part) => part.trim() === '')) problems.push('пустое ключевое слово');

  const seen = new Set<string>();
  const busy = new Set(occupied);
  for (const word of wordsOf(keywords)) {
    if (seen.has(word)) problems.push(`повтор слова «${word}»`);
    seen.add(word);
    if (busy.has(word)) problems.push(`слово «${word}» уже есть в названии/подзаголовке`);
  }
  return problems;
}

// --- разбор и детекторы проверены на инлайн-фикстурах, а не на самом документе ------------

describe('parseListing — разбор заголовков и границ поля', () => {
  const fixture = [
    '# Русский',
    '',
    '### ru · название (30)',
    'Arcanum',
    '',
    '### ru · полное описание (4000)',
    'Первая строка.',
    'Вторая строка.',
    '',
    '---',
    'этот текст уже вне поля',
    '',
    '### ru не по формату',
    'и этот тоже',
  ].join('\n');

  it('берёт язык, имя поля и лимит из заголовка', () => {
    const fields = parseListing(fixture);
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ lang: 'ru', field: 'название', limit: 30, text: 'Arcanum' });
  });

  it('тело поля кончается на `---` и на следующем заголовке, а не на конце файла', () => {
    const full = parseListing(fixture)[1];
    expect(full.text).toBe('Первая строка.\nВторая строка.');
    expect(full.text).not.toContain('вне поля');
  });

  it('заголовок не по формату полем не считается', () => {
    expect(parseListing(fixture).map((f) => f.field)).not.toContain('ru не по формату');
  });
});

describe('size — символы Unicode, а не единицы UTF-16', () => {
  it('составной символ считается за один', () => {
    expect(size('🌙')).toBe(1);
    expect('🌙'.length).toBe(2);
  });
});

describe('forbiddenHits — корень без отрицания', () => {
  it('находит обещание', () => {
    expect(forbiddenHits('Гарантируем результат.')).toEqual(['гарант']);
    // «predict» и «predic» — два корня списка из спеки, второй накрывает испанское «predice»
    expect(forbiddenHits('We predict your future.')).toContain('predict');
  });

  it('пропускает дисклеймер с отрицанием на всех четырёх языках', () => {
    expect(forbiddenHits('Оно не предсказывает будущее.')).toEqual([]);
    expect(forbiddenHits('It does not predict the future.')).toEqual([]);
    expect(forbiddenHits('No predice el futuro.')).toEqual([]);
    expect(forbiddenHits('Ele não prevê o futuro.')).toEqual([]);
  });

  it('отрицание работает в пределах предложения, а не всего текста', () => {
    expect(forbiddenHits('Гарантий нет. Предсказываем будущее.')).toEqual(['предсказ']);
  });

  it('не срабатывает на словах, где корень стоит не с начала', () => {
    expect(forbiddenHits('Una tirada segura y un lugar seguro.')).toEqual([]);
    expect(forbiddenHits('The connection is secure.')).toEqual([]);
    expect(forbiddenHits('This app does prevent nothing')).toEqual([]);
  });
});

describe('keywordProblems — правила поля ключевых слов iOS', () => {
  it('ловит пробел после запятой', () => {
    expect(keywordProblems('таро, карты', [])).toContain('пробел после запятой (съедает лимит)');
  });

  it('ловит повтор слова', () => {
    expect(keywordProblems('таро,карты,таро', [])).toContain('повтор слова «таро»');
  });

  it('ловит слово из названия или подзаголовка', () => {
    expect(keywordProblems('таро,колода', ['таро'])).toContain(
      'слово «таро» уже есть в названии/подзаголовке',
    );
  });

  it('ловит пустое ключевое слово', () => {
    expect(keywordProblems('таро,,колода', [])).toContain('пустое ключевое слово');
  });

  it('исправную строку не трогает', () => {
    expect(keywordProblems('гадание,колода,карта дня', ['таро', 'обучение'])).toEqual([]);
  });
});

// --- сам документ -------------------------------------------------------------------------

const listing = parseListing(fs.readFileSync(FILE, 'utf8'));
const byLang = (lang: string): ListingField[] => listing.filter((f) => f.lang === lang);
const field = (lang: string, name: string): ListingField | undefined =>
  listing.find((f) => f.lang === lang && f.field === name);

describe('периметр документа', () => {
  it('файл разобран: полей больше нуля', () => {
    expect(listing.length).toBeGreaterThan(0);
  });

  it('языки документа = языки приложения', () => {
    expect([...new Set(listing.map((f) => f.lang))].sort()).toEqual([...LANGS].sort());
  });

  it('набор полей одинаков у всех языков', () => {
    const reference = byLang(LANGS[0]).map((f) => f.field);
    expect(reference.length).toBeGreaterThan(0);
    for (const lang of LANGS) expect(byLang(lang).map((f) => f.field)).toEqual(reference);
  });

  it('лимит поля одинаков у всех языков', () => {
    for (const f of listing) {
      const same = listing.filter((x) => x.field === f.field);
      expect(same.map((x) => x.limit)).toEqual(same.map(() => f.limit));
    }
  });

  it.each([...LANGS])('%s: поля, от которых зависят проверки, на месте', (lang) => {
    for (const name of [F_NAME, F_SUBTITLE, F_KEYWORDS, F_FULL]) {
      expect(field(lang, name)?.field).toBe(name);
    }
  });

  it.each([...LANGS])('%s: правило слова «бесплатно» задано', (lang) => {
    expect(FREE_WORD[lang]).toBeDefined();
  });
});

describe('лимиты символов', () => {
  it.each(listing.map((f) => [`${f.lang} · ${f.field}`, f] as const))(
    '%s помещается в лимит',
    (_title, f) => {
      expect(size(f.text)).toBeLessThanOrEqual(f.limit);
    },
  );

  it.each(listing.map((f) => [`${f.lang} · ${f.field}`, f] as const))('%s непустое', (_t, f) => {
    expect(f.text.length).toBeGreaterThan(0);
  });
});

describe('запрещённые слова', () => {
  it.each(listing.map((f) => [`${f.lang} · ${f.field}`, f] as const))(
    '%s: без обещаний и гарантий',
    (_title, f) => {
      expect(forbiddenHits(f.text)).toEqual([]);
    },
  );

  it.each([...LANGS])('%s: слова «бесплатно» нет в названии и подзаголовке', (lang) => {
    const re = FREE_WORD[lang];
    for (const name of [F_NAME, F_SUBTITLE]) {
      expect({ name, hit: re.test(field(lang, name)?.text ?? '') }).toEqual({ name, hit: false });
    }
  });
});

describe('ключевые слова iOS', () => {
  it.each([...LANGS])('%s: без пробелов после запятых, повторов и слов из названия', (lang) => {
    const keywords = field(lang, F_KEYWORDS)?.text ?? '';
    const occupied = [
      ...wordsOf(field(lang, F_NAME)?.text ?? ''),
      ...wordsOf(field(lang, F_SUBTITLE)?.text ?? ''),
    ];
    expect(keywordProblems(keywords, occupied)).toEqual([]);
  });
});

describe('числа в описании берутся из кода', () => {
  const lessons = course.reduce((n, m) => n + m.lessons.length, 0);
  const questions = course.reduce(
    (n, m) => n + m.lessons.reduce((k, l) => k + (l.quiz?.length ?? 0), 0),
    0,
  );
  const facts: ReadonlyArray<readonly [string, number]> = [
    ['карт в колоде', cards.length],
    ['модулей курса', course.length],
    ['уроков курса', lessons],
    ['вопросов викторины', questions],
  ];

  it('раскладов в коде столько, сколько обещает таблица фактов', () => {
    expect([spreads.length, spreads.filter((s) => s.free).length]).toEqual([10, 3]);
  });

  it.each([...LANGS])('%s: полное описание называет числа из кода', (lang) => {
    const text = field(lang, F_FULL)?.text ?? '';
    for (const [what, value] of facts) {
      const re = new RegExp(`(?<!\\d)${value}(?!\\d)`, 'u');
      expect({ what, found: re.test(text) }).toEqual({ what, found: true });
    }
  });
});
