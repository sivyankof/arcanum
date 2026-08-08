/** Каскадное появление элементов экрана (пункт 4 motion-spec):
 *  вход снизу с fade, stagger 70 мс на индекс, 450 мс, cubic-out.
 *  Не оборачивать элементы списков длиннее 8. */
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

  React.useEffect(() => {
    v.value = withDelay(
      index * 70,
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [v, index]);

  const appear = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 14 }],
  }));

  return <Animated.View style={[style, appear]}>{children}</Animated.View>;
}
