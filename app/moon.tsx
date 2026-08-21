/** Лунный календарь (спека 47; product-spec §1а; logic-spec §6): текущий месяц одним экраном —
 *  шапка месяца, строка луны (та же, что на «Сегодня»), сетка 7 колонок с глифами событий,
 *  строки новолуния/полнолуния с местным временем. Всё выводится из времени — стора нет.
 *  «Сейчас» берётся при монтировании и на возврате из фона (useAppActive, правило 06а);
 *  переход через полночь при открытом экране таймером не ловим — обновится на следующем
 *  возврате из фона. Композиция — #v-moon эталона. */
import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeUp } from '../src/components/FadeUp';
import { MoonRow } from '../src/components/MoonRow';
import { MoonSpreadPanel } from '../src/components/MoonSpreadPanel';
import { Rule } from '../src/components/Rule';
import { ScreenBg } from '../src/components/ScreenBg';
import { Txt } from '../src/components/Txt';
import { formatDayMonth, formatMonthTitle, formatTime, localDateISO, weekdayLabels } from '../src/lib/dates';
import { useLang } from '../src/lib/i18n';
import { WEEK_START } from '../src/lib/lang';
import { moonInfo, type MoonEventKind } from '../src/lib/moon';
import { monthEvents, monthGrid } from '../src/lib/moonCalendar';
import { useAppActive } from '../src/lib/useAppActive';
import { fonts, LOCKED_OPACITY, spacing } from '../src/theme/theme';
import { useTheme } from '../src/theme/useTheme';

// .mooncal: 7 колонок, зазор 4
const COLS = 7;
const GAP = 4;

/** Глиф события: ● новолуние (заливка text), ○ полнолуние (кольцо accent). View-кружок, а не
 *  символ шрифта: символ зависел бы от системного шрифта платформы, кружок — нет.
 *  size 6 в ячейке (border 1), 14 в строке события (border 1.5). */
function EventGlyph({ kind, size }: { kind: MoonEventKind; size: number }) {
  const t = useTheme();
  const ring = kind === 'full';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ring ? 'transparent' : t.text,
        borderWidth: ring ? (size > 8 ? 1.5 : 1) : 0,
        borderColor: t.accent,
      }}
    />
  );
}

export default function MoonScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // «сейчас» — при монтировании и на возврате из фона
  const [now, setNow] = React.useState(() => new Date());
  useAppActive(() => setNow(new Date()));

  const year = now.getFullYear();
  const month0 = now.getMonth();
  const today = now.getDate();
  const moon = moonInfo(now);
  const grid = monthGrid(year, month0, WEEK_START[lang]);
  const events = monthEvents(year, month0);
  const labels = weekdayLabels(lang);
  // в один день два события не попадают: между соседними ≈14.8 суток
  const glyphByDay = new Map(events.map((e) => [e.day, e.kind]));
  const cells: Array<number | null> = [
    ...Array.from({ length: grid.leading }, () => null),
    ...Array.from({ length: grid.daysInMonth }, (_, i) => i + 1),
  ];
  // Ширина ячейки из ширины контента: 7 ячеек + 6 зазоров; квадрат — явной высотой.
  // Деление обычное, БЕЗ Math.floor: у макета `repeat(7,1fr)` остатка нет в принципе, а округление
  // вниз копило бы неразделённые 3–6px одним куском у правого края (у ряда без justifyContent
  // дефолт flex-start). Тот же приём уже работает у сетки справочника — CELL_W в CardCell.tsx.
  const cellSize = (width - spacing.xl * 2 - GAP * (COLS - 1)) / COLS;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerBackTitle: tr('tabs.today') }} />
      <ScreenBg />
      <ScrollView
        contentContainerStyle={{
          // как тренажёр и урок: insets.top + высота системной шапки, иначе контент уедет под неё
          paddingTop: insets.top + 64 + spacing.l,
          paddingHorizontal: spacing.xl,
          paddingBottom: 120,
        }}
      >
        <FadeUp index={0}>
          <Txt style={[st.overline, { color: t.muted }]}>
            {formatMonthTitle(localDateISO(now).slice(0, 7), lang).toUpperCase()}
          </Txt>
          <Txt style={[st.title, { color: t.head }]}>{tr('moon.title')}</Txt>
          <Rule glyph="☾" />
        </FadeUp>

        <FadeUp index={1}>
          <MoonRow phase={moon.phase} day={moon.day} />
          <View style={st.grid}>
            {labels.map((l) => (
              <Txt key={l} style={[st.weekday, { width: cellSize, color: t.muted }]}>
                {l}
              </Txt>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <View key={`empty-${i}`} style={{ width: cellSize, height: cellSize }} />;
              const past = d < today;
              const kind = glyphByDay.get(d);
              return (
                <View
                  key={d}
                  style={[
                    st.cell,
                    { width: cellSize, height: cellSize },
                    d === today && { borderColor: t.accent, backgroundColor: t.chipBg },
                    past && st.dim,
                  ]}
                >
                  <Txt style={[st.cellNum, { color: past ? t.muted : t.text }]}>{d}</Txt>
                  {kind && (
                    <View style={st.cellGlyph}>
                      <EventGlyph kind={kind} size={6} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </FadeUp>

        <FadeUp index={2}>
          {events.map((e) => (
            <React.Fragment key={e.at.getTime()}>
              <View
                style={[st.event, { backgroundColor: t.panel, borderColor: t.frame }, e.day < today && st.dim]}
              >
                <EventGlyph kind={e.kind} size={14} />
                <View style={st.eventTexts}>
                  <Txt style={[st.eventTitle, { color: t.accent }]}>
                    {`${tr(`moon.${e.kind}`)} · ${formatDayMonth(localDateISO(e.at), lang)} · ${formatTime(e.at, lang)}`.toUpperCase()}
                  </Txt>
                  <Txt style={[st.eventHint, { color: t.head }]}>
                    {tr(e.kind === 'new' ? 'moon.newHint' : 'moon.fullHint')}
                  </Txt>
                </View>
              </View>
              {/* панель расклада: момент события передаётся пропом, чтобы она судила о СВОЁМ
                  событии. Своего гейта видимости у экрана НЕТ — панель сама прячется под уже
                  прошедшим событием с закрытым окном (иначе гейт и окно разъезжаются) */}
              <MoonSpreadPanel kind={e.kind} at={e.at} now={now} />
            </React.Fragment>
          ))}
        </FadeUp>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  // значения — CSS #v-moon эталона: .date/.h2/.mooncal/.wd/.dcell/.today2/.dim/.mevent
  overline: { fontSize: 9.5, letterSpacing: 3.5, textAlign: 'center' }, // .date
  title: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginTop: 3 }, // .h2
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 12 }, // .mooncal
  weekday: { fontSize: 8.5, letterSpacing: 1, textAlign: 'center', paddingVertical: 4 }, // .wd
  cell: { borderWidth: 1, borderColor: 'transparent', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, // .dcell
  cellNum: { fontSize: 11 },
  cellGlyph: { marginTop: 1 },
  dim: { opacity: LOCKED_OPACITY }, // .dim — прошедшие дни и события
  // .mevent: панель panel/frame, radius 14, паддинг 12/14, отступ 9, ряд gap 12
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 9,
  },
  // сжимаемый текст — flex 1 (в RN flexShrink по умолчанию 0, урок задачи 16)
  eventTexts: { flex: 1 },
  eventTitle: { fontSize: 9, letterSpacing: 2 }, // .mevent b
  eventHint: { fontFamily: fonts.display, fontSize: 14.5 }, // .mevent span
});
