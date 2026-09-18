import { cards, fragments } from '../content';
import {
  boxEdges, FRAGMENT_BOTTOM, FRAGMENT_SIZE_MAX, FRAGMENT_SIZE_MIN, FRAGMENT_TOP,
} from '../fragmentGame';

const majors = cards.filter((c) => c.arcana === 'major').map((c) => c.id);

describe('content/fragments.json (спека 72)', () => {
  it('у каждого старшего аркана не меньше трёх фрагментов', () => {
    expect(majors).toHaveLength(22);
    for (const id of majors) expect([id, (fragments[id] ?? []).length >= 3]).toEqual([id, true]);
  });
  it('все id существуют в колоде', () => {
    const ids = new Set(cards.map((c) => c.id));
    for (const id of Object.keys(fragments)) expect([id, ids.has(id)]).toEqual([id, true]);
  });
  it('квадрат внутри скана, вне полос номера и имени, размер в допуске', () => {
    for (const [id, boxes] of Object.entries(fragments))
      boxes.forEach((b, i) => {
        const e = boxEdges(b);
        const ok =
          e.left >= 0 && e.right <= 1 && e.top >= FRAGMENT_TOP && e.bottom <= 1 - FRAGMENT_BOTTOM &&
          b.size >= FRAGMENT_SIZE_MIN && b.size <= FRAGMENT_SIZE_MAX;
        expect([`${id}#${i}`, ok]).toEqual([`${id}#${i}`, true]);
      });
  });
  it('фрагменты одной карты перекрываются меньше чем наполовину', () => {
    for (const [id, boxes] of Object.entries(fragments))
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxEdges(boxes[i]);
          const b = boxEdges(boxes[j]);
          const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const smaller = Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top));
          expect([`${id} ${i}/${j}`, (w * h) / smaller < 0.5]).toEqual([`${id} ${i}/${j}`, true]);
        }
  });
});
