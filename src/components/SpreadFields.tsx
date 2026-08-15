/** Поля экрана расклада (спека 36): вопрос (`.qfield`), панель заметки (`.mean` + `.rnote`) с CTA
 *  и ссылкой «↺ Разложить заново». Пунктир = «можно написать», сплошной = «написано»/только чтение
 *  (паттерн NotePlate). Ввод — инлайн TextInput: на шаге настроя экран короткий, а у заметки
 *  клавиатуру отодвигает ScrollView (automaticallyAdjustKeyboardInsets). */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { NOTE_MAX } from '../lib/journal';
import { QUESTION_MAX } from '../lib/spread';
import { fonts } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { CtaButton } from './CtaButton';
import { Txt } from './Txt';

// в браузере сфокусированное поле получает системную обводку — рядом с рамкой панели она читается второй
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

export function QuestionField({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (text: string) => void;
  editable: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const filled = value.length > 0;
  return (
    <View style={[st.q, { backgroundColor: t.panel, borderColor: t.line, borderStyle: filled || !editable ? 'solid' : 'dashed' }]}>
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={QUESTION_MAX}
          placeholder={tr('spread.question')}
          placeholderTextColor={t.muted}
          textAlignVertical="top"
          style={[st.qInput, { color: t.text }, noOutline]}
        />
      ) : (
        <Txt style={[st.qText, { color: t.text }]}>{value}</Txt>
      )}
    </View>
  );
}

export function NotePanel({
  value,
  onChange,
  editable,
  showActions,
  saved,
  onSave,
  onAgain,
}: {
  value: string;
  onChange: (text: string) => void;
  editable: boolean;
  /** play — CTA и ссылка; view — только текст */
  showActions: boolean;
  saved: boolean;
  onSave: () => void;
  onAgain: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const v = useSharedValue(0);
  React.useEffect(() => {
    v.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }); // `.mean.show`
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 12 }] }));
  const filled = value.length > 0;

  return (
    <Animated.View style={[st.panel, { backgroundColor: t.panel, borderColor: t.line }, anim]}>
      <Txt style={[st.label, { color: t.accent }]}>{tr('spread.noteLabel')}</Txt>
      <View style={[st.field, { borderColor: t.line, borderStyle: filled || !editable ? 'solid' : 'dashed' }]}>
        {editable ? (
          <TextInput
            value={value}
            onChangeText={onChange}
            multiline
            maxLength={NOTE_MAX}
            placeholder={tr('spread.notePlaceholder')}
            placeholderTextColor={t.muted}
            textAlignVertical="top"
            style={[st.input, { color: t.text }, noOutline]}
          />
        ) : (
          <Txt style={[st.text, { color: filled ? t.text : t.muted }]}>{filled ? value : tr('journal.noNote')}</Txt>
        )}
      </View>
      {showActions && <CtaButton label={saved ? tr('spread.savedBtn') : tr('spread.save')} onPress={onSave} disabled={saved} />}
      {showActions && saved && (
        <Pressable onPress={onAgain} style={st.againWrap} hitSlop={8}>
          {/* пунктирное подчёркивание frame — как «изменить можно до полуночи» в Reflection */}
          <Txt style={[st.again, { color: t.accent, borderBottomColor: t.frame }]}>{tr('spread.again')}</Txt>
        </Pressable>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  // `.qfield`: panel + пунктир line, radius 13, паддинг 11×14, отступ 12, 12px
  q: { borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 14, marginTop: 12 },
  qInput: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, padding: 0, minHeight: 17 },
  qText: { fontSize: 12, lineHeight: 17 },
  // `.mean`: radius 18, паддинг 16×18, отступ 14
  panel: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, marginTop: 14 },
  label: { fontSize: 8.5, letterSpacing: 3 },
  // `.rnote`: пунктир line radius 11, паддинг 10×13, отступ 9, 11.5px
  field: { borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13, marginTop: 9 },
  input: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, padding: 0, minHeight: 32 },
  text: { fontSize: 11.5, lineHeight: 16 },
  againWrap: { alignSelf: 'center', marginTop: 10 },
  again: { fontSize: 11.5, letterSpacing: 1, borderBottomWidth: 1, borderStyle: 'dashed' },
});
