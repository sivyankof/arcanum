/** Веб-версия выбора даты: три списка (день / месяц / год) + OK.
 *  У @react-native-community/datetimepicker веб-реализации нет; без замены шаг 2 онбординга
 *  нечем прокликать в браузере (проверка 6а/6б). Точность жеста — на устройстве. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { localDateISO, parseISODate } from '../lib/dates';
import { localeTag } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

const DEFAULT_DATE = new Date(1995, 5, 15);
const MIN_YEAR = 1900;

/** Дней в месяце (месяц 0–11): new Date(y, m+1, 0) — последний день месяца m. */
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function DatePicker({
  visible,
  value,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string | null;
  title: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const locale = localeTag(i18n.language.startsWith('ru') ? 'ru' : 'en');

  const init = value ? parseISODate(value) : DEFAULT_DATE;
  const [day, setDay] = React.useState(init.getDate());
  const [month, setMonth] = React.useState(init.getMonth());
  const [year, setYear] = React.useState(init.getFullYear());
  React.useEffect(() => {
    if (visible) {
      const d = value ? parseISODate(value) : DEFAULT_DATE;
      setDay(d.getDate());
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  }, [visible, value]);

  const now = new Date();
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= MIN_YEAR; y--) years.push(y);
  // названия месяцев — из локали, не руками (спека 09 §10)
  const months = Array.from({ length: 12 }, (_, m) =>
    new Date(2000, m, 1).toLocaleDateString(locale, { month: 'long' }),
  );
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  // День зажимаем СРАЗУ при смене месяца или года, а не только в confirm: список дней
  // короче на феврале, и при day=31 в колонке не подсвечено ни одной строки — выбранное
  // значение просто исчезает из виду, а по OK молча уходит другое число.
  const pickMonth = (m: number) => {
    setMonth(m);
    setDay((d) => Math.min(d, daysInMonth(year, m)));
  };
  const pickYear = (y: number) => {
    setYear(y);
    setDay((d) => Math.min(d, daysInMonth(y, month)));
  };

  const confirm = () => {
    // страховка на границе: 29 февраля в невисокосном году
    let picked = new Date(year, month, Math.min(day, daysInMonth(year, month)));
    if (picked > now) picked = now; // будущее закрыто, как maximumDate нативного пикера
    onPick(localDateISO(picked));
    onClose();
  };

  const column = <T extends number>(
    items: T[],
    selected: T,
    label: (v: T) => string,
    onSel: (v: T) => void,
  ) => (
    <ScrollView style={st.col}>
      {items.map((v) => (
        <Pressable
          key={v}
          onPress={() => onSel(v)}
          style={[st.row, v === selected && { backgroundColor: t.chipBg, borderColor: t.frame }]}
        >
          <Txt style={{ color: v === selected ? t.head : t.text, fontSize: 13.5 }}>{label(v)}</Txt>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <View style={st.cols}>
        {column(days, day, String, setDay)}
        {column(Array.from({ length: 12 }, (_, m) => m), month, (m) => months[m], pickMonth)}
        {column(years, year, String, pickYear)}
      </View>
      <Pressable onPress={confirm} style={[st.done, { borderColor: t.frame }]}>
        <Txt style={[st.doneTxt, { color: t.accent }]}>{tr('settings.ok')}</Txt>
      </Pressable>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  cols: { flexDirection: 'row', gap: 6, height: 240, marginBottom: spacing.m },
  col: { flex: 1 },
  row: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.s,
    paddingVertical: 8,
    paddingHorizontal: spacing.s,
    marginBottom: 3,
    alignItems: 'center',
  },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
