/** Разлетающиеся звёздочки — короткий салют по событию (пункт 10 motion-spec, `.spark` эталона).
 *  Рисуются вокруг центра родителя, поэтому родителю нужен position: relative.
 *  Запуск: увеличить `burst` (0 — ничего не показываем, анимации нет).
 *
 *  Разброс (угол, длина, кегль) берём из хеша индекса, а не из Math.random: случайное число
 *  в теле компонента пересчитывалось бы на каждой перерисовке, и искры меняли бы траекторию
 *  прямо в полёте. Хеш даёт ту же «неровность», но стабильную. */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { textGlow } from '../theme/glow';
import { useTheme } from '../theme/useTheme';

const BURST_MS = 900;
const GLYPHS = ['✦', '✧', '✦', '✧'];
const SPIN = 260; // rotate(260deg) из @keyframes fly

/** Диапазон значений: одно число — фиксированное, пара — [минимум, максимум]. */
type Range = number | [number, number];

/** Псевдослучайное 0..1, детерминированное от пары чисел (соль разводит разные величины). */
function noise(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Spark({
  index,
  count,
  distance,
  size,
  glyphs,
  duration,
  angleJitter,
  angleRange,
  lift,
  colors,
  burst,
}: {
  index: number;
  count: number;
  distance: Range;
  size: Range;
  glyphs: string[];
  duration: number;
  angleJitter: number;
  angleRange?: [number, number];
  lift: number;
  colors?: string[];
  burst: number;
}) {
  const t = useTheme();
  const p = useSharedValue(0);

  // угол раскладываем равномерно по кругу и слегка «сбиваем», чтобы салют не выглядел машинным;
  // длина без заданного разброса просто чередуется — так было до появления пропсов
  // сектор задан — раскладываем угол равномерно по нему; нет — полный круг, как раньше
  const angle = angleRange
    ? angleRange[0] + ((angleRange[1] - angleRange[0]) * index) / count + noise(index, 0) * angleJitter
    : (Math.PI * 2 * index) / count - Math.PI / 2 + noise(index, 0) * angleJitter;
  const len = Array.isArray(distance)
    ? distance[0] + noise(index, 1) * (distance[1] - distance[0])
    : distance * (index % 2 ? 0.72 : 1);
  const fontSize = Array.isArray(size) ? size[0] + noise(index, 2) * (size[1] - size[0]) : size;
  const dx = Math.cos(angle) * len;
  const dy = Math.sin(angle) * len + lift;

  React.useEffect(() => {
    if (!burst) return;
    p.value = 0;
    p.value = withTiming(1, {
      duration,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [burst, p, duration]);

  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [
      { translateX: dx * p.value },
      { translateY: dy * p.value },
      { rotate: `${SPIN * p.value}deg` },
      { scale: interpolate(p.value, [0, 0.3, 1], [0.5, 1, 0.5]) },
    ],
  }));

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          color: colors ? colors[index % colors.length] : t.accent,
          fontSize,
          // text-shadow 0 0 9px var(--glow) из .spark
          ...textGlow(t.glow, 9),
        },
        anim,
      ]}
    >
      {glyphs[index % glyphs.length]}
    </Animated.Text>
  );
}

export function Sparks({
  burst,
  count = 4,
  distance = 30,
  size = 10,
  glyphs = GLYPHS,
  duration = BURST_MS,
  angleJitter = 0,
  angleRange,
  lift = 0,
  colors,
  style,
}: {
  burst: number;
  count?: number;
  /** Дальность разлёта: число — как раньше (чередование длин), пара — случайно из диапазона. */
  distance?: Range;
  /** Кегль глифа: число — общий, пара — случайно из диапазона. */
  size?: Range;
  glyphs?: string[];
  duration?: number;
  /** Максимальный «сбив» угла в радианах (0 — строго равномерный круг). */
  angleJitter?: number;
  /** Сектор разлёта [от, до] в радианах; ось x вправо, y вниз (верхняя полуокружность —
   *  [Math.PI, Math.PI * 2]). Не задан — полный круг. */
  angleRange?: [number, number];
  /** Постоянный вертикальный сдвиг конца траектории (минус — вверх): «подброс» конфетти. */
  lift?: number;
  /** Цвета глифов по кругу (index % length). Не задан — accent темы. */
  colors?: string[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
        style,
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <Spark
          key={i}
          index={i}
          count={count}
          distance={distance}
          size={size}
          glyphs={glyphs}
          duration={duration}
          angleJitter={angleJitter}
          angleRange={angleRange}
          lift={lift}
          colors={colors}
          burst={burst}
        />
      ))}
    </Animated.View>
  );
}
