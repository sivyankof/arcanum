/** Каскадное появление элементов экрана (пункт 4 motion-spec):
 *  вход снизу с fade, stagger 70 мс на индекс, 450 мс, cubic-out.
 *  Не оборачивать элементы списков длиннее 8.
 *
 *  Анимация висит на ФОКУСЕ экрана, а не на монтировании: таб-навигатор, однажды показав
 *  экран, держит его смонтированным, поэтому при втором заходе на таб эффект монтирования
 *  уже не срабатывал и экран появлялся мгновенно (замечено Артёмом 11.08). При возвращении
 *  каскад играет короче и без ступенек: экран оживает, но не заставляет ждать полсекунды,
 *  прежде чем можно ткнуть в нужную карточку. */
import { useFocusEffect } from 'expo-router';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const ENTER_MS = 450; // первое появление экрана
const REPEAT_MS = 200; // возвращение на уже открытый экран
const STAGGER = 70; // ступенька каскада, только при первом появлении

export function FadeUp({
  index = 0,
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const v = useSharedValue(0);
  const seen = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      const first = !seen.current;
      seen.current = true;
      v.value = 0;
      v.value = withDelay(
        first ? index * STAGGER : 0,
        withTiming(1, {
          duration: first ? ENTER_MS : REPEAT_MS,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      );
    }, [v, index]),
  );

  const appear = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 14 }],
  }));

  return <Animated.View style={[style, appear]}>{children}</Animated.View>;
}
