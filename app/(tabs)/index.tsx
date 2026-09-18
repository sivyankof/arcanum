/** Экран «Учёба» — первая вкладка (спека 72): следующий урок курса, «Повторение», игра «Угадай
 *  карту» и компактная строка карты дня. До задачи 72 первой вкладкой была карта дня (app/daily.tsx). */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyCardRow } from '../../src/components/DailyCardRow';
import { FadeUp } from '../../src/components/FadeUp';
import { FragmentPanel } from '../../src/components/FragmentPanel';
import { NextLessonCard } from '../../src/components/NextLessonCard';
import { ReviewPanel } from '../../src/components/ReviewPanel';
import { ScreenBg } from '../../src/components/ScreenBg';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { StatsPills } from '../../src/components/StatsPills';
import { cardById, course } from '../../src/lib/content';
import { nextLessonState, nextLessonSummary } from '../../src/lib/courseProgress';
import { formatEntryDate, localDateISO } from '../../src/lib/dates';
import { hapticTap } from '../../src/lib/haptics';
import { useLang } from '../../src/lib/i18n';
import { lessonLocked } from '../../src/lib/premium';
import { reflectionVisible } from '../../src/lib/reflection';
import { useNow } from '../../src/lib/useNow';
import { useReviewSummary } from '../../src/lib/useReviewSummary';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function LearnScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const scrollRef = useTabTopRef<ScrollView>();

  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const premium = useApp((s) => s.premium);
  const drawn = useApp((s) => s.todayDraw());
  const reflectionOn = useApp((s) => s.settings.reflectionOn);
  const devReflect = useApp((s) => s.devReflect);
  const reviewSum = useReviewSummary();

  // час (вечерняя рефлексия) и дата шапки — общий useNow (фокус таба и возврат из фона, правило 06а)
  const now = useNow();

  const summary = React.useMemo(() => nextLessonSummary(course, lessonsProgress), [lessonsProgress]);
  const state = nextLessonState(
    summary,
    !!summary.lesson && lessonLocked(summary.lesson.id, course, premium),
  );
  const onHero = () => {
    hapticTap();
    if (state === 'done') router.push({ pathname: '/review', params: { from: 'learn' } });
    else if (state === 'locked') router.push({ pathname: '/paywall', params: { from: 'learn' } });
    else router.push({ pathname: '/lesson/[id]', params: { id: summary.lesson!.id, from: 'learn' } });
  };

  const reflect =
    reflectionVisible({ drawn: !!drawn, hour: now.getHours(), enabled: reflectionOn, devForce: __DEV__ && devReflect }) &&
    !drawn?.outcome;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader overline={formatEntryDate(localDateISO(now), lang, 'long').toUpperCase()} title={tr('home.title')} />
        <StatsPills index={1} />
        <FadeUp index={2}>
          <NextLessonCard summary={summary} state={state} lang={lang} onPress={onHero} />
        </FadeUp>
        <FadeUp index={3} style={st.panels}>
          <ReviewPanel
            summary={reviewSum}
            onPress={() => {
              hapticTap();
              router.push({ pathname: '/review', params: { from: 'learn' } });
            }}
          />
          {/* зазор до «Карты дня» (12, как у ReviewPanel выше) — через style FragmentPanel:
              на «Практике» её сосед снизу несёт отступ сам (спека 72) */}
          <FragmentPanel
            style={{ marginBottom: spacing.m }}
            onPress={() => {
              hapticTap();
              router.push({ pathname: '/fragment', params: { from: 'learn' } });
            }}
          />
          <DailyCardRow
            card={drawn ? cardById.get(drawn.cardId) ?? null : null}
            reflect={reflect}
            lang={lang}
            onPress={() => {
              hapticTap();
              router.push({ pathname: '/daily', params: { from: 'learn' } });
            }}
          />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  panels: { marginTop: 12 },
});
