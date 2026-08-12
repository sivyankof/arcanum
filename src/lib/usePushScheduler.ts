/** Связка «состояние → план → системное расписание».
 *
 *  Живёт в корневом layout, вызывается ровно один раз. Пересчёт происходит в пяти точках
 *  из спеки 06б: гидрация стора (первый рендер), возврат приложения из фона, открытие карты
 *  дня, ответ рефлексии и смена настроек — три последних приходят сами через подписку на стор.
 */
import React from 'react';
import { useApp } from '../store/useApp';
import { localDateISO } from './dates';
import { planPushes } from './pushPlan';
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
    const today = history.find((h) => h.date === localDateISO());
    const plan = planPushes(
      {
        pushesOn: settings.pushesOn,
        reflectionOn: settings.reflectionOn,
        morning: settings.pushMorning,
        evening: settings.pushEvening,
        streak,
        todayCardId: today?.cardId,
        todayOutcome: today?.outcome,
      },
      new Date(),
    );
    initPushes().then(() => applyPlan(plan, lang));
  }, [settings, streak, history, lang, tick]);
}
