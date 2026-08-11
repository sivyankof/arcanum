import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { PressableScale } from '../../src/components/PressableScale';
import { ScreenBg } from '../../src/components/ScreenBg';
import { course } from '../../src/lib/content';
import { hapticWarning } from '../../src/lib/haptics';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';
import { Txt } from '../../src/components/Txt';

// качание замка: ±8°, три раза, суммарно ~350 мс (пункт 13 motion-spec)
const SHAKE_STEP_MS = 58;

/** Строка урока. Закрытый урок на тап качает замком и отвечает предупреждающей вибрацией —
 *  отказ, который приятно трогать. Открытый пока не нажимается: движка уроков нет (этап 3 плана). */
function LessonRow({ title, locked }: { title: string; locked: boolean }) {
  const t = useTheme();
  const shake = useSharedValue(0);

  const onLockedPress = () => {
    hapticWarning();
    const step = (to: number) =>
      withTiming(to, { duration: SHAKE_STEP_MS, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System });
    shake.value = withSequence(step(1), step(-1), step(1), step(-1), step(1), step(0));
  };

  const lockStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 8}deg` }] }));

  const body = (
    <>
      <Txt style={{ color: t.text, fontSize: 13, flex: 1 }}>{title}</Txt>
      <Animated.View style={locked ? lockStyle : undefined}>
        <Ionicons name={locked ? 'lock-closed' : 'play'} size={13} color={locked ? t.muted : t.accent} />
      </Animated.View>
    </>
  );

  const style = [
    st.lesson,
    { backgroundColor: t.panel, borderColor: locked ? t.line : t.frame, opacity: locked ? 0.55 : 1 },
  ];

  if (!locked) return <View style={style}>{body}</View>;
  return (
    <PressableScale onPress={onLockedPress} style={style}>
      {body}
    </PressableScale>
  );
}

/** Экран курса — v0: модули и уроки списком.
 *  Этап 3 плана: «путь» как в Duolingo, движок уроков, XP, тесты. */
export default function CourseScreen() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const scrollRef = useTabTopRef<ScrollView>();

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
            {lang === 'ru' ? '6 МОДУЛЕЙ · 32 УРОКА' : '6 MODULES · 32 LESSONS'}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{lang === 'ru' ? 'Курс' : 'Course'}</Txt>
        </FadeUp>

        {course.map((m: any, mi: number) => (
          <FadeUp key={m.id} index={1 + mi} style={{ marginTop: spacing.xl }}>
            <View style={st.modHead}>
              <Txt style={[st.modTitle, { color: t.head }]}>
                {mi + 1}. {m.title[lang]}
              </Txt>
              {!m.free && <Ionicons name="lock-closed" size={13} color={t.muted} />}
            </View>
            {m.lessons.map((l: any, li: number) => (
              // пока открыт только первый урок первого модуля
              <LessonRow key={l.id} title={l.title[lang]} locked={!(mi === 0 && li === 0)} />
            ))}
          </FadeUp>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
  modHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.s },
  modTitle: { fontFamily: fonts.display, fontSize: 18 },
  lesson: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
});
