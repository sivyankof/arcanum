/** Панель итога (`.lresult` эталона, motion-spec §16): въезжает fade+up 500 мс → хаптика Success →
 *  счётчик «+N XP» катится (55 мс/шаг); когда счётчик докатился — зовёт onCounted (финал урока по нему
 *  запускает полосу модуля и конфетти). Общая часть LessonResult (урок) и ReviewResult (тренажёр,
 *  спека 45) — вынесена по правилу «2+ раза». Порядок содержимого фиксирован: title (Overline, если
 *  задан) → XP (или zeroTitle при gained 0) → line → children → CTA → footer. Порядок важен: footer
 *  у урока — слой конфетти, и он обязан лежать ПОВЕРХ CTA, как раньше. Reduce motion: счётчик
 *  мгновенный (motion-spec §16). */
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
import { Txt } from './Txt';

const ENTER_MS = 500; // въезд панели
const TICK_MS = 55; // шаг XP-счётчика

export function ResultPanel({
  gained,
  title,
  zeroTitle,
  line,
  cta,
  onCounted,
  children,
  footer,
}: {
  gained: number;
  /** Overline над счётчиком (8.5/ls3 accent, `.lbl` эталона) — у тренажёра «ПОВТОРЕНИЕ»; у урока нет */
  title?: string;
  /** заголовок вместо счётчика при gained = 0 (повтор урока: +2 сегодня уже получены); не задан — слот пуст */
  zeroTitle?: string;
  /** строка под счётчиком, 11/ls1 muted */
  line: string;
  cta: { label: string; onPress: () => void };
  /** момент «счётчик докатился»: ENTER_MS + gained × TICK_MS (при reduce motion — ENTER_MS) */
  onCounted?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const reduced = useReducedMotion();

  const [shown, setShown] = React.useState(reduced ? gained : 0);
  const enter = useSharedValue(0);

  React.useEffect(() => {
    enter.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });

    // последовательность §16: панель встала → Success → счётчик → onCounted
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
    if (onCounted) timers.push(setTimeout(onCounted, ENTER_MS + countMs));

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

  return (
    <Animated.View style={enterStyle}>
      <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.frame }]}>
        {!!title && <Txt style={[st.title, { color: t.accent }]}>{title}</Txt>}
        {gained > 0 ? (
          <Txt style={[st.xp, { color: t.accent }]}>{tr('lesson.xpGain', { n: shown })}</Txt>
        ) : (
          !!zeroTitle && <Txt style={[st.zero, { color: t.head }]}>{zeroTitle}</Txt>
        )}
        <Txt style={[st.line, { color: t.muted }]}>{line}</Txt>
        {children}
        <CtaButton label={cta.label} onPress={cta.onPress} style={st.cta} />
        {footer}
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // .lresult эталона: radius 18 — осознанный литерал, как radius 13 у строки дневника
  panel: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginTop: spacing.l },
  title: { fontSize: 8.5, letterSpacing: 3, marginBottom: 8 }, // .lbl над результатом тренажёра
  xp: { fontFamily: fonts.displaySemi, fontSize: 36 },
  zero: { fontFamily: fonts.display, fontSize: 24 },
  line: { fontSize: 11, letterSpacing: 1, marginTop: 4 },
  cta: { marginTop: spacing.l, alignSelf: 'stretch' },
});
