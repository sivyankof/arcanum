/** Плашка заметки — «Поле вопроса/заметки» из design-system §5 (`.rnote` эталона).
 *
 *  Два состояния: пусто — ПУНКТИРНАЯ рамка и приглашение цветом muted; написано — сплошная
 *  рамка и сам текст. Пунктир читается как «сюда можно писать», сплошной — как «написано».
 *  Ввод живёт на отдельном экране (app/note/[date].tsx): клавиатура посреди длинного скролла
 *  перекрывает поле, а редактировать заметку нужно ещё и из дневника (спека 05).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hapticTap } from '../lib/haptics';
import { radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function NotePlate({ note, onPress }: { note?: string; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const filled = !!note;

  return (
    <PressableScale
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={[
        st.plate,
        { borderColor: t.line, borderStyle: filled ? 'solid' : 'dashed' },
      ]}
    >
      <Txt
        numberOfLines={filled ? 3 : 1}
        style={[st.text, { color: filled ? t.text : t.muted }]}
      >
        {filled ? note : tr('note.add')}
      </Txt>
    </PressableScale>
  );
}

const st = StyleSheet.create({
  plate: {
    borderWidth: 1,
    borderRadius: radius.m + 1, // 13 — как у `.rnote` эталона
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginTop: spacing.m,
  },
  text: { fontSize: 11.5, lineHeight: 17 },
});
