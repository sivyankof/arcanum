/** Строка дневника (`.jrow` эталона, design-system §5): мини-карта + дата + первая строка
 *  заметки. Тап — на страницу карты, долгий тап по СЕГОДНЯШНЕЙ записи — на экран заметки
 *  (прошлые фиксируются в полночь, logic-spec §3). Справа — отметка рефлексии, если на день дан ответ. */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { formatEntryDate } from '../lib/dates';
import { hapticTap } from '../lib/haptics';
import { OUTCOME_COLOR, OUTCOME_MARK, type DailyDraw } from '../lib/journal';
import type { Lang } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function JournalRow({
  entry,
  lang,
  onPress,
  onEdit,
}: {
  entry: DailyDraw;
  lang: Lang;
  onPress: () => void;
  /** Не задан — запись прошлых дней, правка запрещена. */
  onEdit?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={
        onEdit &&
        (() => {
          hapticTap();
          onEdit();
        })
      }
      style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      <View style={[st.thumbClip, { borderColor: t.frame }]}>
        <Image source={cardImages[entry.cardId]} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <View style={st.texts}>
        <Txt style={[st.date, { color: t.muted }]}>{formatEntryDate(entry.date, lang).toUpperCase()}</Txt>
        <Txt numberOfLines={1} style={[st.note, { color: entry.note ? t.text : t.muted }]}>
          {entry.note ?? tr('journal.noNote')}
        </Txt>
      </View>
      {entry.outcome && (
        <Txt style={[st.mark, { color: t[OUTCOME_COLOR[entry.outcome]] }]}>
          {OUTCOME_MARK[entry.outcome]}
        </Txt>
      )}
    </PressableScale>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: radius.m + 1, // 13 — как `.jrow`
    paddingVertical: 9,
    paddingHorizontal: spacing.m,
    marginTop: spacing.s,
  },
  thumbClip: { width: 30, height: 48, borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  texts: { flex: 1 },
  date: { fontSize: 9, letterSpacing: 1.5 },
  note: { fontSize: 12, marginTop: 1 },
  mark: { fontSize: 12 },
});
