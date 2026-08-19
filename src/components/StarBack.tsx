/** Рубашка со звездой ✶ — поверхность `CardBackSurface` + центрированная ✶ цветом accent.
 *  До задачи 46 связка жила копиями в SpreadCard и SpreadRow — вынесена по правилу «2+ раза»
 *  (первая редакция 46 добавляла ещё закрытую ячейку альбома и мини-рубашку; редакция снята 46б,
 *  потребителей снова два). Звезда центрируется ЗДЕСЬ, а не родителем. Размер звезды задаёт
 *  вызывающий (20 у SpreadCard, 13 у SpreadRow). ✶ отсутствует в Manrope, поэтому обычный Text
 *  без fontFamily (правило Txt.tsx). */
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
