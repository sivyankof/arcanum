/** Scroll-aware панель: прячется при движении вниз, въезжает сверху на обратном жесте
 *  (design-system §5, спека 04е).
 *
 *  Всё состояние живёт в shared values и обновляется в воркл­ете на UI-потоке: `setState` на каждом
 *  событии скролла дал бы перерисовку всего списка 60 раз в секунду. Экран получает готовый
 *  обработчик и готовый анимированный стиль и про Reanimated ничего не знает. */
import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Easing,
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { nextBarShown } from './scrollAware';

/** Параметры перехода — `.cardsbar` эталона: transform .32s cubic-bezier(.2,.8,.3,1). */
const DURATION = 320;
const EASING = Easing.bezier(0.2, 0.8, 0.3, 1);

/** Скрытое положение — −110% высоты: лишние 10% уводят растворённый нижний край за экран,
 *  иначе он мелькает полоской у самой границы. */
const HIDDEN_RATIO = 1.1;

/** Пока высота не измерена, прячем панель заведомо далеко: при высоте 0 формула дала бы
 *  translateY = 0, и панель мигнула бы наверху экрана на первом кадре. */
const HIDDEN_FALLBACK = 300;

export function useScrollAwareBar() {
  const shown = useSharedValue(false); // целевое состояние, без анимации
  const progress = useSharedValue(0); // 0 — спрятана, 1 — показана; анимируется
  const lastY = useSharedValue(0);
  const height = useSharedValue(0);
  const focused = useSharedValue(false);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const next = nextBarShown({ y, lastY: lastY.value, shown: shown.value, focused: focused.value });
      if (next !== shown.value) {
        shown.value = next;
        progress.value = withTiming(next ? 1 : 0, {
          duration: DURATION,
          easing: EASING,
          reduceMotion: ReduceMotion.System,
        });
      }
      lastY.value = y;
    },
  });

  const barStyle = useAnimatedStyle(() => {
    const hidden = height.value > 0 ? -height.value * HIDDEN_RATIO : -HIDDEN_FALLBACK;
    return { transform: [{ translateY: hidden * (1 - progress.value) }] };
  });

  const onBarLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      height.value = e.nativeEvent.layout.height;
    },
    [height],
  );

  /** Фокус в поле САМОЙ панели: пока он есть, панель не уезжает (иначе при коротком списке
   *  результатов смещение схлопывается в 0 и поле уходит из-под пальца). */
  const setFocused = React.useCallback(
    (v: boolean) => {
      focused.value = v;
      if (v && !shown.value) {
        shown.value = true;
        progress.value = withTiming(1, { duration: DURATION, easing: EASING, reduceMotion: ReduceMotion.System });
      }
    },
    [focused, shown, progress],
  );

  return { onScroll, barStyle, onBarLayout, setFocused };
}
