/** Экран курса — «путь» как в Duolingo (спека 07): все 6 модулей одной лентой,
 *  шапка модуля + тропа-змейка. Узлы ведут в урок (спека 08); над первым модулем — карточка
 *  «Повторение» (спека 45). */
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoursePath } from '../../src/components/CoursePath';
import { FadeUp } from '../../src/components/FadeUp';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { ReviewPanel } from '../../src/components/ReviewPanel';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { course, type CourseLesson } from '../../src/lib/content';
import { lessonStates } from '../../src/lib/courseProgress';
import { localDateISO } from '../../src/lib/dates';
import { useLang } from '../../src/lib/i18n';
import { deckOrder, reviewSummary } from '../../src/lib/review';
import { useAppActive } from '../../src/lib/useAppActive';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function CourseScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const scrollRef = useTabTopRef<ScrollView>();
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const srs = useApp((s) => s.srs);
  const reviewDay = useApp((s) => s.reviewDay);
  // день для сводки повторения: по фокусу таба И по возврату из фона — useFocusEffect не ловит ни
  // полночь, ни сворачивание (урок 06а), а таб «Курс» может остаться открытым с вечера: утром
  // «ждут» должны появиться без переключения табов
  const [today, setToday] = React.useState(() => localDateISO());
  useFocusEffect(React.useCallback(() => setToday(localDateISO()), []));
  useAppActive(() => setToday(localDateISO()));
  const reviewSum = React.useMemo(
    () => reviewSummary(deckOrder(course, lessonsProgress), srs, today, reviewDay),
    [lessonsProgress, srs, reviewDay, today],
  );

  const states = React.useMemo(() => lessonStates(course, lessonsProgress), [lessonsProgress]);
  const lessonsTotal = course.reduce((n, m) => n + m.lessons.length, 0);
  const chipLabel = tr('course.startLesson');

  // Автоскролл к модулю с текущим уроком — один раз, при первом открытии таба.
  // Позиции секций приходят из onLayout в произвольном порядке, поэтому пробуем после
  // каждого замера: сработает, как только измерена именно нужная секция.
  const currentModule = course.findIndex((m) => m.lessons.some((l) => states[l.id] === 'current'));
  const sectionYs = React.useRef<(number | undefined)[]>([]);
  const scrolled = React.useRef(false);
  const onSectionLayout = (index: number, y: number) => {
    sectionYs.current[index] = y;
    if (scrolled.current || currentModule <= 0) return; // первый модуль и так наверху
    const target = sectionYs.current[currentModule];
    if (target === undefined) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, target - spacing.m), animated: false });
  };

  const openLesson = (l: CourseLesson) => router.push(`/lesson/${l.id}`);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.sub, { color: t.muted }]}>
            {`${tr('course.modules', { count: course.length })} · ${tr('course.lessons', { count: lessonsTotal })}`}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('course.title')}</Txt>
          <Rule />
        </FadeUp>

        {course.map((m, mi) => {
          const section = (
            <>
              <ModuleHeader module={m} index={mi} total={course.length} progress={lessonsProgress} lang={lang} />
              <CoursePath module={m} states={states} lang={lang} chipLabel={chipLabel} onLessonPress={openLesson} />
            </>
          );
          return (
            <View
              key={m.id}
              style={mi === 0 ? { marginTop: spacing.l } : undefined}
              onLayout={(e) => onSectionLayout(mi, e.nativeEvent.layout.y)}
            >
              {/* каскад — шапка экрана и только первая секция: глубже первого экрана
                  появление не анимируется (правило задачи 17) */}
              {mi === 0 ? (
                <FadeUp index={1}>
                  {/* карточка «Повторение» (спека 45) — над первым модулем, в ТОМ ЖЕ шаге каскада:
                      нового индекса FadeUp не добавляем (design-system §5) */}
                  <ReviewPanel summary={reviewSum} onPress={() => router.push('/review')} />
                  {section}
                </FadeUp>
              ) : (
                section
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
});
