/** Шапка модуля на пути курса (эталон .mhead): overline «МОДУЛЬ N ИЗ 6» (+ замок на
 *  платных), название, счётчики уроков/карт, процент прохождения справа. Замок —
 *  визуальный маркер премиума: в v1 подписки нет, доступ гейтит только сквозной порядок. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { CourseModule, Lang } from '../lib/content';
import { moduleCardCount, moduleProgress, type LessonProgressMap } from '../lib/courseProgress';
import { inLang } from '../lib/lang';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

export function ModuleHeader({
  module: mod,
  index,
  total,
  progress,
  lang,
}: {
  module: CourseModule;
  /** номер модуля, с нуля */
  index: number;
  total: number;
  progress: LessonProgressMap;
  lang: Lang;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { pct } = moduleProgress(mod, progress);
  const cards = moduleCardCount(mod);
  // у модулей без разбора карт (М1, М6) счётчик карт не показывается — «4 УРОКА · 0 КАРТ» враньё
  const counters =
    tr('course.lessons', { count: mod.lessons.length }) +
    (cards > 0 ? ` · ${tr('course.cardsCount', { count: cards })}` : '');

  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={{ flex: 1 }}>
        <View style={st.overlineRow}>
          <Txt style={[st.overline, { color: t.muted }]}>
            {tr('course.moduleOf', { n: index + 1, total })}
          </Txt>
          {!mod.free && <Ionicons name="lock-closed" size={12} color={t.muted} />}
        </View>
        <Txt style={[st.title, { color: t.head }]}>{inLang(mod.title, lang)}</Txt>
        <Txt style={[st.counters, { color: t.muted }]}>{counters}</Txt>
      </View>
      <Txt style={[st.pct, { color: t.accent }]}>{pct}%</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    borderWidth: 1,
    borderRadius: radius.l,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
  },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: { fontSize: 9.5, letterSpacing: 2.5, fontWeight: '600' },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
  counters: { fontSize: 11, letterSpacing: 1, fontWeight: '600', marginTop: 3 },
  pct: { fontSize: 14, fontWeight: '700' },
});
