/** Онбординг первого запуска (спека 09, переработан спекой 72): welcome → как устроен курс.
 *  Два шага живут в ОДНОМ экране: они делят состояние формы и точки-прогресс.
 *  Профиль пишется ТОЛЬКО финальной CTA шага 2: приложение, закрытое посреди онбординга,
 *  начнёт его заново — осознанное решение спеки. Дата рождения сюда не входит (спека 72):
 *  она доступна из настроек и из приглашения в профиле, аркан рождения — в профиле.
 *  Разрешение на пуши здесь НЕ спрашивается (правило 06б: прелюдия после первой карты дня). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { Emblem } from '../src/components/Emblem';
import { FadeUp } from '../src/components/FadeUp';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { hapticTap } from '../src/lib/haptics';
import { startSpin } from '../src/lib/loops';
import { useApp } from '../src/store/useApp';
import { glowShadow } from '../src/theme/glow';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

const EMBLEM_SIZE = 110; // .emb2 svg эталона
const HOW_ICONS = ['school-outline', 'help-circle-outline', 'sync-outline'] as const; // Ionicons; sync-outline — тот же значок, что у панели «Повторение»

export default function Onboarding() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useApp((s) => s.completeOnboarding);

  const [step, setStep] = React.useState<1 | 2>(1);
  const [name, setName] = React.useState('');

  // эмблема шага 1 — вращение 40s (.emb2 эталона); цикл через loops.ts (ловушка withRepeat)
  const angle = useSharedValue(0);
  React.useEffect(() => {
    startSpin(angle, 40_000);
  }, [angle]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  const goStep = (next: 2) => {
    hapticTap();
    setStep(next);
  };

  // Финал: профиль в стор одним куском. Дальше уводит САМ гард — expo-router, потеряв
  // текущий экран из навигатора, переходит на anchor (первая вкладка «Учёба»).
  // ⚠️ Своего router.replace('/(tabs)') здесь быть НЕ должно: в момент вызова состояние
  // ещё не перерисовалось, маршрута (tabs) в навигаторе нет, и переход уходит в никуда.
  const finish = () => completeOnboarding(name);

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
                  <Txt style={[st.h2, { color: t.head }]}>{tr('ob.howTitle')}</Txt>
                </FadeUp>
                {(['ob.how1', 'ob.how2', 'ob.how3'] as const).map((key, i) => (
                  <FadeUp key={key} index={1 + i} style={st.fieldWrap}>
                    <View style={[st.how, { backgroundColor: t.panel, borderColor: t.line }]}>
                      <Ionicons name={HOW_ICONS[i]} size={18} color={t.accent} />
                      <Txt style={[st.howTxt, { color: t.text }]}>{tr(key)}</Txt>
                    </View>
                  </FadeUp>
                ))}
                <FadeUp index={4} style={st.fieldWrap}>
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
                <FadeUp index={5} style={st.ctaWrap}>
                  <CtaButton label={tr('ob.toCourse')} onPress={finish} />
                </FadeUp>
              </>
            )}

            <View style={st.dots}>
              {([1, 2] as const).map((n) => (
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
  fieldInput: { fontFamily: fonts.display, fontSize: 16, marginTop: 3, padding: 0 },
  how: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 12 },
  howTxt: { flex: 1, fontSize: 14, lineHeight: 20 },
  ctaWrap: { width: '100%', marginTop: 'auto' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
});
