/** Плашка «ПРЕМИУМ» — `.lk` эталона (design-reference.html): 8.5px, ls 1.5, accent, border 1
 *  frame, фон chipBg, радиус 10, паддинг 8×3. Повторяется 3+ раза (пейвол — чип «✦ АКТИВНА»
 *  и бейдж «−40 %» задачи 5, `app/(tabs)/spreads/index.tsx` — бейдж «ПРЕМИУМ» у платных
 *  раскладов), поэтому вынесена сюда одним компонентом (правило DRY). Задачи 6–8 переведут
 *  на неё ещё три места: шапку модуля курса, тренажёр повторения и лунную панель раскладов. */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Txt } from './Txt';
import { useTheme } from '../theme/useTheme';

export function PremiumBadge({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  return (
    <View style={[st.lk, { borderColor: t.frame, backgroundColor: t.chipBg }, style]}>
      <Txt style={[st.text, { color: t.accent }]}>{label ?? tr('spreads.premium')}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  lk: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' },
});
