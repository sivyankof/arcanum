/** Контракт content/composition.json (спека 36): у каждого правила состава есть варианты на обоих
 *  канонических языках, у номиналов 2–9 — имена для плейсхолдера {rank}. Ловит опечатку редактора
 *  до того, как composition.ts вернёт пустую строку на экране. */
import compositionJson from '../../../content/composition.json';

type V = { ru: string; en: string };
type Node = { variants: V[] };
const json = compositionJson as unknown as {
  majors: Node;
  reversed: Node;
  neutral: Node;
  suit: Record<'wands' | 'cups' | 'swords' | 'pentacles', Node>;
  ranks: Record<'aces' | 'tens' | 'courts' | 'generic', Node>;
  rankNames: Record<string, V>;
};

const filled = (v: V) => typeof v.ru === 'string' && v.ru.trim().length > 0 && typeof v.en === 'string' && v.en.trim().length > 0;

const NODES: [string, Node][] = [
  ['majors', json.majors],
  ['reversed', json.reversed],
  ['neutral', json.neutral],
  ...(['wands', 'cups', 'swords', 'pentacles'] as const).map((s) => [`suit.${s}`, json.suit[s]] as [string, Node]),
  ...(['aces', 'tens', 'courts', 'generic'] as const).map((r) => [`ranks.${r}`, json.ranks[r]] as [string, Node]),
];

describe('composition.json — контракт (спека 36)', () => {
  it.each(NODES)('%s: массив variants с ru и en', (_key, node) => {
    expect(Array.isArray(node.variants)).toBe(true);
    expect(node.variants.length).toBeGreaterThan(0);
    for (const v of node.variants) expect(filled(v)).toBe(true);
  });

  it('rankNames: номиналы 2–9 на обоих языках', () => {
    for (let r = 2; r <= 9; r++) expect(filled(json.rankNames[String(r)])).toBe(true);
  });

  it('плейсхолдеры только из набора {x} {n} {rank}', () => {
    const all = NODES.flatMap(([, node]) => node.variants.flatMap((v) => [v.ru, v.en]));
    for (const text of all) {
      for (const m of text.matchAll(/\{(\w+)\}/g)) expect(['x', 'n', 'rank']).toContain(m[1]);
    }
  });
});
