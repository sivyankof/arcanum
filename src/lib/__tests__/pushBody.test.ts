/** Плюрализация числа дней в теле пуша «спасение серии» (пункт C финального ревью 06б).
 *
 *  `pushBody` живёт в `pushes.ts`, который тянет `expo-notifications` — модуль с побочным
 *  эффектом при импорте, поэтому напрямую его не тестируют (см. комментарий в pushes.web.ts).
 *  Веб-версия `pushes.web.ts` содержит ту же самую функцию БЕЗ единого импорта из expo — это
 *  и есть чистая тестируемая копия реального кода, которая шлёт пуши в браузере (там их нет)
 *  и один-в-один повторяет то, что уходит в уведомление на телефоне.
 */
import { pushBody } from '../pushes.web';
import type { PlannedPush } from '../pushPlan';

const streakPush = (n: number): PlannedPush => ({
  kind: 'streak',
  date: '2026-08-12',
  hour: 20,
  minute: 0,
  phraseKey: 'push.streak_save',
  n,
});

describe('pushBody — плюрализация {days} у push.streak_save', () => {
  it('серия 3 — «3 дня», а не «3 дней»', () => {
    expect(pushBody(streakPush(3), 'ru')).toContain('3 дня');
    expect(pushBody(streakPush(3), 'ru')).not.toContain('3 дней');
  });

  it('серия 4 — тоже «дня», не «день» и не «дней»', () => {
    expect(pushBody(streakPush(4), 'ru')).toContain('4 дня');
  });

  it('серия 21 — «21 день» (i18next-правило для чисел на 1, кроме 11)', () => {
    expect(pushBody(streakPush(21), 'ru')).toContain('21 день');
  });

  it('серия 22 — снова «22 дня»', () => {
    expect(pushBody(streakPush(22), 'ru')).toContain('22 дня');
  });

  it('английский вариант не задет: {n}-day остаётся числом без плюрализации слова day', () => {
    const text = pushBody(streakPush(3), 'en');
    expect(text).toContain('3-day');
  });
});
