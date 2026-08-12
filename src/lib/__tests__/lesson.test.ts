import type { CourseLesson, QuizQuestion } from '../content';
import { lessonPlayable, lessonSteps, shuffleOptions, theoryPages } from '../lesson';

const q = (correct: number): QuizQuestion => ({
  type: 'single',
  q: { ru: 'вопрос', en: 'q' },
  options: [{ ru: 'а', en: 'a' }, { ru: 'б', en: 'b' }, { ru: 'в', en: 'c' }],
  correct,
  explain: { ru: 'пояснение', en: 'explain' },
});

const lesson = (over: Partial<CourseLesson> = {}): CourseLesson => ({
  id: 'x1',
  title: { ru: 'Урок', en: 'Lesson' },
  cards: [],
  theory: { ru: 'абзац', en: 'para', status: 'draft' },
  quiz: [q(0)],
  quizStatus: 'draft',
  ...over,
});

const rngZero = () => 0;

describe('theoryPages — жадная группировка абзацев под бюджет ~700', () => {
  it('пустая строка → ни одной страницы', () => {
    expect(theoryPages('')).toEqual([]);
  });

  it('короткие абзацы склеиваются в одну страницу', () => {
    expect(theoryPages('раз\n\nдва')).toEqual(['раз\n\nдва']);
  });

  it('абзац сверх бюджета открывает новую страницу', () => {
    const a = 'а'.repeat(400);
    const b = 'б'.repeat(400);
    const c = 'в'.repeat(100);
    expect(theoryPages(`${a}\n\n${b}\n\n${c}`)).toEqual([a, `${b}\n\n${c}`]);
  });

  it('тройной перенос и хвостовые пробелы не создают пустых страниц', () => {
    expect(theoryPages('раз\n\n\n\nдва  ')).toEqual(['раз\n\nдва']);
  });
});

describe('shuffleOptions — перемешивание с переиндексацией correct', () => {
  it('rng=0: детерминированный порядок, correct следует за вариантом', () => {
    // Фишер–Йетс с j=0: [0,1,2] → swap(2,0) → [2,1,0] → swap(1,0) → [1,2,0]
    const s = shuffleOptions(q(0), rngZero);
    expect(s.options.map((o) => o.ru)).toEqual(['б', 'в', 'а']);
    expect(s.correct).toBe(2);
    expect(s.options[s.correct].ru).toBe('а');
  });

  it('исходный вопрос не мутируется', () => {
    const src = q(1);
    shuffleOptions(src, rngZero);
    expect(src.options.map((o) => o.ru)).toEqual(['а', 'б', 'в']);
    expect(src.correct).toBe(1);
  });

  it('при любом rng правильный ответ остаётся правильным по содержимому', () => {
    for (const seed of [0.1, 0.35, 0.6, 0.99]) {
      const s = shuffleOptions(q(2), () => seed);
      expect(s.options[s.correct].ru).toBe('в');
    }
  });
});

describe('lessonSteps — теория → карты → вопросы', () => {
  it('порядок видов шагов', () => {
    const l = lesson({ cards: ['fool', 'magician'], quiz: [q(0), q(1)] });
    expect(lessonSteps(l, 'ru', rngZero).map((s) => s.kind)).toEqual([
      'theory', 'card', 'card', 'quiz', 'quiz',
    ]);
  });

  it('карты идут в порядке lesson.cards', () => {
    const l = lesson({ cards: ['fool', 'magician'] });
    expect(lessonSteps(l, 'ru', rngZero).filter((s) => s.kind === 'card')).toEqual([
      { kind: 'card', cardId: 'fool' },
      { kind: 'card', cardId: 'magician' },
    ]);
  });

  it('текст теории берётся из переданного языка', () => {
    expect(lessonSteps(lesson(), 'en', rngZero)[0]).toEqual({ kind: 'theory', text: 'para' });
  });

  it('урок без теории и квиза: шагов нет, lessonPlayable = false', () => {
    const empty = lesson({ theory: undefined, quiz: undefined });
    expect(lessonSteps(empty, 'ru', rngZero)).toEqual([]);
    expect(lessonPlayable(empty)).toBe(false);
    expect(lessonPlayable(lesson())).toBe(true);
  });
});
