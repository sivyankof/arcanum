/** Экран Arcanum Premium (спеки 53, 62, 53б): три состояния — «активна» (панель с тарифом
 *  и продлением + «Управлять»), «тарифы» (предложения магазина + CTA) и «скоро» (предложений
 *  нет: без SDK покупок в 53а/62 или магазин не ответил в 53б — панель без цифр и кнопки).
 *  У «Управлять подпиской» и «Восстановить» — свой диалог на ответ магазина (недоступно /
 *  ошибка / подписки нет, DIALOG_TEXT). Маршрут корневого стека под гардом онбординга
 *  (app/_layout.tsx). Композиция — макет v-paywall (состояния А/Б/В). */
import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { CtaButton } from '../src/components/CtaButton';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { LinkTxt } from '../src/components/LinkTxt';
import { PremiumBadge } from '../src/components/PremiumBadge';
import { PressableScale } from '../src/components/PressableScale';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { PRIVACY_URL, TERMS_URL } from '../src/lib/appInfo';
import { formatFullDate } from '../src/lib/dates';
import { hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { getOffers, manageUrl, purchase, PURCHASES_AVAILABLE, restore, type Offer, type PlanId } from '../src/lib/purchases';
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

/** Тексты диалога по ответу магазина (спека 53б): нет магазина / не ответил / подписки нет. */
const DIALOG_TEXT = {
  unavailable: { title: 'paywall.unavailableTitle', text: 'paywall.unavailableText' },
  error: { title: 'paywall.errorTitle', text: 'paywall.errorText' },
  none: { title: 'paywall.restoreNoneTitle', text: 'paywall.restoreNoneText' },
} as const;
type DialogKind = keyof typeof DIALOG_TEXT;

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

  // null — предложения ещё не запрошены (первый кадр), [] — их нет (без SDK покупок в 53а/62;
  // магазин не ответил в 53б) → панель «скоро», непустой — тарифы + CTA. Различать «ещё не
  // запрошено» и «нет» обязательно: иначе в 53б первый кадр мигнул бы панелью «скоро» до
  // ответа магазина (класс «нет данных» ≠ «нет совпадений», урок 46)
  const [offers, setOffers] = React.useState<Offer[] | null>(null);
  const [plan, setPlan] = React.useState<PlanId>('year');
  // один диалог на три ответа магазина; вид хранится отдельно от «открыт», чтобы текст не
  // пропадал на кадре закрытия
  const [dialog, setDialog] = React.useState<DialogKind>('unavailable');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const showDialog = (kind: DialogKind) => {
    setDialog(kind);
    setDialogOpen(true);
  };
  React.useEffect(() => {
    let alive = true;
    // реджект = «предложений нет»: без этого сбой магазина в 53б оставил бы offers === null
    // навсегда, то есть пустой слот вместо панели «скоро» (заглушка 62 реджектить не умеет)
    getOffers()
      .then((o) => alive && setOffers(o))
      .catch(() => alive && setOffers([]));
    return () => {
      alive = false;
    };
  }, []);

  const chosen = offers?.find((o) => o.id === plan);
  const noOffers = offers !== null && offers.length === 0;
  // один обработчик на покупку и восстановление: успех — право в стор; закрытый лист оплаты
  // (cancelled) — тишина; unavailable / error / none — свой диалог (спека 53б, решение 10)
  const run = async (action: () => ReturnType<typeof purchase>) => {
    const r = await action();
    if (r.ok) setPremium(r.premium);
    else if (r.reason !== 'cancelled') showDialog(r.reason);
  };

  const benefits = ['b1', 'b2', 'b3', 'b4'] as const;

  // «Восстановить покупки» живёт ВНУТРИ каждого состояния, как `.trlink` внутри #pwOff/#pwOn
  // макета; в состоянии «скоро» — только когда есть SDK магазина (53б): без него
  // восстанавливать нечего, а тап вёл бы в диалог-заглушку (спека 62, Д3). В 53б при пустых
  // предложениях ссылка нужна: восстановление права не зависит от витрины
  const restoreLink = (
    <Pressable onPress={() => run(restore)} hitSlop={8}>
      <Txt style={[st.link, { color: t.accent }]}>{tr('paywall.restore')}</Txt>
    </Pressable>
  );

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
            <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }]}>
              {/* тариф из магазина (53б); без плана (DEV) — нейтральный заголовок 53а */}
              <Txt style={[st.panelTitle, { color: t.head }]}>
                {premium.plan === 'year'
                  ? tr('paywall.activeYear')
                  : premium.plan === 'month'
                    ? tr('paywall.activeMonth')
                    : tr('paywall.activeTitle')}
              </Txt>
              {/* «Продлится» — только при включённом продлении; отменённая, но действующая —
                  «Действует до» (иначе панель врала бы, спека 53б, решение 9). Развилка ведётся
                  ПО ИСТОЧНИКУ, а не по наличию даты: `until: null` у `source: 'store'` — законное
                  бессрочное промо-право из консоли магазина (toPremium/purchasesMap.ts), а не
                  DEV-тумблер, — такому праву нейтральный «Подписка активна», а не «DEV-режим». */}
              <Txt style={[st.panelSub, { color: t.muted }]}>
                {premium.source !== 'store'
                  ? tr('paywall.activeDev')
                  : premium.until
                    ? tr(premium.willRenew ? 'paywall.activeUntil' : 'paywall.activeExpires', {
                        date: formatFullDate(premium.until, lang),
                      })
                    : tr('paywall.activeTitle')}
              </Txt>
            </View>
            <PressableScale
              onPress={() => {
                hapticTap();
                // страница подписок магазина (managementURL SDK или страница платформы);
                // null — магазина нет (Expo Go) → прежний диалог «Пока недоступно»
                manageUrl()
                  .then((url) => (url ? Linking.openURL(url) : showDialog('unavailable')))
                  .catch(() => showDialog('error'));
              }}
              style={[st.secondary, { borderColor: t.line }]}
            >
              <Txt style={[st.secondaryText, { color: t.head }]}>{tr('paywall.manage')}</Txt>
            </PressableScale>
            {restoreLink}
          </FadeUp>
        ) : (
          <FadeUp index={2} style={{ marginTop: 14 }}>
            {/* обёртка смонтирована всегда, меняется только содержимое (урок 39: условные
                блоки FadeUp дают мини-каскад при каждом возврате) */}
            {offers === null ? null : noOffers ? (
              // состояние В «скоро» (спека 62; макет `#pwSoon`): та же панель, что «активна»,
              // ни цифр, ни кнопки, ни диалога
              <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.panelTitle, { color: t.head }]}>{tr('paywall.soonTitle')}</Txt>
                <Txt style={[st.panelSub, { color: t.muted }]}>{tr('paywall.soonSub')}</Txt>
              </View>
            ) : (
              <>
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
                        {o.discountPct !== undefined && (
                          <PremiumBadge label={tr('paywall.discount', { pct: o.discountPct })} style={st.planBadge} solid />
                        )}
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
              </>
            )}
            {noOffers ? PURCHASES_AVAILABLE && restoreLink : offers !== null && restoreLink}
          </FadeUp>
        )}

        {/* ссылки условий — вне состояний: Apple 3.1.2 требует их на экране подписки всегда
            (спека 62, Д3); в макете `.pwlegal` отстоит от предыдущего блока на свои 14 */}
        <FadeUp index={3}>
          <Txt style={[st.legal, { color: t.muted }]}>
            {tr('paywall.legal')}{' '}
            <LinkTxt href={TERMS_URL}>{tr('paywall.terms')}</LinkTxt>
            {' · '}
            <LinkTxt href={PRIVACY_URL}>{tr('paywall.privacy')}</LinkTxt>
          </Txt>
        </FadeUp>
      </ScrollView>

      <ConfirmDialog
        visible={dialogOpen}
        title={tr(DIALOG_TEXT[dialog].title)}
        message={tr(DIALOG_TEXT[dialog].text)}
        confirmLabel={tr('paywall.ok')}
        confirmTone="accent"
        onConfirm={() => setDialogOpen(false)}
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
