/** Выбор даты рождения — системный пикер (спека 09), пара к TimePicker: та же схема
 *  «iOS-колесо в ModalPanel с черновиком и OK, Android — системный диалог».
 *  Веб-реализации у пакета нет — она в соседнем DatePicker.web.tsx, Metro подставит сам. */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { localDateISO, parseISODate } from '../lib/dates';
import { localeTag } from '../lib/lang';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

/** Стартовая позиция колеса, пока дата не выбрана: середина диапазона аудитории (спека 09). */
const DEFAULT_DATE = new Date(1995, 5, 15);
const MIN_DATE = new Date(1900, 0, 1);

export function DatePicker({
  visible,
  value,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** YYYY-MM-DD; null — дата ещё не выбрана */
  value: string | null;
  title: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { t: tr, i18n } = useTranslation();
  const locale = localeTag(i18n.language.startsWith('ru') ? 'ru' : 'en');
  const date = React.useMemo(() => (value ? parseISODate(value) : DEFAULT_DATE), [value]);
  // верхнюю границу фиксируем на монтирование: колесо iOS шлёт onChange на КАЖДЫЙ тик
  // прокрутки (ловушка 06б), а `new Date()` прямо в пропе давал бы пикеру новое значение
  // границы на каждое движение пальца
  const maxDate = React.useMemo(() => new Date(), []);

  // Черновик и «OK» — как в TimePicker: iOS-колесо шлёт onChange на КАЖДЫЙ тик прокрутки
  // (ловушка 06б), поэтому крутить ≠ сохранять; запись — только кнопкой.
  const [draft, setDraft] = React.useState(date);
  React.useEffect(() => {
    if (visible) setDraft(date);
  }, [visible, date]);

  const onChangeAndroid = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || !picked) {
      onClose();
      return;
    }
    onPick(localDateISO(picked));
    onClose();
  };

  const onChangeIOS = (_event: DateTimePickerEvent, picked?: Date) => {
    if (picked) setDraft(picked);
  };

  const confirmIOS = () => {
    onPick(localDateISO(draft));
    onClose();
  };

  if (!visible) return null;

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        minimumDate={MIN_DATE}
        maximumDate={maxDate}
        onChange={onChangeAndroid}
      />
    );
  }

  return (
    <ModalPanel visible onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <DateTimePicker
        value={draft}
        mode="date"
        display="spinner"
        minimumDate={MIN_DATE}
        maximumDate={maxDate}
        onChange={onChangeIOS}
        // тема приложения — своя настройка; без themeVariant колесо красится под системную
        // тему телефона и на светлом iOS с тёмной темой приложения невидимо (ловушка 06б)
        themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
        // ...и ровно то же самое с ЯЗЫКОМ (найдено Артёмом 13.08 на лайв-проверке): названия
        // месяцев в колесе шли по-английски при русских и приложении, и телефоне. iOS локализует
        // системные виджеты по списку языков приложения-ХОСТА, а хост здесь — Expo Go, и русского
        // в его списке нет. Проп locale документация пакета не советует «в общем случае», но прямо
        // называет надёжным для display="spinner" — наш случай.
        locale={locale}
      />
      <Pressable onPress={confirmIOS} style={[st.done, { borderColor: t.frame }]}>
        <Txt style={[st.doneTxt, { color: t.accent }]}>{tr('settings.ok')}</Txt>
      </Pressable>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
