/** Мини-схема позиций расклада в списке — блок `.sp .diag` эталона: коробка 52×64, ячейки 13×20
 *  radius 3 с рамкой frame на фоне chipBg по координатам из spreadLayout (спека 36). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MINI, miniCells } from '../lib/spreadLayout';
import { useTheme } from '../theme/useTheme';

export function SpreadDiagram({ spreadId }: { spreadId: string }) {
  const t = useTheme();
  // Раскладка, не влезающая в коробку базовым шагом (подкова, кельтский крест, «На месяц»),
  // масштабируется целиком — ячейка тогда МЕНЬШЕ MINI.cellW/cellH, размер берём из layout,
  // а не из константы (спека 36, доводка 16.08).
  const { cells, cellW, cellH } = miniCells(spreadId);
  return (
    <View style={st.box}>
      {cells.map((c, i) => (
        <View
          key={i}
          style={[st.cell, { left: c.left, top: c.top, width: cellW, height: cellH, borderColor: t.frame, backgroundColor: t.chipBg }]}
        />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: MINI.boxW, height: MINI.boxH },
  // radius 3 — фиксирован, не масштабируется (решение владельца 16.08: сжатая ячейка со
  // скруглением «как у большой» читается аккуратнее, чем пропорционально уменьшенное 2px).
  cell: { position: 'absolute', borderWidth: 1, borderRadius: 3 },
});
