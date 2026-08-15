/** Язык приложения (спека 27): список языков, нормализация тегов, детекция по предпочтениям
 *  устройства, доступ к многоязычной записи с фолбэком. Чистая логика — без React и expo. */
import {
  CONTENT_FALLBACK,
  detectLang,
  inLang,
  isLang,
  LANG_NAMES,
  LANGS,
  LOCALES,
  localeTag,
  presentLang,
  primarySubtag,
  toLang,
  type Localized,
} from '../lang';

describe('LANGS и словари', () => {
  it('четыре языка v1 в порядке ru, en, es, pt', () => {
    expect([...LANGS]).toEqual(['ru', 'en', 'es', 'pt']);
  });

  it('у каждого языка есть эндоним и локаль — ключи словарей совпадают со списком', () => {
    expect(Object.keys(LANG_NAMES).sort()).toEqual([...LANGS].sort());
    expect(Object.keys(LOCALES).sort()).toEqual([...LANGS].sort());
  });

  it('локали — те, что понимают системные пикеры и toLocaleDateString', () => {
    expect(localeTag('ru')).toBe('ru-RU');
    expect(localeTag('en')).toBe('en-US');
    expect(localeTag('es')).toBe('es-MX');
    expect(localeTag('pt')).toBe('pt-BR');
  });

  it('фолбэк контента — английский (совпадает с fallbackLng i18n)', () => {
    expect(CONTENT_FALLBACK).toBe('en');
  });
});

describe('isLang', () => {
  it.each(['ru', 'en', 'es', 'pt'])('%s — язык', (l) => expect(isLang(l)).toBe(true));
  it.each(['de', 'ru-RU', '', 42, null, undefined])('%p — не язык', (x) => expect(isLang(x)).toBe(false));
});

describe('primarySubtag / toLang', () => {
  it.each([
    ['es-MX', 'es'], ['pt-BR', 'pt'], ['ru-RU', 'ru'], ['en', 'en'],
    ['PT_br', 'pt'], ['  es-419 ', 'es'], ['', ''],
  ])('primarySubtag(%p) → %p', (tag, sub) => {
    expect(primarySubtag(tag)).toBe(sub);
  });

  it.each([
    ['ru', 'ru'], ['ru-RU', 'ru'], ['es-MX', 'es'], ['pt-BR', 'pt'], ['en-GB', 'en'],
    ['de-DE', 'en'], ['', 'en'],
  ])('toLang(%p) → %p (чужой код падает в en)', (code, lang) => {
    expect(toLang(code)).toBe(lang);
  });
});

describe('detectLang — язык устройства при первой установке', () => {
  it.each([
    [['es-MX'], 'es'],
    [['pt-BR', 'en-US'], 'pt'],
    [['ru-RU'], 'ru'],
    // берётся первый ИЗ ДОСТУПНЫХ по всему списку предпочтений, а не первый тег вообще
    [['de-DE', 'es-ES'], 'es'],
    [['de-DE'], 'en'],
    [[], 'en'],
    [['PT_br'], 'pt'],
  ])('%j → %s при всех четырёх доступных', (tags, lang) => {
    expect(detectLang(tags, LANGS)).toBe(lang);
  });

  it('язык без UI-строк не выбирается: es-MX при доступных ru/en → en', () => {
    expect(detectLang(['es-MX'], ['ru', 'en'])).toBe('en');
    expect(detectLang(['es-MX', 'ru-RU'], ['ru', 'en'])).toBe('ru');
  });
});

describe('Localized / presentLang / inLang', () => {
  const full: Localized = { ru: 'Дурак', en: 'The Fool', es: 'El Loco' };
  const canon: Localized = { ru: 'Дурак', en: 'The Fool' };

  it('есть перевод — отдаёт его', () => {
    expect(presentLang(full, 'es')).toBe('es');
    expect(inLang(full, 'es')).toBe('El Loco');
    expect(inLang(full, 'ru')).toBe('Дурак');
  });

  it('перевода нет — падает на en, а не на ru и не в undefined', () => {
    expect(presentLang(canon, 'es')).toBe('en');
    expect(presentLang(canon, 'pt')).toBe('en');
    expect(inLang(canon, 'es')).toBe('The Fool');
    expect(inLang(canon, 'pt')).toBe('The Fool');
  });

  it('работает со списками (ключевые слова)', () => {
    const kw: Localized<string[]> = { ru: ['начало'], en: ['beginning'] };
    expect(inLang(kw, 'pt')).toEqual(['beginning']);
    expect(inLang(kw, 'ru')).toEqual(['начало']);
  });

  it('пустая строка отсутствием НЕ считается — полноту следят контракт-тесты, не рантайм', () => {
    const empty: Localized = { ru: 'Дурак', en: 'The Fool', es: '' };
    expect(inLang(empty, 'es')).toBe('');
  });
});
