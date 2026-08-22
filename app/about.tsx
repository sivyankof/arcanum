/** Экран «О приложении» (спека 12): версия, дисклеймер, атрибуция колоды Райдер–Уэйт
 *  и источника карт (tarot-api), политика конфиденциальности — текстом внутри приложения
 *  (решение Артёма 14.08: лендинга с политикой ещё нет). Вход — строка в app/settings.tsx.
 *  Макета экрана в design-reference.html нет (хвост в задачу 15), композиция — по спеке. */
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Block, paragraphStyle } from '../src/components/Block';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { appVersion } from '../src/lib/appInfo';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

export default function AboutScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: tr('about.title'), headerBackTitle: tr('settings.title') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        {/* шапка-визитка: та же эмблема, что в онбординге (ticks={false} — контекст
            «представление приложения», не ритуал карты дня, у которой засечки есть) */}
        <FadeUp index={0} style={st.card}>
          <Emblem size={72} ticks={false} />
          <Txt style={[st.name, { color: t.head }]}>Arcanum</Txt>
          <Txt style={[st.version, { color: t.muted }]}>
            {tr('about.version', { v: appVersion() })}
          </Txt>
        </FadeUp>

        <FadeUp index={1}>
          <Block title={tr('about.appTitle')}>
            <Txt style={[paragraphStyle, { color: t.text, marginTop: 7 }]}>{tr('about.appText')}</Txt>
            <Txt style={[paragraphStyle, { color: t.muted, marginTop: spacing.m }]}>
              {tr('about.disclaimer')}
            </Txt>
          </Block>
        </FadeUp>

        <FadeUp index={2}>
          <Block title={tr('about.deckTitle')} text={tr('about.deckText')} />
        </FadeUp>

        <FadeUp index={3}>
          <Block title={tr('about.dataTitle')} text={tr('about.dataText')} />
        </FadeUp>

        <FadeUp index={4}>
          <Block title={tr('about.termsTitle')} text={tr('about.termsText')} />
        </FadeUp>

        <FadeUp index={5}>
          <Block title={tr('about.sourcesTitle')} text={tr('about.sourcesText')} />
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  card: { alignItems: 'center', marginTop: spacing.l },
  name: { fontFamily: fonts.displaySemi, fontSize: 22, marginTop: spacing.m },
  version: { fontSize: 13, marginTop: spacing.xs },
});
