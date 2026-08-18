import { cardById, spreads } from '../content';
import { inLang } from '../lang';
import { NOTE_MAX, normalizeText } from '../journal';
import {
  cardMeaning,
  dealSpread,
  drawnCardLabel,
  normalizeQuestion,
  QUESTION_MAX,
  REVERSED_P,
  spreadMeaningText,
  SPREADS_MAX,
} from '../spread';

/** Линейный конгруэнтный генератор — детерминированный rng для тестов вместо Math.random. */
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

describe('dealSpread — тасование (logic-spec §1а)', () => {
  it('константы схемы (logic-spec §7)', () => {
    expect(SPREADS_MAX).toBe(100);
    expect(QUESTION_MAX).toBe(200);
    expect(REVERSED_P).toBe(0.3);
  });

  it('1000 раскладов «Кельтский крест» — внутри расклада карты не повторяются и все из колоды', () => {
    for (let i = 0; i < 1000; i++) {
      const d = dealSpread(10);
      expect(d).toHaveLength(10);
      expect(new Set(d.map((c) => c.cardId)).size).toBe(10);
      for (const c of d) expect(cardById.has(c.cardId)).toBe(true);
    }
  });

  it('доля перевёрнутых по 10 000 картам — 30 % ± 3 п.п.', () => {
    let reversed = 0;
    for (let i = 0; i < 1000; i++) reversed += dealSpread(10).filter((c) => c.reversed).length;
    const share = reversed / 10000;
    expect(share).toBeGreaterThan(0.27);
    expect(share).toBeLessThan(0.33);
  });

  it('rng выше порога — все прямые, ниже — все перевёрнутые', () => {
    expect(dealSpread(5, () => 0.5).every((c) => !c.reversed)).toBe(true);
    expect(dealSpread(5, () => 0.1).every((c) => c.reversed)).toBe(true);
  });

  it('один и тот же сид даёт один и тот же расклад', () => {
    expect(dealSpread(7, lcg(7))).toEqual(dealSpread(7, lcg(7)));
    expect(dealSpread(7, lcg(7))).not.toEqual(dealSpread(7, lcg(8)));
  });

  it('у каждого расклада каталога позиций ровно cards', () => {
    for (const s of spreads) expect(s.positions).toHaveLength(s.cards);
  });
});

describe('normalizeQuestion / normalizeText', () => {
  it('срезает пробелы и лишнее сверх лимита', () => {
    expect(normalizeQuestion('  вопрос  ')).toBe('вопрос');
    expect(normalizeQuestion('а'.repeat(QUESTION_MAX + 5))).toHaveLength(QUESTION_MAX);
    expect(normalizeText('  x ', NOTE_MAX)).toBe('x');
  });
});

describe('cardMeaning — текст значения для позиции', () => {
  it('прямая — general, перевёрнутая — reversed, todo-блок помечается', () => {
    const fool = cardById.get('fool')!;
    expect(cardMeaning('fool', false, 'ru')).toEqual({ text: fool.content.general.ru, todo: false });
    expect(cardMeaning('fool', true, 'en')).toEqual({ text: fool.content.reversed.en, todo: false });
    // испанского текста нет — фолбэк на английский (inLang)
    expect(cardMeaning('fool', false, 'es').text).toBe(fool.content.general.en);
    expect(cardMeaning('нет-такой', false, 'ru')).toEqual({ text: '', todo: true });
  });
});

// оракул тот же, что реально стоит в i18n.ts: 'spread.reversedName' подставляет один параметр
// name, 'card.soon' зовётся без параметров — переводчик передан параметром намеренно (правка 1
// финального ревью 36: имя карты и текст значения считались трижды по копии на компонент)
const tr = (key: string, options?: { name?: string }) =>
  key === 'spread.reversedName' ? `${options?.name} (перевёрнутая)` : 'Текст готовится';

describe('drawnCardLabel — подпись выпавшей карты (правка 1 финального ревью 36)', () => {
  it('прямая карта — просто имя на языке', () => {
    const fool = cardById.get('fool')!;
    expect(drawnCardLabel('fool', false, 'ru', tr)).toBe(inLang(fool.name, 'ru'));
    expect(drawnCardLabel('fool', false, 'en', tr)).toBe(inLang(fool.name, 'en'));
  });

  it('перевёрнутая карта — имя обёрнуто в spread.reversedName', () => {
    const fool = cardById.get('fool')!;
    expect(drawnCardLabel('fool', true, 'ru', tr)).toBe(`${inLang(fool.name, 'ru')} (перевёрнутая)`);
  });

  it('неизвестный cardId — сам id вместо имени (та же защита, что у cardMeaning)', () => {
    expect(drawnCardLabel('нет-такой', false, 'ru', tr)).toBe('нет-такой');
    expect(drawnCardLabel('нет-такой', true, 'ru', tr)).toBe('нет-такой (перевёрнутая)');
  });
});

describe('spreadMeaningText — готовый текст значения с признаком todo', () => {
  it('обычный блок — текст cardMeaning как есть, todo: false', () => {
    const fool = cardById.get('fool')!;
    expect(spreadMeaningText('fool', false, 'ru', tr)).toEqual({ text: fool.content.general.ru, todo: false });
  });

  it('todo-блок (неизвестная карта) — подставляется card.soon, todo: true', () => {
    expect(spreadMeaningText('нет-такой', false, 'ru', tr)).toEqual({ text: 'Текст готовится', todo: true });
  });
});
