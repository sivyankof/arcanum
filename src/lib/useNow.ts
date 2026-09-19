/** «Сейчас» с обновлением по фокусу экрана И по возврату приложения из фона (правило 06а):
 *  `useFocusEffect` не ловит ни полночь, ни сворачивание — приложение может провисеть в фоне
 *  всю ночь, а таб или стек-экран остаться смонтированным. Раньше эту пару `useState` +
 *  `useFocusEffect` + `useAppActive` каждый потребитель заводил заново — до правки было четыре
 *  копии (таб «Учёба», таб «Практика», `useReviewSummary`, и /daily — своя форма, хранившая
 *  только час) и они успели разойтись (спека 72, финальное ревью, находка F13). */
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { useAppActive } from './useAppActive';

export function useNow(): Date {
  const [now, setNow] = React.useState(() => new Date());
  useFocusEffect(React.useCallback(() => setNow(new Date()), []));
  useAppActive(() => setNow(new Date()));
  return now;
}
