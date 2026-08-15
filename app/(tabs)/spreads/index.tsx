/** Каталог раскладов (product-spec §4): панель `.sp` = мини-схема позиций + имя + описание + PREMIUM.
 *  Тап — экран расклада во вложенном стеке этого таба (спека 36); «Карта дня» ведёт на «Сегодня». */
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../../src/components/FadeUp';
import { PressableScale } from '../../../src/components/PressableScale';
import { ScreenBg } from '../../../src/components/ScreenBg';
import { SpreadDiagram } from '../../../src/components/SpreadDiagram';
import { Txt } from '../../../src/components/Txt';
import { spreads, type Spread } from '../../../src/lib/content';
import { hapticTap } from '../../../src/lib/haptics';
import { useLang } from '../../../src/lib/i18n';
import { inLang } from '../../../src/lib/lang';
import { useTabTopRef } from '../../../src/lib/useTabScrollToTop';
import { fonts, spacing } from '../../../src/theme/theme';
import { useTheme } from '../../../src/theme/useTheme';

export default function SpreadsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const scrollRef = useTabTopRef<ScrollView>();

  const open = (s: Spread) => {
    hapticTap();
    // «Карта дня» раскладом не играется — это ритуал главного экрана (product-spec §4)
    if (s.id === 'card-of-day') router.navigate('/');
    else router.push({ pathname: '/spreads/[id]', params: { id: s.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.sub, { color: t.muted }]}>{tr('spreads.overline')}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('spreads.title')}</Txt>
        </FadeUp>

        {spreads.map((s, si) => (
          <FadeUp key={s.id} index={1 + si}>
            <PressableScale onPress={() => open(s)} style={[st.item, { backgroundColor: t.panel, borderColor: t.line }]}>
              <SpreadDiagram spreadId={s.id} />
              <View style={st.tx}>
                <Txt style={[st.name, { color: t.head }]}>{inLang(s.name, lang)}</Txt>
                <Txt style={[st.desc, { color: t.muted }]}>
                  {tr('spreads.cards', { count: s.cards })} · {inLang(s.description, lang)}
                </Txt>
              </View>
              {!s.free && (
                <View style={[st.badge, { borderColor: t.frame, backgroundColor: t.chipBg }]}>
                  <Txt style={{ color: t.accent, fontSize: 8.5, letterSpacing: 1.5, fontWeight: '700' }}>
                    {tr('spreads.premium')}
                  </Txt>
                </View>
              )}
            </PressableScale>
          </FadeUp>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
  // `.sp` эталона: radius 17, паддинг 15×17, отступ 12, ряд gap 14
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 17,
    paddingVertical: 15,
    paddingHorizontal: 17,
    marginTop: 12,
  },
  tx: { flex: 1 },
  name: { fontFamily: fonts.displaySemi, fontSize: 17 }, // `.sp .tx b`
  desc: { fontSize: 10, lineHeight: 15, marginTop: 3 }, // `.sp .tx small`
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
