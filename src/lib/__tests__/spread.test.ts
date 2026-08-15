import { cardById, spreads } from '../content';
import { NOTE_MAX, normalizeText } from '../journal';
import { cardMeaning, dealSpread, normalizeQuestion, QUESTION_MAX, REVERSED_P, SPREADS_MAX } from '../spread';

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
