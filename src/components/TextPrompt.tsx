/** Диалог ввода одной строки текста (спека 59): подпись, поле, «Отмена» / «Сохранить».
 *
 *  Почему отдельный компонент: диалога с текстовым полем в проекте не было — есть
 *  ConfirmDialog, OptionPicker, TimePicker, DatePicker, а TextInput жил только инлайн
 *  внутри экранов (онбординг, заметка дня, поля расклада, поиск). Геометрия и кнопки —
 *  те же, что у ConfirmDialog, чтобы модалки приложения выглядели одним семейством.
 *
 *  Значение поля живёт в состоянии диалога и сбрасывается на `initial` при каждом открытии:
 *  закрыл «Отменой» — прежний текст остался нетронутым.
 */
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { fonts, radius, spacing } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { noOutline } from '../theme/webInput';
import { ModalPanel } from './ModalPanel';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';

export function TextPrompt({
  visible,
  title,
  initial,
  placeholder,
  maxLength,
  confirmLabel,
  cancelLabel,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** Текущее значение; пустая строка — поля ещё нет */
  initial: string;
  placeholder: string;
  maxLength: number;
  confirmLabel: string;
  cancelLabel: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [value, setValue] = React.useState(initial);

  // диалог не размонтируется между открытиями (Modal живёт в дереве экрана), поэтому
  // значение подтягивается следящим эффектом — иначе второе открытие показало бы
  // недописанный текст прошлого раза
  React.useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  const submit = () => {
    onSubmit(value);
    onClose();
  };

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <Txt style={[st.title, { color: t.head }]}>{title}</Txt>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        maxLength={maxLength}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[
          st.input,
          noOutline,
          { color: t.head, backgroundColor: t.panel, borderColor: t.line },
        ]}
      />
      <View style={st.row}>
        <PressableScale onPress={onClose} style={[st.btn, { borderColor: t.frame }]}>
          <Txt style={[st.btnTxt, { color: t.accent }]}>{cancelLabel}</Txt>
        </PressableScale>
        <PressableScale onPress={submit} style={[st.btn, { borderColor: t.frame }]}>
          <Txt style={[st.btnTxt, { color: t.accent }]}>{confirmLabel}</Txt>
        </PressableScale>
      </View>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: fonts.displaySemi, fontSize: 20, textAlign: 'center' },
  input: {
    marginTop: spacing.l,
    borderWidth: 1,
    borderRadius: radius.m,
    paddingHorizontal: spacing.l,
    paddingVertical: 11,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
  btn: { flex: 1, borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  btnTxt: { fontSize: 12.5, fontWeight: '700' },
});
