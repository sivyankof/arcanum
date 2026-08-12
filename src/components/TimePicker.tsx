/** Выбор времени напоминания — системный пикер (@react-native-community/datetimepicker,
 *  входит в Expo Go SDK 54). Решение Артёма 12.08: родной жест и минуты важнее единства стиля.
 *  Веб-реализации у пакета нет — она лежит в соседнем TimePicker.web.tsx, Metro подставит его сам.
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { formatHHMM, parseHHMM } from '../lib/settings';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

export function TimePicker({
  visible,
  value,
  title,
  onPick,
  onClose,
}: {
  visible: boolean;
  /** 'HH:MM' */
  value: string;
  title: string;
  /** Список часов используется только веб-реализацией; в нативной проп игнорируется. */
  hours?: number[];
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const { hour, minute } = parseHHMM(value, 9);
  const date = React.useMemo(() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [hour, minute]);

  const onChange = (event: DateTimePickerEvent, picked?: Date) => {
    // Android рисует системный диалог сам: 'dismissed' = отмена, 'set' = выбор
    if (event.type === 'dismissed' || !picked) {
      onClose();
      return;
    }
    onPick(formatHHMM(picked.getHours(), picked.getMinutes()));
    if (Platform.OS === 'android') onClose();
  };

  if (!visible) return null;

  // Android: компонент сам открывает системный диалог, обёртка не нужна
  if (Platform.OS === 'android') {
    return <DateTimePicker value={date} mode="time" is24Hour display="default" onChange={onChange} />;
  }

  // iOS: колесо живёт внутри нашей модалки, закрытие — своей кнопкой
  return (
    <ModalPanel visible onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <DateTimePicker value={date} mode="time" is24Hour display="spinner" onChange={onChange} />
      <Pressable onPress={onClose} style={[st.done, { borderColor: t.frame }]}>
        <Txt style={[st.doneTxt, { color: t.accent }]}>OK</Txt>
      </Pressable>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
