/** Пружинное нажатие для всех интерактивных элементов (пункт 5 motion-spec):
 *  scale 0.96 на pressIn и обратно на pressOut, spring damping 15 / stiffness 300.
 *  Единая замена самодельным `pressed ? 0.97 : 1` и «прижиманию» прозрачностью. */
import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 15, stiffness: 300, reduceMotion: ReduceMotion.System } as const;

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** до какого масштаба сжимать (по умолчанию 0.96) */
  scaleTo?: number;
  children?: React.ReactNode;
};

export function PressableScale({ scaleTo = 0.96, style, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}
