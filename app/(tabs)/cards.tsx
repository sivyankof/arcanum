import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardCell, CardGridRow, GRID_COLS, GRID_GAP } from '../../src/components/CardCell';
import { FadeUp } from '../../src/components/FadeUp';
import { FilterChips } from '../../src/components/FilterChips';
import { GlassPanel } from '../../src/components/GlassPanel';
import { PROGRESS_EASE, ProgressBar } from '../../src/components/ProgressBar';
import { ScreenBg } from '../../src/components/ScreenBg';
import { SearchField } from '../../src/components/SearchField';
import { Txt } from '../../src/components/Txt';
import { CARD_FILTERS, filterCards, toRows, type CardFilter } from '../../src/lib/cardSearch';
import { collectionSections, filterProgress } from '../../src/lib/collection';
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

/** Заливка панели прогресса: при входе — от нуля с задержкой (тайминг LevelCard), при смене чипа —
 *  перетекание к новому значению без задержки. */
const FILL_DELAY = 400;
const FILL_MS = 1400;
const FILL_SWITCH_MS = 600;

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
  const label = (f: CardFilter) => tr(f === 'all' ? 'cards.all' : f === 'learned' ? 'cards.learnedFilter' : `cards.${f}`);

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

  // карты пройденных уроков — бейдж «ИЗУЧЕНО ✓», приглушение, чип «Изучено» и панель прогресса (спеки 08/46б)
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const learned = useMemo(() => learnedCardIds(course, lessonsProgress), [lessonsProgress]);

  // 78 карт фильтруются мгновенно — задержки ввода (debounce) не нужно
  const rows = useMemo(
    () => toRows(filterCards(cards, { query, filter, lang, learned }), GRID_COLS),
    [query, filter, lang, learned],
  );

  // панель прогресса (спека 46б): «Изучено N из M» под активным чипом — то же множество, что бейджи
  const sections = useMemo(() => collectionSections(cards, learned), [learned]);
  const progress = filterProgress(sections, filter);
  const chipLabel = filter === 'all' || filter === 'learned' ? null : tr(`cards.${filter}`);
  const progressText = chipLabel
    ? tr('cards.learnedCountIn', { label: chipLabel, ...progress })
    : tr('cards.learnedCount', progress);
  const ratio = progress.total ? progress.open / progress.total : 0;
  const fill = useSharedValue(0);
  const firstFill = useRef(true);
  useEffect(() => {
    const first = firstFill.current;
    firstFill.current = false;
    fill.value = withDelay(
      first ? FILL_DELAY : 0,
      withTiming(ratio, { duration: first ? FILL_MS : FILL_SWITCH_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, ratio]);

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
              {/* панель прогресса изучения (`.colprog`, спека 46б): строка под активным чипом + полоса */}
              <View style={[st.prog, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.progText, { color: t.head }]}>{progressText}</Txt>
                <ProgressBar progress={fill} radius={3} style={st.progBar} />
              </View>
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
            <CardGridRow count={row.length} style={st.pad}>
              {row.map((c) => (
                <CardCell key={c.id} card={c} lang={lang} badge={learned.has(c.id) ? tr('cards.learned') : undefined} dimmed={!learned.has(c.id)} />
              ))}
            </CardGridRow>
          );
          // сетка входит вместе с шапкой — но ОДНИМ блоком, как `.grid` в эталоне: у всех рядов
          // один и тот же индекс каскада, ступенек между карточками нет (motion-spec §4).
          // Ниже первого экрана анимации нет: иначе ряды всплывали бы прямо во время прокрутки
          return index < BODY_ROWS ? <FadeUp index={BODY_STEP}>{cells}</FadeUp> : cells;
        }}
        ListFooterComponent={
          rows.length === 0 ? (
            // подсказка про первый урок — только пока изученных нет вовсе; с изученными
            // пустой результат — обычное «такой карты нет»
            <Txt style={[st.empty, { color: t.muted }]}>
              {tr(filter === 'learned' && learned.size === 0 ? 'cards.learnedEmpty' : 'cards.empty')}
            </Txt>
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
  // .colprog: панель прогресса под заголовком
  prog: { borderWidth: 1, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15, marginTop: 14 },
  progText: { fontFamily: fonts.displaySemi, fontSize: 16 }, // .colprog b — Cormorant 600
  progBar: { height: 6, marginTop: 8 }, // .colbar
  // .stickysearch эталона: 14 сверху, 4 снизу; ещё 15 до сетки — .grid margin-top
  flowBar: { paddingTop: 14, paddingBottom: 4, marginBottom: 15 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  // .cardsbar .search: поле в панели поджато против варианта в потоке (11×15)
  // отступ от краёв экрана поле и чипы держат сами (см. Filters): у поля это внешний отступ,
  // у ленты чипов — внутренний, чтобы прокрутка уходила под самый край
  searchPad: { marginHorizontal: spacing.xl },
  searchCompact: { paddingVertical: 9, paddingHorizontal: 14 },
  segRowCompact: { marginTop: 8 },
  empty: { fontSize: 12.5, textAlign: 'center', marginTop: 40, paddingHorizontal: spacing.xl },
});
