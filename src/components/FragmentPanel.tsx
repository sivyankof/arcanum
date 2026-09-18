/** Вход в игру «Угадай карту» (спека 72) — панель той же геометрии, что шапка модуля и «Повторение».
 *  Стоит на «Учёбе» и первым блоком ленты «Практики». */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { moduleBox } from './ModuleHeader';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function FragmentPanel({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={{ flex: 1 }}>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('game.overline')}</Txt>
        <Txt style={[st.title, { color: t.head }]}>{tr('game.title')}</Txt>
        <Txt style={[st.sub, { color: t.muted }]}>{tr('game.sub')}</Txt>
      </View>
      <Ionicons name="search-outline" size={18} color={t.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  box: moduleBox,
  overline: { fontSize: 8.5, letterSpacing: 2 }, // как у ReviewPanel
  title: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 }, // строка ReviewPanel
  sub: { fontSize: 12, marginTop: 2 },
});
