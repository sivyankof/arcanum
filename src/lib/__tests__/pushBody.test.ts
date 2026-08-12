/** Плюрализация числа дней в теле пуша «спасение серии» (пункт C финального ревью 06б).
 *
 *  Тест целится в `pushBody.ts` напрямую — модуль без единого импорта `expo-notifications`,
 *  поэтому его можно требовать в тестах, не таща побочный эффект инициализации пушей
 *  (см. комментарий в pushes.web.ts). Раньше тест импортировал функцию из `pushes.web.ts`,
 *  где лежала ручная копия «боевой» версии из `pushes.ts` — сломай текст в самой `pushes.ts`,
 *  этот набор остался бы зелёным, хотя реальные уведомления на телефоне уже пришли бы
 *  с «Серия 3 дней». Теперь `pushes.ts` и `pushes.web.ts` реэкспортируют одну и ту же функцию
 *  отсюда (пункт 3 второй волны фиксов 06б), так что тест защищает код, который правда шлёт
 *  уведомления.
 */
import { pushBody } from '../pushBody';
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
