/** Связка «состояние → план → системное расписание».
 *
 *  Живёт в корневом layout, вызывается ровно один раз. Пересчёт происходит в пяти точках
 *  из спеки 06б: гидрация стора (первый рендер), возврат приложения из фона, открытие карты
 *  дня, ответ рефлексии и смена настроек — три последних приходят сами через подписку на стор.
 */
import React from 'react';
import { useApp } from '../store/useApp';
import { planInputFromStore, planPushes } from './pushPlan';
import { applyPlan, initPushes } from './pushes';
import { useAppActive } from './useAppActive';

export function usePushScheduler(): void {
  const settings = useApp((s) => s.settings);
  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);
  const lang = useApp((s) => s.lang);

  // возврат из фона состояние стора не меняет, а план устареть успел: наступил вечер,
  // сменились сутки. Тик заставляет эффект пересчитаться
  const [tick, setTick] = React.useState(0);
  useAppActive(() => setTick((n) => n + 1));

  React.useEffect(() => {
    const now = new Date();
    const plan = planPushes(planInputFromStore(settings, streak, history, now), now);
    // разрешения и API уведомлений умеют бросать (отказ пользователя, сбой канала и т.п.).
    // Без catch это необработанный reject где-то в микротаске: приложение не падает, но и
    // диагностики никакой — в проекте нет сервиса отчётов об ошибках, поэтому предупреждение
    // в консоль остаётся единственным способом это заметить. Провал перепланирования не должен
    // ронять рендер и не должен мешать следующему пересчёту (initPushes/applyPlan сами
    // восстанавливаются на следующий вызов).
    initPushes()
      .then(() => applyPlan(plan, lang))
      .catch((err) => {
        console.warn('[usePushScheduler] не удалось перепланировать пуши:', err);
      });
  }, [settings, streak, history, lang, tick]);
}
