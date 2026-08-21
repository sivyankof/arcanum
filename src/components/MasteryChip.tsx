/** Чип ступени мастерства (`.mastery` эталона, спека 49): 4 точки + ярлык ступени.
 *  Подсвечено ровно `level` точек (правило сегментов 1/2/3/4). Цвета по ступени:
 *  НОВАЯ — muted/line/panel; ЗНАКОМАЯ и УВЕРЕННАЯ — accent/frame/chipBg (как чип
 *  аркана рождения); МАСТЕР — success/successBg. Показывается только изученной карте —
 *  это проверяет вызывающий. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MASTERY_KEYS, type MasteryLevel } from '../lib/mastery';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function MasteryChip({ level, style }: { level: MasteryLevel; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const colors =
    level === 4
      ? { text: t.success, border: t.success, bg: t.successBg }
      : level === 1
        ? { text: t.muted, border: t.line, bg: t.panel }
        : { text: t.accent, border: t.frame, bg: t.chipBg };
  return (
    <View style={[st.chip, { borderColor: colors.border, backgroundColor: colors.bg }, style]}>
      <View style={st.dots}>
        {([1, 2, 3, 4] as const).map((i) => (
          <View key={i} style={[st.dot, { backgroundColor: colors.text }, i > level && st.dotOff]} />
        ))}
      </View>
      <Txt style={[st.label, { color: colors.text }]}>{tr(MASTERY_KEYS[level])}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  // .mastery эталона: gap 5, граница 1, radius 12, паддинг 3/9; в строку, не на всю ширину
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  dots: { flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotOff: { opacity: 0.3 },
  label: { fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' },
});
