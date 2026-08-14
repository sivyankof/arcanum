/** Контракт контента викторин (спека 08): опечатка после вычитки редактора должна валить
 *  npm test, а не всплывать у пользователя. Проверяем собранный course.json, не черновик. */
import { cardById, course } from '../content';

const lessons = course
  .filter((m) => ['m1', 'm2'].includes(m.id))
  .flatMap((m) => m.lessons);

describe('контракт викторин М1–М2 (course.json)', () => {
  it('М1–М2 — это 10 уроков', () => {
    expect(lessons).toHaveLength(10);
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
});

// Викторины М3 — следующий шаг спеки 26; после их слияния блок ниже сливается с основным.
const m3Lessons = course.filter((m) => m.id === 'm3').flatMap((m) => m.lessons);

describe('контракт теории М3 (course.json, спека 26)', () => {
  it('М3 — это 6 уроков', () => {
    expect(m3Lessons).toHaveLength(6);
  });

  it.each(m3Lessons.map((l) => [l.id, l] as const))('%s: теория заполнена на обоих языках', (_id, l) => {
    expect(l.theory?.ru).toBeTruthy();
    expect(l.theory?.en).toBeTruthy();
  });
});
