/** Полоса прогресса с золотым градиентом (accent → accent2): дорожка `t.line` → заливка →
 *  `LinearGradient`. Второе появление было у `XpPill`, третье будет у прогресса шагов урока
 *  (задача 10) — вынесена сюда, чтобы не копировать один и тот же блок в третий раз.
 *
 *  Высоту, радиус и внешние отступы задаёт вызывающий (`radius`/`style`) — у всех трёх мест
 *  разные размеры (6/3 у XpPill и финала урока, 7/4 у шагов урока). Анимацией ширины управляет
 *  вызывающий: у каждого свой тайминг (по смене пропса, по секвенции финала, по шагу викторины),
 *  сюда передаётся уже готовый `SharedValue<number>` 0..1, компонент только читает его в width. */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';

/** Кривая лёгкого перелёта за цель (cubic-bezier(.25,1.2,.4,1) эталона) — общая для всех
 *  вызывающих полосу прогресса, чтобы не дублировать литерал по местам использования. */
export const PROGRESS_EASE = Easing.bezier(0.25, 1.2, 0.4, 1);

export function ProgressBar({
  progress,
  radius = 3,
  colors,
  style,
}: {
  /** Доля заполнения 0..1; withTiming/withDelay настраивает вызывающий. */
  progress: SharedValue<number>;
  /** Радиус дорожки И заливки — одно число на оба слоя (иначе углы заливки торчат из дорожки). */
  radius?: number;
  /** Цвета градиента заливки. Не заданы — accent/accent2 темы, как во всех текущих местах. */
  colors?: [string, string];
  /** Высота, flex, внешние отступы — задаёт вызывающий, у каждого места свои. */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));

  return (
    <View style={[st.track, { backgroundColor: t.line, borderRadius: radius }, style]}>
      <Animated.View style={[st.fill, { borderRadius: radius }, fillStyle]}>
        <LinearGradient
          colors={colors ?? [t.accent, t.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { height: '100%', overflow: 'hidden' },
});
