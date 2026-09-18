/** Экран «Учёба» — первая вкладка (спека 72): следующий урок курса, «Повторение», игра «Угадай
 *  карту» и компактная строка карты дня. До задачи 72 первой вкладкой была карта дня (app/daily.tsx). */
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyCardRow } from '../../src/components/DailyCardRow';
import { FadeUp } from '../../src/components/FadeUp';
import { NextLessonCard } from '../../src/components/NextLessonCard';
import { ReviewPanel } from '../../src/components/ReviewPanel';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { StatsPills } from '../../src/components/StatsPills';
import { Txt } from '../../src/components/Txt';
import { cardById, course } from '../../src/lib/content';
import { nextLessonState, nextLessonSummary } from '../../src/lib/courseProgress';
import { formatEntryDate, localDateISO } from '../../src/lib/dates';
import { useLang } from '../../src/lib/i18n';
import { lessonLocked } from '../../src/lib/premium';
import { reflectionVisible } from '../../src/lib/reflection';
import { useAppActive } from '../../src/lib/useAppActive';
import { useReviewSummary } from '../../src/lib/useReviewSummary';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, spacing } from '../../src/theme/theme';
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

  // час (вечерняя рефлексия) и дата шапки — по фокусу таба и по возврату из фона (правило 06а)
  const [now, setNow] = React.useState(() => new Date());
  useFocusEffect(React.useCallback(() => setNow(new Date()), []));
  useAppActive(() => setNow(new Date()));

  const summary = React.useMemo(() => nextLessonSummary(course, lessonsProgress), [lessonsProgress]);
  const state = nextLessonState(
    summary,
    !!summary.lesson && lessonLocked(summary.lesson.id, course, premium),
  );
  const onHero = () => {
    if (state === 'done') router.push('/review');
    else if (state === 'locked') router.push({ pathname: '/paywall', params: { from: 'course' } });
    else router.push(`/lesson/${summary.lesson!.id}`);
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
        <FadeUp index={0}>
          <Txt style={[st.date, { color: t.muted }]}>
            {formatEntryDate(localDateISO(now), lang, 'long').toUpperCase()}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('home.title')}</Txt>
          <Rule />
        </FadeUp>
        <StatsPills index={1} />
        <FadeUp index={2}>
          <NextLessonCard summary={summary} state={state} lang={lang} onPress={onHero} />
        </FadeUp>
        <FadeUp index={3} style={st.panels}>
          <ReviewPanel summary={reviewSum} onPress={() => router.push('/review')} />
          {/* панель игры «Угадай карту» встаёт сюда задачей 12 плана */}
          <DailyCardRow
            card={drawn ? cardById.get(drawn.cardId) ?? null : null}
            reflect={reflect}
            lang={lang}
            onPress={() => router.push('/daily')}
          />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  date: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
  panels: { marginTop: 12 },
});
