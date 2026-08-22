/** Шапка модуля на пути курса (эталон .mhead): overline «МОДУЛЬ N ИЗ 6» (+ замок на
 *  платных), название, счётчики уроков/карт, процент прохождения справа. Замок остаётся
 *  визуальным маркером «это платный модуль»; решает доступ подписка (спека 53) —
 *  `premiumLocked` приходит снаружи через `moduleLocked` и добавляет плашку «ПРЕМИУМ»
 *  и тап на пейвол (шапка открытого модуля по-прежнему не нажимается). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { CourseModule, Lang } from '../lib/content';
import { moduleCardCount, moduleProgress, type LessonProgressMap } from '../lib/courseProgress';
import { inLang } from '../lib/lang';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PremiumBadge } from './PremiumBadge';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function ModuleHeader({
  module: mod,
  index,
  total,
  progress,
  lang,
  premiumLocked,
  onPremiumPress,
}: {
  module: CourseModule;
  /** номер модуля, с нуля */
  index: number;
  total: number;
  progress: LessonProgressMap;
  lang: Lang;
  /** модуль недоступен без подписки (решает `moduleLocked` у вызывающего) */
  premiumLocked: boolean;
  onPremiumPress?: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { pct } = moduleProgress(mod, progress);
  const cards = moduleCardCount(mod);
  // у модулей без разбора карт (М1, М6) счётчик карт не показывается — «4 УРОКА · 0 КАРТ» враньё
  const counters =
    tr('course.lessons', { count: mod.lessons.length }) +
    (cards > 0 ? ` · ${tr('course.cardsCount', { count: cards })}` : '');
  // показ флага: замок говорит «модуль платный» и остаётся при активной подписке (так в эталоне);
  // доступ решает не он, а premiumLocked из moduleLocked (спека 53)
  const paid = !mod.free;

  const content = (
    <>
      <View style={{ flex: 1 }}>
        <View style={st.overlineRow}>
          <View style={st.overlineLeft}>
            <Txt style={[st.overline, { color: t.accent }]}>
              {tr('course.moduleOf', { n: index + 1, total })}
            </Txt>
            {paid && <Ionicons name="lock-closed" size={12} color={t.muted} />}
          </View>
          {/* отступ 8 — по эталону `.mh2 .lk{margin-left:8px}`, отдельно от gap группы слева */}
          {premiumLocked && <PremiumBadge style={st.badge} />}
        </View>
        <Txt style={[st.title, { color: t.head }]}>{inLang(mod.title, lang)}</Txt>
        <Txt style={[st.counters, { color: t.muted }]}>{counters}</Txt>
      </View>
      <Txt style={[st.pct, { color: t.accent }]}>{pct}%</Txt>
    </>
  );

  // открытая шапка не нажимается (как раньше); заперта подпиской — тап ведёт на пейвол
  if (premiumLocked) {
    return (
      <PressableScale
        onPress={onPremiumPress}
        style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}
      >
        {content}
      </PressableScale>
    );
  }
  return <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>{content}</View>;
}

/** Геометрия панели `.mhead` эталона — общая с карточкой «Повторение» над первым модулем (спека 45). */
export const moduleBox = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.m,
  borderWidth: 1,
  borderRadius: radius.l,
  paddingVertical: 14,
  paddingHorizontal: spacing.l,
} as const;

const st = StyleSheet.create({
  box: moduleBox,
  overlineRow: { flexDirection: 'row', alignItems: 'center' },
  overlineLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overline: { fontSize: 9.5, letterSpacing: 2.5, fontWeight: '600' },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
  counters: { fontSize: 11, letterSpacing: 1, fontWeight: '600', marginTop: 3 },
  pct: { fontSize: 14, fontWeight: '700' },
  badge: { marginLeft: 8 },
});
