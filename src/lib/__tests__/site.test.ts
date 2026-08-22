/** Контракт «страница сайта = приложение» (спека 54): публичные web-страницы на GitHub Pages
 *  (`site/*.html`, собирает отдельный агент) обязаны нести ДОСЛОВНО те же тексты, что и
 *  приложение — политику (`about.dataText`), условия (`about.termsText`) и дисклеймер
 *  (`about.disclaimer`), на каждом из четырёх языков. Пока `site/` не собран, чтение файлов
 *  здесь падает — это ожидаемо (см. спеку); после сборки сайта сьют обязан стать зелёным. */
import fs from 'fs';
import path from 'path';
import { PRIVACY_URL, SITE_URL, SUPPORT_URL, TERMS_URL } from '../appInfo';
import { SUPPORT_EMAIL } from '../feedback';
import { resources } from '../i18n';

const SITE = path.resolve(__dirname, '../../../site');

/** HTML-сущности, которые встречаются в текстах приложения и служебных абзацах страниц. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Схлопывание пробелов для сравнения «текст на странице» ⟺ «строка i18n»: `\n\n` внутри
 *  строки TS — такой же разделитель абзацев, как перенос строки в HTML-исходнике. */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Содержимое `<section data-lang="xx" …>…</section>` без тегов, с раскрытыми сущностями
 *  и схлопнутыми пробелами. Регулярка non-greedy — секции на странице идут одна за другой,
 *  жадный поиск утащил бы текст всех языков разом. */
function textOf(html: string, lang: string): string {
  const re = new RegExp(`<section[^>]*data-lang="${lang}"[^>]*>([\\s\\S]*?)</section>`, 'i');
  const match = html.match(re);
  if (!match) return '';
  const withoutTags = match[1].replace(/<[^>]+>/g, ' ');
  return norm(decodeEntities(withoutTags));
}

function read(file: string): string {
  return fs.readFileSync(path.join(SITE, file), 'utf8');
}

const LANGS = ['ru', 'en', 'es', 'pt'] as const;

describe('textOf/norm — логика проверена на инлайн-фикстуре, не на файлах site/', () => {
  it('вырезает нужную секцию, снимает теги, декодирует сущности', () => {
    const html = `
      <html><body>
        <section data-lang="ru"><p>Привет &amp; пока</p></section>
        <section data-lang="en"><p>Hello &quot;world&quot;</p></section>
      </body></html>
    `;
    expect(textOf(html, 'ru')).toBe('Привет & пока');
    expect(textOf(html, 'en')).toBe('Hello "world"');
  });

  it('схлопывает пробелы и переносы строк так же, как norm() — строку i18n с \\n\\n', () => {
    const html = '<section data-lang="ru">Первый  абзац.\n\nВторой   абзац.</section>';
    const source = 'Первый  абзац.\n\nВторой   абзац.';
    expect(textOf(html, 'ru')).toBe(norm(source));
  });

  it('отсутствующий язык — пустая строка, а не совпадение по случайной подстроке', () => {
    const html = '<section data-lang="ru">Текст</section>';
    expect(textOf(html, 'es')).toBe('');
  });
});

describe.each(LANGS)('%s: контракт «страница = приложение»', (lang) => {
  const about = resources[lang].translation.about;

  it('privacy.html содержит about.dataText дословно', () => {
    expect(textOf(read('privacy.html'), lang)).toContain(norm(about.dataText));
  });

  it('terms.html содержит about.termsText дословно', () => {
    expect(textOf(read('terms.html'), lang)).toContain(norm(about.termsText));
  });

  it('terms.html содержит about.disclaimer дословно', () => {
    expect(textOf(read('terms.html'), lang)).toContain(norm(about.disclaimer));
  });
});

describe('SUPPORT_EMAIL виден на каждой публичной странице', () => {
  it.each(['privacy.html', 'terms.html', 'support.html', 'index.html'])(
    '%s содержит SUPPORT_EMAIL',
    (file) => {
      expect(read(file)).toContain(SUPPORT_EMAIL);
    },
  );
});

describe('адреса *_URL указывают на существующие файлы site/', () => {
  const urls: Array<[string, string]> = [
    ['PRIVACY_URL', PRIVACY_URL],
    ['TERMS_URL', TERMS_URL],
    ['SUPPORT_URL', SUPPORT_URL],
  ];

  it.each(urls)('%s начинается с SITE_URL', (_name, url) => {
    expect(url.startsWith(`${SITE_URL}/`)).toBe(true);
  });

  it.each(urls)('файл под %s существует в site/', (_name, url) => {
    const file = url.slice(SITE_URL.length + 1);
    expect(fs.existsSync(path.join(SITE, file))).toBe(true);
  });
});

it('index.html ссылается на все три страницы', () => {
  const html = read('index.html');
  expect(html).toContain('privacy.html');
  expect(html).toContain('terms.html');
  expect(html).toContain('support.html');
});

describe('нет внешних ресурсов в <link>/<script> (шрифты системные, CDN нет)', () => {
  it.each(['index.html', 'privacy.html', 'terms.html', 'support.html'])('%s', (file) => {
    const html = read(file);
    const tags = [...(html.match(/<link[^>]*>/gi) ?? []), ...(html.match(/<script[^>]*>/gi) ?? [])];
    for (const tag of tags) expect(tag).not.toMatch(/https?:\/\//i);
  });
});
