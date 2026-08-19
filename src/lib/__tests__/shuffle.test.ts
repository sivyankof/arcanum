import { shuffle } from '../shuffle';

const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

describe('shuffle — Фишер–Йетс (спека 45, вынесен из spread.ts)', () => {
  it('перестановка: тот же набор элементов, вход не тронут', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(src, lcg(3));
    expect([...out].sort((a, b) => a - b)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out).not.toBe(src);
  });
  it('сидированный rng — детерминированно, другой сид — иначе', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(7))).toEqual(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(7)));
    expect(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(7))).not.toEqual(shuffle([1, 2, 3, 4, 5, 6, 7], lcg(8)));
  });
  it('rng → 0 всегда меняет i-й с нулевым: [1,2,3,4] → [2,3,4,1]; rng → 0.999 — тождество', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
  });
  it('пустой массив и один элемент', () => {
    expect(shuffle([], lcg(1))).toEqual([]);
    expect(shuffle(['a'], lcg(1))).toEqual(['a']);
  });
});
