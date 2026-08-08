import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { ScreenBg } from '../../src/components/ScreenBg';
import { useApp } from '../../src/store/useApp';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

export default function ProfileScreen() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  const themeMode = useApp((s) => s.themeMode);
  const setThemeMode = useApp((s) => s.setThemeMode);
  const setLang = useApp((s) => s.setLang);
  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);
  const resetToday = useApp((s) => s.resetToday);

  const Row = ({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        st.row,
        { backgroundColor: t.panel, borderColor: t.line, opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={t.accent} />
      <Text style={{ color: t.text, fontSize: 14, flex: 1 }}>{label}</Text>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        <FadeUp index={0}>
          <Text style={[st.title, { color: t.head }]}>{lang === 'ru' ? 'Профиль' : 'Profile'}</Text>
        </FadeUp>

        <FadeUp index={1} style={st.stats}>
          <View style={[st.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
            <Text style={[st.statNum, { color: t.head }]}>{streak}</Text>
            <Text style={[st.statLbl, { color: t.muted }]}>{lang === 'ru' ? 'СЕРИЯ' : 'STREAK'}</Text>
          </View>
          <View style={[st.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
            <Text style={[st.statNum, { color: t.head }]}>{history.length}</Text>
            <Text style={[st.statLbl, { color: t.muted }]}>{lang === 'ru' ? 'КАРТ ДНЯ' : 'DAILY CARDS'}</Text>
          </View>
        </FadeUp>

        <FadeUp index={2}>
          <Row
            icon={themeMode === 'dark' ? 'moon' : 'sunny'}
            label={lang === 'ru' ? 'Тема' : 'Theme'}
            value={themeMode === 'dark' ? (lang === 'ru' ? 'Тёмная' : 'Dark') : lang === 'ru' ? 'Светлая' : 'Light'}
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
        </FadeUp>
        <FadeUp index={3}>
          <Row
            icon="language"
            label={lang === 'ru' ? 'Язык' : 'Language'}
            value={lang === 'ru' ? 'Русский' : 'English'}
            onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')}
          />
        </FadeUp>
        {__DEV__ && (
          <FadeUp index={4}>
            <Row
              icon="refresh"
              label={lang === 'ru' ? 'Сбросить карту дня' : 'Reset daily card'}
              value="DEV"
              onPress={resetToday}
            />
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xl, marginBottom: spacing.l },
  stat: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.l, paddingVertical: spacing.l },
  statNum: { fontFamily: fonts.display, fontSize: 30 },
  statLbl: { fontSize: 9, letterSpacing: 2, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.l,
    marginTop: spacing.s,
  },
});
