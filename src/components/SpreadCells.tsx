/** Ряд ячеек прогресса над лентой 7–10 карт (`.ccmap` эталона, design-system §5): 13×20 radius 3,
 *  зазор 4, перенос, ширина ≤200, по центру; открытая — фон chipBg + бордер frame, переход 300 мс. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MINI } from '../lib/spreadLayout';
import { useTheme } from '../theme/useTheme';

function Cell({ open }: { open: boolean }) {
  const t = useTheme();
  const v = useSharedValue(open ? 1 : 0);
  React.useEffect(() => {
    v.value = withTiming(open ? 1 : 0, { duration: 300 });
  }, [open, v]);
  // прозрачное «золото» вместо 'transparent': иначе интерполяция шла бы через чёрный
  const clear = `${t.accent}00`;
  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [clear, t.chipBg]),
    borderColor: interpolateColor(v.value, [0, 1], [t.line, t.frame]),
  }));
  return <Animated.View style={[st.cell, anim]} />;
}

export function SpreadCells({ total, opened }: { total: number; opened: boolean[] }) {
  return (
    <View style={st.row}>
      {Array.from({ length: total }, (_, i) => (
        <Cell key={i} open={!!opened[i]} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, maxWidth: 200, alignSelf: 'center', marginTop: 14 },
  cell: { width: MINI.cellW, height: MINI.cellH, borderWidth: 1, borderRadius: 3 },
});
