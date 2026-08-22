/** Онбординг первого запуска (спека 09): welcome → о вас → аркан рождения.
 *  Три шага живут в ОДНОМ экране: они делят состояние формы и точки-прогресс.
 *  Профиль пишется ТОЛЬКО финальной CTA (шаг 3, либо «ПРОДОЛЖИТЬ» при пропуске даты):
 *  приложение, закрытое посреди онбординга, начнёт его заново — осознанное решение спеки.
 *  Разрешение на пуши здесь НЕ спрашивается (правило 06б: прелюдия после первой карты дня). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { DatePicker } from '../src/components/DatePicker';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { birthArcanaId } from '../src/lib/birthArcana';
import { cardById, cardImages } from '../src/lib/content';
import { formatFullDate } from '../src/lib/dates';
import { hapticSuccess, hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { inLang } from '../src/lib/lang';
import { pingPong, startSpin } from '../src/lib/loops';
import { useApp } from '../src/store/useApp';
import { glowShadow } from '../src/theme/glow';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

const EMBLEM_SIZE = 110; // .emb2 svg эталона
const CARD_WIDTH = 165; // .reveal: 150 макета + масштаб рамы ~10%
const CARD_HEIGHT = Math.round((CARD_WIDTH * 518) / 300); // пропорция сканов assets/cards

export default function Onboarding() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useApp((s) => s.completeOnboarding);

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [name, setName] = React.useState('');
  const [birthDate, setBirthDate] = React.useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // эмблема шага 1 — вращение 40s (.emb2 эталона); цикл через loops.ts (ловушка withRepeat)
  const angle = useSharedValue(0);
  React.useEffect(() => {
    startSpin(angle, 40_000);
  }, [angle]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  // карта шага 3 — парение ±4px, полный цикл 4s (hov эталона); запуск при входе на шаг
  const hover = useSharedValue(0);
  const hoverStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hover.value }] }));

  const goStep = (next: 2 | 3) => {
    hapticTap();
    setStep(next);
    if (next === 3) {
      hover.value = -4;
      hover.value = pingPong(4, 2000);
      hapticSuccess(); // вау-момент: карта аркана появилась
    }
  };

  // Финал: профиль в стор одним куском. Дальше уводит САМ гард — expo-router, потеряв
  // текущий экран из навигатора, переходит на anchor (у нас initialRouteName '(tabs)').
  // ⚠️ Своего router.replace('/(tabs)') здесь быть НЕ должно: в момент вызова состояние
  // ещё не перерисовалось, маршрута (tabs) в навигаторе нет, и переход уходит в никуда.
  // По той же причине переход на страницу аркана откладывается на следующий тик — к нему
  // гард уже отработал и маршрут card/[id] существует.
  const finish = (cardId: string | null) => {
    completeOnboarding(name, birthDate ?? undefined);
    // «назад» со страницы карты ведёт на «Сегодня»: под ней лежит anchor, а не онбординг
    if (cardId) {
      setTimeout(() => router.push({ pathname: '/card/[id]', params: { id: cardId, from: 'today' } }), 0);
    }
  };

  const arcana = birthDate ? cardById.get(birthArcanaId(birthDate)) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* key={step}: новый шаг = свежий монтаж, FadeUp отыгрывает каскад заново */}
          <View key={step} style={st.step}>
            {step === 1 && (
              <>
                <FadeUp index={0}>
                  <Animated.View style={[st.emblem, spin]}>
                    {/* ticks={false} — у эмблемы онбординга (.emb2 эталона) засечек
                        по сторонам света нет, в отличие от рубашки карты (.emb) */}
                    <View style={glowShadow(t.glow, t.accent, 16, 0.35)}>
                      <Emblem size={EMBLEM_SIZE} ticks={false} />
                    </View>
                  </Animated.View>
                </FadeUp>
                <FadeUp index={1}>
                  <Txt style={[st.h1, { color: t.head }]}>Arcanum</Txt>
                </FadeUp>
                <FadeUp index={2}>
                  <Txt style={[st.lead, { color: t.muted }]}>{tr('ob.sub')}</Txt>
                </FadeUp>
                <FadeUp index={3} style={st.ctaWrap}>
                  <CtaButton label={tr('ob.start')} onPress={() => goStep(2)} />
                  {/* дисклеймер первого шага (release-checklist, спека 54): в макете v-onboarding
                      его нет — решение Д3, дорисовка макета отложена в бэклог */}
                  <Txt style={[st.disclaimer, { color: t.muted }]}>{tr('ob.disclaimer')}</Txt>
                </FadeUp>
              </>
            )}

            {step === 2 && (
              <>
                <FadeUp index={0}>
                  <Txt style={[st.h2, { color: t.head }]}>{tr('ob.aboutTitle')}</Txt>
                </FadeUp>
                <FadeUp index={1}>
                  <Txt style={[st.lead, { color: t.muted }]}>{tr('ob.aboutLead')}</Txt>
                </FadeUp>
                <FadeUp index={2} style={st.fieldWrap}>
                  <View style={[st.field, { backgroundColor: t.panel, borderColor: t.line }]}>
                    <Txt style={[st.fieldLabel, { color: t.accent }]}>{tr('ob.nameLabel')}</Txt>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={tr('ob.namePlaceholder')}
                      placeholderTextColor={t.muted}
                      autoCorrect={false}
                      returnKeyType="done"
                      style={[st.fieldInput, { color: t.head }]}
                    />
                  </View>
                </FadeUp>
                <FadeUp index={3} style={st.fieldWrap}>
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    style={[st.field, { backgroundColor: t.panel, borderColor: t.line }]}
                  >
                    <Txt style={[st.fieldLabel, { color: t.accent }]}>{tr('ob.birthLabel')}</Txt>
                    <Txt style={[st.fieldValue, { color: birthDate ? t.head : t.muted }]}>
                      {birthDate ? formatFullDate(birthDate, lang) : tr('ob.birthPlaceholder')}
                    </Txt>
                  </Pressable>
                </FadeUp>
                {/* дата выбрана → к аркану; нет → «ПРОДОЛЖИТЬ» = «пропустить» из product-spec §0 */}
                <FadeUp index={4} style={st.ctaWrap}>
                  <CtaButton
                    label={tr(birthDate ? 'ob.openArcana' : 'ob.continue')}
                    onPress={() => (birthDate ? goStep(3) : finish(null))}
                  />
                </FadeUp>
              </>
            )}

            {step === 3 && arcana && (
              <>
                <FadeUp index={0}>
                  <Txt style={[st.overline, { color: t.accent }]}>{tr('ob.birthOverline')}</Txt>
                </FadeUp>
                <FadeUp index={1}>
                  <Animated.View
                    style={[
                      st.reveal,
                      { borderColor: t.frame, boxShadow: `0px 20px 50px ${t.glow}` },
                      hoverStyle,
                    ]}
                  >
                    <Image
                      source={cardImages[arcana.id]}
                      style={st.revealImg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </Animated.View>
                </FadeUp>
                <FadeUp index={2}>
                  <Txt style={[st.cardName, { color: t.head }]}>{inLang(arcana.name, lang)}</Txt>
                </FadeUp>
                <FadeUp index={3}>
                  <Txt style={[st.lead, { color: t.muted }]}>
                    {arcana.content['birth_path'] ? inLang(arcana.content['birth_path'], lang) : ''}
                  </Txt>
                </FadeUp>
                <FadeUp index={4} style={st.ctaWrap}>
                  <CtaButton label={tr('ob.learnMore')} onPress={() => finish(arcana.id)} />
                </FadeUp>
              </>
            )}

            <View style={st.dots}>
              {([1, 2, 3] as const).map((n) => (
                <View
                  key={n}
                  style={[
                    st.dot,
                    { backgroundColor: n === step ? t.accent : t.line },
                    n === step && st.dotOn,
                  ]}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePicker
        visible={pickerOpen}
        value={birthDate}
        title={tr('ob.pickTitle')}
        onPick={setBirthDate}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  step: { flex: 1, alignItems: 'center' },
  emblem: { marginTop: 40, marginBottom: 30 },
  h1: { fontFamily: fonts.display, fontSize: 32, textAlign: 'center' },
  h2: { fontFamily: fonts.display, fontSize: 26, marginTop: 30, textAlign: 'center' },
  lead: { fontSize: 14, lineHeight: 24, textAlign: 'center', marginTop: 12, maxWidth: 270 },
  disclaimer: { fontSize: 11.5, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8, marginTop: 12 },
  fieldWrap: { width: '100%' },
  field: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 12 },
  fieldLabel: { fontSize: 9, letterSpacing: 2 },
  fieldValue: { fontFamily: fonts.display, fontSize: 16, marginTop: 3 },
  fieldInput: { fontFamily: fonts.display, fontSize: 16, marginTop: 3, padding: 0 },
  overline: { fontSize: 10, letterSpacing: 2, marginTop: 8 },
  reveal: { marginTop: 26, marginBottom: 16, borderWidth: 1, borderRadius: 12 },
  revealImg: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 12 },
  cardName: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center' },
  ctaWrap: { width: '100%', marginTop: 'auto' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
});
