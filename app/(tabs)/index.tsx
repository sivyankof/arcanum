import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBg } from '../../src/components/ScreenBg';
import { cardById, cardImages, cardOfDay } from '../../src/lib/content';
import { useApp } from '../../src/store/useApp';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

const { width: W } = Dimensions.get('window');
const CARD_W = Math.min(W * 0.56, 230);
const CARD_H = CARD_W * 1.72;
const FLIP_MS = 850;

// пропорции колец из эталона: карта 216 → кольца 330 и 378
const RING_A = CARD_W * 1.53;
const RING_B = CARD_W * 1.75;

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
    angle.value = withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1);
  }, [angle, duration]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reverse ? -angle.value : angle.value}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
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

  const todayISO = new Date().toISOString().slice(0, 10);
  const card = drawn ? cardById.get(drawn.cardId)! : cardOfDay(todayISO);

  // --- анимации ---
  const flip = useSharedValue(drawn ? 1 : 0);
  const bob = useSharedValue(0);

  // после сброса карты дня (или смены даты) возвращаем рубашку
  React.useEffect(() => {
    if (!drawn) flip.value = 0;
  }, [drawn, flip]);

  React.useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
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

  const onDraw = () => {
    if (drawn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) });
    drawToday(card.id, false);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), FLIP_MS * 0.6);
  };

  const dayText = card.content.day_card?.[lang];
  const hasText = dayText && card.content.day_card.status !== 'todo';

  const dateStr = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[st.date, { color: t.muted }]}>{dateStr.toUpperCase()}</Text>
        <Text style={[st.title, { color: t.head }]}>{tr('today.title')}</Text>

        <View style={[st.pill, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Ionicons name="flame" size={16} color={t.accent} />
          <Text style={{ color: t.head, fontWeight: '700', fontSize: 13 }}>
            {streak} {lang === 'ru' ? 'дн.' : 'days'}
          </Text>
          <Text style={{ color: t.muted, fontSize: 11 }}>{lang === 'ru' ? 'серия' : 'streak'}</Text>
        </View>

        {/* сцена с картой */}
        <Pressable onPress={onDraw} style={{ alignSelf: 'center', marginTop: spacing.xl }}>
          <View style={{ width: CARD_W, height: CARD_H }}>
            {/* кольца позади карты */}
            <Ring size={RING_A} duration={70000} opacity={0.55} star="✦" starSize={8} />
            <Ring size={RING_B} duration={100000} reverse opacity={0.3} star="✧" starSize={6} />
            {/* рубашка */}
            <Animated.View style={[st.face, backStyle, { borderColor: t.frame, shadowColor: t.accent }]}>
              <LinearGradient colors={t.mode === 'dark' ? ['#1d2752', '#0c1130'] : ['#f4ead0', '#e4d6b0']} style={StyleSheet.absoluteFill} />
              <View style={[st.inframe, { borderColor: t.frame }]} />
              <View style={st.embWrap}>
                <Ionicons name="sparkles" size={44} color={t.accent} />
                <Text style={[st.embWord, { color: t.accent }]}>ARCANUM</Text>
                {!drawn && (
                  <Text style={[st.tapHint, { color: t.muted }]}>
                    {lang === 'ru' ? 'НАЖМИ, ЧТОБЫ ОТКРЫТЬ' : 'TAP TO REVEAL'}
                  </Text>
                )}
              </View>
            </Animated.View>
            {/* лицо */}
            <Animated.View style={[st.face, frontStyle, { borderColor: t.frame, shadowColor: t.accent }]}>
              <Image source={cardImages[card.id]} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
            </Animated.View>
          </View>
        </Pressable>

        {drawn && (
          <>
            <Text style={[st.cardName, { color: t.head }]}>{card.name[lang].toUpperCase()}</Text>
            <Text style={[st.cardSub, { color: t.muted }]}>
              {card.arcana === 'major'
                ? lang === 'ru' ? 'СТАРШИЙ АРКАН' : 'MAJOR ARCANA'
                : lang === 'ru' ? 'МЛАДШИЙ АРКАН' : 'MINOR ARCANA'}
            </Text>
            <View style={[st.meanBox, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Text style={[st.meanLbl, { color: t.accent }]}>
                {lang === 'ru' ? 'ЗНАЧЕНИЕ ДНЯ' : "TODAY'S MEANING"}
              </Text>
              <Text style={[st.meanTxt, { color: t.text }]}>
                {hasText ? dayText : tr('card.soon')}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/card/${card.id}`)}
              style={({ pressed }) => [st.cta, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <LinearGradient
                colors={['#caa45a', '#efd9a2', '#caa45a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.ctaGrad}
              >
                <Text style={st.ctaTxt}>{lang === 'ru' ? 'ИЗУЧИТЬ КАРТУ →' : 'STUDY THIS CARD →'}</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  date: { fontSize: 10, letterSpacing: 3, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, textAlign: 'center', marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.l,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  inframe: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderWidth: 1, borderRadius: 10, opacity: 0.8 },
  embWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  embWord: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 6 },
  tapHint: { position: 'absolute', bottom: 18, fontSize: 8.5, letterSpacing: 2 },
  cardName: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 3, textAlign: 'center', marginTop: spacing.xl },
  cardSub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center', marginTop: 3 },
  meanBox: { borderRadius: radius.l, borderWidth: 1, padding: spacing.l, marginTop: spacing.l },
  meanLbl: { fontSize: 9, letterSpacing: 3 },
  meanTxt: { fontFamily: fonts.display, fontSize: 17, lineHeight: 25, marginTop: 8 },
  cta: { marginTop: spacing.l, borderRadius: radius.l, overflow: 'hidden' },
  ctaGrad: { paddingVertical: 15, alignItems: 'center' },
  ctaTxt: { color: '#241c0d', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
});
