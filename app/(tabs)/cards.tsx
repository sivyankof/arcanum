import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { PressableScale } from '../../src/components/PressableScale';
import { ScreenBg } from '../../src/components/ScreenBg';
import { SearchField } from '../../src/components/SearchField';
import { Skeleton } from '../../src/components/Skeleton';
import { StickyGlass } from '../../src/components/StickyGlass';
import { Txt } from '../../src/components/Txt';
import { cardImages } from '../../src/lib/cardImages';
import { CARD_FILTERS, filterCards, toRows, type CardFilter } from '../../src/lib/cardSearch';
import { setCardOrigin } from '../../src/lib/cardTransition';
import { cards, type TarotCard } from '../../src/lib/content';
import { hapticTap } from '../../src/lib/haptics';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

const { width: W } = Dimensions.get('window');
const COLS = 3;
const GAP = 11; // .grid эталона: gap 11 в обе стороны
const CELL_W = (W - spacing.xl * 2 - GAP * (COLS - 1)) / COLS;

/** Ячейка сетки. Позицию картинки меряем на нажатии — с неё начнётся перелёт
 *  на страницу карты (пункт 6 motion-spec). */
function Cell({ item, lang }: { item: TarotCard; lang: 'ru' | 'en' }) {
  const t = useTheme();
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
      </View>
      <Txt numberOfLines={2} style={[st.name, { color: t.muted }]}>
        {item.name[lang]}
      </Txt>
    </PressableScale>
  );
}

export default function CardsScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const [filter, setFilter] = useState<CardFilter>('all');
  const [query, setQuery] = useState('');

  // 78 карт фильтруются мгновенно — задержки ввода (debounce) не нужно
  const rows = useMemo(
    () => toRows(filterCards(cards, { query, filter, lang }), COLS),
    [query, filter, lang],
  );

  const label = (f: CardFilter) => tr(f === 'all' ? 'cards.all' : `cards.${f}`);

  // поиск всегда идёт по всей колоде: иначе «Мечи» + «шут» дают пустой экран без видимой причины
  const onQuery = (v: string) => {
    setQuery(v);
    if (v.trim() && filter !== 'all') setFilter('all');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      {/* отступ сверху даёт обёртка, а не содержимое списка: липкая панель должна
          останавливаться под статус-баром, а не под ним же уезжать */}
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <SectionList
          sections={[{ data: rows }]}
          keyExtractor={(row, i) => row[0]?.id ?? `row-${i}`}
          stickySectionHeadersEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          ListHeaderComponent={
            <FadeUp index={0} style={st.pad}>
              <Txt style={[st.sub, { color: t.muted }]}>
                {lang === 'ru' ? 'СПРАВОЧНИК · РАЙДЕР–УЭЙТ 1909' : 'REFERENCE · RIDER–WAITE 1909'}
              </Txt>
              <Txt style={[st.title, { color: t.head }]}>{tr('cards.title')}</Txt>
            </FadeUp>
          }
          renderSectionHeader={() => (
            // липкая панель: поиск + чипы на «невидимом стекле» с растворёнными краями
            <StickyGlass style={st.sticky}>
              <View style={st.pad}>
                <SearchField
                  value={query}
                  onChangeText={onQuery}
                  placeholder={tr('cards.searchPlaceholder')}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[st.pad, st.segRow]}
              >
                {CARD_FILTERS.map((f) => (
                  <PressableScale
                    key={f}
                    onPress={() => {
                      hapticTap();
                      setFilter(f);
                    }}
                    style={[
                      st.seg,
                      {
                        borderColor: filter === f ? t.frame : t.line,
                        backgroundColor: filter === f ? t.chipBg : 'transparent',
                      },
                    ]}
                  >
                    <Txt style={[st.segTxt, { color: filter === f ? t.accent : t.muted }]}>
                      {label(f)}
                    </Txt>
                  </PressableScale>
                ))}
              </ScrollView>
            </StickyGlass>
          )}
          renderItem={({ item: row }) => (
            <View style={[st.pad, st.row]}>
              {row.map((c) => (
                <Cell key={c.id} item={c} lang={lang} />
              ))}
              {/* добивка неполного ряда, чтобы карты не растягивались на всю ширину */}
              {row.length < COLS &&
                Array.from({ length: COLS - row.length }, (_, i) => (
                  <View key={`gap-${i}`} style={{ width: CELL_W }} />
                ))}
            </View>
          )}
          ListFooterComponent={
            rows.length === 0 ? (
              <Txt style={[st.empty, { color: t.muted }]}>{tr('cards.empty')}</Txt>
            ) : null
          }
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  pad: { paddingHorizontal: spacing.xl },
  sub: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center', paddingTop: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 },
  // паддинги увеличены против макета (14/12), чтобы зоны растворения краёв умещались в них
  // и не наползали на поле поиска и чипы; фон и края рисует StickyGlass
  sticky: { paddingTop: 22, paddingBottom: 20 },
  segRow: { flexDirection: 'row', gap: 6, marginTop: 9 },
  seg: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  segTxt: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
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
  name: { fontSize: 9.5, textAlign: 'center', marginTop: 5, fontWeight: '600', letterSpacing: 0.3, lineHeight: 12 },
  empty: { fontSize: 12.5, textAlign: 'center', marginTop: 40, paddingHorizontal: spacing.xl },
});
