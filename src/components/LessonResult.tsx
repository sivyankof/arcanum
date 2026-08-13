/** Финал урока (motion-spec §16, `.lresult` эталона): панель въезжает fade+up 500мс →
 *  хаптика Success → счётчик «+N XP» катится (55мс/шаг) → полоса прогресса модуля заполняется
 *  пружинной кривой (та же, что у XpPill) → конфетти вверх веером. Конфетти живёт ТОЛЬКО здесь
 *  (и позже в коллекции, этап 3+) — редкость сохраняет праздник.
 *  gained = 0 (повтор, +2 сегодня уже получены): счётчика нет — заголовок «Повторение пройдено».
 *  Reduce motion: счётчик мгновенный, конфетти не запускается (motion-spec §16). */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { hapticSuccess } from '../lib/haptics';
import { fonts, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CtaButton } from './CtaButton';
import { Sparks } from './Sparks';
import { Txt } from './Txt';

const ENTER_MS = 500; // въезд панели
const TICK_MS = 55; // шаг XP-счётчика
const BAR_MS = 800; // полоса модуля
// конфетти по motion-spec §16: ~22 частицы, вверх веером, 1.1с
const CONFETTI_COUNT = 22;
const CONFETTI_MS = 1100;
const CONFETTI_GLYPHS = ['✦', '✧', '❖', '·'];

export function LessonResult({
  gained,
  done,
  total,
  prevDone,
  onNext,
}: {
  gained: number;
  done: number;
  total: number;
  prevDone: number;
  onNext: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();

  const [shown, setShown] = React.useState(reduced ? gained : 0);
  const [burst, setBurst] = React.useState(0);

  const enter = useSharedValue(0);
  const bar = useSharedValue(total ? prevDone / total : 0);

  React.useEffect(() => {
    enter.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });

    // последовательность §16: панель встала → Success → счётчик → полоса + конфетти
    const timers: ReturnType<typeof setTimeout>[] = [];
    let tick: ReturnType<typeof setInterval> | undefined;

    timers.push(setTimeout(hapticSuccess, ENTER_MS));

    if (!reduced && gained > 0) {
      timers.push(
        setTimeout(() => {
          let cur = 0;
          tick = setInterval(() => {
            cur += 1;
            setShown(cur);
            if (cur >= gained && tick) clearInterval(tick);
          }, TICK_MS);
        }, ENTER_MS),
      );
    }

    const countMs = reduced ? 0 : gained * TICK_MS;
    timers.push(
      setTimeout(() => {
        bar.value = withTiming(total ? done / total : 0, {
          duration: BAR_MS,
          easing: Easing.bezier(0.25, 1.2, 0.4, 1), // перелёт за цель, как полоса XpPill
          reduceMotion: ReduceMotion.System,
        });
        if (!reduced) setBurst((b) => b + 1);
      }, ENTER_MS + countMs),
    );

    return () => {
      timers.forEach(clearTimeout);
      if (tick) clearInterval(tick);
    };
    // финал запускается один раз при монтировании — зависимости пустые сознательно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` as `${number}%` }));

  return (
    <Animated.View style={enterStyle}>
      <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.frame }]}>
        {gained > 0 ? (
          <Txt style={[st.xp, { color: t.accent }]}>{tr('lesson.xpGain', { n: shown })}</Txt>
        ) : (
          <Txt style={[st.repeat, { color: t.head }]}>{tr('lesson.repeatDone')}</Txt>
        )}
        <Txt style={[st.line, { color: t.muted }]}>
          {tr('lesson.passedOf', { done, count: total })}
        </Txt>
        <View style={[st.bar, { backgroundColor: t.line }]}>
          <Animated.View style={[st.fill, barStyle]}>
            <LinearGradient
              colors={[t.accent, t.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <CtaButton label={tr('lesson.nextOnPath')} onPress={onNext} style={st.cta} />
        {/* конфетти из-за панели: верхняя полуокружность + подброс, цвета через один */}
        <Sparks
          burst={burst}
          count={CONFETTI_COUNT}
          duration={CONFETTI_MS}
          distance={[90, 220]}
          size={[8, 18]}
          glyphs={CONFETTI_GLYPHS}
          angleJitter={0.5}
          angleRange={[Math.PI, Math.PI * 2]}
          lift={-60}
          colors={[t.accent, t.accent2]}
        />
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // .lresult эталона: radius 18 — осознанный литерал, как radius 13 у строки дневника
  panel: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginTop: spacing.l },
  xp: { fontFamily: fonts.displaySemi, fontSize: 36 },
  repeat: { fontFamily: fonts.display, fontSize: 24 },
  line: { fontSize: 11, letterSpacing: 1, marginTop: 4 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', alignSelf: 'stretch', marginTop: 12, marginHorizontal: 30 },
  fill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  cta: { marginTop: spacing.l, alignSelf: 'stretch' },
});
