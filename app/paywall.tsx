/** Экран Arcanum Premium (спека 53): два состояния — «не оформлено» (тарифы + CTA) и «активна».
 *  В 53а покупки недоступны (Expo Go): CTA/«Восстановить»/«Управлять» открывают диалог-объяснение,
 *  сам экран и гейты проверяются с DEV-тумблером в настройках. Маршрут корневого стека под
 *  гардом онбординга (app/_layout.tsx). Композиция — макет v-paywall. */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { CtaButton } from '../src/components/CtaButton';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { PremiumBadge } from '../src/components/PremiumBadge';
import { PressableScale } from '../src/components/PressableScale';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { formatFullDate } from '../src/lib/dates';
import { hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { getOffers, purchase, restore, type Offer, type PlanId } from '../src/lib/purchases';
import { useBackHaptic } from '../src/lib/useBackHaptic';
import { useApp } from '../src/store/useApp';
import { fonts, radius, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

/** Подпись «назад» по источнику перехода; неизвестный/пустой from — «Настройки». */
const BACK_TITLES: Record<string, string> = {
  settings: 'settings.title',
  course: 'tabs.course',
  spreads: 'tabs.spreads',
  moon: 'moon.title',
  review: 'review.title',
};

export default function PaywallScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  useBackHaptic();
  const premium = useApp((s) => s.premium);
  const setPremium = useApp((s) => s.setPremium);
  // откуда пришли — подпись кнопки «назад» (приём card/[id]: BACK_TITLES по параметру from)
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [plan, setPlan] = React.useState<PlanId>('year');
  const [unavailable, setUnavailable] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    getOffers().then((o) => alive && setOffers(o));
    return () => {
      alive = false;
    };
  }, []);

  const chosen = offers.find((o) => o.id === plan);
  // один обработчик на все три действия: результат 'unavailable' — диалог, успех — право в стор
  const run = async (action: () => ReturnType<typeof purchase>) => {
    const r = await action();
    if (r.ok) setPremium(r.premium);
    else if (r.reason === 'unavailable') setUnavailable(true);
  };

  const benefits = ['b1', 'b2', 'b3', 'b4'] as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr(BACK_TITLES[from ?? ''] ?? 'settings.title') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        <FadeUp index={0} style={st.head}>
          <Txt style={[st.overline, { color: t.muted }]}>{tr('paywall.overline')}</Txt>
          <Emblem size={56} ticks={false} />
          <View style={st.titleRow}>
            <Txt style={[st.title, { color: t.head }]}>{tr('paywall.title')}</Txt>
            {premium.active && <PremiumBadge label={tr('paywall.activeChip')} />}
          </View>
          <Txt style={[st.subtitle, { color: t.muted }]}>{tr('paywall.subtitle')}</Txt>
        </FadeUp>

        <FadeUp index={1} style={{ marginTop: spacing.l }}>
          {benefits.map((k) => (
            <View key={k} style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Txt style={[st.star, { color: t.accent }]}>✦</Txt>
              <Txt style={[st.rowText, { color: t.text }]}>{tr(`paywall.${k}`)}</Txt>
            </View>
          ))}
        </FadeUp>

        {premium.active ? (
          <FadeUp index={2} style={{ marginTop: 14 }}>
            {/* `.pwstate` макета: панель ДВЕ строки, выравнивание по левому краю (флаг 6а-0 —
                план рисовал одну центрированную строку с ключом paywall.activeLine, которого
                больше нет). Тарифа («годовая»/«месячная») в PremiumState 53а нет — первая строка
                нейтральная, тариф придёт из RevenueCat в 53б (решение Артёма 22.08) */}
            <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Txt style={[st.panelTitle, { color: t.head }]}>{tr('paywall.activeTitle')}</Txt>
              <Txt style={[st.panelSub, { color: t.muted }]}>
                {premium.source === 'store' && premium.until
                  ? tr('paywall.activeUntil', { date: formatFullDate(premium.until, lang) })
                  : tr('paywall.activeDev')}
              </Txt>
            </View>
            <PressableScale
              onPress={() => {
                hapticTap();
                setUnavailable(true); // 53б: deep link в подписки магазина
              }}
              style={[st.secondary, { borderColor: t.line }]}
            >
              <Txt style={[st.secondaryText, { color: t.head }]}>{tr('paywall.manage')}</Txt>
            </PressableScale>
          </FadeUp>
        ) : (
          <FadeUp index={2} style={{ marginTop: 14 }}>
            <View style={st.plans}>
              {offers.map((o) => {
                const on = o.id === plan;
                return (
                  <PressableScale
                    key={o.id}
                    onPress={() => {
                      hapticTap();
                      setPlan(o.id);
                    }}
                    style={[
                      st.plan,
                      { backgroundColor: on ? t.chipBg : t.panel, borderColor: on ? t.frame : t.line },
                    ]}
                  >
                    <Txt style={[st.planName, { color: t.head }]}>
                      {o.id === 'year' ? tr('paywall.planYear') : tr('paywall.planMonth')} · {o.price}
                    </Txt>
                    {o.perMonth && (
                      <Txt style={[st.planSub, { color: t.muted }]}>{tr('paywall.perMonth', { price: o.perMonth })}</Txt>
                    )}
                    {/* solid: бейдж сидит на верхней рамке карточки — сквозь полупрозрачный
                        chipBg она просвечивала полосой (лайв-проверка 22.08) */}
                    {o.discount && <PremiumBadge label={o.discount} style={st.planBadge} solid />}
                  </PressableScale>
                );
              })}
            </View>
            <CtaButton
              label={
                chosen
                  ? plan === 'year'
                    ? tr('paywall.ctaYear', { price: chosen.price })
                    : tr('paywall.ctaMonth', { price: chosen.price })
                  : tr('paywall.title')
              }
              disabled={!chosen}
              onPress={() => run(() => purchase(plan))}
            />
          </FadeUp>
        )}

        {/* отступа у обёртки нет: в макете «Восстановить покупки» лежит в том же блоке, что тарифы
            и CTA, и отстоит от кнопки ровно на свои 12 (`.trlink`) */}
        <FadeUp index={3}>
          <Pressable onPress={() => run(restore)} hitSlop={8}>
            <Txt style={[st.link, { color: t.accent }]}>{tr('paywall.restore')}</Txt>
          </Pressable>
          <Txt style={[st.legal, { color: t.muted }]}>
            {tr('paywall.legal')}{' '}
            <Txt style={{ color: t.accent }} onPress={() => router.push('/about')}>
              {tr('paywall.terms')}
            </Txt>
            {' · '}
            <Txt style={{ color: t.accent }} onPress={() => router.push('/about')}>
              {tr('paywall.privacy')}
            </Txt>
          </Txt>
        </FadeUp>
      </ScrollView>

      <ConfirmDialog
        visible={unavailable}
        title={tr('paywall.unavailableTitle')}
        message={tr('paywall.unavailableText')}
        confirmLabel={tr('paywall.ok')}
        confirmTone="accent"
        onConfirm={() => setUnavailable(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  head: { alignItems: 'center' },
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center', marginBottom: 10 }, // .date + отступ обёртки эмблемы
  // зазор эмблема → заголовок 8 (инлайн-стиль .h2 в макете перебивает его собственный margin-top 3);
  // сам заголовок отступа не несёт — иначе он съехал бы вниз относительно чипа «✦ АКТИВНА» в ряду
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  title: { fontFamily: fonts.display, fontSize: 28 }, // .h2
  subtitle: { fontSize: 12, lineHeight: 18.5, textAlign: 'center', marginTop: 8, paddingHorizontal: 6 },
  // панель преимущества — `.pwfeat` принятого макета: panel/line, радиус 14, паддинг 11×14, зазор 8
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 14, marginTop: 8 },
  star: { fontSize: 12, marginTop: 2 },
  rowText: { flex: 1, fontSize: 12.5, lineHeight: 19 },
  plans: { flexDirection: 'row', gap: 10 }, // `.plans`
  // `.plan` макета: радиус 16, паддинг 13×12, текст по центру; бейдж «−40 %» сверху по центру на −9px
  plan: { flex: 1, borderWidth: 1, borderRadius: radius.l, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', minHeight: 76 },
  planName: { fontFamily: fonts.displaySemi, fontSize: 15, textAlign: 'center' },
  planSub: { fontSize: 10, marginTop: 4, textAlign: 'center', lineHeight: 14.5 },
  planBadge: { position: 'absolute', top: -9, alignSelf: 'center' },
  // `.pwstate` макета: panel/line, радиус 16, паддинг 13×16, ДВЕ строки, выравнивание влево
  panel: { borderWidth: 1, borderRadius: radius.l, paddingVertical: 13, paddingHorizontal: 16 },
  panelTitle: { fontFamily: fonts.displaySemi, fontSize: 15 }, // .pwstate b
  panelSub: { fontSize: 10.5, marginTop: 4 }, // .pwstate small
  // `.cta2` макета: контур line, текст head, 12 / ls 1.6, паддинг 13, радиус 16
  secondary: { marginTop: 14, borderWidth: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  secondaryText: { fontSize: 12, letterSpacing: 1.6, fontWeight: '700' },
  link: { fontSize: 10.5, letterSpacing: 1, textAlign: 'center', marginTop: 12 }, // `.trlink`
  legal: { fontSize: 9.5, lineHeight: 15.2, textAlign: 'center', marginTop: 14, paddingHorizontal: 4 }, // `.pwlegal`
});
