/** Универсальная панель со значением карты — блок `.block` из эталона
 *  (docs/design-reference.html): заголовок-Overline с линией-хвостом + текст ниже.
 *  Используется на странице карты (общее значение, перевёрнутая, как карта дня, символика);
 *  дальше пригодится дневнику. Панель не анимируется (высота меняется без анимации),
 *  анимируется только контент внутри — через `contentStyle` (fade при смене вкладки сферы). */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

interface BlockProps {
  title: string;
  text: string;
  todo?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  // Контекстный блок «ваша карта сегодня» (product-spec §3): золотая рамка вместо обычной...
  accentBorder?: boolean;
  // ...и звёздочка ✦ перед заголовком. ✦ отсутствует в Manrope, поэтому рисуется обычным
  // Text без fontFamily (см. правило в шапке Txt.tsx, пример — Rule.tsx).
  star?: boolean;
}

export function Block({ title, text, todo, contentStyle, accentBorder, star }: BlockProps) {
  const t = useTheme();
  // 'transparent' в градиенте на iOS даёт серый ореол, поэтому гасим через альфу самого цвета
  const clear = `${t.line}00`;

  return (
    <View style={[st.panel, { backgroundColor: t.panel, borderColor: accentBorder ? t.frame : t.line }]}>
      <Animated.View style={contentStyle}>
        <View style={st.titleRow}>
          {star && <Text style={[st.star, { color: t.accent }]}>✦</Text>}
          <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
          <LinearGradient colors={[t.line, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.tail} />
        </View>
        <Text style={[st.text, { color: todo ? t.muted : t.text }, todo && st.textTodo]}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.l, padding: spacing.l, marginTop: spacing.m },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 9, letterSpacing: 2.5 },
  star: { fontSize: 9.5 },
  tail: { flex: 1, height: 1 },
  text: { fontFamily: fonts.display, fontSize: 16, lineHeight: 24, marginTop: 7 },
  textTodo: { fontStyle: 'italic' },
});
