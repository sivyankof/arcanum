import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { ScreenBg } from '../../src/components/ScreenBg';
import { spreads } from '../../src/lib/content';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Каталог раскладов — v0: список. Этап 5 плана: режим «разложить» с сохранением в дневник. */
export default function SpreadsScreen() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Text style={[st.sub, { color: t.muted }]}>{lang === 'ru' ? 'ПРАКТИКА' : 'PRACTICE'}</Text>
          <Text style={[st.title, { color: t.head }]}>{lang === 'ru' ? 'Расклады' : 'Spreads'}</Text>
        </FadeUp>

        {spreads.map((s: any, si: number) => (
          <FadeUp key={s.id} index={1 + si} style={[st.item, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[st.name, { color: t.head }]}>{s.name[lang]}</Text>
              <Text style={[st.desc, { color: t.muted }]}>
                {s.cards} {lang === 'ru' ? 'карт' : 'cards'} · {s.description[lang]}
              </Text>
            </View>
            {!s.free && (
              <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                <Text style={{ color: t.accent, fontSize: 8.5, letterSpacing: 1.2, fontWeight: '700' }}>PREMIUM</Text>
              </View>
            )}
          </FadeUp>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.l,
    marginTop: spacing.m,
  },
  name: { fontFamily: fonts.display, fontSize: 18 },
  desc: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
