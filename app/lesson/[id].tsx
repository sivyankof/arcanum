/** Экран урока (спека 08): теория → разбор карт → викторина → финал с XP и конфетти.
 *  Состояние прохождения живёт здесь и умирает с экраном: выход посреди урока прогресс шага
 *  не сохраняет (product-spec §2). В стор пишет только completeLesson на финале.
 *  Язык шагов фиксируется при входе: пересборка посреди прохождения сбила бы индекс шага. */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Block } from '../../src/components/Block';
import { CtaButton } from '../../src/components/CtaButton';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeUp } from '../../src/components/FadeUp';
import { LessonResult } from '../../src/components/LessonResult';
import { PressableScale } from '../../src/components/PressableScale';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { cardById, cardImages, course, type CourseLesson, type CourseModule } from '../../src/lib/content';
import { moduleProgress } from '../../src/lib/courseProgress';
import { hapticError, hapticTap } from '../../src/lib/haptics';
import { useLang } from '../../src/lib/i18n';
import { inLang, type Lang } from '../../src/lib/lang';
import { lessonPlayable, lessonSteps, type LessonStep } from '../../src/lib/lesson';
import { useBackHaptic } from '../../src/lib/useBackHaptic';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';
import { useApp } from '../../src/store/useApp';

// смена контента шага — как вкладки сфер на странице карты: гашение 130мс → проявление 350мс
const FADE_OUT_MS = 130;
const FADE_IN_MS = 350;
// подсветка правильного варианта после ошибки — задержка из эталона (answer(): setTimeout 400)
const REVEAL_MS = 400;
// прогресс-бар шагов
const PROG_MS = 300;

/** Урок, его модуль и позиция («МОДУЛЬ N · УРОК M») по id из маршрута. */
function findLesson(
  id: string | undefined,
): { lesson: CourseLesson; module: CourseModule; mi: number; li: number } | null {
  for (let mi = 0; mi < course.length; mi++) {
    const li = course[mi].lessons.findIndex((l) => l.id === id);
    if (li >= 0) return { lesson: course[mi].lessons[li], module: course[mi], mi, li };
  }
  return null;
}

type OptState = 'idle' | 'ok' | 'no';

export default function LessonScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();

  // вибрация на уходе с экрана — общий хук (как card/[id])
  useBackHaptic();

  const found = React.useMemo(() => findLesson(id), [id]);

  // шаги строятся один раз на урок; язык внутри зафиксирован сознательно (см. шапку файла).
  // useMemo не гарантирует сохранность кэша между рендерами — его сброс посреди вопроса
  // перетасовал бы варианты, а уже выбранный ответ и correct указывали бы на другие строки.
  // Ленивая инициализация состояния вызывает lessonSteps ровно один раз на монтирование экрана.
  // id стабилен в рамках одного монтирования: единственный переход на этот маршрут — router.push
  // из app/(tabs)/course.tsx с новым id на каждый тап, внутри самого экрана перехода на другой
  // урок нет (только router.back() на финале) — новый урок всегда получает новый экземпляр экрана.
  const [steps] = React.useState<LessonStep[]>(() => {
    if (!found || !lessonPlayable(found.lesson)) return [];
    return lessonSteps(found.lesson, lang, Math.random);
  });

  const completeLesson = useApp((s) => s.completeLesson);
  const lessonsProgress = useApp((s) => s.lessonsProgress);

  const [stepIdx, setStepIdx] = React.useState(0);
  const [errors, setErrors] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [showCorrect, setShowCorrect] = React.useState(false);
  const [result, setResult] = React.useState<{ gained: number; prevDone: number } | null>(null);
  const revealTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );

  // плавная смена контента шага
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const applyStep = (next: number) => {
    setPicked(null);
    setShowCorrect(false);
    setStepIdx(next);
    // контент погашен (opacity 0) в этот момент — сброс скролла здесь не виден пользователю
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    fade.value = withTiming(1, { duration: FADE_IN_MS, reduceMotion: ReduceMotion.System });
  };

  // прогресс-бар: доля пройденных шагов; на финале — 1
  const prog = useSharedValue(0);
  React.useEffect(() => {
    const target = steps.length === 0 ? 0 : result ? 1 : stepIdx / steps.length;
    prog.value = withTiming(target, {
      duration: PROG_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [stepIdx, result, steps.length, prog]);

  const step: LessonStep | undefined = steps[stepIdx];
  const answered = picked !== null;

  const onPick = (i: number) => {
    if (!step || step.kind !== 'quiz' || answered) return;
    setPicked(i);
    if (i === step.question.correct) {
      hapticTap(); // верный — Light (product-spec §2)
    } else {
      setErrors((e) => e + 1);
      hapticError();
      revealTimer.current = setTimeout(() => setShowCorrect(true), REVEAL_MS);
    }
  };

  const finish = () => {
    if (!found) return;
    const prevDone = moduleProgress(found.module, useApp.getState().lessonsProgress).done;
    const gained = completeLesson(found.lesson.id, errors);
    setResult({ gained, prevDone });
  };

  const onNext = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (stepIdx + 1 < steps.length) {
      fade.value = withTiming(
        0,
        { duration: FADE_OUT_MS, reduceMotion: ReduceMotion.System },
        (finished) => {
          if (finished) runOnJS(applyStep)(stepIdx + 1);
        },
      );
    } else {
      finish();
    }
  };

  const optState = (i: number): OptState => {
    if (!step || step.kind !== 'quiz' || picked === null) return 'idle';
    if (i === step.question.correct && (picked === step.question.correct || showCorrect)) return 'ok';
    if (i === picked && picked !== step.question.correct) return 'no';
    return 'idle';
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.course') }} />
      <ScreenBg />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          // как card/[id]: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        {found && (
          <FadeUp index={0}>
            <Txt style={[st.overline, { color: t.muted }]}>
              {tr('course.lessonOverline', { m: found.mi + 1, l: found.li + 1 })}
            </Txt>
            <Txt style={[st.title, { color: t.head }]}>{inLang(found.lesson.title, lang)}</Txt>
            {steps.length > 0 && (
              <View style={st.progRow}>
                <ProgressBar progress={prog} radius={4} style={st.progTrack} />
                <Txt style={[st.progLabel, { color: t.accent }]}>
                  {`${result ? steps.length : Math.min(stepIdx + 1, steps.length)}/${steps.length}`}
                </Txt>
              </View>
            )}
          </FadeUp>
        )}

        {/* урок без контента (М3+): как заглушка 07 — «Урок готовится» */}
        {(!found || steps.length === 0) && (
          <FadeUp index={1} style={{ marginTop: spacing.xl }}>
            <EmptyState text={tr('course.lessonPreparing')} />
          </FadeUp>
        )}

        {found && steps.length > 0 && result && (
          <LessonResult
            gained={result.gained}
            done={moduleProgress(found.module, lessonsProgress).done}
            total={found.module.lessons.length}
            prevDone={result.prevDone}
            onNext={() => router.back()}
          />
        )}

        {found && step && !result && (
          <FadeUp index={1}>
            <Animated.View style={fadeStyle}>
              {step.kind === 'theory' && <Block title={tr('lesson.theoryTitle')} text={step.text} />}

              {step.kind === 'card' && <CardStep cardId={step.cardId} lang={lang} />}

              {step.kind === 'quiz' && (
                // текст вопроса/вариантов/пояснения читает ЖИВОЙ lang, а не вмороженный, как теория:
                // step.question хранит объект QuizQuestion целиком (оба языка сразу), нужный язык
                // выбирается прямо тут при рендере, а не при сборке шагов. Сегодня разницы не видно —
                // сменить язык, не размонтировав экран урока, нельзя. Разъедутся они, если появится
                // способ сменить язык БЕЗ размонтирования этого экрана (например, общий переключатель
                // языка поверх текущего таба) — тогда вопрос перескочит на новый язык на середине
                // урока, а уже пройденная теория останется на старом.
                <View style={{ marginTop: spacing.l }}>
                  {step.question.type === 'card' && step.question.cardId && (
                    <View style={[st.qImWrap, { borderColor: t.frame }]}>
                      <Image
                        source={cardImages[step.question.cardId]}
                        style={st.qIm}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    </View>
                  )}
                  <Txt style={[st.q, { color: t.head }]}>{inLang(step.question.q, lang)}</Txt>
                  {step.question.options.map((o, i) => {
                    const state = optState(i);
                    return (
                      <PressableScale
                        key={i}
                        onPress={() => onPick(i)}
                        style={[
                          st.opt,
                          { backgroundColor: t.panel, borderColor: t.line },
                          // фон верного — success с альфой 0.12 (1F), как rgba(90,160,126,.12) эталона
                          state === 'ok' && { borderColor: t.success, backgroundColor: `${t.success}1F` },
                          state === 'no' && { borderColor: t.danger, opacity: 0.6 },
                        ]}
                      >
                        <Txt style={[st.optTxt, { color: t.text }]}>{inLang(o, lang)}</Txt>
                      </PressableScale>
                    );
                  })}
                  {answered && (
                    <Txt style={[st.explain, { color: t.text }]}>
                      <Txt
                        style={[
                          st.explain,
                          {
                            color: picked === step.question.correct ? t.success : t.danger,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {tr(picked === step.question.correct ? 'lesson.explainRight' : 'lesson.explainWrong')}
                      </Txt>
                      {` ${inLang(step.question.explain, lang)}`}
                    </Txt>
                  )}
                </View>
              )}

              {(step.kind !== 'quiz' || answered) && (
                <CtaButton label={tr('lesson.next')} onPress={onNext} style={{ marginTop: spacing.xl }} />
              )}
            </Animated.View>
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}

/** Шаг «разбор карты» — `.lcard` эталона: изображение + имя + 4 ключевых слова из cards.json. */
function CardStep({ cardId, lang }: { cardId: string; lang: Lang }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const card = cardById.get(cardId);
  if (!card) return null;
  return (
    <View style={[st.lcard, { backgroundColor: t.panel, borderColor: t.frame }]}>
      <View style={[st.lcardImWrap, { borderColor: t.frame, boxShadow: `0px 8px 22px ${t.glow}` }]}>
        <Image source={cardImages[cardId]} style={st.lcardIm} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <View style={st.lcardCol}>
        <Txt style={[st.lcardOverline, { color: t.accent }]}>{tr('lesson.cardStep')}</Txt>
        <Txt style={[st.lcardName, { color: t.head }]}>{inLang(card.name, lang)}</Txt>
        <Txt style={[st.lcardKw, { color: t.muted }]}>{`✦ ${inLang(card.keywords, lang).join(' · ')}`}</Txt>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  overline: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', fontWeight: '600' },
  title: { fontFamily: fonts.display, fontSize: 26, textAlign: 'center', marginTop: 4 },
  // .prog эталона: полоса 7/4 + подпись X/N, отступ сверху 6 — design-reference.html, не spacing.m
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  progTrack: { flex: 1, height: 7 },
  progLabel: { fontSize: 11, fontWeight: '700' },
  // вопрос (.quiz .q, масштаб рамы: 17 → 19)
  q: { fontFamily: fonts.display, fontSize: 19, textAlign: 'center' },
  qImWrap: {
    width: 110,
    aspectRatio: 0.58,
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: spacing.l,
  },
  qIm: { width: '100%', height: '100%' },
  // вариант ответа (.opt): бордер 1.5, radius 14, паддинг 13×16, Body 14
  opt: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, marginTop: 9 },
  optTxt: { fontSize: 14, lineHeight: 20 },
  explain: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: spacing.l },
  // шаг карты (.lcard)
  lcard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: radius.l, padding: 14, marginTop: spacing.m },
  lcardImWrap: { width: 74, aspectRatio: 0.58, borderRadius: radius.s, borderWidth: 1, overflow: 'hidden' },
  lcardIm: { width: '100%', height: '100%' },
  lcardCol: { flex: 1 },
  lcardOverline: { fontSize: 9, letterSpacing: 2, fontWeight: '600' },
  lcardName: { fontFamily: fonts.display, fontSize: 20, marginTop: 2 },
  lcardKw: { fontSize: 12, marginTop: 5, lineHeight: 17 },
});
