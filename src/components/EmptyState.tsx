/** Пустое состояние (design-system §7): мини-рубашка карты + тёплая фраза, никаких «Нет данных».
 *  Рубашка нарисована в миниатюре — полноразмерный `CardBack` сюда не годится: у него эмблема
 *  96px и слово ARCANUM, в 44×72 они не помещаются. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function EmptyState({ text }: { text: string }) {
  const t = useTheme();

  return (
    <View style={st.box}>
      <View style={[st.back, { borderColor: t.frame, backgroundColor: t.panel }]}>
        {/* ✦ отсутствует в Manrope, поэтому рисуем обычным Text без fontFamily */}
        <Text style={[st.star, { color: t.accent }]}>✦</Text>
      </View>
      <Txt style={[st.text, { color: t.muted }]}>{text}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  box: { alignItems: 'center', gap: spacing.m, paddingVertical: spacing.xxl },
  back: {
    width: 44,
    height: 72,
    borderWidth: 1,
    borderRadius: radius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 16 },
  // 270 — чтобы фраза о карте дня ложилась в две ровные строки, а не рвалась на «карты / дня»
  text: { fontSize: 12.5, textAlign: 'center', maxWidth: 270, lineHeight: 18 },
});
