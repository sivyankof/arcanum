/** Золочёные уголки карты дня — `.cnr` эталона (design-system §5): четыре дужки 20×20 с инсетом 4,
 *  обводка 1.1 цветом accent, точка r=1 — один рисунок, повёрнутый на 0/90/180/270°.
 *  Место применения РОВНО одно — обе грани карты дня (рубашка через проп `CardBack.corners`,
 *  лицо в app/(tabs)/index.tsx); нигде больше — уголки остаются особенными, потому что редкие
 *  (решение 10.08; задача 40 закрыла расхождение с макетом 18.08). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

const SIZE = 20; // .cnr width/height
const INSET = 4; // .cnr.tl top/left
const STROKE = 1.1; // .cnr svg stroke-width

// один и тот же рисунок по часовой: tl 0°, tr 90°, br 180°, bl 270° (.cnr.tl/.tr/.br/.bl эталона)
const CORNERS = [
  { key: 'tl', place: { top: INSET, left: INSET }, rotate: '0deg' },
  { key: 'tr', place: { top: INSET, right: INSET }, rotate: '90deg' },
  { key: 'br', place: { bottom: INSET, right: INSET }, rotate: '180deg' },
  { key: 'bl', place: { bottom: INSET, left: INSET }, rotate: '270deg' },
] as const;

export function CardCorners() {
  const t = useTheme();
  return (
    <View style={st.layer}>
      {CORNERS.map((c) => (
        <View key={c.key} style={[st.corner, c.place, { transform: [{ rotate: c.rotate }] }]}>
          {/* width/height явно: на вебе react-native-svg без них рисует в дефолтный вьюпорт (урок CardBackSurface) */}
          <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
            <Path d="M2 14 V6 a4 4 0 0 1 4-4 h8" stroke={t.accent} strokeWidth={STROKE} fill="none" />
            <Circle cx={2} cy={17} r={1} fill={t.accent} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  // свойство внутри стиля, а не пропом (правило спеки 07)
  layer: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  corner: { position: 'absolute', width: SIZE, height: SIZE },
});
