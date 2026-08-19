/** Строка-счётчик `.suitrow` эталона (спека 46, design-system §5): слева иконка Ionicons ИЛИ
 *  мини-рубашка `StarBack` 22×36, название, справа «N ИЗ M» капсом с трекингом; опционально шеврон
 *  и onPress. Пять мест одной разметки: четыре строки мастей альбома (без иконки — мини-рубашка,
 *  «14 закрытых карт») и вход «Коллекция» на «Картах» (иконка albums-outline, шеврон, тап → альбом).
 *  Без onPress — обычный View, не PressableScale: пружина обещала бы переход, которого нет
 *  (прецедент ReviewPanel). Глифы мастей 🜂🜄🜁🜃 макета не используются: системный шрифт iOS их
 *  не гарантирует (решение спеки 46). */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PressableScale } from './PressableScale';
import { StarBack } from './StarBack';
import { Txt } from './Txt';

export function CountRow({
  icon,
  title,
  count,
  total,
  chevron,
  onPress,
  style,
}: {
  /** иконка слева; не задана — мини-рубашка со звездой */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  count: number;
  total: number;
  chevron?: boolean;
  onPress?: () => void;
  /** внешние отступы — задаёт вызывающий (8 между строками мастей, 14 у входа на «Картах») */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const body = (
    <>
      {icon ? (
        <Ionicons name={icon} size={17} color={t.accent} />
      ) : (
        <View style={[st.mini, { borderColor: t.line }]}>
          <StarBack starSize={9} />
        </View>
      )}
      <Txt style={[st.title, { color: t.text }]}>{title}</Txt>
      <Txt style={[st.count, { color: t.muted }]}>{tr('collection.ofTotal', { open: count, total })}</Txt>
      {chevron && <Ionicons name="chevron-forward" size={14} color={t.muted} />}
    </>
  );
  const box = [st.row, { backgroundColor: t.panel, borderColor: t.line }, style];

  return onPress ? (
    <PressableScale onPress={onPress} style={box}>
      {body}
    </PressableScale>
  ) : (
    <View style={box}>{body}</View>
  );
}

const st = StyleSheet.create({
  // .suitrow: ряд, gap 12, panel + line, radius 13, паддинг 11/14
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 14 },
  // мини-рубашка вместо глифа `.sg`: пропорция карты, radius 4, бордер line
  mini: { width: 22, height: 36, borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  title: { flex: 1, fontSize: 12.5, fontWeight: '600' }, // .st3
  count: { fontSize: 10, fontWeight: '700', letterSpacing: 1 }, // .sc2
});
