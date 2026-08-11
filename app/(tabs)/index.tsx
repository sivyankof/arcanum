import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Block } from '../../src/components/Block';
import { CardBack } from '../../src/components/CardBack';
import { CtaButton } from '../../src/components/CtaButton';
import { FadeUp } from '../../src/components/FadeUp';
import { NotePlate } from '../../src/components/NotePlate';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Sparks } from '../../src/components/Sparks';
import { StreakPill } from '../../src/components/StreakPill';
import { XpPill } from '../../src/components/XpPill';
import { cardById, cardImages, cardNumeral, cardOfDay } from '../../src/lib/content';
import { daysAgoISO, localDateISO } from '../../src/lib/dates';
import { hapticReveal, hapticSuccess } from '../../src/lib/haptics';
import { pingPong, startSpin, sweepLoop } from '../../src/lib/loops';
import { moonInfo } from '../../src/lib/moon';
import { useApp } from '../../src/store/useApp';
import { fonts, gold, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';
import { Txt } from '../../src/components/Txt';

const { width: W } = Dimensions.get('window');
const CARD_W = Math.min(W * 0.56, 230);
const CARD_H = CARD_W * 1.72;
const FLIP_MS = 850;
const STREAK_MILESTONE = 7; // 7-й день серии — единственная «победа» на этом экране

// мок уровня до задачи 08 (реальные XP считаются там): первый уровень, полоса пустая
const MOCK_LEVEL = 1;
const MOCK_PROGRESS = 0;

// пропорции колец из эталона: карта 216 → кольца 330 и 378
const RING_A = CARD_W * 1.53;
const RING_B = CARD_W * 1.75;

// блик по лицу карты (.glare из эталона): диагональ 112°, ход ±140% ширины, задержка 500 мс, 1100 мс.
// Сверх эталона (motion-spec п.7): пока карта открыта, проход повторяется каждые ~7 с
const GLARE_DELAY = 500;
const GLARE_MS = 1100;
const GLARE_PAUSE = 7000;
const GLARE_ANGLE = { start: { x: 0.04, y: 0.31 }, end: { x: 0.96, y: 0.69 } };

// салют при перевороте (.spark эталона + stage.onclick): 18 искр, кегль 8–17, разлёт 85–180 px
const SPARK_COUNT = 18;
const SPARK_GLYPHS = ['✦', '✧', '·'];
const SPARK_MS = 1050;
const SPARK_SIZE: [number, number] = [8, 17];
const SPARK_DISTANCE: [number, number] = [85, 180];
const SPARK_JITTER = 0.5; // Math.random()*.5 рад в эталоне

// всплывание текста после переворота (.plate/.mean эталона): 600 мс, задержки 500 и 600 мс
const REVEAL_MS = 600;
const PLATE_DELAY = 500;
const PLATE_SHIFT = 8;
const MEAN_DELAY = 600;
const MEAN_SHIFT = 12;

// кривая CSS-дефолта `ease` — им в эталоне идут и блик, и всплывание текста
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// тень карты дня (.face эталона): box-shadow 0 30px 66px var(--glow), 0 6px 18px rgba(0,0,0,.4) —
// две тени (тёплое золотое свечение + мягкая тёмная), значения переносятся из CSS один в один.
// Нужна на рубашке и на лице карты, поэтому вынесена, чтобы не дублировать строку дважды
const FACE_SHADOW = (glow: string) => `0px 30px 66px ${glow}, 0px 6px 18px rgba(0,0,0,0.4)`;

/** Медленно вращающееся пунктирное кольцо вокруг карты дня (по эталону). */
function Ring({
  size,
  duration,
  reverse,
  opacity,
  star,
  starSize,
}: {
  size: number;
  duration: number;
  reverse?: boolean;
  opacity: number;
  star: string;
  starSize: number;
}) {
  const t = useTheme();
  const angle = useSharedValue(0);

  React.useEffect(() => {
    startSpin(angle, duration);
  }, [angle, duration]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reverse ? -angle.value : angle.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          pointerEvents: 'none',
          position: 'absolute',
          left: (CARD_W - size) / 2,
          top: (CARD_H - size) / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: t.ring,
          opacity,
        },
        spin,
      ]}
    >
      <Text
        style={{
          position: 'absolute',
          top: -starSize / 2,
          left: '50%',
          marginLeft: -starSize / 2,
          fontSize: starSize,
          color: t.accent,
        }}
      >
        {star}
      </Text>
    </Animated.View>
  );
}

export default function TodayScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  const streak = useApp((s) => s.streak);
  const drawToday = useApp((s) => s.drawToday);
  const drawn = useApp((s) => s.todayDraw());
  const installSeed = useApp((s) => s.installSeed);
  const history = useApp((s) => s.history);

  const todayISO = localDateISO();
  // анти-повтор карты дня: карты, выпадавшие за последние 7 дней (не считая сегодня)
  const recent = history
    .filter((h) => h.date >= daysAgoISO(7) && h.date !== todayISO)
    .map((h) => h.cardId);
  const card = drawn ? cardById.get(drawn.cardId)! : cardOfDay(todayISO, installSeed, recent);

  // --- анимации ---
  const [burst, setBurst] = React.useState(0); // счётчик салютов у огонька серии
  const [cardBurst, setCardBurst] = React.useState(0); // салют вокруг карты при перевороте
  const flip = useSharedValue(drawn ? 1 : 0);
  const bob = useSharedValue(0);
  const glare = useSharedValue(0);
  // видимость текста под картой. При входе на таб с уже открытой картой стартуем сразу с 1 —
  // всплывание положено только переходу «рубашка → лицо», за вход отвечает каскад FadeUp
  const plateIn = useSharedValue(drawn ? 1 : 0);
  const meanIn = useSharedValue(drawn ? 1 : 0);

  // после сброса карты дня (или смены даты) возвращаем рубашку и прячем текст
  React.useEffect(() => {
    if (!drawn) {
      flip.value = 0;
      plateIn.value = 0;
      meanIn.value = 0;
    }
  }, [drawn, flip, plateIn, meanIn]);

  // блик живёт, пока карта открыта: первый проход через 500 мс, дальше цикл с паузой.
  // Держим его в эффекте, а не в onDraw, — иначе при возврате на таб блик бы не запускался
  React.useEffect(() => {
    glare.value = 0;
    if (!drawn) return;
    glare.value = withDelay(GLARE_DELAY, sweepLoop(GLARE_MS, GLARE_PAUSE, EASE));
  }, [drawn, glare]);

  // покачивание карты: ход 6 px вверх и обратно, полный цикл 4.2 с (.flip/hov из эталона)
  React.useEffect(() => {
    bob.value = pingPong(-6, 2100);
  }, [bob]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { perspective: 1100 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: 'hidden' as const,
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { perspective: 1100 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: 'hidden' as const,
  }));
  const glareStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(glare.value, [0, 1], [-CARD_W * 1.4, CARD_W * 1.4]) }],
  }));
  const plateStyle = useAnimatedStyle(() => ({
    opacity: plateIn.value,
    transform: [{ translateY: (1 - plateIn.value) * PLATE_SHIFT }],
  }));
  const meanStyle = useAnimatedStyle(() => ({
    opacity: meanIn.value,
    transform: [{ translateY: (1 - meanIn.value) * MEAN_SHIFT }],
  }));

  const reveal = (delay: number) =>
    withDelay(delay, withTiming(1, { duration: REVEAL_MS, easing: EASE, reduceMotion: ReduceMotion.System }));

  const onDraw = () => {
    if (drawn) return;
    const prevStreak = streak;
    hapticReveal();
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) });
    plateIn.value = reveal(PLATE_DELAY);
    meanIn.value = reveal(MEAN_DELAY);
    setCardBurst((b) => b + 1); // искры — в момент нажатия, вместе с хаптикой
    drawToday(card.id, false);
    const newStreak = useApp.getState().streak;
    // серия выросла — салют у огонька, но только вместе с открытием карты
    if (newStreak > prevStreak) setTimeout(() => setBurst((b) => b + 1), FLIP_MS * 0.7);
    // Success бережём для настоящих побед: 7-й день серии (и позже — завершённый урок)
    if (newStreak === STREAK_MILESTONE) setTimeout(hapticSuccess, FLIP_MS);
  };

  const dayText = card.content.day_card?.[lang];
  const hasText = dayText && card.content.day_card.status !== 'todo';

  // дата как в эталоне: «Пятница · 1 августа» (в стиле .date стоит верхний регистр)
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const now = new Date();
  const dateStr = `${now.toLocaleDateString(locale, { weekday: 'long' })} · ${now.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
  })}`;

  // фаза луны считается локально от текущего момента (logic-spec §6)
  const moon = moonInfo(now);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <FadeUp index={0}>
          <Txt style={[st.date, { color: t.muted }]}>{dateStr.toUpperCase()}</Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('today.title')}</Txt>
          <Rule />
        </FadeUp>

        {/* строка луны (.moonrow эталона). Символ ☽ рисуем системным шрифтом:
            в Manrope его нет, поэтому обёртка — обычный Text без fontFamily */}
        <FadeUp index={1}>
          <Text style={[st.moon, { color: t.muted }]}>
            <Text>☽ </Text>
            <Txt style={{ color: t.head, fontWeight: '600' }}>{tr(`moon.${moon.phase}`)}</Txt>
            <Txt style={{ color: t.muted }}>{` · ${tr('moon.day', { n: moon.day })}`}</Txt>
          </Text>
        </FadeUp>

        {/* ряд пилюль (.pills эталона): серия слева, уровень справа и чуть шире */}
        <FadeUp index={2} style={st.pills}>
          <StreakPill streak={streak} burst={burst} style={st.pillStreak} />
          <XpPill level={MOCK_LEVEL} progress={MOCK_PROGRESS} style={st.pillXp} />
        </FadeUp>

        {/* сцена с картой */}
        <FadeUp index={3}>
        <Pressable onPress={onDraw} style={{ alignSelf: 'center', marginTop: spacing.xl }}>
          <View style={{ width: CARD_W, height: CARD_H }}>
            {/* кольца позади карты */}
            <Ring size={RING_A} duration={70000} opacity={0.55} star="✦" starSize={8} />
            <Ring size={RING_B} duration={100000} reverse opacity={0.3} star="✧" starSize={6} />
            {/* рубашка. Тень живёт на внешней View: на iOS overflow:'hidden' срезает собственную тень */}
            <Animated.View style={[st.face, backStyle, { boxShadow: FACE_SHADOW(t.glow), backgroundColor: t.bg }]}>
              <View style={[st.faceClip, { borderColor: t.frame }]}>
                <CardBack hint={drawn ? undefined : lang === 'ru' ? 'НАЖМИ, ЧТОБЫ ОТКРЫТЬ' : 'TAP TO REVEAL'} />
              </View>
            </Animated.View>
            {/* лицо */}
            <Animated.View style={[st.face, frontStyle, { boxShadow: FACE_SHADOW(t.glow), backgroundColor: t.bg }]}>
              <View style={[st.faceClip, { borderColor: t.frame }]}>
                <Image source={cardImages[card.id]} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
                {/* блик: проходит по лицу карты сразу после переворота */}
                <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }, glareStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
                    locations={[0, 0.32, 0.48, 0.6, 1]}
                    start={GLARE_ANGLE.start}
                    end={GLARE_ANGLE.end}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
            </Animated.View>
          </View>
          {/* салют поверх сцены; внутри Sparks стоит pointerEvents none, нажатию не мешает */}
          <Sparks
            burst={cardBurst}
            count={SPARK_COUNT}
            glyphs={SPARK_GLYPHS}
            size={SPARK_SIZE}
            distance={SPARK_DISTANCE}
            duration={SPARK_MS}
            angleJitter={SPARK_JITTER}
            style={st.sparkLayer}
          />
        </Pressable>
        </FadeUp>

        {drawn && (
          <>
            <Animated.View style={plateStyle}>
              <Txt style={[st.cardName, { color: t.head }]}>{card.name[lang].toUpperCase()}</Txt>
              <Txt style={[st.cardSub, { color: t.muted }]}>
                {cardNumeral(card)} ·{' '}
                {card.arcana === 'major'
                  ? lang === 'ru' ? 'СТАРШИЙ АРКАН' : 'MAJOR ARCANA'
                  : lang === 'ru' ? 'МЛАДШИЙ АРКАН' : 'MINOR ARCANA'}
              </Txt>
            </Animated.View>
            {/* кнопка живёт внутри блока значения — как .cta внутри .mean в эталоне */}
            <Animated.View style={meanStyle}>
              <View style={[st.meanBox, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.meanLbl, { color: t.accent }]}>
                  {lang === 'ru' ? 'ЗНАЧЕНИЕ ДНЯ' : "TODAY'S MEANING"}
                </Txt>
                <Txt style={[st.meanTxt, { color: t.text }]}>
                  {hasText ? dayText : tr('card.soon')}
                </Txt>
                <CtaButton
                  label={lang === 'ru' ? 'ПРОДОЛЖИТЬ ПУТЬ →' : 'CONTINUE YOUR PATH →'}
                  onPress={() => router.push(`/card/${card.id}?from=today`)}
                />
              </View>
              {/* заметка о дне (спека 05): плашка в потоке, ввод — на отдельном экране */}
              <Block title={tr('note.title')}>
                <NotePlate
                  note={drawn?.note}
                  onPress={() => router.push({ pathname: '/note/[date]', params: { date: todayISO } })}
                />
              </Block>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  date: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
  moon: { fontSize: 13, textAlign: 'center', marginTop: 12 },
  pills: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pillStreak: { flex: 1 },
  pillXp: { flex: 1.5 },
  // тёплое свечение вокруг карты дня — значение в FACE_SHADOW (см. константу выше),
  // задаётся инлайн через boxShadow, т.к. зависит от темы
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.card,
  },
  faceClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  // искры уводим над картой: на Android грани карты подняты elevation, иначе салют уйдёт под них
  sparkLayer: { zIndex: 2, elevation: 20 },
  cardName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 3, textAlign: 'center', marginTop: spacing.xl },
  cardSub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', marginTop: 3 },
  meanBox: { borderRadius: radius.l, borderWidth: 1, padding: spacing.l, marginTop: spacing.l },
  meanLbl: { fontSize: 9.5, letterSpacing: 3 }, // Overline из дизайн-системы: 9.5–10
  meanTxt: { fontFamily: fonts.display, fontSize: 17, lineHeight: 25, marginTop: 8 },
  // тень кнопки из эталона `.btn`: box-shadow 0 12px 30px var(--glow) — задаётся инлайн
  // (boxShadow зависит от темы, см. JSX выше). overflow тут ставить нельзя — срежет тень;
  // обрезка живёт в ctaClip. Подложка под форму (нужна была старым shadow*-пропам) — не нужна
  cta: {
    marginTop: 14,
    borderRadius: radius.l,
  },
  ctaClip: { borderRadius: radius.l, overflow: 'hidden' },
  ctaGrad: { paddingVertical: 15, alignItems: 'center' },
  ctaGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' },
  ctaTxt: { color: gold.text, fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
});
