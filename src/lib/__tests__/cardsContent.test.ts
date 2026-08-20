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
    '%s: у неканоничного языка текст и статус согласованы в ОБЕ стороны',
    (_id, card) => {
      for (const [key, block] of Object.entries(card.content)) {
        for (const lang of EXTRA) {
          const text = block[lang];
          const status = statusOf(block.status, lang);
          expect(VALID_STATUSES).toContain(status);
          // Эквивалентность, а не импликация. Первая версия теста проверяла только сторону
          // «есть текст ⇒ статус не todo» и пропускала обратную: `set_status.py --lang es`
          // на непереведённом корпусе проставлял статус всем 958 блокам, отчёт готовности
          // рапортовал «es готово 100%» при нуле испанских знаков, и все тесты были зелёные
          // (находка финального ревью ветки 19.08).
          const has = text !== undefined && text.trim() !== '';
          expect(`${key}.${lang}: текст=${has}`).toBe(`${key}.${lang}: текст=${status !== 'todo'}`);
          // отдельно: пустая строка — не «нет языка». presentLang считает такой язык
          // присутствующим и покажет пустоту вместо готового английского (решение 2б спеки)
          if (text !== undefined) {
            expect(`${key}.${lang}: пусто=${text.trim() === ''}`).toBe(`${key}.${lang}: пусто=false`);
          }
        }
      }
    },
  );

  // Решение 4а спеки объявляет name + keywords + search ОДНОЙ единицей перевода: схема обязана
  // не допускать состояния «название переведено, слова нет». До волны фиксов финального ревью
  // (19.08) это было только обещанием в комментарии — тест проверял у wordsStatus лишь канон,
  // и карта с `name.es` без `search.es` проходила все 1085 тестов. Цена такого состояния
  // реальна: `presentLang(card.name, lang)` в cardSearch.ts выбирает язык источника ПО
  // НАЗВАНИЮ, поэтому испанское имя при английских словах даёт поиск на смешанном языке,
  // который вдобавок режется испанскими окончаниями (ENDINGS['es']).
  // Предусловие заливки ES/PT (хвост 45б в backlog): блок значений без переведённого названия
  // карты запрещён. Тренажёр маскирует имя карты в подсказке на рубашке языком ПОКАЗАННОГО
  // текста (`inLang(card.name, presentLang(general, lang))`) — появись `general.es` без
  // `name.es`, маска искала бы английское имя в испанском тексте, не находила бы его,
  // и рубашка-вопрос печатала бы ответ. Обратное направление (`name.es` без блоков) законно:
  // показ блоков целиком уходит на английский фолбэк, и маска ищет английское имя в английском
  // тексте. Тест делает запретное состояние недостижимым в закоммиченном контенте — поэтому
  // дорабатывать маску «на все варианты имени» перед волной переводов не нужно.
  it.each(cards.map((c) => [c.id, c] as const))(
    '%s: у неканоничного языка нет блоков без названия карты',
    (_id, card) => {
      for (const lang of EXTRA) {
        const blockKeys = Object.entries(card.content)
          .filter(([, block]) => (block[lang] ?? '').trim() !== '')
          .map(([key]) => key);
        const hasName = (card.name[lang] ?? '').trim() !== '';
        if (blockKeys.length > 0) {
          expect(`${lang}: блоки [${blockKeys.join(', ')}], name=${hasName}`).toBe(
            `${lang}: блоки [${blockKeys.join(', ')}], name=true`,
          );
        }
      }
    },
  );

  it.each(cards.map((c) => [c.id, c] as const))('%s: слова карты переведены атомарно', (_id, card) => {
    for (const lang of LANGS) {
      const status = statusOf(card.wordsStatus, lang);
      expect(VALID_STATUSES).toContain(status);
      const parts = {
        name: (card.name[lang] ?? '').trim() !== '',
        keywords: (card.keywords[lang] ?? []).length > 0,
        search: (card.search[lang] ?? []).length > 0,
      };
      const filled = Object.values(parts).filter(Boolean).length;
      // либо все три поля есть, либо ни одного — «две трети перевода» не бывает
      expect(`${lang}: заполнено ${filled} из 3 (${JSON.stringify(parts)})`).toBe(
        `${lang}: заполнено ${filled === 0 ? 0 : 3} из 3 (${JSON.stringify(parts)})`,
      );
      // и статус обязан описывать ровно это состояние, а не жить своей жизнью
      expect(`wordsStatus.${lang}: готов=${status !== 'todo'}`).toBe(
        `wordsStatus.${lang}: готов=${filled === 3}`,
      );
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
