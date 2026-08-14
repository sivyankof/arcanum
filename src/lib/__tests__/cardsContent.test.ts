/** Контракт контента перевёрнутых приписок сфер (спека 25): 4 новых блока
 *  love_reversed/career_reversed/finances_reversed/health_reversed у каждой из 78 карт.
 *  Ловит рассинхрон конвейера — блок со сменённым статусом, но без текста, и наоборот. */
import { cards, type BlockStatus } from '../content';

const REVERSED_KEYS = ['love_reversed', 'career_reversed', 'finances_reversed', 'health_reversed'];
const VALID_STATUSES: BlockStatus[] = ['todo', 'draft', 'reviewed', 'final'];

describe('контракт перевёрнутых приписок сфер (cards.json)', () => {
  it('всего 78 карт', () => {
    expect(cards).toHaveLength(78);
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s: есть все 4 блока *_reversed', (_id, card) => {
    for (const key of REVERSED_KEYS) {
      expect(card.content[key]).toBeDefined();
    }
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s: статус валиден, текст согласован со статусом', (_id, card) => {
    for (const key of REVERSED_KEYS) {
      const block = card.content[key];
      expect(VALID_STATUSES).toContain(block.status);
      if (block.status === 'todo') {
        // черновик без смены статуса — ошибка конвейера: у todo оба языка обязаны быть пустыми
        expect(block.ru.trim()).toBe('');
        expect(block.en.trim()).toBe('');
      } else {
        expect(block.ru.trim()).not.toBe('');
        expect(block.en.trim()).not.toBe('');
      }
    }
  });
});
