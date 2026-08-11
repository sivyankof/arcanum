import { localDateISO } from '../dates';
import {
  canEditNote,
  cardHistory,
  entriesOfMonth,
  monthSummary,
  monthsWithEntries,
  normalizeNote,
  NOTE_MAX,
  type DailyDraw,
} from '../journal';

/** Короткая запись: дата, карта и (необязательно) заметка. */
const d = (date: string, cardId: string, note?: string): DailyDraw => ({
  date,
  cardId,
  reversed: false,
  ...(note ? { note } : {}),
});

describe('monthsWithEntries', () => {
  it('пустая история не даёт месяцев', () => {
    expect(monthsWithEntries([])).toEqual([]);
  });

  it('месяцы идут от новых к старым, дубли схлопываются', () => {
    const history = [d('2026-08-11', 'moon'), d('2026-08-01', 'sun'), d('2026-07-30', 'star')];
    expect(monthsWithEntries(history)).toEqual(['2026-08', '2026-07']);
  });

  it('порядок записей в сторе не влияет на порядок месяцев', () => {
    const history = [d('2026-07-30', 'star'), d('2026-08-11', 'moon'), d('2025-12-31', 'sun')];
    expect(monthsWithEntries(history)).toEqual(['2026-08', '2026-07', '2025-12']);
  });
});

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
      lastDate: undefined,
      lastNote: undefined,
    });
  });
});

describe('canEditNote', () => {
  it('сегодняшнюю запись править можно, вчерашнюю нельзя', () => {
    expect(canEditNote(localDateISO())).toBe(true);
    expect(canEditNote('2026-08-10', '2026-08-11')).toBe(false);
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
