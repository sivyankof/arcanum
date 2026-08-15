/** Список-модалка «выбери один вариант»: overline-заголовок и строки с галочкой на текущем.
 *
 *  Второе появление этой разметки (первое — выбор часа в вебе, TimePicker.web) — вынесена по правилу
 *  «2+ раза → общий компонент»; здесь живёт выбор языка (спека 27), дальше — расклады.
 *  Тап по уже выбранному варианту — «закрыть без изменений»: onPick не зовётся, значение не менялось
 *  (для часа это ещё и защита минут — см. TimePicker.web). Тап по скриму закрывает (ModalPanel).
 *  Значения стилей — те же, что были у списка часов: ничего визуально не меняется. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
import { Txt } from './Txt';

export function OptionPicker<K extends string>({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly { key: K; label: string }[];
  value: K;
  onPick: (key: K) => void;
  onClose: () => void;
}) {
  const t = useTheme();

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <ScrollView style={{ maxHeight: 260 }}>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                if (!selected) onPick(o.key);
                onClose();
              }}
              style={[st.row, selected && { backgroundColor: t.chipBg, borderColor: t.frame }]}
            >
              <Txt style={{ color: selected ? t.head : t.text, fontSize: 15.5, flex: 1 }}>{o.label}</Txt>
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
