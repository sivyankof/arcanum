import { cards } from '../content';

// Контракт контента (спека 09): фразы «ваш путь» есть у ВСЕХ старших арканов и ТОЛЬКО у них.
// Ловит опечатку при будущей вычитке редактором — как courseContent.test.ts у викторин.
describe('birth_path в cards.json', () => {
  const majors = cards.filter((c) => c.arcana === 'major');
  const minors = cards.filter((c) => c.arcana === 'minor');

  test('22 старших: блок есть, ru и en непустые', () => {
    expect(majors).toHaveLength(22);
    for (const c of majors) {
      const b = c.content['birth_path'];
      expect(b).toBeDefined();
      expect(b.ru.trim().length).toBeGreaterThan(0);
      expect(b.en.trim().length).toBeGreaterThan(0);
    }
  });

  test('56 младших: блока нет', () => {
    expect(minors).toHaveLength(56);
    for (const c of minors) expect(c.content['birth_path']).toBeUndefined();
  });

  // Без этой проверки сьют зелёный даже когда у всех 22 карт ОДНА И ТА ЖЕ фраза: наличие
  // и непустота дубль не ловят. Блоки уходят редактору черновиками (задача 23 бэклога),
  // а копипаста при вычитке — самая вероятная ошибка; цена — одинаковый «ваш путь» у всех.
  test('все 22 фразы различны в обоих языках', () => {
    expect(new Set(majors.map((c) => c.content['birth_path'].ru)).size).toBe(22);
    expect(new Set(majors.map((c) => c.content['birth_path'].en)).size).toBe(22);
  });
});
