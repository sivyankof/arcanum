/** Перечень позиций расклада до тасования — блок `.poscard` эталона (спека 51, экран
 *  `v-moonspread`): пунктирная заглушка карты со звездой, номер позиции и её название.
 *  Показывается только у лунных раскладов: для редкого расклада это объяснение, что он даёт;
 *  у обычных восьми список позиций до тасования не появляется. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { Spread } from '../lib/content';
import { useLang } from '../lib/i18n';
import { inLang } from '../lib/lang';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function PositionCards({ spread }: { spread: Spread }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();

  return (
    <>
      {spread.positions.map((p, i) => (
        <View key={i} style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          <View style={[st.thumb, { borderColor: t.line }]}>
            {/* ✶ нет в Manrope, поэтому обычный Text без fontFamily (правило Txt.tsx) */}
            <Text style={{ fontSize: 12, color: t.muted }}>✶</Text>
          </View>
          <View style={st.tx}>
            <Txt style={[st.num, { color: t.accent }]}>{tr('moonSpread.position', { n: i + 1 })}</Txt>
            <Txt style={[st.name, { color: t.muted }]}>{inLang(p, lang)}</Txt>
          </View>
        </View>
      ))}
    </>
  );
}

const st = StyleSheet.create({
  // `.poscard`: panel/line, radius 13, паддинг 11×13, отступ 8, ряд gap 11
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginTop: 8,
  },
  // `.pcimg`: 34×56, radius 5, пунктир line
  thumb: {
    width: 34,
    height: 56,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tx: { flex: 1 }, // сжимаемый текст (в RN flexShrink по умолчанию 0)
  num: { fontSize: 8.5, letterSpacing: 1.8 }, // `.pcn`
  name: { fontFamily: fonts.display, fontSize: 14, marginTop: 2 }, // `.pct`
});
