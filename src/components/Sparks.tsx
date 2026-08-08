/** Разлетающиеся звёздочки — короткий салют по событию (пункт 10 motion-spec).
 *  Рисуются вокруг центра родителя, поэтому родителю нужен position: relative.
 *  Запуск: увеличить `burst` (0 — ничего не показываем, анимации нет). */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';

const BURST_MS = 900;
const GLYPHS = ['✦', '✧', '✦', '✧'];

function Spark({ index, count, distance, burst }: { index: number; count: number; distance: number; burst: number }) {
  const t = useTheme();
  const p = useSharedValue(0);

  // угол раскладываем равномерно по кругу, длину чередуем — так «салют» не выглядит машинным
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const len = distance * (index % 2 ? 0.72 : 1);
  const dx = Math.cos(angle) * len;
  const dy = Math.sin(angle) * len;

  React.useEffect(() => {
    if (!burst) return;
    p.value = 0;
    p.value = withTiming(1, {
      duration: BURST_MS,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [burst, p]);

  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [
      { translateX: dx * p.value },
      { translateY: dy * p.value },
      { rotate: `${260 * p.value}deg` },
      { scale: interpolate(p.value, [0, 0.3, 1], [0.5, 1, 0.5]) },
    ],
  }));

  return (
    <Animated.Text style={[{ position: 'absolute', color: t.accent, fontSize: 10 }, anim]}>
      {GLYPHS[index % GLYPHS.length]}
    </Animated.Text>
  );
}

export function Sparks({ burst, count = 4, distance = 30 }: { burst: number; count?: number; distance?: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
    >
      {Array.from({ length: count }, (_, i) => (
        <Spark key={i} index={i} count={count} distance={distance} burst={burst} />
      ))}
    </Animated.View>
  );
}
