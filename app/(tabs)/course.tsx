import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { course } from '../../src/lib/content';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Экран курса — v0: модули и уроки списком.
 *  Этап 3 плана: «путь» как в Duolingo, движок уроков, XP, тесты. */
export default function CourseScreen() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.sub, { color: t.muted }]}>
          {lang === 'ru' ? '6 МОДУЛЕЙ · 32 УРОКА' : '6 MODULES · 32 LESSONS'}
        </Text>
        <Text style={[st.title, { color: t.head }]}>{lang === 'ru' ? 'Курс' : 'Course'}</Text>

        {course.map((m: any, mi: number) => (
          <View key={m.id} style={{ marginTop: spacing.xl }}>
            <View style={st.modHead}>
              <Text style={[st.modTitle, { color: t.head }]}>
                {mi + 1}. {m.title[lang]}
              </Text>
              {!m.free && <Ionicons name="lock-closed" size={13} color={t.muted} />}
            </View>
            {m.lessons.map((l: any, li: number) => {
              const locked = !m.free || li > (mi === 0 ? 0 : -1);
              const first = mi === 0 && li === 0;
              return (
                <View
                  key={l.id}
                  style={[
                    st.lesson,
                    { backgroundColor: t.panel, borderColor: first ? t.frame : t.line, opacity: locked && !first ? 0.55 : 1 },
                  ]}
                >
                  <Text style={{ color: t.text, fontSize: 13, flex: 1 }}>{l.title[lang]}</Text>
                  <Ionicons
                    name={first ? 'play' : 'lock-closed'}
                    size={13}
                    color={first ? t.accent : t.muted}
                  />
                </View>
              );
            })}
          </View>
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
