/** Поверхность рубашки — радиальный градиент `.backpat` эталона со смещённым вверх центром
 *  (`radial-gradient(95% 95% at 50% 28%)`); expo-linear-gradient такого не умеет, рисуем
 *  прямоугольник в react-native-svg. Общая для карты дня (CardBack — с эмблемой и словом ARCANUM)
 *  и карт расклада (SpreadCard/SpreadRow — только звезда ✶), спека 36. */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

/** Цвета рубашки из `.backpat` эталона. Не токены дизайн-системы, а два оттенка одной поверхности. */
const BACK_COLORS = {
  dark: ['#1d2752', '#0c1130'],
  light: ['#f4ead0', '#e4d6b0'],
} as const;

const GRAD_ID = 'cardBackGlow';

export function CardBackSurface() {
  const t = useTheme();
  const [from, to] = BACK_COLORS[t.mode];
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={GRAD_ID} cx="50%" cy="28%" rx="95%" ry="95%">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${GRAD_ID})`} />
    </Svg>
  );
}
