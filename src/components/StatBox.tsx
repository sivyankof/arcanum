/** Коробка статистики в профиле — класс `.statbox` эталона: крупное число серифом
 *  и подпись-overline под ним. Иконка рядом с подписью необязательна: у серии это огонёк,
 *  у «карт дня» подписи хватает. Третья коробка (заморозка, снежинка) добавлена задачей 10.
 *
 *  ⚠️ Огонёк — ИКОНКА `Ionicons`, а не эмодзи 🔥, хотя в макете подпись написана эмодзи:
 *  на «Сегодня» серия уже рисуется иконкой (`StreakPill`), и два разных огня в одном
 *  приложении читались бы как небрежность (правка по лайв-проверке 14.08). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fonts, radius } from '../theme/theme';
import { useTheme } from '../theme/useTheme';
import { Txt } from './Txt';

/** Размер огонька под подпись 8.5px: у иконки нет полей эмодзи, поэтому она мельче кегля. */
const ICON_SIZE = 11;

export function StatBox({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  /** Иконка справа от подписи; цвет — accent, как у огонька серии на «Сегодня». */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const t = useTheme();

  return (
    <View style={[st.box, { backgroundColor: t.panel, borderColor: t.line }]}>
      <Txt style={[st.num, { color: t.head }]}>{value}</Txt>
      <View style={st.labelRow}>
        <Txt style={[st.label, { color: t.muted }]}>{label}</Txt>
        {icon && <Ionicons name={icon} size={ICON_SIZE} color={t.accent} />}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.l - 1, // 15 — как `.statbox`
    paddingVertical: 13,
  },
  num: { fontFamily: fonts.display, fontSize: 24 }, // `.statbox b`
  // подпись и иконка стоят в строке; зазор меньше межбуквенного, иначе огонёк «отлипает»
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  // flexShrink: у «ЗАМОРОЗКИ» — самой длинной подписи и единственной с иконкой — при системном
  // «Крупном тексте» iOS текст без права сжаться выдавил бы иконку за пределы коробки
  // (тот же класс, что переполнение LevelCard в задаче 16)
  label: { fontSize: 8.5, letterSpacing: 2, flexShrink: 1 }, // `.statbox small`
});
