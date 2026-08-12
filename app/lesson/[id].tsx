/** Заглушка урока (спека 07): маршрут, шапка и композиция настоящие, содержимое привезёт
 *  задача 08 (теория → викторина → результат). Открывается с узла пути курса. */
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeUp } from '../../src/components/FadeUp';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { course } from '../../src/lib/content';
import { useBackHaptic } from '../../src/lib/useBackHaptic';
import { fonts, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Урок и его позиция («МОДУЛЬ N · УРОК M») по id из маршрута. */
function findLesson(id: string | undefined) {
  for (let mi = 0; mi < course.length; mi++) {
    const li = course[mi].lessons.findIndex((l) => l.id === id);
    if (li >= 0) return { lesson: course[mi].lessons[li], mi, li };
  }
  return null;
}

export default function LessonScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const { id } = useLocalSearchParams<{ id: string }>();

  // вибрация на уходе с экрана — общий хук (второе появление паттерна card/[id])
  useBackHaptic();

  const found = findLesson(id);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.course') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // как card/[id]: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        {found && (
          <FadeUp index={0}>
            <Txt style={[st.overline, { color: t.muted }]}>
              {tr('course.lessonOverline', { m: found.mi + 1, l: found.li + 1 })}
            </Txt>
            <Txt style={[st.title, { color: t.head }]}>{found.lesson.title[lang]}</Txt>
          </FadeUp>
        )}
        <FadeUp index={1} style={{ marginTop: spacing.xl }}>
          <EmptyState text={tr('course.lessonPreparing')} />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  overline: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 26, textAlign: 'center', marginTop: 4 },
});
