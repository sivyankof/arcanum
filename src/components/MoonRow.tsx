/** Строка луны «☽ Растущая луна» (.moonrow эталона) — на вкладке «Практика» и в шапке лунного
 *  календаря; номер лунного дня снят задачей 72 (фазы — астрономия, нумерованные дни — астрология).
 *  Символ ☽ рисуем системным шрифтом: в Manrope его нет, поэтому обёртка — обычный Text без
 *  fontFamily. С `onPress` строка нажимаема (PressableScale — единая замена самодельным нажатиям)
 *  и несёт справа шеврон — вход в календарь; без `onPress` — просто текст (сам календарь). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { MoonPhase } from '../lib/moon';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

type Props = {
  phase: MoonPhase;
  /** тап по строке (вход в лунный календарь); без него строка не нажимаема и без шеврона */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function MoonRow({ phase, onPress, style }: Props) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const text = (
    <Text style={[st.text, { color: t.muted }]}>
      <Text>☽ </Text>
      <Txt style={{ color: t.head, fontWeight: '600' }}>{tr(`moon.${phase}`)}</Txt>
    </Text>
  );

  if (!onPress) return <View style={[st.row, style]}>{text}</View>;

  return (
    <PressableScale onPress={onPress} hitSlop={8} accessibilityRole="button" style={[st.row, style]}>
      {text}
      {/* шеврон 12 muted, зазор 4 (решение спеки 47 — в макете дорисован) */}
      <Ionicons name="chevron-forward-outline" size={12} color={t.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  // .moonrow: 13px по центру, отступ 12 сверху; строка — ряд, чтобы шеврон встал за текстом
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  // flexShrink: 1 обязателен — в режиме с шевроном текст делит ряд с иконкой, а в RN дефолт
  // flexShrink: 0 (в CSS 1): без него длинная локализованная фраза не переносится, а вылезает
  // за экран. Этот класс дефекта проект ловил дважды — чип «НАЧАТЬ УРОК» (07) и LevelCard (16)
  text: { fontSize: 13, textAlign: 'center', flexShrink: 1 },
});
