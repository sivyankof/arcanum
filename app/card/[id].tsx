import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  measure,
  ReduceMotion,
  runOnJS,
  runOnUI,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Block } from '../../src/components/Block';
import { FadeUp } from '../../src/components/FadeUp';
import { PressableScale } from '../../src/components/PressableScale';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { takeCardOrigin, type Rect } from '../../src/lib/cardTransition';
import { cardImages } from '../../src/lib/cardImages';
import { cardById, cardNumeral } from '../../src/lib/content';
import { formatDayMonth } from '../../src/lib/dates';
import { hapticTap } from '../../src/lib/haptics';
import { cardHistory } from '../../src/lib/journal';
import { useApp } from '../../src/store/useApp';
import { fonts, gold, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

const FLY_MS = 350;

/** Подпись нативной кнопки «назад» по источнику перехода (параметр from). */
const BACK_TITLES: Record<string, string> = {
  today: 'card.backToday',
  journal: 'card.backProfile',
};

/** Ключ сферы значения — вкладки под героем страницы карты. Строгий порядок эталона.
 *  tabKey — подпись вкладки, blockKey — заголовок блока значения снизу. */
type SphereKey = 'general' | 'love' | 'career' | 'finances' | 'health';

const SPHERES: { key: SphereKey; tabKey: string; blockKey: string }[] = [
  { key: 'general', tabKey: 'card.tabGeneral', blockKey: 'card.general' },
  { key: 'love', tabKey: 'card.love', blockKey: 'card.sphereLove' },
  { key: 'career', tabKey: 'card.career', blockKey: 'card.sphereCareer' },
  { key: 'finances', tabKey: 'card.finances', blockKey: 'card.sphereFinances' },
  { key: 'health', tabKey: 'card.health', blockKey: 'card.sphereHealth' },
];

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
  const hover = useSharedValue(0); // парение героя (эталон .hero .im: hov 4.5s ease-in-out infinite)

  // Парение стартует ПОСЛЕ «перелёта» из сетки (иначе смешается с ним и собьёт замер),
  // а при обычном открытии карты — сразу
  React.useEffect(() => {
    hover.value = withDelay(
      origin ? FLY_MS : 0,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2250, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
          withTiming(0, { duration: 2250, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
        ),
        -1,
      ),
    );
  }, [hover, origin]);

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
        { translateY: dy.value * k + hover.value },
        { scale: 1 + (dScale.value - 1) * k },
      ],
    };
  });

  return (
    // тень и обрезка — на разных View: на iOS overflow:'hidden' срезает собственную тень
    <Animated.View
      ref={ref}
      onLayout={onLayout}
      style={[st.imShadow, { boxShadow: `0px 18px 40px ${t.glow}`, backgroundColor: t.bg }, fly]}
    >
      <View style={[st.imClip, { borderColor: t.frame }]}>
        <Image source={cardImages[cardId]} style={st.im} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      </View>
    </Animated.View>
  );
}

export default function CardDetail() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  // позицию ячейки забираем один раз при монтировании
  const [origin] = React.useState(() => takeCardOrigin(id ?? ''));
  // активная вкладка сферы значения — не персистится, при каждом открытии страницы сброс на «Общее»
  const [sphere, setSphere] = React.useState<SphereKey>('general');
  const fade = useSharedValue(1);
  // Хуки должны вызываться до условного return, иначе нарушится их порядок между рендерами.
  // Селектор возвращает примитив (id карты, а не саму функцию todayDraw), иначе стор не
  // уведомит компонент об обновлении при вытягивании новой карты дня
  const todayCardId = useApp((s) => s.todayDraw()?.cardId);
  const history = useApp((s) => s.history);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  // вибрация при возврате: кнопка «назад» теперь системная (нативная), на неё нельзя повесить
  // onPress, поэтому ловим сам уход с экрана — это покрывает и тап по кнопке, и свайп-жест назад
  const navigation = useNavigation();
  React.useEffect(() => navigation.addListener('beforeRemove', () => { hapticTap(); }), [navigation]);

  const card = cardById.get(id ?? '');
  if (!card) return null;

  // контекстный блок «ваша карта сегодня» (product-spec §3): поднимается над вкладками,
  // получает золотую рамку и звёздочку в заголовке; на обычном месте блок не дублируется
  const isTodayCard = todayCardId === card.id;

  const num = cardNumeral(card);
  const arcanaLabel =
    card.arcana === 'major'
      ? lang === 'ru' ? 'СТАРШИЙ АРКАН' : 'MAJOR ARCANA'
      : `${tr(`cards.${card.suit}`)}`.toUpperCase();

  // текст и статус блока контента по ключу — общая логика для вкладки сферы
  // и для постоянных блоков ниже (перевёрнутая / как карта дня / символика)
  const blockOf = (key: string): { text: string; todo: boolean } => {
    const block = card.content[key];
    if (!block || block.status === 'todo') return { text: tr('card.soon'), todo: true };
    return { text: block[lang], todo: false };
  };

  const applySphere = (key: SphereKey) => {
    setSphere(key);
    fade.value = withTiming(1, { duration: 350, reduceMotion: ReduceMotion.System });
  };

  const onTabPress = (key: SphereKey) => {
    if (key === sphere) return; // повторный тап по активной вкладке — ничего
    hapticTap();
    fade.value = withTiming(0, { duration: 130, reduceMotion: ReduceMotion.System }, (finished) => {
      if (finished) runOnJS(applySphere)(key);
    });
  };

  // личная история: сколько раз карта выпадала, когда в последний раз и последняя заметка
  const personal = cardHistory(history, card.id);
  const lastDay = personal.lastDate ? formatDayMonth(personal.lastDate, lang) : '';
  const personalText = [
    // при единственном выпадении «выпадала 1 раз · последняя 10 августа» звучит как отчёт;
    // одной датой — по-человечески
    personal.times === 1
      ? tr('journal.drawnOnce', { date: lastDay })
      : `${tr('journal.drawn', { count: personal.times })} · ${tr('journal.lastDate', { date: lastDay })}`,
    personal.lastNote ? `«${personal.lastNote}»` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const activeSphere = SPHERES.find((s) => s.key === sphere)!;
  const sphereBlock = blockOf(sphere);
  const reversed = blockOf('reversed');
  const dayCard = blockOf('day_card');
  const symbolism = blockOf('symbolism');

  // индексы каскада FadeUp: контекстный блок «как карта дня» встаёт перед вкладками
  // и сдвигает всё, что идёт следом, на один шаг; символика всегда последняя (5)
  const idxTabs = isTodayCard ? 2 : 1;
  const idxSphere = isTodayCard ? 3 : 2;
  const idxReversed = isTodayCard ? 4 : 3;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* подпись нативной кнопки «назад» зависит от источника перехода (параметр from):
          с «Сегодня» — «Сегодня», из дневника — «Профиль», иначе (сетка справочника
          или прямая ссылка) — «Карты» */}
      <Stack.Screen options={{ headerBackTitle: tr(BACK_TITLES[from ?? ''] ?? 'card.backAll') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // insets.top + высота системной шапки (64) — со значением поменьше контент уедет под неё,
          // такая ошибка уже была
          paddingTop: insets.top + 64,
          paddingHorizontal: spacing.xl,
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.hero}>
          {origin ? (
            <HeroImage cardId={card.id} origin={origin} />
          ) : (
            <FadeUp index={0}>
              <HeroImage cardId={card.id} origin={null} />
            </FadeUp>
          )}
          <FadeUp index={0} style={{ flex: 1 }}>
            <Txt style={[st.num, { color: t.muted }]}>{num} · {arcanaLabel}</Txt>
            <Txt style={[st.name, { color: t.head }]}>{card.name[lang]}</Txt>
            <View style={st.kws}>
              {card.keywords[lang].map((k) => (
                <View key={k} style={[st.kw, { backgroundColor: t.chipBg, borderColor: t.line }]}>
                  <Txt style={{ color: t.accent, fontSize: 10, fontWeight: '600' }}>{k}</Txt>
                </View>
              ))}
            </View>
          </FadeUp>
        </View>

        {/* контекстный блок «ваша карта сегодня» (product-spec §3): выше вкладок,
            золотая рамка вместо обычной + звёздочка перед заголовком */}
        {isTodayCard && (
          <FadeUp index={1}>
            <Block
              title={tr('card.todayHighlight').toUpperCase()}
              text={dayCard.text}
              todo={dayCard.todo}
              accentBorder
              star
            />
          </FadeUp>
        )}

        {/* вкладки сфер значения (.tabs эталона) */}
        <FadeUp index={idxTabs} style={[st.tabs, { backgroundColor: t.panel, borderColor: t.line }]}>
          {SPHERES.map((s) => {
            const active = s.key === sphere;
            return (
              <PressableScale
                key={s.key}
                onPress={() => onTabPress(s.key)}
                style={[st.tab, active && { boxShadow: `0px 4px 12px ${t.glow}` }]}
              >
                {active && (
                  <View style={st.tabFill}>
                    <LinearGradient
                      colors={gold.tabGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0.6 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                )}
                <Txt style={[st.tabLabel, { color: active ? gold.text : t.muted }]}>{tr(s.tabKey)}</Txt>
              </PressableScale>
            );
          })}
        </FadeUp>

        {/* блок активной сферы: заголовок и текст гаснут/проявляются при смене вкладки */}
        <FadeUp index={idxSphere}>
          <Block title={tr(activeSphere.blockKey)} text={sphereBlock.text} todo={sphereBlock.todo} contentStyle={fadeStyle} />
        </FadeUp>

        {/* постоянные блоки — всегда видны, порядок по product-spec §3 */}
        <FadeUp index={idxReversed}>
          <Block title={tr('card.reversed')} text={reversed.text} todo={reversed.todo} />
        </FadeUp>
        {!isTodayCard && (
          <FadeUp index={4}>
            <Block title={tr('card.day_card')} text={dayCard.text} todo={dayCard.todo} />
          </FadeUp>
        )}
        <FadeUp index={5}>
          <Block title={tr('card.symbolism')} text={symbolism.text} todo={symbolism.todo} />
        </FadeUp>

        {/* личная история карты (logic-spec §3): только если карта уже выпадала.
            Счётчик «отзывалась N» добавит задача 06 — ответов рефлексии пока нет */}
        {personal.times > 0 && (
          <FadeUp index={5}>
            <Block title={tr('journal.cardHistory').toUpperCase()} text={personalText} accentBorder />
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: 'row', gap: spacing.l, alignItems: 'flex-start' },
  // виньетка = тёплое свечение вокруг карты; в эталоне `.hero .im`: box-shadow 0 18px 40px var(--glow).
  // Значение берём напрямую из CSS макета — boxShadow принимает ту же синтаксическую форму
  imShadow: {
    width: 128,
    aspectRatio: 0.58,
    borderRadius: radius.m,
  },
  imClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
  },
  im: { width: '100%', height: '100%' },
  num: { fontSize: 9.5, letterSpacing: 2.5 },
  name: { fontFamily: fonts.display, fontSize: 26, marginTop: 4, lineHeight: 32 },
  kws: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.m },
  kw: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  // пилюля вкладок (.tabs эталона)
  tabs: { flexDirection: 'row', gap: 5, marginTop: 18, borderWidth: 1, borderRadius: 14, padding: 4 },
  tab: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  // тень активной вкладки из эталона `.tabs button.on`: 0 4px 12px var(--glow) — задаётся
  // инлайн (boxShadow зависит от темы, см. JSX выше); заливка градиентом живёт в tabFill.
  // Подложка-фон под тень (как раньше требовали старые shadow*-пропы) больше не нужна
  tabFill: { ...StyleSheet.absoluteFillObject, borderRadius: 11, overflow: 'hidden' },
  tabLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textAlign: 'center' },
});
