/** Тесты поиска по справочнику (спека 04): совпадение по имени и ключевым словам,
 *  регистр, «ё/е», сложение фильтра с запросом, нарезка на ряды сетки. */
import { filterCards, matchesQuery, normalize, stem, tokenize, toRows } from '../cardSearch';
import { cardById, cards } from '../content';

const fool = cardById.get('fool')!;
const lovers = cardById.get('lovers')!;
const hierophant = cardById.get('hierophant')!;

describe('normalize', () => {
  it('приводит к нижнему регистру, срезает пробелы и заменяет «ё» на «е»', () => {
    expect(normalize('  ВлюблЁнные ')).toBe('влюбленные');
  });
});

describe('matchesQuery — по названию', () => {
  it('находит по части названия', () => {
    expect(matchesQuery(fool, 'дур', 'ru')).toBe(true);
  });

  it('не зависит от регистра', () => {
    expect(matchesQuery(fool, 'ДУРАК', 'ru')).toBe(true);
  });

  it('находит карту с «ё» при вводе через «е» и наоборот', () => {
    expect(matchesQuery(lovers, 'влюбленные', 'ru')).toBe(true);
    expect(matchesQuery(lovers, 'Влюблённые', 'ru')).toBe(true);
  });

  it('пустой запрос совпадает с любой картой', () => {
    expect(matchesQuery(fool, '   ', 'ru')).toBe(true);
  });

  it('работает на английском языке', () => {
    expect(matchesQuery(fool, 'fool', 'en')).toBe(true);
    expect(matchesQuery(fool, 'дурак', 'en')).toBe(false);
  });
});

describe('matchesQuery — по ключевым словам', () => {
  it('находит Иерофанта по слову «наставник»', () => {
    expect(matchesQuery(hierophant, 'наставник', 'ru')).toBe(true);
  });

  it('находит Дурака по слову «свобода»', () => {
    expect(matchesQuery(fool, 'свобода', 'ru')).toBe(true);
  });

  it('не находит по слову, которого нет ни в имени, ни в ключевых словах', () => {
    expect(matchesQuery(fool, 'ипотека', 'ru')).toBe(false);
  });
});

describe('matchesQuery — по скрытым поисковым синонимам (спека 04г)', () => {
  it('находит Тройку Мечей по житейскому «измена»', () => {
    expect(matchesQuery(cardById.get('s03')!, 'измена', 'ru')).toBe(true);
  });

  it('находит Десятку Жезлов по «выгорание»', () => {
    expect(matchesQuery(cardById.get('w10')!, 'выгорание', 'ru')).toBe(true);
  });

  it('находит Дьявола по смыслу перевёрнутой карты «освобождение»', () => {
    expect(matchesQuery(cardById.get('devil')!, 'освобождение', 'ru')).toBe(true);
  });

  it('работает и на английском', () => {
    expect(matchesQuery(cardById.get('p05')!, 'debt', 'en')).toBe(true);
  });
});

describe('наполнение ключевых слов (спека 04г)', () => {
  it('у каждой карты ровно 4 слова витрины в обоих языках', () => {
    const bad = cards.filter((c) => c.keywords.ru.length !== 4 || c.keywords.en.length !== 4);
    expect(bad.map((c) => c.id)).toEqual([]);
  });

  it('у каждой карты 8–12 поисковых синонимов в обоих языках', () => {
    const inRange = (a: string[]) => a.length >= 8 && a.length <= 12;
    const bad = cards.filter((c) => !inRange(c.search.ru) || !inRange(c.search.en));
    expect(bad.map((c) => c.id)).toEqual([]);
  });

  it('поисковые синонимы не дублируют витрину', () => {
    const bad = cards.filter((c) =>
      (['ru', 'en'] as const).some((lang) => {
        const shown = new Set(c.keywords[lang].map(normalize));
        return c.search[lang].some((w) => shown.has(normalize(w)));
      }),
    );
    expect(bad.map((c) => c.id)).toEqual([]);
  });

  it('житейские запросы находят от 1 до 12 карт — не пусто и не пол-колоды', () => {
    // верхняя граница поднята с 8 до 12 в задаче 04з: поиск научился словоформам,
    // и «работа» законно подтянула карты со словами «работы», «работу», «работе»
    const probes = ['любовь', 'деньги', 'работа', 'здоровье', 'расставание',
      'переезд', 'выгорание', 'одиночество', 'ссора', 'учёба'];
    const out = probes.map((q) => [q, filterCards(cards, { query: q, filter: 'all', lang: 'ru' }).length]);
    expect(out.filter(([, n]) => (n as number) < 1 || (n as number) > 12)).toEqual([]);
  });
});

describe('словоформы и токены (спека 04з)', () => {
  const ids = (query: string) =>
    filterCards(cards, { query, filter: 'all', lang: 'ru' }).map((c) => c.id);

  it('tokenize разбивает фразу на слова', () => {
    expect(tokenize('баланс работы и дома')).toEqual(['баланс', 'работы', 'и', 'дома']);
  });

  it('stem срезает окончание, но бережёт короткие слова', () => {
    expect(stem('деньгами', 'ru')).toBe(stem('деньги', 'ru'));
    expect(stem('работе', 'ru')).toBe(stem('работа', 'ru'));
    expect(stem('дом', 'ru')).toBe('дом');
    expect(stem('feelings', 'en')).toBe(stem('feeling', 'en'));
  });

  it('падежная форма находит то же, что словарная', () => {
    expect(ids('работе')).toEqual(ids('работа'));
    expect(ids('деньгами')).toEqual(ids('деньги'));
    expect(ids('переезда')).toEqual(ids('переезд'));
  });

  it('запросы, которые раньше не находили ничего, теперь находят карты', () => {
    expect(ids('семьи').length).toBeGreaterThan(0);
    expect(ids('ссоры').length).toBeGreaterThan(0);
    expect(ids('тревоге').length).toBeGreaterThan(0);
  });

  it('подстрока в середине слова больше не срабатывает', () => {
    expect(ids('рост')).toEqual(['w01', 'w03']);           // не «щедрость», «мудрость», «скорость»
    expect(ids('дом')).not.toContain('c05');               // «опора рядом» — не про дом
    expect(matchesQuery(cardById.get('empress')!, 'рост', 'ru')).toBe(false);
  });

  it('набор по буквам работает как прежде', () => {
    expect(ids('дур')).toEqual(['fool']);
    expect(ids('люб').length).toBeGreaterThan(0);
    expect(ids('пент')).toHaveLength(14);
  });

  it('многословный запрос требует все слова', () => {
    expect(ids('мир семья')).toContain('c10');
    expect(ids('мир кракозябра')).toEqual([]);
  });
});

describe('filterCards', () => {
  const all = { query: '', filter: 'all' as const, lang: 'ru' as const };

  it('без запроса и фильтра возвращает всю колоду', () => {
    expect(filterCards(cards, all)).toHaveLength(78);
  });

  it('фильтр «Старшие» оставляет 22 карты', () => {
    expect(filterCards(cards, { ...all, filter: 'major' })).toHaveLength(22);
  });

  it('фильтр по масти оставляет 14 карт', () => {
    expect(filterCards(cards, { ...all, filter: 'cups' })).toHaveLength(14);
  });

  it('запрос по названию находит нужную карту', () => {
    const found = filterCards(cards, { ...all, query: 'дурак' });
    expect(found.map((c) => c.id)).toEqual(['fool']);
  });

  it('запрос по ключевому слову находит несколько карт', () => {
    const found = filterCards(cards, { ...all, query: 'наставник' });
    expect(found.map((c) => c.id)).toContain('hierophant');
  });

  it('несуществующий запрос даёт пустой список', () => {
    expect(filterCards(cards, { ...all, query: 'кракозябра' })).toEqual([]);
  });

  it('фильтр и запрос складываются: в Кубках Дурака нет', () => {
    expect(filterCards(cards, { ...all, filter: 'cups', query: 'дурак' })).toEqual([]);
  });
});

describe('toRows', () => {
  it('78 карт по 3 в ряд дают 26 полных рядов', () => {
    const rows = toRows(cards, 3);
    expect(rows).toHaveLength(26);
    expect(rows.every((r) => r.length === 3)).toBe(true);
  });

  it('неполный последний ряд сохраняет остаток', () => {
    const rows = toRows(cards.slice(0, 77), 3);
    expect(rows).toHaveLength(26);
    expect(rows[25]).toHaveLength(2);
  });

  it('пустой список даёт пустой результат', () => {
    expect(toRows([], 3)).toEqual([]);
  });
});

describe('язык без переводов контента (es/pt до задачи 28) — спека 27', () => {
  it('ищет по английским словам и стеммит английскими окончаниями, а не падает', () => {
    // у карты нет name.es → текст берётся из en, окончания — английские
    expect(matchesQuery(fool, 'fool', 'es')).toBe(true);
    // поисковое слово en «risk» находится по форме «risks» ТОЛЬКО английским стеммингом
    // (русские окончания «s» не срежут, префикс тоже не совпадёт) — так проверяется, что
    // окончания берутся по языку текста, а не по выбранному языку
    expect(matchesQuery(fool, 'risks', 'pt')).toBe(true);
    expect(matchesQuery(fool, 'дурак', 'es')).toBe(false);
  });

  it('фильтрация всей колоды на pt не бросает и что-то находит', () => {
    expect(filterCards(cards, { query: 'sword', filter: 'all', lang: 'pt' }).length).toBeGreaterThan(0);
  });
});
