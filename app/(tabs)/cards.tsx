import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../../src/components/FadeUp';
import { ScreenBg } from '../../src/components/ScreenBg';
import { cards, type TarotCard } from '../../src/lib/content';
import { cardImages } from '../../src/lib/cardImages';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

const { width: W } = Dimensions.get('window');
const COLS = 3;
const GAP = 10;
const CELL_W = (W - spacing.xl * 2 - GAP * (COLS - 1)) / COLS;

type Filter = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
const FILTERS: Filter[] = ['all', 'major', 'wands', 'cups', 'swords', 'pentacles'];

export default function CardsScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';
  const [filter, setFilter] = useState<Filter>('all');

  const data = useMemo(() => {
    if (filter === 'all') return cards;
    if (filter === 'major') return cards.filter((c) => c.arcana === 'major');
    return cards.filter((c) => c.suit === filter);
  }, [filter]);

  const label = (f: Filter) =>
    f === 'all' ? (lang === 'ru' ? 'Все' : 'All') : tr(`cards.${f === 'major' ? 'major' : f}`);

  const renderCard = ({ item }: { item: TarotCard }) => (
    <Pressable
      onPress={() => router.push(`/card/${item.id}`)}
      style={({ pressed }) => [st.cell, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[st.imWrap, { borderColor: t.line }]}>
        <Image source={cardImages[item.id]} style={st.im} contentFit="cover" transition={180} cachePolicy="memory-disk" />
      </View>
      <Text numberOfLines={1} style={[st.name, { color: t.muted }]}>
        {item.name[lang]}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
          gap: GAP + 4,
        }}
        renderItem={renderCard}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.m }}>
            <FadeUp index={0}>
              <Text style={[st.sub, { color: t.muted }]}>
                {lang === 'ru' ? 'СПРАВОЧНИК · РАЙДЕР–УЭЙТ 1909' : 'REFERENCE · RIDER–WAITE 1909'}
              </Text>
              <Text style={[st.title, { color: t.head }]}>{tr('cards.title')}</Text>
            </FadeUp>
            <FadeUp index={1} style={st.segRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    st.seg,
                    { borderColor: filter === f ? t.frame : t.line, backgroundColor: filter === f ? t.chipBg : 'transparent' },
                  ]}
                >
                  <Text style={{ color: filter === f ? t.accent : t.muted, fontSize: 11, fontWeight: '700' }}>
                    {label(f)}
                  </Text>
                </Pressable>
              ))}
            </FadeUp>
          </View>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  sub: { fontSize: 9.5, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 4 },
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: spacing.l },
  seg: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7 },
  cell: { width: CELL_W },
  imWrap: {
    borderRadius: radius.m,
    borderWidth: 1,
    overflow: 'hidden',
    aspectRatio: 0.58,
  },
  im: { width: '100%', height: '100%' },
  name: { fontSize: 10, textAlign: 'center', marginTop: 5, fontWeight: '600' },
});
