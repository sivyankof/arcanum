import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { ScreenBg } from '../../src/components/ScreenBg';
import { spreads } from '../../src/lib/content';
import { useLang } from '../../src/lib/i18n';
import { inLang } from '../../src/lib/lang';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';
import { Txt } from '../../src/components/Txt';

/** Каталог раскладов — v0: список. Этап 5 плана: режим «разложить» с сохранением в дневник. */
export default function SpreadsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
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
          <Txt style={[st.sub, { color: t.muted }]}>{tr('spreads.overline')}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('spreads.title')}</Txt>
        </FadeUp>

        {spreads.map((s: any, si: number) => (
          <FadeUp key={s.id} index={1 + si} style={[st.item, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={{ flex: 1 }}>
              <Txt style={[st.name, { color: t.head }]}>{inLang(s.name, lang)}</Txt>
              <Txt style={[st.desc, { color: t.muted }]}>
                {tr('spreads.cards', { count: s.cards })} · {inLang(s.description, lang)}
              </Txt>
            </View>
            {!s.free && (
              <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                <Txt style={{ color: t.accent, fontSize: 8.5, letterSpacing: 1.2, fontWeight: '700' }}>
                  {tr('spreads.premium')}
                </Txt>
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
