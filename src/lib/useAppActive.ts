/** Вызывает `cb` каждый раз, когда приложение возвращается из фона.
 *
 *  `useFocusEffect` этого НЕ ловит: он реагирует только на смену фокуса экрана внутри
 *  навигатора, а свёрнутое и заново развёрнутое приложение фокус не меняет. Нашлось финальным
 *  ревью 06а: утром открыл карту → свернул → вечером вернулся, и час оставался утренним.
 *  Всё, что зависит от текущего времени (вечерний блок, планировщик пушей, переход через
 *  полночь, будущая заморозка серии), обязано слушать ещё и AppState.
 */
import React from 'react';
import { AppState } from 'react-native';

export function useAppActive(cb: () => void): void {
  // колбэк держим в ref: иначе подписка пересоздавалась бы на каждый рендер вызывающего
  const ref = React.useRef(cb);
  ref.current = cb;

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ref.current();
    });
    return () => sub.remove();
  }, []);
}
