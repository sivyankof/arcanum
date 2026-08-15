/** Карточка месяца в шапке дневника (`.mcard` эталона, design-system §5): мини-карта +
 *  «КАРТА МЕСЯЦА» + самая частая карта с числом выпадений + строка статистики месяца +
 *  сводка вечерних рефлексий (строка «Отозвалось X из Y» и трёхсегментная полоска, задача 06а). */
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { cardImages } from '../lib/cardImages';
import { cardById } from '../lib/content';
import { OUTCOME_COLOR, type MonthSummary, type OutcomeStats } from '../lib/journal';
import type { Lang } from '../lib/lang';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function MonthCard({
  summary,
  stats,
  lang,
  onPress,
}: {
  summary: MonthSummary;
  stats: OutcomeStats | null;
  lang: Lang;
  onPress: (cardId: string) => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  // «Карта месяца» имеет смысл только при повторе: с одним выпадением это просто случайная
  // карта из ленты, и подпись «КАРТА МЕСЯЦА · 1 раз» обещает закономерность, которой нет
  const card = summary.topCount > 1 && summary.topCardId ? cardById.get(summary.topCardId) : undefined;
  const answered = stats?.answered ?? 0;
  // без карты месяца карточка всё равно нужна, если есть ответы: иначе сводка рефлексии
  // в таком месяце не покажется никогда
  if (!card && answered === 0) return null;

  const statsLine = [
    tr('journal.entries', { count: summary.count }),
    summary.withNote > 0 ? tr('journal.withNote', { count: summary.withNote }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale
      onPress={card ? () => onPress(card.id) : undefined}
      disabled={!card}
      style={[st.card, { backgroundColor: t.panel, borderColor: t.line }]}
    >
      {card && (
        <View style={[st.thumbClip, { borderColor: t.frame }]}>
          <Image source={cardImages[card.id]} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      )}
      <View style={st.texts}>
        {card && (
          <>
            <Txt style={[st.overline, { color: t.accent }]}>{tr('journal.monthCard').toUpperCase()}</Txt>
            <Txt style={[st.name, { color: t.head }]}>
              {`${card.name[lang]} · ${tr('journal.times', { count: summary.topCount })}`}
            </Txt>
          </>
        )}
        <Txt style={[st.stats, { color: t.muted }]}>{statsLine}</Txt>
        {stats && answered > 0 && (
          <>
            <Txt style={[st.stats, { color: t.muted }]}>
              {tr('journal.resonated', { n: stats.resonated, count: answered })}
            </Txt>
            {/* трёхсегментная полоска распределения (product-spec §5): доли ✓/≈/✗ за месяц.
                Единственная визуализация рефлексий в v1 — графиков и «процента точности» нет */}
            <View style={[st.bar, { backgroundColor: t.line }]}>
              <View style={{ flex: stats.yes, backgroundColor: t[OUTCOME_COLOR.yes] }} />
              <View style={{ flex: stats.partly, backgroundColor: t[OUTCOME_COLOR.partly] }} />
              <View style={{ flex: stats.no, backgroundColor: t[OUTCOME_COLOR.no] }} />
            </View>
          </>
        )}
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
  // тонкий трёхсегментный бар: сегменты встык, подложка line видна, когда доля нулевая
  bar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
});
