/** Выбор времени напоминания — системный пикер (@react-native-community/datetimepicker,
 *  входит в Expo Go SDK 54). Решение Артёма 12.08: родной жест и минуты важнее единства стиля.
 *  Веб-реализации у пакета нет — она лежит в соседнем TimePicker.web.tsx, Metro подставит его сам.
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { localeTag } from '../lib/lang';
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
  const { t: tr, i18n } = useTranslation();
  const locale = localeTag(i18n.language.startsWith('ru') ? 'ru' : 'en');
  const { hour, minute } = parseHHMM(value, 9);
  const date = React.useMemo(() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [hour, minute]);

  // iOS-колесо (display="spinner") шлёт onChange на КАЖДЫЙ тик прокрутки — это штатное
  // поведение самого пикера (задокументировано в README пакета), а не разовое подтверждение
  // выбора. Поэтому крутить колесо ≠ сохранять: значение копится в черновике и коммитится
  // в onPick только по кнопке «OK». НЕ упрощать обратно на прямой onChange→onPick — так
  // значение будет записываться при каждом движении пальца, и «отмены» не станет вовсе.
  // Android этой проблемы не касается: системный диалог сам присылает onChange один раз,
  // при подтверждении ('set'), поэтому черновик там не нужен — пишем сразу.
  const [draft, setDraft] = React.useState(date);

  // Открыли модалку заново (или сменили входное value, пока она была открыта) — черновик
  // подтягиваем к актуальному сохранённому значению. Без этого повторное открытие показало бы
  // огрызок прошлой прокрутки колеса, а не то, что реально лежит в настройках.
  React.useEffect(() => {
    if (visible) setDraft(date);
  }, [visible, date]);

  const onChangeAndroid = (event: DateTimePickerEvent, picked?: Date) => {
    // Android рисует системный диалог сам: 'dismissed' = отмена, 'set' = выбор — событие одно
    if (event.type === 'dismissed' || !picked) {
      onClose();
      return;
    }
    onPick(formatHHMM(picked.getHours(), picked.getMinutes()));
    onClose();
  };

  const onChangeIOS = (_event: DateTimePickerEvent, picked?: Date) => {
    if (picked) setDraft(picked);
  };

  const confirmIOS = () => {
    onPick(formatHHMM(draft.getHours(), draft.getMinutes()));
    onClose();
  };

  if (!visible) return null;

  // Android: компонент сам открывает системный диалог, обёртка не нужна
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker value={date} mode="time" is24Hour display="default" onChange={onChangeAndroid} />
    );
  }

  // iOS: колесо живёт внутри нашей модалки. Тап по затемнению и аппаратная «назад» уходят
  // через onClose из ModalPanel и ничего не пишут — запись только через кнопку «OK».
  return (
    <ModalPanel visible onClose={onClose}>
      <Txt style={[st.title, { color: t.accent }]}>{title.toUpperCase()}</Txt>
      <DateTimePicker
        value={draft}
        mode="time"
        is24Hour
        display="spinner"
        onChange={onChangeIOS}
        // тема приложения — своя настройка (themeMode в сторе), от системного Light/Dark
        // не зависит; без themeVariant колесо красит текст под СИСТЕМНУЮ тему телефона, и на
        // светлом iOS с тёмной темой приложения получались тёмные цифры на тёмной панели —
        // невидимое колесо (пункт G финального ревью 06б)
        themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
        // язык — та же история, что и тема: своя настройка приложения, системе не видна
        // (разбор — в DatePicker.tsx). Здесь колесо набрано цифрами и при is24Hour почти
        // не зависит от локали, но расходиться поведению двух пикеров незачем
        locale={locale}
      />
      <Pressable onPress={confirmIOS} style={[st.done, { borderColor: t.frame }]}>
        <Txt style={[st.doneTxt, { color: t.accent }]}>{tr('settings.ok')}</Txt>
      </Pressable>
    </ModalPanel>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.m },
  done: { borderWidth: 1, borderRadius: radius.m, paddingVertical: 11, alignItems: 'center' },
  doneTxt: { fontSize: 12.5, fontWeight: '700' },
});
