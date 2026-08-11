/** Профиль: статистика пути + дневник карт дня (спека 05).
 *
 *  Список — FlatList, а не ScrollView: записей в месяце до 31, а шапка (статы, навигатор,
 *  карточка месяца) едет вместе с ними как ListHeaderComponent (product-spec §5).
 *  Утилитарные строки (тема, язык, dev-сброс) уехали на экран «Настройки» за шестерёнку —
 *  профиль остаётся эмоциональным «путём».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeUp } from '../../src/components/FadeUp';
import { JournalRow } from '../../src/components/JournalRow';
import { MonthCard } from '../../src/components/MonthCard';
import { MonthNav } from '../../src/components/MonthNav';
import { PressableScale } from '../../src/components/PressableScale';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { localDateISO } from '../../src/lib/dates';
import { hapticTap } from '../../src/lib/haptics';
import { entriesOfMonth, monthsWithEntries, monthSummary, type DailyDraw } from '../../src/lib/journal';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Сколько записей участвует в появлении экрана — примерно один экран строк. */
const BODY_ROWS = 4;
/** Шаг каскада тела списка: на ступеньку позже шапки дневника (motion-spec §4). */
const BODY_STEP = 3;

export default function ProfileScreen() {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = (i18n.language.startsWith('ru') ? 'ru' : 'en') as 'ru' | 'en';

  const listRef = useTabTopRef<FlatList<DailyDraw>>();

  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);

  const months = React.useMemo(() => monthsWithEntries(history), [history]);
  const [picked, setPicked] = React.useState<string | null>(null);
  // выбранный месяц держим «мягко»: если записи появились или уехали (сброс карты дня),
  // возвращаемся к самому свежему месяцу вместо пустого экрана
  const month = picked && months.includes(picked) ? picked : months[0];

  const entries = React.useMemo(() => (month ? entriesOfMonth(history, month) : []), [history, month]);
  const summary = React.useMemo(() => (month ? monthSummary(history, month) : null), [history, month]);

  // месяцы отсортированы от новых к старым: старший месяц лежит ДАЛЬШЕ по списку
  const index = month ? months.indexOf(month) : -1;
  const hasPrev = index >= 0 && index < months.length - 1;
  const hasNext = index > 0;

  const today = localDateISO();
  const openCard = (id: string) => router.push({ pathname: '/card/[id]', params: { id, from: 'journal' } });

  const header = (
    <>
      <FadeUp index={0} style={st.pad}>
        <Txt style={[st.title, { color: t.head }]}>{tr('profile.title')}</Txt>
      </FadeUp>

      <FadeUp index={1} style={[st.stats, st.pad]}>
        <View style={[st.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Txt style={[st.statNum, { color: t.head }]}>{streak}</Txt>
          <Txt style={[st.statLbl, { color: t.muted }]}>{tr('profile.streak')}</Txt>
        </View>
        <View style={[st.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Txt style={[st.statNum, { color: t.head }]}>{history.length}</Txt>
          <Txt style={[st.statLbl, { color: t.muted }]}>{tr('profile.cards')}</Txt>
        </View>
      </FadeUp>

      {month && summary && (
        <FadeUp index={2} style={st.pad}>
          <MonthNav
            month={month}
            lang={lang}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={() => setPicked(months[index + 1])}
            onNext={() => setPicked(months[index - 1])}
          />
          <MonthCard summary={summary} lang={lang} onPress={openCard} />
        </FadeUp>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <FlatList
        ref={listRef}
        data={entries}
        keyExtractor={(e) => e.date}
        renderItem={({ item, index }) => {
          const row = (
            <JournalRow
              entry={item}
              lang={lang}
              onPress={() => openCard(item.cardId)}
              // правится только сегодняшняя запись (logic-spec §3)
              onEdit={
                item.date === today
                  ? () => router.push({ pathname: '/note/[date]', params: { date: item.date } })
                  : undefined
              }
            />
          );
          // записи входят вместе с шапкой одним блоком (motion-spec §4); ниже первого экрана
          // анимации нет, иначе строки всплывали бы во время прокрутки
          return index < BODY_ROWS ? (
            <FadeUp index={BODY_STEP} style={st.pad}>{row}</FadeUp>
          ) : (
            <View style={st.pad}>{row}</View>
          );
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={st.pad}><EmptyState text={tr('journal.empty')} /></View>}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* шестерёнка — поверх списка, чтобы не уезжала со скроллом (эталон: правый верхний угол) */}
      <PressableScale
        onPress={() => {
          hapticTap();
          router.push('/settings');
        }}
        style={[st.gear, { top: insets.top + spacing.xl, backgroundColor: t.panel, borderColor: t.line }]}
      >
        <Ionicons name="settings-outline" size={17} color={t.muted} />
      </PressableScale>
    </View>
  );
}

const st = StyleSheet.create({
  // горизонтальный отступ держат сами элементы, а не контейнер списка: иначе лента чипов
  // обрывается за 24px до края экрана (правило задачи 19, design-system §5)
  pad: { marginHorizontal: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.xl },
  stat: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.l, paddingVertical: spacing.l },
  statNum: { fontFamily: fonts.display, fontSize: 30 },
  statLbl: { fontSize: 9, letterSpacing: 2, marginTop: 2 },
  gear: {
    position: 'absolute',
    right: spacing.xl,
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
