/** Панель значения `.mean` эталона: фон panel, бордер line, radius 16, паддинг 16, Overline-подпись
 *  accent сверху. Первое место — «ЗНАЧЕНИЕ ДНЯ» на «Сегодня», второе — «ЗНАЧЕНИЕ» в тренажёре
 *  (спека 45) — вынесена по правилу «2+ раза». От Block отличается ровно тем, чем в эталоне `.mean`
 *  отличается от `.block`: у заголовка нет хвоста-линии, отступ сверху 16. Содержимое — children
 *  (у карты дня текст + CTA, у тренажёра чипы + предложение + ссылка + кнопки). */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function MeaningPanel({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }, style]}>
      <Txt style={[st.lbl, { color: t.accent }]}>{title}</Txt>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderRadius: radius.l, borderWidth: 1, padding: spacing.l, marginTop: spacing.l },
  lbl: { fontSize: 9.5, letterSpacing: 3 }, // Overline из дизайн-системы: 9.5–10
});
