/** Горизонтальная лента чипов-фильтров (design-system §5).
 *
 *  ⚠️ Лента идёт ОТ КРАЯ ДО КРАЯ экрана (правило задачи 19): горизонтальный отступ 24 держит
 *  внутренний `contentContainerStyle`, а НЕ контейнер вокруг. Паддинг на контейнере обрывает
 *  прокрутку за 24px до края, и крайние чипы выглядят обрезанными посреди экрана.
 *  Значит родитель ленты не должен иметь горизонтальных паддингов.
 */
import React from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { hapticTap } from '../lib/haptics';
import { spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function FilterChips<T extends string>({
  values,
  labels,
  active,
  onPick,
  contentStyle,
}: {
  values: readonly T[];
  /** Подпись чипа — вместе со счётчиком, если он нужен экрану. */
  labels: (value: T) => string;
  active: T;
  onPick: (value: T) => void;
  /** Отступ сверху и прочая посадка на конкретном экране. */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[st.row, contentStyle]}
    >
      {values.map((v) => (
        <PressableScale
          key={v}
          onPress={() => {
            hapticTap();
            onPick(v);
          }}
          style={[
            st.chip,
            {
              borderColor: active === v ? t.frame : t.line,
              backgroundColor: active === v ? t.chipBg : 'transparent',
            },
          ]}
        >
          <Txt style={[st.txt, { color: active === v ? t.accent : t.muted }]}>{labels(v)}</Txt>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 9, paddingHorizontal: spacing.xl },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  txt: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
});
