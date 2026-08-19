/** Альбом коллекции (спека 46; product-spec §3 «Коллекция»; logic-spec §13): панель «Открыто N из 78»
 *  с полосой, затем секции в порядке COLLECTION_GROUPS — сетка (есть открытые карты: заголовок
 *  «НАЗВАНИЕ · N ИЗ M» + ряды CardCell, закрытые — рубашки) или строка CountRow (ни одной открытой).
 *  Всё выводится из learnedCardIds, ничего не хранится. Список — FlatList с типизированными
 *  элементами: до 78 миниатюр, нужна виртуализация, как в справочнике. Каскад появления — шапка 0,
 *  панель 1, первый экран секций 2 (строки мастей 3, `.d4`/`.d5` эталона), дальше без анимации
 *  (правило тела списков, задача 17). */
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { ReduceMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardCell, CardGridRow, GRID_COLS, GRID_GAP } from '../src/components/CardCell';
import { CountRow } from '../src/components/CountRow';
import { FadeUp } from '../src/components/FadeUp';
import { PROGRESS_EASE, ProgressBar } from '../src/components/ProgressBar';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { toRows } from '../src/lib/cardSearch';
import {
  collectionProgress,
  collectionSections,
  sectionMode,
  type CollectionSection,
} from '../src/lib/collection';
import { cards, course, type TarotCard } from '../src/lib/content';
import { learnedCardIds } from '../src/lib/courseProgress';
import { useLang } from '../src/lib/i18n';
import { useBackHaptic } from '../src/lib/useBackHaptic';
import { useApp } from '../src/store/useApp';
import { fonts, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

/** Элементы списка: заголовок секции-сетки, ряд ≤3 карт, строка секции без открытых. */
type Item =
  | { kind: 'header'; key: string; section: CollectionSection }
  | { kind: 'row'; key: string; cards: TarotCard[]; first: boolean }
  | { kind: 'suit'; key: string; section: CollectionSection; afterGrid: boolean };

const FILL_DELAY = 400; // полоса прогресса — тайминг LevelCard (эталон fill2: задержка .4s, ход 1.4s)
const FILL_MS = 1400;
/** Сколько элементов после панели прогресса участвуют в каскаде появления — примерно первый экран. */
const FADE_ITEMS = 6;

function buildItems(sections: readonly CollectionSection[]): Item[] {
  const items: Item[] = [];
  let prevGrid = false;
  for (const s of sections) {
    if (sectionMode(s) === 'grid') {
      items.push({ kind: 'header', key: `h-${s.group}`, section: s });
      toRows(s.cards, GRID_COLS).forEach((row, i) =>
        items.push({ kind: 'row', key: `r-${s.group}-${i}`, cards: row, first: i === 0 }),
      );
      prevGrid = true;
    } else {
      items.push({ kind: 'suit', key: `s-${s.group}`, section: s, afterGrid: prevGrid });
      prevGrid = false;
    }
  }
  return items;
}

/** Отступ элемента от предыдущего — значения эталона: заголовок секции `.date margin-top:18`,
 *  первый ряд сетки `.grid margin-top:10`, ряды между собой — зазор сетки, строки мастей 8
 *  (`.suitrow`) и 16 после сетки (`.fadeup d5`). Первый элемент после панели — всегда 18. */
function topGap(item: Item, index: number): number {
  if (index === 0) return 18;
  if (item.kind === 'header') return 18;
  if (item.kind === 'row') return item.first ? 10 : GRID_GAP;
  return item.afterGrid ? 16 : 8;
}

export default function CollectionScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  useBackHaptic();

  // одно множество с бейджем «ИЗУЧЕНО ✓» справочника и колодой тренажёра (решение спеки 46, вопрос 6)
  const lessonsProgress = useApp((s) => s.lessonsProgress);
  const learned = React.useMemo(() => learnedCardIds(course, lessonsProgress), [lessonsProgress]);
  const sections = React.useMemo(() => collectionSections(cards, learned), [learned]);
  const { open, total } = collectionProgress(sections);
  const items = React.useMemo(() => buildItems(sections), [sections]);

  const fill = useSharedValue(0);
  React.useEffect(() => {
    fill.value = withDelay(
      FILL_DELAY,
      withTiming(total ? open / total : 0, { duration: FILL_MS, easing: PROGRESS_EASE, reduceMotion: ReduceMotion.System }),
    );
  }, [fill, open, total]);

  // название секции: старшие — свой ключ, масти — подписи чипов справочника (одно слово на два экрана)
  const sectionTitle = (s: CollectionSection) => (s.group === 'major' ? tr('collection.major') : tr(`cards.${s.group}`));
  const ofTotal = (s: CollectionSection) => tr('collection.ofTotal', { open: s.open, total: s.total });

  const renderItem = ({ item, index }: ListRenderItemInfo<Item>) => {
    let body: React.ReactNode;
    if (item.kind === 'header') {
      // `.date` влево: капс через toUpperCase (прецедент SpreadRow)
      body = (
        <Txt style={[st.section, { color: t.muted }]}>
          {`${sectionTitle(item.section).toUpperCase()} · ${ofTotal(item.section)}`}
        </Txt>
      );
    } else if (item.kind === 'row') {
      body = (
        <CardGridRow count={item.cards.length}>
          {item.cards.map((c) => (
            <CardCell key={c.id} card={c} lang={lang} from="collection" closed={!learned.has(c.id)} />
          ))}
        </CardGridRow>
      );
    } else {
      body = <CountRow title={sectionTitle(item.section)} count={item.section.open} total={item.section.total} />;
    }
    const content = <View style={{ marginTop: topGap(item, index) }}>{body}</View>;
    return index < FADE_ITEMS ? <FadeUp index={item.kind === 'suit' ? 3 : 2}>{content}</FadeUp> : content;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.cards') }} />
      <ScreenBg />
      <FlatList
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // как урок, страница карты и тренажёр: insets.top + высота системной шапки
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
        ListHeaderComponent={
          <>
            <FadeUp index={0}>
              <Txt style={[st.overline, { color: t.muted }]}>{tr('collection.overline')}</Txt>
              <Txt style={[st.title, { color: t.head }]}>{tr('collection.title')}</Txt>
            </FadeUp>
            <FadeUp index={1}>
              {/* .colprog: panel + line, radius 15, паддинг 12/15, отступ 14; строка Cormorant 600 16 head;
                  полоса 6/3 с отступом 8, заливка открыто/всего */}
              <View style={[st.prog, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Txt style={[st.progText, { color: t.head }]}>{tr('collection.opened', { open, total })}</Txt>
                <ProgressBar progress={fill} radius={3} style={st.bar} />
              </View>
              {/* подсказка только пока ничего не открыто: экран не пуст (структура альбома видна),
                  поэтому не EmptyState — решение спеки 46 */}
              {open === 0 && <Txt style={[st.hint, { color: t.muted }]}>{tr('collection.hint')}</Txt>}
            </FadeUp>
          </>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  // значения — CSS `#v-collection` эталона: .date/.h2/.colprog/.colbar/.grid/.suitrow
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  prog: { borderWidth: 1, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15, marginTop: 14 }, // .colprog
  progText: { fontFamily: fonts.displaySemi, fontSize: 16 }, // .colprog b — Cormorant 600
  bar: { height: 6, marginTop: 8 }, // .colbar
  hint: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', alignSelf: 'center', maxWidth: 270, marginTop: 18 },
  section: { fontSize: 9.5, letterSpacing: 3.5 }, // .date слева — заголовок секции-сетки
});
