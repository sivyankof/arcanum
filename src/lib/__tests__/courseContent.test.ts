/** Контракт контента викторин (спека 08): опечатка после вычитки редактора должна валить
 *  npm test, а не всплывать у пользователя. Проверяем собранный course.json, не черновик. */
import { cardById, course, type BlockStatus, type StatusMap } from '../content';
import { LANGS, type CanonLang, type Lang } from '../lang';

const lessons = course
  .filter((m) => ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].includes(m.id))
  .flatMap((m) => m.lessons);

describe('контракт викторин М1–М6 (course.json)', () => {
  it('М1–М6 — это 32 урока', () => {
    expect(lessons).toHaveLength(32);
  });

  it.each(lessons.map((l) => [l.id, l] as const))('%s: теория заполнена на обоих языках', (_id, l) => {
    // theory.ru/en редактируются руками (в отличие от quiz, который идёт через скрипт):
    // пропавший язык даст урок без теории именно у этого языка — lessonPlayable этого не ловит,
    // она смотрит только theory.ru (спека 08).
    expect(l.theory?.ru).toBeTruthy();
    expect(l.theory?.en).toBeTruthy();
  });

  it.each(lessons.map((l) => [l.id, l] as const))('%s: 5 вопросов по схеме', (_id, l) => {
    expect(l.quiz).toBeDefined();
    expect(l.quiz!).toHaveLength(5);
    for (const q of l.quiz!) {
      expect(['single', 'card']).toContain(q.type);
      expect(q.options).toHaveLength(3);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(3);
      expect(q.q.ru).toBeTruthy();
      expect(q.q.en).toBeTruthy();
      expect(q.explain.ru).toBeTruthy();
      expect(q.explain.en).toBeTruthy();
      for (const o of q.options) {
        expect(o.ru).toBeTruthy();
        expect(o.en).toBeTruthy();
      }
      // cardId обязан существовать в колоде, но НЕ обязан входить в lesson.cards:
      // у m2l6 карт нет, а card-вопрос есть (спека 08)
      if (q.type === 'card') expect(cardById.has(q.cardId!)).toBe(true);
    }
  });

  it('правильные ответы не сидят на одном индексе (защита от «correct: 0 везде»)', () => {
    for (const l of lessons) {
      expect(new Set(l.quiz!.map((q) => q.correct)).size).toBeGreaterThan(1);
    }
  });

  // Верный ответ не должен угадываться по длине (задача 29): считаем single-вопросы, где верный
  // вариант строго длиннее обоих неверных (по ru); порог — не больше 2 из 5 в уроке.
  // card-вопросы вне правила: их варианты — имена карт, длину им не подобрать.
  it.each(lessons.map((l) => [l.id, l] as const))(
    '%s: верный вариант — самый длинный не более чем в 2 вопросах',
    (_id, l) => {
      const longest = l
        .quiz!.filter((q) => q.type === 'single')
        .filter((q) => {
          const lens = q.options.map((o) => o.ru.length);
          const max = Math.max(...lens);
          return lens[q.correct] === max && lens.filter((n) => n === max).length === 1;
        }).length;
      expect(longest).toBeLessThanOrEqual(2);
    },
  );
});

// Пер-языковый статус курса (спека 28а). До волны фиксов финального ревью ветки (19.08) статусы
// course.json не проверял НИ ОДИН тест: контракт был написан только для cards.json. Проверено
// экспериментом — возврат theory.status и quizStatus к старой строковой форме (то есть ровно
// та регрессия, которую отчёт спеки называет главной: merge_quiz.py переносит статус staging-файла
// в course.json целиком) оставлял npm test полностью зелёным.
const CANON: CanonLang[] = ['ru', 'en'];
const EXTRA: Lang[] = LANGS.filter((l): l is Lang => !CANON.includes(l as CanonLang));
const VALID: BlockStatus[] = ['todo', 'draft', 'reviewed', 'final'];
const statusOf = (map: StatusMap | undefined, lang: Lang): BlockStatus => map?.[lang] ?? 'todo';

/** Написан ли язык у викторины целиком: у каждого вопроса — сам вопрос, все варианты, пояснение.
 *  Половина переведённой викторины викториной не является. Та же мера, что в set_status.py. */
const quizWritten = (l: (typeof lessons)[number], lang: Lang): boolean =>
  !!l.quiz?.length &&
  l.quiz.every(
    (q) =>
      (q.q[lang] ?? '').trim() !== '' &&
      (q.explain[lang] ?? '').trim() !== '' &&
      q.options.every((o) => (o[lang] ?? '').trim() !== ''),
  );

describe('контракт пер-языкового статуса курса (course.json, спека 28а)', () => {
  it.each(lessons.map((l) => [l.id, l] as const))(
    '%s: статус — словарь по языкам, а не строка старой формы',
    (_id, l) => {
      // typeof строкой: именно возврат к строке и есть та регрессия, которую ловим
      expect(`theory.status: ${typeof l.theory?.status}`).toBe('theory.status: object');
      expect(`quizStatus: ${typeof l.quizStatus}`).toBe('quizStatus: object');
    },
  );

  it.each(lessons.map((l) => [l.id, l] as const))(
    '%s: канон вычитан, значения статусов валидны',
    (_id, l) => {
      for (const lang of CANON) {
        const theory = statusOf(l.theory?.status, lang);
        const quiz = statusOf(l.quizStatus, lang);
        expect(VALID).toContain(theory);
        expect(VALID).toContain(quiz);
        expect(`${l.id} theory.${lang}=${theory}`).not.toBe(`${l.id} theory.${lang}=todo`);
        expect(`${l.id} quiz.${lang}=${quiz}`).not.toBe(`${l.id} quiz.${lang}=todo`);
      }
    },
  );

  it.each(lessons.map((l) => [l.id, l] as const))(
    '%s: у неканоничного языка статус и текст согласованы в обе стороны',
    (_id, l) => {
      for (const lang of EXTRA) {
        const theoryStatus = statusOf(l.theory?.status, lang);
        expect(VALID).toContain(theoryStatus);
        const theoryWritten = (l.theory?.[lang] ?? '').trim() !== '';
        expect(`${l.id} theory.${lang}: текст=${theoryWritten}`).toBe(
          `${l.id} theory.${lang}: текст=${theoryStatus !== 'todo'}`,
        );

        const quizStatus = statusOf(l.quizStatus, lang);
        expect(VALID).toContain(quizStatus);
        expect(`${l.id} quiz.${lang}: написана=${quizWritten(l, lang)}`).toBe(
          `${l.id} quiz.${lang}: написана=${quizStatus !== 'todo'}`,
        );
      }
    },
  );
});
