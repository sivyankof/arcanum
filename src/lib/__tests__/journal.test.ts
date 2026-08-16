import { localDateISO } from '../dates';
import {
  canEditEntry,
  cardHistory,
  entriesOfMonth,
  filterJournal,
  journalCounts,
  journalKey,
  journalMonths,
  journalOfMonth,
  monthSummary,
  normalizeNote,
  NOTE_MAX,
  outcomeStats,
  type DailyDraw,
  type JournalEntry,
  type Outcome,
} from '../journal';
import type { SpreadDraw } from '../spread';

/** Короткая запись: дата, карта и (необязательно) заметка. */
const d = (date: string, cardId: string, note?: string): DailyDraw => ({
  date,
  cardId,
  reversed: false,
  ...(note ? { note } : {}),
});

/** Запись с ответом рефлексии. */
const o = (date: string, cardId: string, outcome: Outcome, note?: string): DailyDraw => ({
  ...d(date, cardId, note),
  outcome,
});

/** Сохранённый расклад — короткая запись для тестов ленты. */
const sp = (ts: number, date: string, question?: string, note?: string): SpreadDraw => ({
  ts,
  date,
  spreadId: 'three-card',
  cards: [{ cardId: 'fool', reversed: false }, { cardId: 'sun', reversed: true }, { cardId: 'moon', reversed: false }],
  ...(question ? { question } : {}),
  ...(note ? { note } : {}),
});
const asDay = (e: DailyDraw): JournalEntry => ({ kind: 'day', entry: e });
/** cardId записи дня; для записи расклада — undefined (сужение типа без каста). */
const dayCardId = (e: JournalEntry): string | undefined => (e.kind === 'day' ? e.entry.cardId : undefined);

describe('entriesOfMonth', () => {
  it('соседние месяцы не попадают в выборку', () => {
    const history = [d('2026-07-31', 'star'), d('2026-08-01', 'moon'), d('2026-09-01', 'sun')];
    expect(entriesOfMonth(history, '2026-08').map((e) => e.cardId)).toEqual(['moon']);
  });

  it('записи возвращаются новыми сверху даже при перемешанной истории', () => {
    const history = [d('2026-08-03', 'sun'), d('2026-08-11', 'moon'), d('2026-08-07', 'star')];
    expect(entriesOfMonth(history, '2026-08').map((e) => e.date)).toEqual([
      '2026-08-11',
      '2026-08-07',
      '2026-08-03',
    ]);
  });

  it('месяц без записей даёт пустой список', () => {
    expect(entriesOfMonth([d('2026-08-11', 'moon')], '2026-06')).toEqual([]);
  });
});

describe('monthSummary', () => {
  const history = [
    d('2026-08-11', 'moon', 'созвон прошёл легко'),
    d('2026-08-09', 'moon'),
    d('2026-08-05', 'sun', 'много сил'),
    d('2026-07-28', 'star', 'заметка прошлого месяца'),
  ];

  it('считает записи месяца и записи с заметкой', () => {
    const s = monthSummary(history, '2026-08');
    expect(s.count).toBe(3);
    expect(s.withNote).toBe(2);
  });

  it('карта месяца — самая частая', () => {
    const s = monthSummary(history, '2026-08');
    expect(s.topCardId).toBe('moon');
    expect(s.topCount).toBe(2);
  });

  it('при равенстве частот выигрывает карта со свежайшей записью, результат детерминирован', () => {
    const tie = [
      d('2026-08-10', 'sun'),
      d('2026-08-02', 'sun'),
      d('2026-08-11', 'moon'),
      d('2026-08-01', 'moon'),
    ];
    const results = new Set(
      Array.from({ length: 100 }, () => monthSummary(tie, '2026-08').topCardId),
    );
    expect([...results]).toEqual(['moon']); // у moon свежайшая запись 11-го
  });

  it('месяц без записей: нулевая сводка без карты месяца', () => {
    const s = monthSummary(history, '2026-06');
    expect(s).toEqual({ count: 0, withNote: 0, topCardId: undefined, topCount: 0 });
  });
});

describe('cardHistory', () => {
  const history = [
    d('2026-08-11', 'moon'),
    d('2026-08-04', 'moon', 'решилась написать первой'),
    d('2026-07-20', 'moon', 'старая заметка'),
    d('2026-08-06', 'sun'),
  ];

  it('считает выпадения и дату последнего', () => {
    const h = cardHistory(history, 'moon');
    expect(h.times).toBe(3);
    expect(h.lastDate).toBe('2026-08-11');
  });

  it('последняя заметка берётся из свежайшей записи С ЗАМЕТКОЙ', () => {
    // свежайшее выпадение (11-го) заметки не имеет — показываем заметку от 4-го, а не пустоту
    expect(cardHistory(history, 'moon').lastNote).toBe('решилась написать первой');
  });

  it('карта не выпадала — пустая история', () => {
    expect(cardHistory(history, 'tower')).toEqual({
      times: 0,
      resonated: 0,
      lastDate: undefined,
      lastNote: undefined,
    });
  });
});

describe('canEditEntry', () => {
  it('сегодняшнюю запись править можно, вчерашнюю нельзя', () => {
    expect(canEditEntry(localDateISO())).toBe(true);
    expect(canEditEntry('2026-08-10', '2026-08-11')).toBe(false);
  });
});

describe('normalizeNote', () => {
  it('срезает пробелы по краям', () => {
    expect(normalizeNote('  мысль дня \n')).toBe('мысль дня');
  });

  it('обрезает текст до предела', () => {
    expect(normalizeNote('я'.repeat(600))).toHaveLength(NOTE_MAX);
  });

  it('строка из одних пробелов превращается в пустую', () => {
    expect(normalizeNote('   ')).toBe('');
  });
});

describe('outcomeStats', () => {
  const history = [
    o('2026-08-11', 'moon', 'yes'),
    o('2026-08-10', 'sun', 'partly'),
    o('2026-08-09', 'star', 'no'),
    o('2026-08-08', 'moon', 'yes'),
    d('2026-08-07', 'tower'), // без ответа — в знаменатель не идёт
    o('2026-07-30', 'moon', 'yes'), // чужой месяц
  ];

  it('считает ответы по видам', () => {
    const s = outcomeStats(history, '2026-08');
    expect(s.yes).toBe(2);
    expect(s.partly).toBe(1);
    expect(s.no).toBe(1);
  });

  it('знаменатель — только дни С ОТВЕТОМ, запись без ответа не считается', () => {
    expect(outcomeStats(history, '2026-08').answered).toBe(4);
  });

  it('отозвалось = «да» + «отчасти»', () => {
    expect(outcomeStats(history, '2026-08').resonated).toBe(3);
  });

  it('соседний месяц не подмешивается', () => {
    expect(outcomeStats(history, '2026-07').answered).toBe(1);
  });

  it('месяц без ответов даёт нули', () => {
    expect(outcomeStats([d('2026-06-01', 'moon')], '2026-06')).toEqual({
      answered: 0, resonated: 0, yes: 0, partly: 0, no: 0,
    });
  });
});

describe('filterJournal (дни)', () => {
  const entries = [
    o('2026-08-11', 'moon', 'yes', 'с заметкой'),
    o('2026-08-10', 'sun', 'partly'),
    o('2026-08-09', 'star', 'no'),
    d('2026-08-08', 'tower', 'только заметка'),
  ].map(asDay);

  it('«все» отдаёт список как есть', () => {
    expect(filterJournal(entries, 'all')).toHaveLength(4);
  });

  it('фильтр по ответу', () => {
    expect(filterJournal(entries, 'yes').map(dayCardId)).toEqual(['moon']);
    expect(filterJournal(entries, 'partly').map(dayCardId)).toEqual(['sun']);
    expect(filterJournal(entries, 'no').map(dayCardId)).toEqual(['star']);
  });

  it('«с заметкой» не зависит от ответа', () => {
    expect(filterJournal(entries, 'note').map(dayCardId)).toEqual(['moon', 'tower']);
  });
});

describe('journalCounts (дни)', () => {
  it('даёт число для каждого чипа', () => {
    const entries = [
      o('2026-08-11', 'moon', 'yes', 'с заметкой'),
      o('2026-08-10', 'sun', 'yes'),
      d('2026-08-09', 'star'),
    ].map(asDay);
    expect(journalCounts(entries)).toEqual({ all: 3, yes: 2, partly: 0, no: 0, note: 1 });
  });
});

describe('единая лента дня и расклада (спека 36)', () => {
  const history = [d('2026-08-14', 'fool', 'заметка дня'), o('2026-08-13', 'sun', 'no')];
  const spreads = [sp(2, '2026-08-14', 'вопрос'), sp(1, '2026-08-14'), sp(3, '2026-07-02', undefined, 'заметка')];

  it('journalMonths: месяцы обеих историй, новые первыми, без дублей', () => {
    expect(journalMonths(history, spreads)).toEqual(['2026-08', '2026-07']);
    expect(journalMonths([], [sp(9, '2026-06-01')])).toEqual(['2026-06']);
  });

  it('journalOfMonth: по дате убыв., внутри дня запись дня первой, расклады по ts убыв.', () => {
    const items = journalOfMonth(history, spreads, '2026-08');
    expect(items.map(journalKey)).toEqual(['d:2026-08-14', 's:2', 's:1', 'd:2026-08-13']);
  });

  it('filterJournal: ответы — только дни; «с заметкой» — день с заметкой или расклад с заметкой/вопросом', () => {
    const items = journalOfMonth(history, spreads, '2026-08');
    expect(filterJournal(items, 'no').map(journalKey)).toEqual(['d:2026-08-13']);
    expect(filterJournal(items, 'note').map(journalKey)).toEqual(['d:2026-08-14', 's:2']);
    expect(filterJournal(items, 'all')).toBe(items);
  });

  it('journalCounts: «Все» считает и расклады', () => {
    const items = journalOfMonth(history, spreads, '2026-08');
    expect(journalCounts(items)).toEqual({ all: 4, yes: 0, partly: 0, no: 1, note: 2 });
  });

  it('journalKey уникален у двух раскладов одного дня', () => {
    expect(journalKey({ kind: 'spread', entry: sp(1, '2026-08-14') })).not.toBe(
      journalKey({ kind: 'spread', entry: sp(2, '2026-08-14') }),
    );
  });

  it('старые вызовы фильтров переписаны на ленту: тот же ответ по дням', () => {
    const items = history.map(asDay);
    expect(filterJournal(items, 'note').map(journalKey)).toEqual(['d:2026-08-14']);
    expect(journalCounts(items).all).toBe(2);
  });
});

describe('cardHistory · отзывалась', () => {
  it('считает «да» и «отчасти», записи без ответа не в счёт', () => {
    const history = [
      o('2026-08-11', 'moon', 'yes'),
      o('2026-08-04', 'moon', 'partly'),
      o('2026-07-20', 'moon', 'no'),
      d('2026-07-10', 'moon'),
    ];
    const h = cardHistory(history, 'moon');
    expect(h.times).toBe(4);
    expect(h.resonated).toBe(2);
  });
});
