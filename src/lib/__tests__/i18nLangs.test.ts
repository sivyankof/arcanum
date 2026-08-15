/** Проводка языков в i18n (спека 27): какие языки доступны и как ведёт себя интерфейс на языке,
 *  UI-строк которого ещё нет (es/pt до сессии L-0 плана локализации). */
import i18n, { AVAILABLE_LANGS, resources } from '../i18n';
import { LANGS } from '../lang';

describe('AVAILABLE_LANGS', () => {
  it('подмножество LANGS в том же порядке, канон ru/en всегда доступен', () => {
    expect(AVAILABLE_LANGS.every((l) => (LANGS as readonly string[]).includes(l))).toBe(true);
    expect(AVAILABLE_LANGS).toContain('ru');
    expect(AVAILABLE_LANGS).toContain('en');
    const order = AVAILABLE_LANGS.map((l) => LANGS.indexOf(l));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('в dev (как в jest) доступны все четыре — проверка проводки не ждёт переводов', () => {
    expect(__DEV__).toBe(true);
    expect([...AVAILABLE_LANGS]).toEqual([...LANGS]);
  });

  it('язык с UI-строками доступен всегда — это и есть «включение» языка сессией L-0', () => {
    for (const l of Object.keys(resources)) expect(AVAILABLE_LANGS).toContain(l);
  });
});

describe('язык без ресурсов: i18n принимает его, строки падают на en', () => {
  afterEach(() => {
    i18n.changeLanguage('ru');
  });

  it.each(['es', 'pt'])('%s — language выставлен, t() английский', (lng) => {
    i18n.changeLanguage(lng);
    expect(i18n.language).toBe(lng);
    expect(i18n.t('tabs.today')).toBe('Today');
    expect(i18n.t('course.lessons', { count: 2 })).toBe('2 LESSONS');
  });
});
