/** Тесты сборки mailto-ссылки обратной связи (спека 13).
 *  Главный риск — кодирование: кириллица, переносы строк и спецсимволы &?=
 *  не должны рвать query-часть URL. Раскодируем обратно через URLSearchParams
 *  и сверяем с исходником — круговая проверка вместо сверки с литералами %D0…. */
import { buildMailto, SUPPORT_EMAIL } from '../feedback';

// query-часть mailto разбирается тем же способом, что её читают почтовые клиенты
function parseQuery(url: string): URLSearchParams {
  const q = url.split('?')[1] ?? '';
  return new URLSearchParams(q);
}

describe('buildMailto', () => {
  test('простой случай: адрес в to, тема и тело в query', () => {
    const url = buildMailto('a@b.c', 'Subject', 'Body');
    expect(url).toBe('mailto:a@b.c?subject=Subject&body=Body');
  });

  test('кириллица, двоеточие и пробелы восстанавливаются без потерь', () => {
    const url = buildMailto(SUPPORT_EMAIL, 'Arcanum: отзыв', 'Привет! Всё отлично.');
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
    const q = parseQuery(url);
    expect(q.get('subject')).toBe('Arcanum: отзыв');
    expect(q.get('body')).toBe('Привет! Всё отлично.');
  });

  test('переносы строк уходят как %0A и возвращаются переносами', () => {
    const body = 'строка один\n\nстрока два';
    const url = buildMailto('a@b.c', 's', body);
    expect(url).toContain('%0A');
    expect(parseQuery(url).get('body')).toBe(body);
  });

  test('спецсимволы & ? = в теле не рвут query на лишние параметры', () => {
    const body = 'вопрос? раз=два & три';
    const url = buildMailto('a@b.c', 'тема & ещё', body);
    const q = parseQuery(url);
    expect(q.get('subject')).toBe('тема & ещё');
    expect(q.get('body')).toBe(body);
    // параметра ровно два: сырой & в значениях не породил третьего
    expect([...q.keys()].sort()).toEqual(['body', 'subject']);
  });

  test('адрес поддержки похож на адрес', () => {
    expect(SUPPORT_EMAIL).toMatch(/^\S+@\S+\.\S+$/);
  });
});
