/** Вариант ответа (`.opt` эталона): панель с рамкой; верный — рамка и тинт success, неверный
 *  выбранный — рамка danger и приглушение. Вынесен из экрана урока задачей 72 — второй потребитель
 *  (игра «Угадай карту»). Значения — прежние значения урока. */
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export type OptionState = 'idle' | 'ok' | 'no';

export function OptionButton({ label, state, onPress }: { label: string; state: OptionState; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        st.opt,
        { backgroundColor: t.panel, borderColor: t.line },
        // фон верного — success с альфой 0.12 (1F), как rgba(90,160,126,.12) эталона
        state === 'ok' && { borderColor: t.success, backgroundColor: `${t.success}1F` },
        state === 'no' && { borderColor: t.danger, opacity: 0.6 },
      ]}
    >
      <Txt style={[st.optTxt, { color: t.text }]}>{label}</Txt>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  opt: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, marginTop: 9 },
  optTxt: { fontSize: 14, lineHeight: 20 },
});
