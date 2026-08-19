/** Чтение статуса с учётом фолбэка (спека 28а, решения 2 и 2а): статус спрашивается у того
 *  языка, который РЕАЛЬНО попадёт на экран, а не у того, который выбрал пользователь.
 *  Фикстуры здесь свои, не данные бандла: тест проверяет правило, а не сегодняшнее содержимое
 *  cards.json (иначе он позеленел бы сам собой, когда контент доедет до нужного состояния). */
import { blockText, statusIn, type CardContentBlock } from '../content';

const block = (over: Partial<CardContentBlock> = {}): CardContentBlock => ({
  ru: 'текст',
  en: 'text',
  status: { ru: 'reviewed', en: 'reviewed' },
  ...over,
});

describe('statusIn — статус показанного языка', () => {
  it('свой язык есть — отдаёт его статус', () => {
    const b = block({ es: 'texto', status: { ru: 'reviewed', en: 'reviewed', es: 'draft' } });
    expect(statusIn(b, 'es')).toBe('draft');
  });

  it('своего языка нет — отдаёт статус английского, на который упал inLang', () => {
    expect(statusIn(block(), 'es')).toBe('reviewed');
  });

  it('у показанного языка статуса нет вовсе — это todo', () => {
    expect(statusIn(block({ status: { ru: 'reviewed' } }), 'en')).toBe('todo');
  });

  it('готовность языков независима: en готов, ru нет', () => {
    const b = block({ ru: '', status: { ru: 'todo', en: 'reviewed' } });
    expect(statusIn(b, 'ru')).toBe('todo');
    expect(statusIn(b, 'en')).toBe('reviewed');
  });
});

describe('blockText — что показать и готово ли', () => {
  it('готовый блок — текст своего языка', () => {
    expect(blockText(block(), 'ru')).toEqual({ text: 'текст', todo: false });
  });

  it('испанцу без перевода — английский текст, потому что английский готов', () => {
    expect(blockText(block(), 'es')).toEqual({ text: 'text', todo: false });
  });

  it('испанцу без перевода при неготовом английском — заглушка', () => {
    const b = block({ ru: 'текст', en: '', status: { ru: 'reviewed', en: 'todo' } });
    expect(blockText(b, 'es')).toEqual({ text: '', todo: true });
  });

  it('todo у показанного языка — пусто и todo: true', () => {
    const b = block({ ru: '', en: '', status: { ru: 'todo', en: 'todo' } });
    expect(blockText(b, 'ru')).toEqual({ text: '', todo: true });
  });

  it('блока нет вовсе — todo: true (у карты нет такого ключа контента)', () => {
    expect(blockText(undefined, 'ru')).toEqual({ text: '', todo: true });
  });

  it('свой язык — черновик: показываем его, а не английский (draft ≠ todo)', () => {
    const b = block({ es: 'borrador', status: { ru: 'reviewed', en: 'reviewed', es: 'draft' } });
    expect(blockText(b, 'es')).toEqual({ text: 'borrador', todo: false });
  });
});
