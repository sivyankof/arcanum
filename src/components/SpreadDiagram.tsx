/** Мини-схема позиций расклада в списке — блок `.sp .diag` эталона: коробка 52×64, ячейки 13×20
 *  radius 3 с рамкой frame на фоне chipBg по координатам из spreadLayout (спека 36). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MINI, miniCells } from '../lib/spreadLayout';
import { useTheme } from '../theme/useTheme';

export function SpreadDiagram({ spreadId }: { spreadId: string }) {
  const t = useTheme();
  return (
    <View style={st.box}>
      {miniCells(spreadId).map((c, i) => (
        <View key={i} style={[st.cell, { left: c.left, top: c.top, borderColor: t.frame, backgroundColor: t.chipBg }]} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: MINI.boxW, height: MINI.boxH },
  cell: { position: 'absolute', width: MINI.cellW, height: MINI.cellH, borderWidth: 1, borderRadius: 3 },
});
