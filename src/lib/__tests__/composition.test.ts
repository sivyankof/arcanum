import { analyzeSpread, compositionTexts, type Observation } from '../composition';
import type { DrawnCard } from '../spread';

// имена id — из content/cards.json: старшие по имени, младшие <масть><номер> (w/c/s/p + 01..14)
const c = (cardId: string, reversed = false): DrawnCard => ({ cardId, reversed });
const keys = (obs: Observation[]) => obs.map((o) => o.key);

describe('analyzeSpread — правила состава (logic-spec §1б, спека 36 А)', () => {
  it('1. все три карты старшие → одно наблюдение majors {3, 3}', () => {
    const obs = analyzeSpread([c('empress'), c('justice', true), c('fool')]);
    expect(obs).toEqual([{ key: 'majors', vars: { x: 3, n: 3 } }]);
  });

  it('2. Двойка и Пятёрка Кубков + Туз Мечей → suit.cups (2 из 3 младших)', () => {
    expect(keys(analyzeSpread([c('c02'), c('c05', true), c('s01')]))).toEqual(['suit.cups']);
  });

  it('3. кельтский крест: 5 старших, 3 Жезла, 2 Кубка, 5 перевёрнутых → majors, suit.wands, reversed', () => {
    const cards = [
      c('fool', true), c('magician', true), c('empress', true), c('sun', true), c('moon', true),
      c('w03'), c('w05'), c('w07'), c('c02'), c('c04'),
    ];
    const obs = analyzeSpread(cards);
    expect(keys(obs)).toEqual(['majors', 'suit.wands', 'reversed']);
    expect(obs[0].vars).toEqual({ x: 5, n: 10 });
    expect(obs[2].vars).toEqual({ x: 5, n: 10 });
  });

  it('4. два туза и две придворные → одно наблюдение ranks.aces (равенство — по порядку правил)', () => {
    const obs = analyzeSpread([c('w01'), c('c01'), c('s03'), c('p11'), c('w12')]);
    expect(obs).toEqual([{ key: 'ranks.aces', vars: { x: 2 } }]);
  });

  it('5. две Двойки + Луна → ranks.generic с номером', () => {
    expect(analyzeSpread([c('w02'), c('c02'), c('moon')])).toEqual([
      { key: 'ranks.generic', vars: { x: 2, rank: 2 } },
    ]);
  });

  it('6. ничего не сработало → neutral', () => {
    expect(analyzeSpread([c('fool'), c('w03'), c('c07')])).toEqual([{ key: 'neutral', vars: {} }]);
  });

  it('7. три Пятёрки разных мастей + две старшие → только ranks.generic {3, 5}', () => {
    expect(analyzeSpread([c('c05'), c('s05'), c('w05'), c('moon'), c('sun')])).toEqual([
      { key: 'ranks.generic', vars: { x: 3, rank: 5 } },
    ]);
  });

  it('масть при ничьей лидеров не срабатывает; одна младшая карта — тоже нет', () => {
    expect(keys(analyzeSpread([c('c02'), c('s02'), c('fool'), c('sun'), c('w03')]))).not.toContain('suit.cups');
    expect(keys(analyzeSpread([c('c02'), c('fool'), c('sun')]))).not.toContain('suit.cups');
  });

  it('половина перевёрнутых при чётном числе карт срабатывает', () => {
    expect(keys(analyzeSpread([c('w03', true), c('c07', true), c('fool'), c('p09')]))).toContain('reversed');
  });

  it('пустой вход → neutral, не падает', () => {
    expect(analyzeSpread([])).toEqual([{ key: 'neutral', vars: {} }]);
  });
});

describe('compositionTexts — тексты из composition.json', () => {
  const obs = analyzeSpread([c('w02'), c('c02'), c('moon')]);

  it('одна дата — один и тот же текст 100 раз, плейсхолдеры подставлены', () => {
    const texts = new Set(Array.from({ length: 100 }, () => compositionTexts(obs, '2026-08-15', 'ru')[0]));
    expect(texts.size).toBe(1);
    const t = [...texts][0];
    expect(t).toContain('Двойка');
    expect(t).not.toMatch(/\{/);
  });

  it('английский берёт английское имя номинала', () => {
    expect(compositionTexts(obs, '2026-08-15', 'en')[0]).toContain('Two');
  });

  it('majors подставляет x и n', () => {
    const t = compositionTexts([{ key: 'majors', vars: { x: 2, n: 3 } }], '2026-08-15', 'ru')[0];
    expect(t).toMatch(/2/);
    expect(t).toMatch(/3/);
    expect(t).not.toMatch(/\{/);
  });

  it('за 30 дней у majors чередуются разные варианты', () => {
    const texts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        compositionTexts([{ key: 'majors', vars: { x: 2, n: 3 } }], `2026-08-${String(i + 1).padStart(2, '0')}`, 'ru')[0],
      ),
    );
    expect(texts.size).toBeGreaterThan(1);
  });
});
