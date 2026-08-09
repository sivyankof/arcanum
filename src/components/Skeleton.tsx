/** Плейсхолдер на время загрузки: мягкое мерцание opacity 0.4 → 0.7 (пункт 12 motion-spec).
 *  Показывается только до появления контента — постоянных пульсаций в списках быть не должно. */
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { pingPong } from '../lib/loops';
import { useTheme } from '../theme/useTheme';

const PULSE_MS = 900;

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const p = useSharedValue(0.4);

  React.useEffect(() => {
    p.value = pingPong(0.7, PULSE_MS);
  }, [p]);

  const anim = useAnimatedStyle(() => ({ opacity: p.value }));

  return <Animated.View pointerEvents="none" style={[{ backgroundColor: t.panel }, style, anim]} />;
}
