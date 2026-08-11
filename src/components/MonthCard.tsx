/** Карточка месяца в шапке дневника (`.mcard` эталона, design-system §5): мини-карта +
 *  «КАРТА МЕСЯЦА» + самая частая карта с числом выпадений + строка статистики месяца.
 *  Строку «Отозвалось X из Y дней» и полоску распределения добавит задача 06 — до неё
 *  ответов рефлексии в записях нет. */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { cardById } from '../lib/content';
import type { MonthSummary } from '../lib/journal';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function MonthCard({
  summary,
  lang,
  onPress,
}: {
  summary: MonthSummary;
  lang: 'ru' | 'en';
  onPress: (cardId: string) => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  // «Карта месяца» имеет смысл только при повторе: с одним выпадением это просто случайная
  // карта из ленты, и подпись «КАРТА МЕСЯЦА · 1 раз» обещает закономерность, которой нет
  const card = summary.topCount > 1 && summary.topCardId ? cardById.get(summary.topCardId) : undefined;
  if (!card) return null;

  const stats = [
    tr('journal.entries', { count: summary.count }),
    summary.withNote > 0 ? tr('journal.withNote', { count: summary.withNote }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale
      onPress={() => onPress(card.id)}
      style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      <View style={[st.thumbClip, { borderColor: t.frame }]}>
        <Image source={cardImages[card.id]} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <View style={st.texts}>
        <Txt style={[st.overline, { color: t.accent }]}>{tr('journal.monthCard').toUpperCase()}</Txt>
        <Txt style={[st.name, { color: t.head }]}>
          {`${card.name[lang]} · ${tr('journal.times', { count: summary.topCount })}`}
        </Txt>
        <Txt style={[st.stats, { color: t.muted }]}>{stats}</Txt>
      </View>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.mcard`
    paddingVertical: spacing.m,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  thumbClip: { width: 38, height: 61, borderWidth: 1, borderRadius: 5, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  texts: { flex: 1 },
  overline: { fontSize: 8.5, letterSpacing: 2 },
  name: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 1 },
  stats: { fontSize: 10.5, marginTop: 1 },
});
