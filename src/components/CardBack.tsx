/** Рубашка карты дня — блоки `.backpat` и `.emb` эталона (docs/design-reference.html).
 *
 *  Фон — радиальный градиент со смещённым вверх центром (`radial-gradient(95% 95% at 50% 28%)`).
 *  expo-linear-gradient такого не умеет, поэтому рисуем прямоугольник в react-native-svg:
 *  вертикальный градиент давал плоскую рубашку без «света сверху».
 *
 *  Эмблема-«компас» вынесена сюда не только ради чистоты экрана: тот же рисунок нужен
 *  в онбординге (`.emb2` эталона), дублировать пути не будем. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { glowShadow } from '../theme/glow';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

/** Цвета рубашки из `.backpat` эталона. Живут здесь, а не в theme.ts: это не токены
 *  дизайн-системы, а два оттенка одной-единственной поверхности. */
const BACK_COLORS = {
  dark: ['#1d2752', '#0c1130'],
  light: ['#f4ead0', '#e4d6b0'],
} as const;

const EMB_SIZE = 96; // .emb svg
const GRAD_ID = 'cardBackGlow';

export function CardBack({ hint }: { hint?: string }) {
  const t = useTheme();
  const [from, to] = BACK_COLORS[t.mode];

  return (
    <>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          {/* 95% 95% at 50% 28% — центр светового пятна выше середины карты */}
          <RadialGradient id={GRAD_ID} cx="50%" cy="28%" rx="95%" ry="95%">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${GRAD_ID})`} />
      </Svg>

      <View style={[st.inframe, { borderColor: t.frame }]} />

      <View style={st.emb}>
        {/* свечение эмблемы — эталон `.emb svg`: filter:drop-shadow(0 0 12px var(--glow)),
            то есть по контуру символа, а не по прямоугольнику; boxShadow дал бы квадратную
            тень вокруг прозрачного фона. Висит на отдельной обёртке: рядом с overflow:'hidden'
            тень срезает, поэтому обрезка — только на faceClip */}
        <View style={glowShadow(t.glow, t.accent, 12, 0.35)}>
          <Svg
            width={EMB_SIZE}
            height={EMB_SIZE}
            viewBox="0 0 100 100"
            fill="none"
            stroke={t.accent}
            strokeWidth={0.9}
          >
            <Circle cx={50} cy={50} r={33} />
            <Circle cx={50} cy={50} r={41} strokeDasharray="2 5" />
            <Path d="M50 23 L57 43 L77 50 L57 57 L50 77 L43 57 L23 50 L43 43 Z" />
            <Circle cx={50} cy={50} r={7} />
            <Path d="M50 9v6M50 85v6M9 50h6M85 50h6" />
          </Svg>
        </View>

        <Txt style={[st.word, { color: t.accent }]}>ARCANUM</Txt>

        {!!hint && <Txt style={[st.hint, { color: t.muted }]}>{hint}</Txt>}
      </View>
    </>
  );
}

const st = StyleSheet.create({
  inframe: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderWidth: 1, borderRadius: 10, opacity: 0.8 },
  // gap 15 — из .emb эталона
  emb: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 15 },
  word: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 7 },
  hint: { fontSize: 8.5, letterSpacing: 2 },
});
