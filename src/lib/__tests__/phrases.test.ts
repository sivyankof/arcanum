import { pickPhrase } from '../phrases';

describe('pickPhrase', () => {
  it('в течение дня формулировка стабильна (никакого Math.random)', () => {
    const results = new Set(
      Array.from({ length: 100 }, () =>
        pickPhrase('reflect.question', '2026-08-11', 'ru', { card: 'Звезда' }),
      ),
    );
    expect(results.size).toBe(1);
  });

  it('за месяц формулировки чередуются, а не залипают на одной', () => {
    const texts = new Set(
      Array.from({ length: 30 }, (_, i) =>
        pickPhrase('reflect.question', `2026-08-${String(i + 1).padStart(2, '0')}`, 'ru', {
          card: 'Звезда',
        }),
      ),
    );
    expect(texts.size).toBeGreaterThan(1);
  });

  it('подставляет плейсхолдер', () => {
    const text = pickPhrase('reflect.question', '2026-08-11', 'ru', { card: 'Звезда' });
    expect(text).toContain('Звезда');
    expect(text).not.toContain('{card}');
  });

  it('английский вариант берётся из того же места', () => {
    const text = pickPhrase('reflect.question', '2026-08-11', 'en', { card: 'The Star' });
    expect(text).toContain('The Star');
    expect(/[а-яё]/i.test(text)).toBe(false);
  });

  it('незаполненный плейсхолдер остаётся текстом, а не превращается в undefined', () => {
    const text = pickPhrase('reflect.question', '2026-08-11', 'ru');
    expect(text).toContain('{card}');
    expect(text).not.toContain('undefined');
  });

  it('неизвестный ключ даёт пустую строку, а не падение', () => {
    expect(pickPhrase('nope.nothing', '2026-08-11', 'ru')).toBe('');
  });

  it('работает с вложенным ключом пустых состояний', () => {
    expect(pickPhrase('empty.filter', '2026-08-11', 'ru').length).toBeGreaterThan(0);
  });
});
