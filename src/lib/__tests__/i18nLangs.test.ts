/** Проводка языков в i18n (спека 27) и контракт строк, включённых сессией L-0 (задача 28):
 *  какие языки доступны, отдают ли es/pt СВОИ строки и не потерялись ли плейсхолдеры. */
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

/** До сессии L-0 здесь стоял обратный контракт («язык без ресурсов падает на en» — es/pt
 *  отдавали 'Today'). L-0 включила испанский и португальский, и тест перевёрнут: язык обязан
 *  отдавать строку из СВОИХ ресурсов. Ожидание берётся из resources самого языка, а не
 *  литералом «не по-английски»: fallbackLng подменил бы пропавший ключ английским текстом,
 *  и проверка «непустая строка» осталась бы зелёной (правило hf-02 про тихий фолбэк). */
describe('языки, включённые L-0: t() отдаёт строки САМОГО языка', () => {
  afterEach(() => {
    i18n.changeLanguage('ru');
  });

  it.each(['es', 'pt'] as const)('%s — language выставлен, t() не английский', (lng) => {
    i18n.changeLanguage(lng);
    expect(i18n.language).toBe(lng);
    const own = (resources[lng].translation as { tabs: { today: string } }).tabs.today;
    expect(i18n.t('tabs.today')).toBe(own);
    expect(own).not.toBe('Today');
    // плюральный ключ тоже резолвится в самом языке (формы _one/_other есть — сьют i18nPlurals)
    expect(i18n.t('course.lessons', { count: 2 })).not.toBe('2 LESSONS');
  });
});

/** Плейсхолдеры перевода. Набор ключей и полноту плюральных форм стережёт i18nPlurals;
 *  дыра, которую не закрывал никто, — {{подстановки}} внутри строки: перевод с потерянным
 *  {{count}} валиден для i18next (интерполяция просто не срабатывает) и молча показывает
 *  строку без числа. Сравниваем НАБОР плейсхолдеров каждого семейства ключей с английским —
 *  по объединению форм: у языков разные наборы суффиксов (_few/_many против _one/_other). */
describe('плейсхолдеры совпадают с en во всех языках', () => {
  const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;
  const family = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

  const collect = (lang: keyof typeof resources) => {
    const out = new Map<string, Set<string>>();
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        const fam = family(path);
        const set = out.get(fam) ?? new Set<string>();
        for (const m of node.matchAll(PLACEHOLDER)) set.add(m[1]);
        out.set(fam, set);
        return;
      }
      if (node && typeof node === 'object')
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(resources[lang].translation, '');
    return out;
  };

  const en = collect('en');
  const others = (Object.keys(resources) as Array<keyof typeof resources>).filter((l) => l !== 'en');

  it.each(others)('%s', (lng) => {
    const own = collect(lng);
    for (const [fam, enSet] of en) {
      const ownSet = own.get(fam);
      if (!ownSet) continue; // отсутствие ключа — забота контракта наборов в i18nPlurals
      expect(`${fam}: [${[...ownSet].sort()}]`).toBe(`${fam}: [${[...enSet].sort()}]`);
    }
  });
});
