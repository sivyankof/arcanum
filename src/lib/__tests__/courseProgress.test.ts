import type { CourseModule } from '../content';
import { course } from '../content';
import {
  lessonStates,
  moduleCardCount,
  moduleProgress,
  nextLessonId,
  nodeXs,
  type LessonProgressMap,
} from '../courseProgress';

// Фабрика модулей: fx('a', 2) — модуль "a" с уроками a1, a2; cardsPerLesson РАЗНЫХ карт в каждом
const fx = (id: string, lessons: number, cardsPerLesson = 0): CourseModule => ({
  id,
  free: true,
  title: { ru: id, en: id },
  lessons: Array.from({ length: lessons }, (_, i) => ({
    id: `${id}${i + 1}`,
    title: { ru: `${id}${i + 1}`, en: `${id}${i + 1}` },
    cards: Array.from({ length: cardsPerLesson }, (_, c) => `${id}${i + 1}-card-${c}`),
  })),
});

const done = (...ids: string[]): LessonProgressMap =>
  Object.fromEntries(ids.map((id) => [id, { done: true, errors: 0, ts: 1 }]));

const MODULES = [fx('a', 2), fx('b', 3)];

describe('lessonStates — сквозная блокировка (решение брейншторма 07)', () => {
  it('пустой прогресс: первый урок курса current, все прочие locked', () => {
    expect(lessonStates(MODULES, {})).toEqual({
      a1: 'current', a2: 'locked', b1: 'locked', b2: 'locked', b3: 'locked',
    });
  });

  it('после первого урока current переезжает на второй', () => {
    expect(lessonStates(MODULES, done('a1'))).toEqual({
      a1: 'done', a2: 'current', b1: 'locked', b2: 'locked', b3: 'locked',
    });
  });

  it('граница модулей сквозная: закрыт весь "a" — current в начале "b"', () => {
    expect(lessonStates(MODULES, done('a1', 'a2'))).toEqual({
      a1: 'done', a2: 'done', b1: 'current', b2: 'locked', b3: 'locked',
    });
  });

  it('всё пройдено — current нет ни у кого', () => {
    const states = lessonStates(MODULES, done('a1', 'a2', 'b1', 'b2', 'b3'));
    expect(Object.values(states)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('«дырка» не ломает правило: done не по порядку остаётся done, current — первый не-done', () => {
    expect(lessonStates(MODULES, done('a2'))).toEqual({
      a1: 'current', a2: 'done', b1: 'locked', b2: 'locked', b3: 'locked',
    });
  });

  it('пустой курс не ломает разбор состояний', () => {
    expect(lessonStates([], {})).toEqual({});
  });
});

describe('nextLessonId', () => {
  it('пустой прогресс → первый урок', () => {
    expect(nextLessonId(MODULES, {})).toBe('a1');
  });
  it('всё пройдено → null', () => {
    expect(nextLessonId(MODULES, done('a1', 'a2', 'b1', 'b2', 'b3'))).toBeNull();
  });

  it('переход через границу модулей: закрыт весь "a" — следующий в начале "b"', () => {
    expect(nextLessonId(MODULES, done('a1', 'a2'))).toBe('b1');
  });

  it('частичный прогресс внутри модуля', () => {
    expect(nextLessonId(MODULES, done('a1'))).toBe('a2');
  });

  // страховка от расхождения двух копий правила «первый непройденный»
  it('совпадает с узлом, который lessonStates пометила current', () => {
    for (const p of [{}, done('a1'), done('a1', 'a2'), done('a1', 'a2', 'b1')]) {
      const current = Object.entries(lessonStates(MODULES, p)).find(([, s]) => s === 'current')?.[0] ?? null;
      expect(nextLessonId(MODULES, p)).toBe(current);
    }
  });
});

describe('moduleProgress — процент для шапки модуля', () => {
  const b = MODULES[1]; // 3 урока
  it('0 из 3 → 0%', () => {
    expect(moduleProgress(b, {})).toEqual({ done: 0, total: 3, pct: 0 });
  });
  it('обычное округление: 1/3 → 33, 2/3 → 67', () => {
    expect(moduleProgress(b, done('b1')).pct).toBe(33);
    expect(moduleProgress(b, done('b1', 'b2')).pct).toBe(67);
  });
  it('3 из 3 → 100%', () => {
    expect(moduleProgress(b, done('b1', 'b2', 'b3')).pct).toBe(100);
  });
  it('чужие уроки не считаются', () => {
    expect(moduleProgress(b, done('a1', 'a2')).done).toBe(0);
  });
  it('модуль без уроков не делит на ноль', () => {
    expect(moduleProgress(fx('c', 0), {})).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('moduleCardCount — РАЗНЫЕ карты модуля', () => {
  it('разные карты по урокам складываются', () => {
    expect(moduleCardCount(fx('c', 3, 2))).toBe(6);
  });
  it('модуль без карт → 0 (счётчик карт в шапке скрывается)', () => {
    expect(moduleCardCount(fx('c', 3))).toBe(0);
  });
  it('урок-повторение не удваивает счёт: карты, повторённые в другом уроке, считаются раз', () => {
    // так устроен реальный М2: четыре урока по две карты + «Повторение» со всеми восемью
    const mod = fx('c', 2, 2);
    mod.lessons.push({
      id: 'c3',
      title: { ru: 'Повторение', en: 'Review' },
      cards: [...mod.lessons[0].cards, ...mod.lessons[1].cards],
    });
    expect(moduleCardCount(mod)).toBe(4);
  });
});

describe('nodeXs — x-координаты змейки', () => {
  it('6 узлов — паттерн эталона', () => {
    expect(nodeXs(6)).toEqual([50, 24, 70, 38, 66, 42]);
  });
  it('меньше узлов — префикс паттерна', () => {
    expect(nodeXs(4)).toEqual([50, 24, 70, 38]);
  });
  it('больше узлов — цикл хвоста (модуль М4 = 8 уроков)', () => {
    expect(nodeXs(8)).toEqual([50, 24, 70, 38, 66, 42, 24, 70]);
  });
  it('все координаты в берегах макета [24, 70]', () => {
    for (const x of nodeXs(12)) {
      expect(x).toBeGreaterThanOrEqual(24);
      expect(x).toBeLessThanOrEqual(70);
    }
  });
});

describe('реальный course.json', () => {
  it('6 модулей, 32 урока (шапка экрана «6 МОДУЛЕЙ · 32 УРОКА»)', () => {
    expect(course).toHaveLength(6);
    expect(course.reduce((n, m) => n + m.lessons.length, 0)).toBe(32);
  });
  it('М2 разбирает 8 карт — как в шапке эталона «6 УРОКОВ · 8 КАРТ»', () => {
    // в JSON у М2 шестнадцать записей карт: урок «Повторение» перечисляет все восемь заново
    expect(course[1].lessons.flatMap((l) => l.cards)).toHaveLength(16);
    expect(moduleCardCount(course[1])).toBe(8);
  });
});
