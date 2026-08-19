import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardCell, CELL_W, GRID_COLS, GRID_GAP } from '../../src/components/CardCell';
import { FadeUp } from '../../src/components/FadeUp';
import { FilterChips } from '../../src/components/FilterChips';
import { GlassPanel } from '../../src/components/GlassPanel';
import { ScreenBg } from '../../src/components/ScreenBg';
import { SearchField } from '../../src/components/SearchField';
import { Txt } from '../../src/components/Txt';
import { CARD_FILTERS, filterCards, toRows, type CardFilter } from '../../src/lib/cardSearch';
import { cards, course, type TarotCard } from '../../src/lib/content';
import { learnedCardIds } from '../../src/lib/courseProgress';
import { useLang } from '../../src/lib/i18n';
import { useScrollAwareBar } from '../../src/lib/useScrollAwareBar';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Сколько рядов сетки участвует в появлении экрана — примерно один экран карточек. */
const BODY_ROWS = 4;
/** Шаг каскада для тела списка: на две ступеньки позже шапки, как `.grid d4` против `.d2` эталона. */
const BODY_STEP = 3;

/** Размытие парящей панели в CSS-пикселях эталона (`.cardsbar`: backdrop-filter blur(20px)). */
const BAR_BLUR = 20;
/** Растворяется только нижний край панели — сверху её ограничивает край экрана. */
const BAR_FADE = 14;

const AnimatedList = Animated.createAnimatedComponent(FlatList<TarotCard[]>);

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
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const [filter, setFilter] = useState<CardFilter>('all');
  const [query, setQuery] = useState('');

  const listRef = useTabTopRef<FlatList<TarotCard[]>>();
  const { onScroll, barStyle, onBarLayout, setFocused } = useScrollAwareBar();

  // 78 карт фильтруются мгновенно — задержки ввода (debounce) не нужно
  const rows = useMemo(
    () => toRows(filterCards(cards, { query, filter, lang }), GRID_COLS),
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
        ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
        ListHeaderComponent={
          <>
            <FadeUp index={0} style={st.pad}>
              <Txt style={[st.sub, { color: t.muted }]}>{tr('cards.subtitle')}</Txt>
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
                <CardCell key={c.id} card={c} lang={lang} from="cards" badge={learned.has(c.id) ? tr('cards.learned') : undefined} />
              ))}
              {/* добивка неполного ряда, чтобы карты не растягивались на всю ширину */}
              {row.length < GRID_COLS &&
                Array.from({ length: GRID_COLS - row.length }, (_, i) => (
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
  row: { flexDirection: 'row', gap: GRID_GAP },
  empty: { fontSize: 12.5, textAlign: 'center', marginTop: 40, paddingHorizontal: spacing.xl },
});
