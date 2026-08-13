import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { FilterChips } from '../../src/components/FilterChips';
import { GlassPanel } from '../../src/components/GlassPanel';
import { PressableScale } from '../../src/components/PressableScale';
import { ScreenBg } from '../../src/components/ScreenBg';
import { SearchField } from '../../src/components/SearchField';
import { Skeleton } from '../../src/components/Skeleton';
import { Txt } from '../../src/components/Txt';
import { cardImages } from '../../src/lib/cardImages';
import { CARD_FILTERS, filterCards, toRows, type CardFilter } from '../../src/lib/cardSearch';
import { setCardOrigin } from '../../src/lib/cardTransition';
import { cards, course, type TarotCard } from '../../src/lib/content';
import { learnedCardIds } from '../../src/lib/courseProgress';
import { useScrollAwareBar } from '../../src/lib/useScrollAwareBar';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

const { width: W } = Dimensions.get('window');
const COLS = 3;
const GAP = 11; // .grid эталона: gap 11 в обе стороны
const CELL_W = (W - spacing.xl * 2 - GAP * (COLS - 1)) / COLS;

/** Сколько рядов сетки участвует в появлении экрана — примерно один экран карточек. */
const BODY_ROWS = 4;
/** Шаг каскада для тела списка: на две ступеньки позже шапки, как `.grid d4` против `.d2` эталона. */
const BODY_STEP = 3;

/** Размытие парящей панели в CSS-пикселях эталона (`.cardsbar`: backdrop-filter blur(20px)). */
const BAR_BLUR = 20;
/** Растворяется только нижний край панели — сверху её ограничивает край экрана. */
const BAR_FADE = 14;

const AnimatedList = Animated.createAnimatedComponent(FlatList<TarotCard[]>);

/** Ячейка сетки. Позицию картинки меряем на нажатии — с неё начнётся перелёт
 *  на страницу карты (пункт 6 motion-spec). */
function Cell({ item, lang, learned }: { item: TarotCard; lang: 'ru' | 'en'; learned: boolean }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const imRef = React.useRef<View>(null);
  const [loaded, setLoaded] = React.useState(false);

  return (
    <PressableScale
      onPressIn={() =>
        imRef.current?.measureInWindow((x, y, w, h) => {
          if (w) setCardOrigin(item.id, { x, y, w, h });
        })
      }
      onPress={() => router.push(`/card/${item.id}?from=cards`)}
      style={st.cell}
    >
      <View ref={imRef} style={[st.imWrap, { borderColor: t.line }]}>
        <Image
          source={cardImages[item.id]}
          style={st.im}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          onLoad={() => setLoaded(true)}
        />
        {!loaded && <Skeleton style={StyleSheet.absoluteFill} />}
        {learned && (
          <View style={st.learned}>
            <Txt style={[st.learnedTxt, { color: t.accent2 }]}>{tr('cards.learned')}</Txt>
          </View>
        )}
      </View>
      <Txt numberOfLines={2} style={[st.name, { color: t.muted }]}>
        {item.name[lang]}
      </Txt>
    </PressableScale>
  );
}

type FiltersProps = {
  query: string;
  onQuery: (v: string) => void;
  filter: CardFilter;
  onFilter: (f: CardFilter) => void;
  /** вариант внутри парящей панели: поле и чипы поджаты (`.cardsbar .search` / `.seg`) */
  compact?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

/** Поиск + чипы. Живут в двух местах сразу — в потоке шапки и в парящей панели, — поэтому
 *  разметка одна, а различаются экземпляры только отступами. */
function Filters({ query, onQuery, filter, onFilter, compact, onFocus, onBlur }: FiltersProps) {
  const { t: tr } = useTranslation();
  const label = (f: CardFilter) => tr(f === 'all' ? 'cards.all' : `cards.${f}`);

  return (
    <>
      <SearchField
        value={query}
        onChangeText={onQuery}
        placeholder={tr('cards.searchPlaceholder')}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[st.searchPad, compact && st.searchCompact]}
      />
      <FilterChips
        values={CARD_FILTERS}
        labels={label}
        active={filter}
        onPick={onFilter}
        contentStyle={compact && st.segRowCompact}
      />
    </>
  );
}

export default function CardsScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const [filter, setFilter] = useState<CardFilter>('all');
  const [query, setQuery] = useState('');

  const listRef = useTabTopRef<FlatList<TarotCard[]>>();
  const { onScroll, barStyle, onBarLayout, setFocused } = useScrollAwareBar();

  // 78 карт фильтруются мгновенно — задержки ввода (debounce) не нужно
  const rows = useMemo(
    () => toRows(filterCards(cards, { query, filter, lang }), COLS),
    [query, filter, lang],
  );

  // карты пройденных уроков — бейдж «Изучено ✓» (спека 08)
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const learned = useMemo(() => learnedCardIds(course, lessonsProgress), [lessonsProgress]);

  // поиск всегда идёт по всей колоде: иначе «Мечи» + «шут» дают пустой экран без видимой причины
  const onQuery = (v: string) => {
    setQuery(v);
    if (v.trim() && filter !== 'all') setFilter('all');
  };

  const filters = { query, onQuery, filter, onFilter: setFilter };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      {/* список идёт от самого верха экрана: иначе стекло панели не накроет статус-бар,
          а контент не будет затуманиваться, проходя под ней. Безопасная зона — в паддинге */}
      <AnimatedList
        ref={listRef}
        data={rows}
        keyExtractor={(row, i) => row[0]?.id ?? `row-${i}`}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // на устройстве клавиатура прячется только при реальном перетаскивании; react-native-web
        // жеста не видит и снимает фокус на ЛЮБОМ событии скролла — поэтому в вебе исключение
        // «не прятать панель, пока поле в фокусе» не срабатывает, а на iOS/Android работает
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListHeaderComponent={
          <>
            <FadeUp index={0} style={st.pad}>
              <Txt style={[st.sub, { color: t.muted }]}>
                {lang === 'ru' ? 'СПРАВОЧНИК · РАЙДЕР–УЭЙТ 1909' : 'REFERENCE · RIDER–WAITE 1909'}
              </Txt>
              <Txt style={[st.title, { color: t.head }]}>{tr('cards.title')}</Txt>
            </FadeUp>
            {/* поиск и чипы БЕЗ внешнего паддинга: отступы они задают себе сами, поэтому
                лента чипов прокручивается от края до края экрана, а не обрывается за 24px
                до него (замечено Артёмом 11.08) */}
            <FadeUp index={1} style={st.flowBar}>
              <Filters {...filters} />
            </FadeUp>
          </>
        }
        renderItem={({ item: row, index }) => {
          const cells = (
            <View style={[st.pad, st.row]}>
              {row.map((c) => (
                <Cell key={c.id} item={c} lang={lang} learned={learned.has(c.id)} />
              ))}
              {/* добивка неполного ряда, чтобы карты не растягивались на всю ширину */}
              {row.length < COLS &&
                Array.from({ length: COLS - row.length }, (_, i) => (
                  <View key={`gap-${i}`} style={{ width: CELL_W }} />
                ))}
            </View>
          );
          // сетка входит вместе с шапкой — но ОДНИМ блоком, как `.grid` в эталоне: у всех рядов
          // один и тот же индекс каскада, ступенек между карточками нет (motion-spec §4).
          // Ниже первого экрана анимации нет: иначе ряды всплывали бы прямо во время прокрутки
          return index < BODY_ROWS ? <FadeUp index={BODY_STEP}>{cells}</FadeUp> : cells;
        }}
        ListFooterComponent={
          rows.length === 0 ? (
            <Txt style={[st.empty, { color: t.muted }]}>{tr('cards.empty')}</Txt>
          ) : null
        }
      />

      {/* парящая панель: «крыша экрана», а не остров — от края до края, из-под статус-бара */}
      <Animated.View style={[st.bar, barStyle]} onLayout={onBarLayout}>
        <GlassPanel
          blur={BAR_BLUR}
          fadeBottom={BAR_FADE}
          // горизонтальных паддингов у панели нет: их держат само поле и лента чипов,
          // иначе чипы обрывались бы, не доехав до края экрана
          style={{ paddingTop: insets.top + 10, paddingBottom: BAR_FADE }}
        >
          <Filters
            {...filters}
            compact
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </GlassPanel>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  pad: { paddingHorizontal: spacing.xl },
  sub: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center', paddingTop: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 },
  // .stickysearch эталона: 14 сверху, 4 снизу; ещё 15 до сетки — .grid margin-top
  flowBar: { paddingTop: 14, paddingBottom: 4, marginBottom: 15 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  // .cardsbar .search: поле в панели поджато против варианта в потоке (11×15)
  // отступ от краёв экрана поле и чипы держат сами (см. Filters): у поля это внешний отступ,
  // у ленты чипов — внутренний, чтобы прокрутка уходила под самый край
  searchPad: { marginHorizontal: spacing.xl },
  searchCompact: { paddingVertical: 9, paddingHorizontal: 14 },
  segRowCompact: { marginTop: 8 },
  row: { flexDirection: 'row', gap: GAP },
  cell: { width: CELL_W },
  imWrap: {
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    aspectRatio: 0.58,
    // .gc .im: тень по прямоугольнику миниатюры (design-system §4)
    boxShadow: '0px 8px 20px rgba(0,0,0,0.28)',
  },
  im: { width: '100%', height: '100%' },
  // .st2 эталона: скрим-подложка литералом — как тень imWrap (не тема: затемнение поверх фото)
  learned: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.s,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  learnedTxt: { fontSize: 8, letterSpacing: 0.5, fontWeight: '700' },
  name: { fontSize: 9.5, textAlign: 'center', marginTop: 5, fontWeight: '600', letterSpacing: 0.3, lineHeight: 12 },
  empty: { fontSize: 12.5, textAlign: 'center', marginTop: 40, paddingHorizontal: spacing.xl },
});
