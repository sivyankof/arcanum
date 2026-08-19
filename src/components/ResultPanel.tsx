/** Панель итога (`.lresult` эталона, motion-spec §16): въезжает fade+up 500 мс → хаптика Success →
 *  счётчик «+N XP» катится (55 мс/шаг); когда счётчик докатился — зовёт onCounted (финал урока по нему
 *  запускает полосу модуля и конфетти). Общая часть LessonResult (урок) и ReviewResult (тренажёр,
 *  спека 45) — вынесена по правилу «2+ раза». Порядок содержимого: title (Overline, если задан) →
 *  [XP (или zeroTitle при gained 0) / line — порядок этой пары задаёт `lineFirst`] → children → CTA →
 *  footer. У урока (`#lresult`) порядок XP → line, у тренажёра (`#trres`) — line → XP: макет и спека
 *  расходятся здесь по-настоящему, `lineFirst` — не косметика. Порядок footer важен: у урока это
 *  слой конфетти, и он обязан лежать ПОВЕРХ CTA, как раньше. Reduce motion: счётчик мгновенный
 *  (motion-spec §16). */
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
  lineFirst,
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
  /** true — строка стоит НАД счётчиком XP, а не под ним (тренажёр, `#trres` эталона: `lbl → lp →
   *  xpn` против `xpn → lp` у урока); заодно переключает отступы на инлайн-стили #trres —
   *  8 у строки, 6 у счётчика (у урока это marginBottom заголовка и marginTop строки) */
  lineFirst?: boolean;
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

  // xp/zero и line — одна и та же пара элементов у обоих экранов, порядок задаёт lineFirst
  // (Important 2 финального ревью: у тренажёра эталон рисует строку НАД счётчиком, у урока — под)
  const xpBlock =
    gained > 0 ? (
      <Txt style={[st.xp, { color: t.accent }, lineFirst && st.xpAfterLine]}>{tr('lesson.xpGain', { n: shown })}</Txt>
    ) : (
      !!zeroTitle && <Txt style={[st.zero, { color: t.head }]}>{zeroTitle}</Txt>
    );
  const lineBlock = <Txt style={[st.line, { color: t.muted }, lineFirst && st.lineAfterTitle]}>{line}</Txt>;

  return (
    <Animated.View style={enterStyle}>
      <View style={[st.panel, { backgroundColor: t.panel, borderColor: t.frame }]}>
        {!!title && <Txt style={[st.title, { color: t.accent }, lineFirst && st.titleTight]}>{title}</Txt>}
        {lineFirst ? (
          <>
            {lineBlock}
            {xpBlock}
          </>
        ) : (
          <>
            {xpBlock}
            {lineBlock}
          </>
        )}
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
  title: { fontSize: 8.5, letterSpacing: 3, marginBottom: 8 }, // .lbl над результатом тренажёра (дефолт: гэп до XP)
  titleTight: { marginBottom: 0 }, // lineFirst: гэп до строки держит marginTop строки (8), не заголовок
  xp: { fontFamily: fonts.displaySemi, fontSize: 36 },
  xpAfterLine: { marginTop: 6 }, // #trres .xpn margin-top:6 — тренажёр: счётчик идёт после строки
  zero: { fontFamily: fonts.display, fontSize: 24 },
  line: { fontSize: 11, letterSpacing: 1, marginTop: 4 }, // дефолт: .lp после XP (урок)
  lineAfterTitle: { marginTop: 8 }, // #trres .lp margin-top:8 — тренажёр: строка сразу после заголовка
  cta: { marginTop: spacing.l, alignSelf: 'stretch' },
});
