/** Золотые чипы ключевых слов (`.kws` эталона, design-system §5): 4 слова витрины под названием
 *  на странице карты, в панели «ЗНАЧЕНИЕ» тренажёра и столбиком на рубашке-вопросе (спека 45) —
 *  вынесены по правилу «2+ раза». Слова приходят уже на нужном языке (inLang снаружи).
 *  layout 'wrap' — лента с переносом (страница карты, панель); 'column' — столбик по центру
 *  (рубашка toCard, `.trkwcol` эталона: gap 5). Сам чип один и тот же везде: макет рисует на рубашке
 *  чип чуть иначе (radius 12, бордер frame, 700) — расхождение осознанное, второй стиль чипа для тех
 *  же слов — дубликат (правило проекта). */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function KeywordChips({
  words,
  layout = 'wrap',
  style,
}: {
  words: readonly string[];
  layout?: 'wrap' | 'column';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[layout === 'column' ? st.column : st.row, style]}>
      {words.map((k) => (
        <View key={k} style={[st.chip, { backgroundColor: t.chipBg, borderColor: t.line }]}>
          <Txt style={[st.txt, { color: t.accent }]}>{k}</Txt>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  column: { flexDirection: 'column', alignItems: 'center', gap: 5 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  txt: { fontSize: 10, fontWeight: '600' },
});
