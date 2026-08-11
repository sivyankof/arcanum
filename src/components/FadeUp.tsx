/** Каскадное появление элементов экрана (пункт 4 motion-spec):
 *  вход снизу с fade, stagger 70 мс на индекс, 450 мс, cubic-out.
 *  Не оборачивать элементы списков длиннее 8.
 *
 *  Анимация висит на ФОКУСЕ экрана, а не на монтировании: таб-навигатор, однажды показав
 *  экран, держит его смонтированным, поэтому при втором заходе на таб эффект монтирования
 *  уже не срабатывал и экран появлялся мгновенно (замечено Артёмом 11.08).
 *
 *  ВОЗВРАЩЕНИЕ на уже открытый экран отыгрывается иначе, чем первое появление: без ступенек,
 *  без сдвига и не с нуля, а с 0.6 — короткое «оживание». Первая версия правки повторяла полный
 *  вход (гасила всё в ноль и двигала на 14px за 200мс): на устройстве это читалось вспышкой
 *  пустоты и рывком — экран будто перезагружался при каждом переключении таба. */
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
const REPEAT_MS = 180; // возвращение на уже открытый экран
const STAGGER = 70; // ступенька каскада, только при первом появлении
const SHIFT = 14; // подъём снизу, тоже только при первом появлении
const REPEAT_FROM = 0.6; // возвращение начинается не с пустоты, иначе экран мигает

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
  const shift = useSharedValue(SHIFT);
  const seen = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      const first = !seen.current;
      seen.current = true;
      shift.value = first ? SHIFT : 0;
      v.value = first ? 0 : REPEAT_FROM;
      v.value = withDelay(
        first ? index * STAGGER : 0,
        withTiming(1, {
          duration: first ? ENTER_MS : REPEAT_MS,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      );
    }, [v, shift, index]),
  );

  const appear = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * shift.value }],
  }));

  return <Animated.View style={[style, appear]}>{children}</Animated.View>;
}
