/** Рубашка со звездой ✶ — поверхность `CardBackSurface` + центрированная ✶ цветом accent.
 *  До спеки 46 связка жила копиями в SpreadCard и SpreadRow, третьим местом стала бы закрытая
 *  ячейка коллекции (и четвёртым — мини-рубашка строки масти) — вынесена по правилу «2+ раза».
 *  Звезда центрируется ЗДЕСЬ, а не родителем: у закрытой ячейки и мини-рубашки центрирующих
 *  стилей нет. Размер звезды задаёт вызывающий — у каждого места свой (20 / 13 / 17 / 9).
 *  ✶ отсутствует в Manrope, поэтому обычный Text без fontFamily (правило Txt.tsx). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CardBackSurface } from './CardBackSurface';

export function StarBack({ starSize }: { starSize: number }) {
  const t = useTheme();
  return (
    <>
      <CardBackSurface />
      <View style={st.center}>
        <Text style={{ fontSize: starSize, color: t.accent }}>✶</Text>
      </View>
    </>
  );
}

const st = StyleSheet.create({
  // поверх SVG-поверхности; событий не ловит — нажатие идёт родителю (pointerEvents в стиле, не пропом)
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
