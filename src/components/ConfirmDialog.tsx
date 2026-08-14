/** Мягкое подтверждение действия — «Уйти без сохранения?» (product-spec §4, спека 05).
 *
 *  Почему не системный `Alert`: в react-native-web `Alert.alert` — пустая заглушка,
 *  на вебе диалог не появился бы вовсе, а экран, задержанный на `beforeRemove`,
 *  вообще не закрылся бы. Свой диалог одинаково работает везде и держит стиль приложения.
 *  Тон кнопок — design-system §8: без «Ошибка!» и приказов.
 *  Без cancelLabel — режим «сообщение» с одной кнопкой (диалоги исхода импорта, спека 11);
 *  скрим тогда закрывает через onConfirm.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { ModalPanel } from './ModalPanel';
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
  confirmTone = 'danger',
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Тон кнопки подтверждения. 'danger' — «удалить / уйти без сохранения» (по умолчанию),
   *  'accent' — когда подтверждение не разрушительное (показ плана пушей, прелюдия разрешения). */
  confirmTone?: 'danger' | 'accent';
}) {
  const t = useTheme();

  return (
    <ModalPanel visible={visible} onClose={onCancel ?? onConfirm}>
      <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
      <Txt style={[st.msg, { color: t.muted }]}>{message}</Txt>
      <View style={st.row}>
        {cancelLabel != null && (
          <PressableScale onPress={onCancel} style={[st.btn, { borderColor: t.frame }]}>
            <Txt style={[st.btnTxt, { color: t.accent }]}>{cancelLabel}</Txt>
          </PressableScale>
        )}
        <PressableScale
          onPress={onConfirm}
          style={[st.btn, { borderColor: confirmTone === 'accent' ? t.frame : t.line }]}
        >
          <Txt style={[st.btnTxt, { color: confirmTone === 'accent' ? t.accent : t.danger }]}>
            {confirmLabel}
          </Txt>
        </PressableScale>
      </View>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.displaySemi, fontSize: 20, textAlign: 'center' },
  msg: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  row: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
  btn: { flex: 1, borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  btnTxt: { fontSize: 12.5, fontWeight: '700' },
});
