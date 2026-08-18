/** Контракт контента карт: перевёрнутые приписки сфер (спека 25) и пер-языковый статус
 *  (спека 28а). Ловит рассинхрон конвейера — блок со сменённым статусом, но без текста,
 *  и наоборот, теперь по каждому языку отдельно. */
import { cards, type BlockStatus, type StatusMap } from '../content';
import { LANGS, type CanonLang, type Lang } from '../lang';

const REVERSED_KEYS = ['love_reversed', 'career_reversed', 'finances_reversed', 'health_reversed'];
const VALID_STATUSES: BlockStatus[] = ['todo', 'draft', 'reviewed', 'final'];
const CANON: CanonLang[] = ['ru', 'en'];
const EXTRA: Lang[] = LANGS.filter((l): l is Lang => !CANON.includes(l as CanonLang));

const statusOf = (map: StatusMap | undefined, lang: Lang): BlockStatus => map?.[lang] ?? 'todo';

describe('контракт перевёрнутых приписок сфер (cards.json)', () => {
  it('всего 78 карт', () => {
    expect(cards).toHaveLength(78);
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s: есть все 4 блока *_reversed', (_id, card) => {
    for (const key of REVERSED_KEYS) {
      expect(card.content[key]).toBeDefined();
    }
  });
});

describe('контракт пер-языкового статуса (cards.json, спека 28а)', () => {
  it.each(cards.map((c) => [c.id, c] as const))(
    '%s: у канона текст согласован со статусом',
    (_id, card) => {
      for (const [key, block] of Object.entries(card.content)) {
        for (const lang of CANON) {
          const status = statusOf(block.status, lang);
          expect(VALID_STATUSES).toContain(status);
          // черновик без смены статуса (или статус без текста) — ошибка конвейера.
          // Сообщение несёт адрес блока: иначе на 78 картах непонятно, где именно рассинхрон.
          const has = block[lang].trim() !== '';
          expect(`${key}.${lang}: текст=${has}`).toBe(
            `${key}.${lang}: текст=${status !== 'todo'}`,
          );
        }
      }
    },
  );

  // Решение 2б спеки: отсутствие ключа языка и пустая строка значат РАЗНОЕ. `presentLang`
  // считает язык присутствующим по `!== undefined`, поэтому "es": "" — это не «возьми
  // английский», а «испанский есть, и он пустой»: пользователь увидел бы пустое место вместо
  // готового английского текста. Заглушек у неканоничных языков быть не должно вовсе.
  it.each(cards.map((c) => [c.id, c] as const))(
    '%s: неканоничный язык либо отсутствует, либо полноценен',
    (_id, card) => {
      for (const [key, block] of Object.entries(card.content)) {
        for (const lang of EXTRA) {
          const text = block[lang];
          if (text === undefined) continue;
          expect(`${key}.${lang}: пусто=${text.trim() === ''}`).toBe(`${key}.${lang}: пусто=false`);
          expect(`${key}.${lang}: статус=${statusOf(block.status, lang)}`).not.toBe(
            `${key}.${lang}: статус=todo`,
          );
        }
      }
    },
  );

  it.each(cards.map((c) => [c.id, c] as const))('%s: wordsStatus заведён на канон', (_id, card) => {
    for (const lang of CANON) {
      const status = statusOf(card.wordsStatus, lang);
      expect(VALID_STATUSES).toContain(status);
      expect(`wordsStatus.${lang}=${status}`).not.toBe(`wordsStatus.${lang}=todo`);
    }
  });
});

// Граница данных, которую до сих пор не проверял ни один тест (волна фиксов финального ревью
// спеки 27): пропади английское название у карты — упадёт только пользователь es/pt (у него
// имя карты берётся английским фолбэком через inLang/presentLang), а ru и en ничего не заметят.
describe('контракт названий карт (cards.json)', () => {
  it.each(cards.map((c) => [c.id, c] as const))('%s: name.ru и name.en непустые', (_id, card) => {
    expect(card.name.ru.trim()).not.toBe('');
    expect(card.name.en.trim()).not.toBe('');
  });
});
