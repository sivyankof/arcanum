/** Веб-версия выбора времени: список целых часов.
 *
 *  У @react-native-community/datetimepicker веб-реализации нет вовсе, а без неё экран
 *  «Настройки» нечем прокликать в браузере — то есть шаг 6а процесса по этой задаче
 *  выполнить было бы невозможно. Минуты в вебе не выбираются: там проверяется поведение
 *  экрана, а точное время — на устройстве.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { formatHHMM, parseHHMM } from '../lib/settings';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

export function TimePicker({
  visible,
  value,
  title,
  hours = [7, 8, 9, 10, 11],
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string;
  title: string;
  hours?: number[];
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const current = parseHHMM(value, hours[0]).hour;

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <ScrollView style={{ maxHeight: 260 }}>
        {hours.map((h) => {
          const selected = h === current;
          return (
            <Pressable
              key={h}
              onPress={() => {
                onPick(formatHHMM(h, 0));
                onClose();
              }}
              style={[st.row, selected && { backgroundColor: t.chipBg, borderColor: t.frame }]}
            >
              <Txt style={{ color: selected ? t.head : t.text, fontSize: 15.5, flex: 1 }}>
                {`${h}:00`}
              </Txt>
              {selected && <Txt style={{ color: t.accent, fontSize: 13 }}>✓</Txt>}
            </Pressable>
          );
        })}
      </ScrollView>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.m,
    paddingVertical: 11,
    paddingHorizontal: spacing.m,
    marginBottom: 5,
  },
});
