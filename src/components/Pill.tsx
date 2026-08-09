/** Оболочка пилюли из ряда «серия · уровень» на «Сегодня» (класс .pill эталона):
 *  панель с рамкой, радиус 15, паддинги 10/13, содержимое в ряд с зазором 9.
 *  Вынесена отдельно, потому что чрома одинаковая у StreakPill и XpPill —
 *  дублировать её во втором компоненте нельзя. Размеры ряда (flex) задаёт экран. */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function Pill({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[st.pill, { backgroundColor: t.panel, borderColor: t.line }, style]}>{children}</View>
  );
}

const st = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
  },
});
