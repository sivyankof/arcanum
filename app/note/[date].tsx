/** Экран заметки к карте дня (спека 05). Один экран на три входа: плашка на «Сегодня»,
 *  долгий тап по сегодняшней записи дневника и — после задачи 06 — поле рефлексии.
 *
 *  Ввод вынесен с «Сегодня» сюда, потому что на устройстве клавиатура перекрывает поле
 *  посреди длинного скролла. Правится только сегодняшняя запись (logic-spec §3): для прошлых
 *  дат экран открывается в режиме чтения — страховка от прямой ссылки и от долгого тапа.
 */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { CtaButton } from '../../src/components/CtaButton';
import { ScreenBg } from '../../src/components/ScreenBg';
import { Txt } from '../../src/components/Txt';
import { cardById } from '../../src/lib/content';
import { cardImages } from '../../src/lib/cardImages';
import { formatEntryDate } from '../../src/lib/dates';
import { hapticTap } from '../../src/lib/haptics';
import { useLang } from '../../src/lib/i18n';
import { canEditEntry, normalizeNote, NOTE_MAX } from '../../src/lib/journal';
import { inLang } from '../../src/lib/lang';
import { useLeaveGuard } from '../../src/lib/useLeaveGuard';
import { useApp } from '../../src/store/useApp';
import { fonts, radius, spacing } from '../../src/theme/theme';
import { useTheme } from '../../src/theme/useTheme';

/** С какой длины счётчик подсвечивается: дальше видно, что предел близко. */
const COUNTER_WARN = 450;

export default function NoteScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const t = useTheme();
  const { t: tr } = useTranslation();
  const lang = useLang();
  const insets = useSafeAreaInsets();

  const entry = useApp((s) => s.history.find((h) => h.date === date));
  const setNote = useApp((s) => s.setNote);

  const saved = entry?.note ?? '';
  const [text, setText] = React.useState(saved);

  const editable = !!entry && canEditEntry(date ?? '');
  const dirty = editable && normalizeNote(text) !== saved;
  // перехватывает и кнопку «назад», и свайп-жест закрытия модалки
  const { asking, onCancel, onConfirm, markLeaving } = useLeaveGuard(dirty);

  const onSave = () => {
    hapticTap();
    markLeaving();
    setNote(date ?? '', text);
    router.back();
  };

  const card = entry ? cardById.get(entry.cardId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: tr('note.title') }} />
      <ScreenBg />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {date && <Txt style={[st.date, { color: t.muted }]}>{formatEntryDate(date, lang, 'long').toUpperCase()}</Txt>}

          {card && (
            <View style={st.cardRow}>
              <View style={[st.thumbClip, { borderColor: t.frame }]}>
                <Image source={cardImages[card.id]} style={st.thumb} contentFit="cover" cachePolicy="memory-disk" />
              </View>
              <Txt style={[st.cardName, { color: t.head }]}>{inLang(card.name, lang)}</Txt>
            </View>
          )}

          <TextInput
            value={text}
            onChangeText={setText}
            editable={editable}
            multiline
            autoFocus={editable}
            maxLength={NOTE_MAX}
            placeholder={tr('note.placeholder')}
            placeholderTextColor={t.muted}
            textAlignVertical="top"
            style={[
              st.input,
              { backgroundColor: t.panel, borderColor: t.line, color: t.text },
              // в браузере сфокусированное поле получает системную обводку — на устройстве
              // её нет, и рядом с макетом она читается как вторая рамка
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
            ]}
          />
          <Txt style={[st.counter, { color: text.length >= COUNTER_WARN ? t.accent : t.muted }]}>
            {`${text.length} / ${NOTE_MAX}`}
          </Txt>

          {editable && <CtaButton label={tr('note.save').toUpperCase()} onPress={onSave} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={asking}
        title={tr('note.leaveTitle')}
        message={tr('note.leaveText')}
        confirmLabel={tr('note.leave')}
        cancelLabel={tr('note.stay')}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </View>
  );
}

const st = StyleSheet.create({
  date: { fontSize: 9.5, letterSpacing: 3, textAlign: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginTop: spacing.l },
  thumbClip: { width: 44, height: 72, borderWidth: 1, borderRadius: radius.s - 2, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  cardName: { fontFamily: fonts.display, fontSize: 20, flex: 1 },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.m + 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: spacing.l,
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 24,
  },
  counter: { fontSize: 10.5, textAlign: 'right', marginTop: 6 },
});
