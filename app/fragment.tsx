/** Игра «Угадай карту по фрагменту» (спека 72): увеличенный квадрат скана + четыре названия.
 *  После ответа квадрат «отъезжает» до целой карты. Сессия — 10 вопросов, итог — ResultPanel.
 *  Вся логика — src/lib/fragmentGame.ts; экран только рисует и ведёт анимацию. */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CtaButton } from '../src/components/CtaButton';
import { FadeUp } from '../src/components/FadeUp';
import { OptionButton } from '../src/components/OptionButton';
import { ResultPanel } from '../src/components/ResultPanel';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { cardById, cardImages, fragments } from '../src/lib/content';
import { buildFragmentSession, fragmentLayout, sessionScore } from '../src/lib/fragmentGame';
import { hapticSuccess, hapticTap } from '../src/lib/haptics';
import { useLang } from '../src/lib/i18n';
import { inLang } from '../src/lib/lang';
import { useApp } from '../src/store/useApp';
import { glowShadow } from '../src/theme/glow';
import { stackTopPad } from '../src/theme/navHeader';
import { fonts, radius, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

const VIEW = Math.min(Dimensions.get('window').width - 48, 300);
const ZOOM_MS = 300;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export default function FragmentScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const gainFragmentXp = useApp((s) => s.gainFragmentXp);

  const [questions, setQuestions] = React.useState(() => buildFragmentSession(fragments));
  const [at, setAt] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [log, setLog] = React.useState<boolean[]>([]);
  const zoom = useSharedValue(0); // 0 — фрагмент, 1 — карта целиком

  const q = questions[at];
  const finished = at >= questions.length;
  const from0 = q ? fragmentLayout(q.box, VIEW, undefined, 0) : null;
  const to1 = q ? fragmentLayout(q.box, VIEW, undefined, 1) : null;
  const imgStyle = useAnimatedStyle(() => {
    if (!from0 || !to1) return {};
    const mix = (a: number, b: number) => a + (b - a) * zoom.value;
    return { width: mix(from0.width, to1.width), height: mix(from0.height, to1.height), left: mix(from0.left, to1.left), top: mix(from0.top, to1.top) };
  }, [from0?.width, from0?.left, from0?.top, to1?.width]);

  const onPick = (i: number) => {
    if (picked !== null || !q) return;
    const right = i === q.correct;
    setPicked(i);
    setLog((l) => [...l, right]);
    if (right) { hapticSuccess(); gainFragmentXp(); } else hapticTap();
    zoom.value = withTiming(1, { duration: ZOOM_MS, easing: EASE, reduceMotion: ReduceMotion.System });
  };
  const onNext = () => { zoom.value = 0; setPicked(null); setAt((n) => n + 1); };
  const onAgain = () => { zoom.value = 0; setQuestions(buildFragmentSession(fragments)); setAt(0); setPicked(null); setLog([]); };

  const score = sessionScore(log);
  const optState = (i: number) =>
    picked === null ? 'idle' : i === q!.correct ? 'ok' : i === picked ? 'no' : 'idle';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr(from === 'practice' ? 'tabs.practice' : 'tabs.learn') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{ paddingTop: stackTopPad(insets), paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {finished ? (
          <ResultPanel
            gained={score.xp}
            title={tr('game.overline')}
            zeroTitle={tr('game.title')}
            line={tr('game.resultLine', { right: score.right, total: score.total })}
            lineFirst
            cta={{ label: tr('review.done'), onPress: () => router.back() }}
            footer={
              <Pressable onPress={onAgain} hitSlop={8} style={st.again}>
                <Txt style={[st.againTxt, { color: t.accent }]}>{tr('game.again')}</Txt>
              </Pressable>
            }
          />
        ) : (
          // key: новый вопрос = свежий монтаж, каскад и картинка не «доезжают» с прошлого
          <View key={at}>
            <FadeUp index={0}>
              <Txt style={[st.counter, { color: t.muted }]}>{`${at + 1} / ${questions.length}`}</Txt>
              <View style={[st.frame, glowShadow(t.glow, t.accent, 16, 0.35)]}>
                <View style={[st.clip, { borderColor: t.frame, backgroundColor: t.bg }]}>
                  <Animated.View style={[st.abs, imgStyle]}>
                    <Image source={cardImages[q.cardId]} style={st.fill} contentFit="fill" cachePolicy="memory-disk" />
                  </Animated.View>
                </View>
              </View>
              <Txt style={[st.q, { color: t.head }]}>
                {picked === null ? tr('game.question') : inLang(cardById.get(q.cardId)!.name, lang)}
              </Txt>
            </FadeUp>
            <FadeUp index={1}>
              {q.options.map((id, i) => (
                <OptionButton key={id} label={inLang(cardById.get(id)!.name, lang)} state={optState(i)} onPress={() => onPick(i)} />
              ))}
              {picked !== null && <CtaButton label={tr('lesson.next')} onPress={onNext} style={{ marginTop: spacing.xl }} />}
            </FadeUp>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  counter: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  frame: { alignSelf: 'center', marginTop: spacing.l, borderRadius: radius.l },
  clip: { width: VIEW, height: VIEW, borderRadius: radius.l, borderWidth: 1, overflow: 'hidden' },
  abs: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
  q: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 26, textAlign: 'center', marginTop: spacing.l },
  again: { marginTop: 10 },
  againTxt: { fontSize: 10.5, letterSpacing: 1, textAlign: 'center' },
});
