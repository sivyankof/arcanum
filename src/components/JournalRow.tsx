/** Строка дневника (`.jrow` эталона, design-system §5). Два вида записи (спека 36):
 *  день — мини-карта + дата + первая строка заметки, справа отметка рефлексии; тап — страница карты,
 *  долгий тап по СЕГОДНЯШНЕЙ — экран заметки (прошлые фиксируются в полночь, logic-spec §3);
 *  расклад — рамка с веером карт (глиф таба «Карты», не эмодзи 🃏 из макета — правило задачи 16) +
 *  дата «· РАСКЛАД» + «Имя · «вопрос или заметка»», справа ✦; тап — просмотр расклада. */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { spreadById } from '../lib/content';
import { formatEntryDate } from '../lib/dates';
import { hapticTap } from '../lib/haptics';
import { OUTCOME_COLOR, OUTCOME_MARK, type JournalEntry } from '../lib/journal';
import { inLang, type Lang } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { TabIcon } from './TabIcons';
import { Txt } from './Txt';

export function JournalRow({
  item,
  lang,
  onPress,
  onEdit,
}: {
  item: JournalEntry;
  lang: Lang;
  onPress: () => void;
  /** Только у сегодняшней записи дня; у раскладов и прошлых дней не задан. */
  onEdit?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  if (item.kind === 'spread') {
    const s = item.entry;
    const name = inLang(spreadById.get(s.spreadId)?.name ?? { ru: s.spreadId, en: s.spreadId }, lang);
    const text = s.note || s.question;
    return (
      <PressableScale onPress={onPress} style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
        <View style={[st.thumbClip, st.fan, { borderColor: t.frame }]}>
          <TabIcon name="cards" color={t.accent} size={16} />
        </View>
        <View style={st.texts}>
          <Txt style={[st.date, { color: t.muted }]}>
            {`${formatEntryDate(s.date, lang).toUpperCase()} · ${tr('journal.spreadTag')}`}
          </Txt>
          <Txt numberOfLines={1} style={[st.note, { color: text ? t.text : t.muted }]}>
            {text ? `${name} · «${text}»` : name}
          </Txt>
        </View>
        {/* ✦ отсутствует в Manrope — обычный Text (правило Txt.tsx) */}
        <Text style={[st.mark, { color: t.accent }]}>✦</Text>
      </PressableScale>
    );
  }

  const entry = item.entry;
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
        <Txt style={[st.mark, { color: t[OUTCOME_COLOR[entry.outcome]] }]}>{OUTCOME_MARK[entry.outcome]}</Txt>
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
  fan: { alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '100%', height: '100%' },
  texts: { flex: 1 },
  date: { fontSize: 9, letterSpacing: 1.5 },
  note: { fontSize: 12, marginTop: 1 },
  mark: { fontSize: 12 },
});
