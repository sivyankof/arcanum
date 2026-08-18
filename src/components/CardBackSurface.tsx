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
    // width/height="100%" — ОБЯЗАТЕЛЬНЫ явно, `StyleSheet.absoluteFill` в style задаёт только
    // CSS-позиционирование (position:absolute; inset:0), а не размер вьюпорта самого SVG.
    // Без них react-native-svg на вебе рендерит голый <svg> с браузерным дефолтом 300×150 —
    // <Rect width="100%"> считает проценты от НЕГО, а не от карты, и градиент обрывается
    // на 150px высоты (на светлой теме это видно как ровная граница на рубашке). Проверено
    // по исходнику react-native-svg 15.12.1: на нативе Svg сам подставляет '100%', когда оба
    // пропа не заданы (`elements/Svg.tsx`), а веб-реализация (`elements.web.ts`, просто <svg>)
    // этого дефолта не делает — поэтому здесь пропы обязаны быть проставлены руками.
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
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
