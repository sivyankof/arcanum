import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  measure,
  ReduceMotion,
  runOnUI,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { Glow } from '../../src/components/Glow';
import { ScreenBg } from '../../src/components/ScreenBg';
import { takeCardOrigin, type Rect } from '../../src/lib/cardTransition';
import { cardById } from '../../src/lib/content';
import { cardImages } from '../../src/lib/cardImages';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const BLOCKS = ['general', 'reversed', 'love', 'career', 'finances', 'health', 'day_card', 'symbolism'] as const;

const FLY_MS = 350;
const GLOW_SIZE = 250; // картинка 128 шириной, свечение выходит за неё мягким ореолом

/** Изображение в шапке. Если экран открыт из сетки карт, картинка «перелетает»
 *  от своей ячейки на место (пункт 6 motion-spec); иначе появляется как обычно. */
function HeroImage({ cardId, origin }: { cardId: string; origin: Rect | null }) {
  const t = useTheme();
  const ref = useAnimatedRef<Animated.View>();

  const progress = useSharedValue(origin ? 0 : 1); // 0 — в позиции ячейки, 1 — на своём месте
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const dScale = useSharedValue(1);
  const shown = useSharedValue(origin ? 0 : 1); // до замера не показываем, иначе мигнёт на финальном месте

  const onLayout = () => {
    if (!origin) return;
    runOnUI(() => {
      'worklet';
      const m = measure(ref);
      if (m && m.width) {
        // смещение центров: откуда лететь относительно конечного места
        dx.value = origin.x + origin.w / 2 - (m.pageX + m.width / 2);
        dy.value = origin.y + origin.h / 2 - (m.pageY + m.height / 2);
        dScale.value = origin.w / m.width;
        progress.value = withTiming(1, {
          duration: FLY_MS,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        });
      }
      shown.value = 1;
    })();
  };

  const fly = useAnimatedStyle(() => {
    const k = 1 - progress.value;
    return {
      opacity: shown.value,
      transform: [
        { translateX: dx.value * k },
        { translateY: dy.value * k },
        { scale: 1 + (dScale.value - 1) * k },
      ],
    };
  });

  return (
    <Animated.View
      ref={ref}
      onLayout={onLayout}
      style={[st.imWrap, { borderColor: t.frame, shadowColor: t.accent }, fly]}
    >
      <Image source={cardImages[cardId]} style={st.im} contentFit="cover" transition={200} cachePolicy="memory-disk" />
    </Animated.View>
  );
}

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  // позицию ячейки забираем один раз при монтировании
  const [origin] = React.useState(() => takeCardOrigin(id ?? ''));

  const card = cardById.get(id ?? '');
  if (!card) return null;

  const num = card.arcana === 'major' ? ROMAN[card.number] : String(card.number);
  const arcanaLabel =
    card.arcana === 'major'
      ? lang === 'ru' ? 'СТАРШИЙ АРКАН' : 'MAJOR ARCANA'
      : `${tr(`cards.${card.suit}`)}`.toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingHorizontal: spacing.xl,
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.hero}>
          <View>
            {/* виньетка: тёплое свечение позади карты */}
            <Glow size={GLOW_SIZE} />
            {origin ? (
              <HeroImage cardId={card.id} origin={origin} />
            ) : (
              <FadeUp index={0}>
                <HeroImage cardId={card.id} origin={null} />
              </FadeUp>
            )}
          </View>
          <FadeUp index={0} style={{ flex: 1 }}>
            <Text style={[st.num, { color: t.muted }]}>{num} · {arcanaLabel}</Text>
            <Text style={[st.name, { color: t.head }]}>{card.name[lang]}</Text>
            <View style={st.kws}>
              {card.keywords[lang].map((k) => (
                <View key={k} style={[st.kw, { backgroundColor: t.chipBg, borderColor: t.line }]}>
                  <Text style={{ color: t.accent, fontSize: 10, fontWeight: '600' }}>{k}</Text>
                </View>
              ))}
            </View>
          </FadeUp>
        </View>

        {BLOCKS.map((b, bi) => {
          const block = card.content[b];
          if (!block) return null;
          const text = block.status === 'todo' ? tr('card.soon') : block[lang];
          return (
            <FadeUp key={b} index={1 + bi} style={[st.block, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Text style={[st.blockTitle, { color: t.accent }]}>{tr(`card.${b}`).toUpperCase()}</Text>
              <Text
                style={[
                  st.blockText,
                  { color: block.status === 'todo' ? t.muted : t.text },
                  block.status === 'todo' && { fontStyle: 'italic' },
                ]}
              >
                {text}
              </Text>
            </FadeUp>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: 'row', gap: spacing.l, alignItems: 'flex-start' },
  imWrap: {
    width: 128,
    aspectRatio: 0.58,
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  im: { width: '100%', height: '100%' },
  num: { fontSize: 9.5, letterSpacing: 2.5 },
  name: { fontFamily: fonts.display, fontSize: 30, marginTop: 4, lineHeight: 34 },
  kws: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.m },
  kw: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  block: { borderWidth: 1, borderRadius: radius.l, padding: spacing.l, marginTop: spacing.m },
  blockTitle: { fontSize: 9, letterSpacing: 2.5 },
  blockText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 24, marginTop: 7 },
});
