/** Мягкое подтверждение действия — «Уйти без сохранения?» (product-spec §4, спека 05).
 *
 *  Почему не системный `Alert`: в react-native-web `Alert.alert` — пустая заглушка,
 *  на вебе диалог не появился бы вовсе, а экран, задержанный на `beforeRemove`,
 *  вообще не закрылся бы. Свой диалог одинаково работает везде и держит стиль приложения.
 *  Тон кнопок — design-system §8: без «Ошибка!» и приказов.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* тап по затемнению = «остаться»: случайный промах не должен терять текст */}
      <Pressable style={st.scrim} onPress={onCancel}>
        <Pressable style={[st.panel, { backgroundColor: t.bg, borderColor: t.line }]} onPress={() => {}}>
          <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
          <Txt style={[st.msg, { color: t.muted }]}>{message}</Txt>
          <View style={st.row}>
            <PressableScale
              onPress={onCancel}
              style={[st.btn, { borderColor: t.frame }]}
            >
              <Txt style={[st.btnTxt, { color: t.accent }]}>{cancelLabel}</Txt>
            </PressableScale>
            <PressableScale onPress={onConfirm} style={[st.btn, { borderColor: t.line }]}>
              <Txt style={[st.btnTxt, { color: t.danger }]}>{confirmLabel}</Txt>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: radius.l,
    padding: spacing.xl,
  },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, textAlign: 'center' },
  msg: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  row: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
  btn: { flex: 1, borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  btnTxt: { fontSize: 12.5, fontWeight: '700' },
});
