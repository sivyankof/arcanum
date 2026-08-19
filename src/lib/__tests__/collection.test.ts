/** Коллекция-альбом (спека 46): секции, прогресс, режим секции — на РЕАЛЬНОЙ колоде и курсе,
 *  чтобы тест заодно был контрактом данных (22 старших + 4×14, m2l1–m2l4 = 8 старших макета). */
import {
  COLLECTION_GROUPS,
  collectionProgress,
  collectionSections,
  groupOf,
  sectionMode,
  type CollectionSection,
} from '../collection';
import { cards, course } from '../content';
import { learnedCardIds, type LessonProgressMap } from '../courseProgress';

const none = new Set<string>();
const byId = (id: string) => cards.find((c) => c.id === id)!;
const done = (...ids: string[]): LessonProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

describe('collectionSections', () => {
  it('пять секций в порядке экрана, тоталы 22 + 14×4 = 78', () => {
    const s = collectionSections(cards, none);
    expect(s.map((x) => x.group)).toEqual([...COLLECTION_GROUPS]);
    expect(s.map((x) => x.total)).toEqual([22, 14, 14, 14, 14]);
    expect(collectionProgress(s)).toEqual({ open: 0, total: 78 });
  });

  it('каждая карта колоды ровно в одной секции', () => {
    const all = collectionSections(cards, none).flatMap((x) => x.cards.map((c) => c.id));
    expect(all.length).toBe(cards.length);
    expect(new Set(all).size).toBe(cards.length);
  });

  it('внутри секции карты идут по возрастанию number: Дурак…Мир, Туз…Король', () => {
    const s = collectionSections(cards, none);
    for (const sec of s) {
      const nums = sec.cards.map((c) => c.number);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }
    const [major, wands] = s;
    expect(major.cards[0].id).toBe('fool');
    expect(major.cards[21].id).toBe('world');
    expect(wands.cards[0].id).toBe('w01');
    expect(wands.cards[13].id).toBe('w14');
  });

  it('open считает карты секции из множества; чужие id не считаются', () => {
    const learned = new Set(['fool', 'magician', 'w01', 'w02', 'w03', 'no-such-card']);
    const s = collectionSections(cards, learned);
    expect(s.map((x) => x.open)).toEqual([2, 3, 0, 0, 0]);
    expect(collectionProgress(s)).toEqual({ open: 5, total: 78 });
  });

  it('состояние макета: пройдены m2l1–m2l4 → открыто 8 из 78, старшие 8 из 22, масти по нулям', () => {
    const learned = learnedCardIds(course, done('m2l1', 'm2l2', 'm2l3', 'm2l4'));
    const s = collectionSections(cards, learned);
    expect(collectionProgress(s)).toEqual({ open: 8, total: 78 });
    expect(s[0]).toMatchObject({ group: 'major', open: 8, total: 22 });
    expect(s.slice(1).map((x) => x.open)).toEqual([0, 0, 0, 0]);
  });

  it('порядок секций не зависит от того, какие открыты (секция растёт на месте)', () => {
    const learned = learnedCardIds(course, done('m4l1')); // Жезлы 1–5
    const s = collectionSections(cards, learned);
    expect(s.map((x) => x.group)).toEqual([...COLLECTION_GROUPS]);
    expect(s.map(sectionMode)).toEqual(['row', 'grid', 'row', 'row', 'row']);
    expect(s[1].open).toBe(5);
  });
});

describe('sectionMode', () => {
  const sec = (open: number): CollectionSection => ({ group: 'cups', cards: [], open, total: 14 });
  it('ни одной открытой — строка, хотя бы одна — сетка', () => {
    expect(sectionMode(sec(0))).toBe('row');
    expect(sectionMode(sec(1))).toBe('grid');
    expect(sectionMode(sec(14))).toBe('grid');
  });
});

describe('groupOf', () => {
  it('старший аркан → major, младший → его масть', () => {
    expect(groupOf(byId('fool'))).toBe('major');
    expect(groupOf(byId('w01'))).toBe('wands');
    expect(groupOf(byId('c01'))).toBe('cups');
    expect(groupOf(byId('s01'))).toBe('swords');
    expect(groupOf(byId('p01'))).toBe('pentacles');
  });
});
