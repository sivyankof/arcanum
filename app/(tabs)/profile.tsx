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
import { BirthArcanaCard } from '../../src/components/BirthArcanaCard';
import { EmptyState } from '../../src/components/EmptyState';
import { FadeUp } from '../../src/components/FadeUp';
import { FilterChips } from '../../src/components/FilterChips';
import { JournalRow } from '../../src/components/JournalRow';
import { LevelCard } from '../../src/components/LevelCard';
import { MonthCard } from '../../src/components/MonthCard';
import { MonthNav } from '../../src/components/MonthNav';
import { PressableScale } from '../../src/components/PressableScale';
import { Rule } from '../../src/components/Rule';
import { ScreenBg } from '../../src/components/ScreenBg';
import { StatBox } from '../../src/components/StatBox';
import { Txt } from '../../src/components/Txt';
import { localDateISO } from '../../src/lib/dates';
import { hapticTap } from '../../src/lib/haptics';
import { useLang } from '../../src/lib/i18n';
import {
  entriesOfMonth,
  filterJournal,
  journalCounts,
  journalKey,
  journalMonths,
  journalOfMonth,
  JOURNAL_FILTERS,
  monthSummary,
  OUTCOME_MARK,
  outcomeStats,
  type JournalEntry,
  type JournalFilter,
} from '../../src/lib/journal';
import { pickPhrase } from '../../src/lib/phrases';
import { useTabTopRef } from '../../src/lib/useTabScrollToTop';
import { useApp } from '../../src/store/useApp';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** Сколько записей участвует в появлении экрана — примерно один экран строк. */
const BODY_ROWS = 4;
/** Шаг каскада тела списка: на ступеньку позже шапки дневника (motion-spec §4). */
const BODY_STEP = 4;

export default function ProfileScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = useLang();

  const listRef = useTabTopRef<FlatList<JournalEntry>>();

  const streak = useApp((s) => s.streak);
  const history = useApp((s) => s.history);
  const spreadsHistory = useApp((s) => s.spreadsHistory);
  const freezes = useApp((s) => s.freezes);
  const xp = useApp((s) => s.xp);
  const name = useApp((s) => s.profile.name);

  const months = React.useMemo(() => journalMonths(history, spreadsHistory), [history, spreadsHistory]);
  const [picked, setPicked] = React.useState<string | null>(null);
  // выбранный месяц держим «мягко»: если записи появились или уехали (сброс карты дня),
  // возвращаемся к самому свежему месяцу вместо пустого экрана
  const month = picked && months.includes(picked) ? picked : months[0];

  const entries = React.useMemo(() => (month ? entriesOfMonth(history, month) : []), [history, month]);
  const summary = React.useMemo(() => (month ? monthSummary(history, month) : null), [history, month]);
  const stats = React.useMemo(() => (month ? outcomeStats(history, month) : null), [history, month]);

  const [filter, setFilter] = React.useState<JournalFilter>('all');
  // смена месяца сбрасывает фильтр: счётчики в чипах относятся к текущему месяцу
  React.useEffect(() => setFilter('all'), [month]);

  const items = React.useMemo(
    () => (month ? journalOfMonth(history, spreadsHistory, month) : []),
    [history, spreadsHistory, month],
  );
  const counts = React.useMemo(() => journalCounts(items), [items]);
  // чип с нулём не показываем — тап по нему вёл бы в пустоту; «Все» остаётся всегда
  const chips = React.useMemo(
    () => JOURNAL_FILTERS.filter((f) => f === 'all' || counts[f] > 0),
    [counts],
  );
  // фильтр сбрасывается и когда его чип пропал из ленты: иначе запись, потерявшая заметку
  // или ответ, оставляет пользователя с пустым списком и без чипа, чтобы вернуться к «Все»
  React.useEffect(() => {
    if (!chips.includes(filter)) setFilter('all');
  }, [chips, filter]);

  const shown = React.useMemo(() => filterJournal(items, filter), [items, filter]);

  // месяцы отсортированы от новых к старым: старший месяц лежит ДАЛЬШЕ по списку
  const index = month ? months.indexOf(month) : -1;
  const hasPrev = index >= 0 && index < months.length - 1;
  const hasNext = index > 0;

  const today = localDateISO();
  const openCard = (id: string) => router.push({ pathname: '/card/[id]', params: { id, from: 'journal' } });
  const openSpread = (ts: number) => router.push({ pathname: '/spread/[ts]', params: { ts: String(ts) } });

  const header = (
    <>
      <FadeUp index={0} style={st.pad}>
        {/* эталон: overline «ВАШ ПУТЬ» + имя; имени нет (пропущено в онбординге) — «Профиль» */}
        <Txt style={[st.overline, { color: t.muted }]}>{tr('profile.overline')}</Txt>
        <Txt style={[st.title, { color: t.head }]}>{name ?? tr('profile.title')}</Txt>
      </FadeUp>

      <FadeUp index={1} style={st.pad}>
        <Rule />
        <LevelCard xp={xp} />
      </FadeUp>

      <FadeUp index={2} style={[st.stats, st.pad]}>
        {/* огонёк — иконкой, как на «Сегодня»: эмодзи из макета рядом с иконочным
            огоньком той же серии выглядел бы вторым, чужим (правка по лайв-проверке) */}
        <StatBox value={streak} label={tr('profile.streak')} icon="flame" />
        <StatBox value={history.length} label={tr('profile.cards')} />
        {/* снежинка — иконкой, как огонёк: эмодзи ❄ из макета — указание на смысл,
            не на способ рисования (правило задачи 16); цвет accent — холодный синий
            в палитру «Небесного золота» не вводим (спека 10) */}
        <StatBox value={freezes} label={tr('profile.freeze')} icon="snow" />
      </FadeUp>

      <FadeUp index={2} style={st.pad}>
        <BirthArcanaCard lang={lang} />
      </FadeUp>

      {month && summary && (
        <FadeUp index={3} style={st.pad}>
          <MonthNav
            month={month}
            lang={lang}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={() => setPicked(months[index + 1])}
            onNext={() => setPicked(months[index - 1])}
          />
          <MonthCard summary={summary} stats={stats} lang={lang} onPress={openCard} />
        </FadeUp>
      )}

      {month && chips.length > 1 && (
        <FadeUp index={3}>
          <FilterChips
            values={chips}
            // «Все» и «С заметкой» — текст из i18n; три ответа — знак ✓/≈/✗ (один источник
            // на весь экран, см. OUTCOME_MARK). У каждого чипа свой счётчик (design-reference.html)
            labels={(f) =>
              f === 'all' || f === 'note'
                ? `${tr(`journal.filters.${f}`)} ${counts[f]}`
                : `${OUTCOME_MARK[f]} ${counts[f]}`
            }
            active={filter}
            onPick={setFilter}
            contentStyle={st.chips}
          />
        </FadeUp>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenBg />
      <FlatList
        ref={listRef}
        data={shown}
        keyExtractor={journalKey}
        renderItem={({ item, index }) => {
          const row = (
            <JournalRow
              item={item}
              lang={lang}
              onPress={() => (item.kind === 'day' ? openCard(item.entry.cardId) : openSpread(item.entry.ts))}
              // правится только сегодняшняя запись дня (logic-spec §3); у раскладов правки нет
              onEdit={
                item.kind === 'day' && item.entry.date === today
                  ? () => router.push({ pathname: '/note/[date]', params: { date: item.entry.date } })
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
        ListEmptyComponent={
          <View style={st.pad}>
            <EmptyState
              text={
                items.length === 0
                  ? pickPhrase('empty.journal', today, lang)
                  : pickPhrase('empty.filter', today, lang)
              }
            />
          </View>
        }
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
  chips: { marginTop: 12 },
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // `.date`
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // `.h2`
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 }, // `.statrow`
  // сама коробка (`.statbox`) живёт в компоненте StatBox — коробок три, заморозку добавила задача 10
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
