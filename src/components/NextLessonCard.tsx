/** Герой экрана «Учёба» (спека 72): следующий урок курса — «МОДУЛЬ 1 · УРОК 1 ИЗ 32», название,
 *  полоса прогресса курса, CTA. Состояние и подписи приходят снаружи: компонент не знает ни про
 *  подписку, ни про маршруты. Геометрия панели — общий moduleBox (ModuleHeader, ReviewPanel). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { NextLessonState, NextLessonSummary } from '../lib/courseProgress';
import type { Lang } from '../lib/content';
import { inLang } from '../lib/lang';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CtaButton } from './CtaButton';
import { moduleBox } from './ModuleHeader';
import { PremiumBadge } from './PremiumBadge';
import { PROGRESS_EASE, PROGRESS_FILL_DELAY, PROGRESS_FILL_MS, ProgressBar } from './ProgressBar';
import { Txt } from './Txt';

const CTA_KEY: Record<NextLessonState, string> = {
  start: 'home.ctaStart',
  continue: 'home.ctaContinue',
  locked: 'home.ctaPremium',
  done: 'home.ctaReview',
};

export function NextLessonCard({
  summary,
  state,
  lang,
  onPress,
}: {
  summary: NextLessonSummary;
  state: NextLessonState;
  lang: Lang;
  onPress: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const fill = useSharedValue(0);
  React.useEffect(() => {
    // тайминг — эталон fill2 (тот же, что у LevelCard и панели прогресса «Карт»), не свой
    fill.value = withDelay(
      PROGRESS_FILL_DELAY,
      withTiming(summary.pct / 100, { duration: PROGRESS_FILL_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, summary.pct]);

  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={st.overlineRow}>
        <Txt style={[st.overline, { color: t.accent }]}>
          {summary.lesson
            ? tr('home.lessonOf', { m: summary.moduleIndex + 1, n: summary.lessonNumber, total: summary.total })
            : tr('course.title').toUpperCase()}
        </Txt>
        {state === 'locked' && <PremiumBadge style={st.badge} />}
      </View>
      <Txt style={[st.title, { color: t.head }]}>
        {summary.lesson ? inLang(summary.lesson.title, lang) : tr('home.courseDone')}
      </Txt>
      <View style={st.barRow}>
        <ProgressBar progress={fill} radius={3} style={st.bar} />
        <Txt style={[st.pct, { color: t.muted }]}>{summary.pct}%</Txt>
      </View>
      <CtaButton label={tr(CTA_KEY[state])} onPress={onPress} style={st.cta} />
    </View>
  );
}

const st = StyleSheet.create({
  // колонка, а не ряд moduleBox: у героя содержимое идёт сверху вниз
  box: { ...moduleBox, flexDirection: 'column', alignItems: 'stretch', gap: 0, marginTop: spacing.l },
  overlineRow: { flexDirection: 'row', alignItems: 'center' },
  overline: { fontSize: 9.5, letterSpacing: 2.5, fontWeight: '600' }, // как у ModuleHeader
  badge: { marginLeft: 8 },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, marginTop: 4 }, // Display M
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  bar: { flex: 1, height: 6 },
  pct: { fontSize: 13 },
  cta: { marginTop: 14 },
});
