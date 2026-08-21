import { queueReveal, REVEAL_CAP, revealOrder, takeReveal } from '../revealQueue';

describe('queueReveal/takeReveal — очередь «момента переворота» (спека 46в)', () => {
  it('take отдаёт содержимое и сразу очищает', () => {
    queueReveal(['fool', 'magician']);
    expect(takeReveal()).toEqual(['fool', 'magician']);
    expect(takeReveal()).toEqual([]);
  });

  it('повторный queueReveal дописывает без дублей', () => {
    queueReveal(['fool', 'magician']);
    queueReveal(['magician', 'empress']);
    expect(takeReveal()).toEqual(['fool', 'magician', 'empress']);
  });

  it('пустой массив ничего не добавляет', () => {
    queueReveal([]);
    expect(takeReveal()).toEqual([]);
  });
});

describe('revealOrder — ступеньки стаггера в порядке сетки (спека 46в)', () => {
  // строки по 3 ячейки, как в справочнике (GRID_COLS = 3)
  const rows = (ids: string[]): { id: string }[][] => {
    const out: { id: string }[][] = [];
    for (let i = 0; i < ids.length; i += 3) out.push(ids.slice(i, i + 3).map((id) => ({ id })));
    return out;
  };

  it('порядок сетки: ряды сверху вниз, в ряду слева направо', () => {
    const grid = rows(['a', 'b', 'c', 'd', 'e', 'f']);
    const order = revealOrder(grid, new Set(['e', 'a', 'c']));
    expect(order.get('a')).toBe(0);
    expect(order.get('c')).toBe(1);
    expect(order.get('e')).toBe(2);
    expect(order.has('b')).toBe(false);
    expect(order.has('d')).toBe(false);
    expect(order.has('f')).toBe(false);
  });

  it('потолок каскада: девятая карта в Map не попадает', () => {
    const ids = Array.from({ length: 9 }, (_, i) => `c${i}`);
    const grid = rows(ids);
    const order = revealOrder(grid, new Set(ids));
    expect(order.size).toBe(REVEAL_CAP);
    for (let i = 0; i < REVEAL_CAP; i++) expect(order.get(`c${i}`)).toBe(i);
    expect(order.has('c8')).toBe(false);
  });

  it('свой cap: третья карта уже не попадает при cap=2', () => {
    const grid = rows(['a', 'b', 'c']);
    const order = revealOrder(grid, new Set(['a', 'b', 'c']), 2);
    expect(order.size).toBe(2);
    expect(order.has('c')).toBe(false);
  });

  it('id, которых нет в rows (скрыты фильтром), ступенек не получают', () => {
    const grid = rows(['a', 'b']);
    const order = revealOrder(grid, new Set(['a', 'ghost']));
    expect(order.get('a')).toBe(0);
    expect(order.has('ghost')).toBe(false);
    expect(order.size).toBe(1);
  });

  it('пустые ids — пустая Map', () => {
    const grid = rows(['a', 'b', 'c']);
    expect(revealOrder(grid, new Set()).size).toBe(0);
  });

  it('пустая сетка — пустая Map', () => {
    expect(revealOrder([], new Set(['a'])).size).toBe(0);
  });
});
